import { supabase, logSupabaseError } from './supabase';
import { transactionFromRow, type TransactionRow } from './supabaseMap';
import type { Transaction, TransactionType } from '../types/finance';

function asTransactionRow(data: unknown): TransactionRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('user_id' in data)) return null;
  return data as TransactionRow;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
  if (error || !data) {
    logSupabaseError(error, 'transactions');
    throw new Error(error?.message || 'Не удалось загрузить транзакции');
  }
  return data.flatMap((item) => {
    const row = asTransactionRow(item);
    return row ? [transactionFromRow(row)] : [];
  });
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
  if (rows.length !== expected.size || rows.some((row) => !expected.delete(row!.id) || row!.status !== 'paid')) {
    throw new Error('Сервер не подтвердил оплату всех счетов');
  }
  return rows.map((row) => transactionFromRow(row!));
}

export async function deleteTransactionRow(transactionId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  if (error) {
    logSupabaseError(error, 'delete transaction');
    throw new Error(error.message);
  }
}

export async function updateDealerHoursRows(
  tournamentId: string,
  userId: string,
  hours: number,
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ dealer_hours: hours, is_dealer: hours > 0 })
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  if (error) {
    logSupabaseError(error, 'dealer hours');
    throw new Error(error.message);
  }
}
