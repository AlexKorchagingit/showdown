import type { Transaction } from '../types/finance';

export function isActiveTransaction(tx: Transaction): boolean {
  return !tx.voidedAt;
}

/** Payment and cancellation are monotonic: late replies cannot undo them in the UI. */
function reconcile(previous: Transaction | undefined, incoming: Transaction): Transaction {
  if (!previous) return incoming;
  if (previous.voidedAt && !incoming.voidedAt) return previous;
  if (previous.status === 'paid' && incoming.status === 'unpaid') {
    return { ...incoming, status: 'paid', updatedAt: previous.updatedAt };
  }
  return incoming;
}

export function mergeTransactionUpdates(previous: Transaction[], incoming: Transaction[]): Transaction[] {
  const rows = new Map(previous.map((row) => [row.id,row]));
  for (const row of incoming) rows.set(row.id,reconcile(rows.get(row.id),row));
  return [...rows.values()];
}

/** Drop entries no longer in the server-authorized snapshot, while rejecting stale states. */
export function reconcileTransactionSnapshot(previous: Transaction[], incoming: Transaction[]): Transaction[] {
  const rows = new Map(previous.map((row) => [row.id,row]));
  return incoming.map((row) => reconcile(rows.get(row.id),row));
}

export function transactionVoidPrompt(tx: Transaction): string {
  const label = tx.type === 'ticket' ? 'билет' : `счёт на ${tx.amount.toLocaleString('ru-RU')} ₽`;
  return `Отменить ${label}? Запись будет исключена из расчётов кассы, но сохранится в истории.\n`
    + (tx.status === 'paid' && tx.amount > 0 ? 'Это отмена записи, НЕ возврат денег.\n' : '')
    + 'Укажите причину отмены (до 1000 символов):';
}
