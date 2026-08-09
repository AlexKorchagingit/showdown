import type { Transaction } from '../types/finance';
import { TRANSACTION_TYPE_LABEL } from '../types/finance';

function csvEscape(value: string | number | boolean): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

/** Download the current ledger as a CSV file in the browser. */
export function exportToCSV(
  transactions: Transaction[],
  filename = `showdown-finance-${new Date().toISOString().slice(0, 10)}.csv`,
) {
  const headers = [
    'id',
    'date',
    'tournamentId',
    'userId',
    'type',
    'typeLabel',
    'amount',
    'status',
    'comment',
    'isDealer',
    'dealerHours',
  ];

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.date,
      tx.tournamentId,
      tx.userId,
      tx.type,
      TRANSACTION_TYPE_LABEL[tx.type],
      tx.amount,
      tx.status,
      tx.comment,
      tx.isDealer,
      tx.dealerHours,
    ]
      .map(csvEscape)
      .join(','),
  );

  const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
