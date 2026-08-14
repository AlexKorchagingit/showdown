import type { Transaction } from '../types/finance';
import { TRANSACTION_STATUS_LABEL, TRANSACTION_TYPE_LABEL } from '../types/finance';
import { formatTxDate, formatTxTime, ledgerTimestamp } from './transactionDisplay';

function csvEscape(value: string | number | boolean): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export interface ExportToCSVResolvers {
  tournamentTitle: (tournamentId: string) => string;
  playerName: (userId: string) => string;
}

/** Download the current ledger as a CSV file in the browser. */
export function exportToCSV(
  transactions: Transaction[],
  resolvers: ExportToCSVResolvers,
  filename = `showdown-finance-${new Date().toISOString().slice(0, 10)}.csv`,
) {
  const headers = ['Дата', 'Время', 'Турнир', 'Игрок', 'Тип', 'Сумма', 'Статус', 'Комментарий'];

  const rows = transactions.map((tx) => {
    const stamp = ledgerTimestamp(tx);
    return [
      formatTxDate(stamp),
      formatTxTime(stamp),
      resolvers.tournamentTitle(tx.tournamentId),
      resolvers.playerName(tx.userId),
      TRANSACTION_TYPE_LABEL[tx.type],
      tx.amount,
      TRANSACTION_STATUS_LABEL[tx.status],
      tx.comment,
    ]
      .map(csvEscape)
      .join(',');
  });

  const blob = new Blob([`\uFEFF${[headers.join(','), ...rows].join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
