/** Calendar date from a transaction ISO timestamp (DD.MM.YYYY). */
export function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Clock time from a transaction ISO timestamp (HH:MM). */
export function formatTxTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Date + time for dealer hour logs. */
export function formatTxDateTime(iso: string): string {
  return `${formatTxDate(iso)} ${formatTxTime(iso)}`;
}

/** Paid txs use updatedAt (settlement time); unpaid use the original charge date. */
export function ledgerTimestamp(tx: { status: string; date: string; updatedAt?: string }): string {
  return tx.status === 'paid' ? (tx.updatedAt ?? tx.date) : tx.date;
}
