import { supabase } from './supabase';
import { transactionFromRow, transactionToRow, type TransactionRow } from './supabaseMap';
import type { Transaction } from '../types/finance';

function asTransactionRow(data: unknown): TransactionRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('user_id' in data)) return null;
  return data as TransactionRow;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
  if (error || !data) throw new Error(error?.message || 'Не удалось загрузить транзакции');
  return data.flatMap((item) => {
    const row = asTransactionRow(item);
    return row ? [transactionFromRow(row)] : [];
  });
}

export async function insertTransaction(tx: Transaction): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transactionToRow(tx))
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Не удалось создать транзакцию');
  const row = asTransactionRow(data);
  return row ? transactionFromRow(row) : tx;
}

export async function updateTransactions(
  ids: string[],
  patch: Partial<TransactionRow>,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('transactions').update(patch).in('id', ids);
  if (error) throw new Error(error.message);
}

export async function deleteTransactionRow(transactionId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
}
