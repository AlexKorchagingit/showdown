import { supabase } from './supabase';
import { transactionFromRow, type TransactionRow } from './supabaseMap';
import type { Transaction, TransactionType } from '../types/finance';
import type { DealerHours, DealerHoursInput } from './dealerHours';

function asTransactionRow(data: unknown): TransactionRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('user_id' in data)) return null;
  const row = data as Record<string,unknown>;
  if (row.voided_at != null && (typeof row.voided_at !== 'string' || !Number.isFinite(Date.parse(row.voided_at)))) return null;
  if (row.void_reason != null && typeof row.void_reason !== 'string') return null;
  return data as TransactionRow;
}

function dealerHoursFromRow(data: unknown): DealerHours {
  if (!data || typeof data !== 'object') throw new Error('Сервер не подтвердил часы дилера');
  const row = data as Record<string, unknown>;
  if (typeof row.tournament_id !== 'string' || !row.tournament_id || typeof row.user_id !== 'string' || !row.user_id
    || typeof row.hours !== 'number' || !Number.isFinite(row.hours) || row.hours < 0
    || !Number.isSafeInteger(row.revision) || (row.revision as number) < 0
    || (row.logged_at !== null && (typeof row.logged_at !== 'string' || !Number.isFinite(Date.parse(row.logged_at))))) {
    throw new Error('Сервер не подтвердил часы дилера');
  }
  return { tournamentId: row.tournament_id, userId: row.user_id, hours: row.hours,
    revision: row.revision as number, loggedAt: row.logged_at as string | null ?? undefined };
}

export async function fetchFinanceSnapshot(): Promise<{ transactions: Transaction[]; dealerHours: DealerHours[] }> {
  const { data, error } = await supabase.rpc('club_finance_snapshot');
  if (error || !data || !Array.isArray(data.transactions) || !Array.isArray(data.dealer_hours)) {
    throw new Error('Не удалось загрузить финансы и часы дилеров');
  }
  const rows = data.transactions.map(asTransactionRow) as (TransactionRow | null)[];
  if (rows.some((row) => !row)) throw new Error('Не удалось подтвердить финансовые данные');
  return { transactions: rows.map((row) => transactionFromRow(row!)),
    dealerHours: data.dealer_hours.map(dealerHoursFromRow) };
}

export type CreateChargeInput = {
  requestId: string;
  tournamentId: string;
  userId: string;
  type: TransactionType;
  comment?: string;
};

export async function createCharge(input: CreateChargeInput): Promise<Transaction> {
  const { data, error } = await supabase.rpc('club_create_charge', {
    p_request_id: input.requestId,
    p_tournament_id: input.tournamentId,
    p_user_id: input.userId,
    p_type: input.type,
    p_comment: input.comment?.trim() ?? '',
  });
  if (error) throw new Error('Не удалось подтвердить создание счёта. Повторите действие: будет отправлен тот же запрос.');
  const row = asTransactionRow(data);
  if (!row) throw new Error('Сервер не подтвердил создание счёта');
  return transactionFromRow(row);
}

export async function markTransactionsPaid(ids: string[]): Promise<Transaction[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('club_mark_paid', { p_transaction_ids: ids });
  if (error || !Array.isArray(data)) throw new Error('Не удалось подтвердить оплату');
  const rows = data.map(asTransactionRow);
  if (rows.some((row) => row === null)) throw new Error('Сервер не подтвердил оплату');
  const expected = new Set(ids);
  if (rows.length !== expected.size || rows.some((row) => !expected.delete(row!.id) || row!.status !== 'paid' || row!.voided_at)) {
    throw new Error('Сервер не подтвердил оплату всех счетов');
  }
  return rows.map((row) => transactionFromRow(row!));
}

export async function voidTransactionOnServer(transactionId: string, reason: string): Promise<Transaction> {
  const normalized = reason.trim();
  if (!transactionId.trim() || !normalized || normalized.length > 1000) throw new Error('Укажите причину отмены: от 1 до 1000 символов');
  const { data, error } = await supabase.rpc('club_void_transaction', { p_transaction_id: transactionId, p_reason: normalized });
  if (error) throw new Error('Не удалось подтвердить отмену. Повторите отмену этой же записи или обновите кассу.');
  const row = asTransactionRow(data);
  if (!row || row.id !== transactionId || !row.voided_at) throw new Error('Сервер не подтвердил отмену записи');
  return transactionFromRow(row);
}

export async function adjustDealerHoursOnServer(input: DealerHoursInput): Promise<DealerHours> {
  if (input.delta !== 0.5 && input.delta !== -0.5) throw new Error('Изменяйте часы шагом в полчаса');
  const { data, error } = await supabase.rpc('club_adjust_dealer_hours', {
    p_request_id: input.requestId, p_tournament_id: input.tournamentId,
    p_user_id: input.userId, p_delta: input.delta,
  });
  if (error) throw new Error('Не удалось подтвердить часы. Повторите то же действие в этой вкладке: будет отправлен прежний запрос.');
  const saved = dealerHoursFromRow(data);
  if (saved.tournamentId !== input.tournamentId || saved.userId !== input.userId) {
    throw new Error('Сервер вернул часы другого участника');
  }
  return saved;
}
