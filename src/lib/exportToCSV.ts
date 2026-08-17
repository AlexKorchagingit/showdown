import type { ActionLog } from '../types/auditLog';
import type { Transaction } from '../types/finance';
import { TRANSACTION_STATUS_LABEL, TRANSACTION_TYPE_LABEL } from '../types/finance';
import { formatTxDate, formatTxTime, ledgerTimestamp } from './transactionDisplay';

function csvEscape(value: string | number | boolean): string {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean)[][]) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
    ];
  });

  downloadCsv(filename, headers, rows);
}

/** Download filtered audit journal rows as Excel-friendly CSV. */
export function exportAuditLogsToCSV(
  logs: ActionLog[],
  filename = `showdown-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
) {
  const headers = ['Date', 'Time', 'Admin', 'AdminName', 'Action', 'Description', 'Target', 'Details', 'TargetUser'];
  const rows = logs.map((log) => {
    const stamp = new Date(log.timestamp).toISOString();
    return [
      formatTxDate(stamp),
      formatTxTime(stamp),
      log.adminEmail,
      log.adminName,
      log.actionType,
      log.description,
      log.targetName ?? '',
      log.details ?? '',
      log.targetUserEmail ?? '',
    ];
  });
  downloadCsv(filename, headers, rows);
}
