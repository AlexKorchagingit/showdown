import type { ActionLog } from '../types/auditLog';
import type { Transaction } from '../types/finance';
import { TRANSACTION_STATUS_LABEL, TRANSACTION_TYPE_LABEL } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { formatIsoDay } from './financePeriod';
import { formatTxDate, formatTxTime, ledgerTimestamp } from './transactionDisplay';
import { compareByStart } from './tournamentStatus';

function csvEscape(value: string | number | boolean, delimiter = ','): string {
  const raw = String(value ?? '');
  if (raw.includes('"') || raw.includes('\n') || raw.includes('\r') || raw.includes(delimiter)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean)[][],
  delimiter = ',',
) {
  const lines = [
    headers.map((value) => csvEscape(value, delimiter)).join(delimiter),
    ...rows.map((row) => row.map((value) => csvEscape(value, delimiter)).join(delimiter)),
  ];
  // `sep=` makes Excel (including ru-RU, where `;` is the list separator) keep columns aligned.
  const sepLine = delimiter === ';' ? `sep=${delimiter}\n` : '';
  const blob = new Blob([`\uFEFF${sepLine}${lines.join('\n')}`], {
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
  const headers = ['Time', 'AdminId', 'Admin', 'AdminEmail', 'Action', 'User', 'UserId', 'Tournament', 'TournamentId', 'Details'];
  const rows = logs.map((log) => {
    const stamp = new Date(log.timestamp).toISOString();
    return [
      `${formatTxDate(stamp)} ${formatTxTime(stamp)}`,
      log.adminId,
      log.adminName,
      log.adminEmail,
      log.actionType,
      log.targetUserName ?? '',
      log.targetUserId ?? '',
      log.targetTournamentName ?? '',
      log.targetTournamentId ?? '',
      log.details ?? '',
    ];
  });
  downloadCsv(filename, headers, rows);
}

function formatExportDate(startDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((startDate ?? '').trim());
  if (!match) return (startDate ?? '').trim() || '—';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function formatExportTime(startTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((startTime ?? '').trim());
  if (!match) return (startTime ?? '').trim() || '—';
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function formatExportFeatures(features: string[] | undefined): string {
  return (features ?? [])
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(', ');
}

export function tournamentExportFilename(
  fromIsoDay: string,
  toIsoDay: string,
  now = new Date(),
): string {
  const from = fromIsoDay.trim();
  const to = toIsoDay.trim();
  if (from && to) return `showdown-tournaments-${from}-${to}.csv`;
  if (from) return `showdown-tournaments-from-${from}.csv`;
  if (to) return `showdown-tournaments-until-${to}.csv`;
  return `showdown-tournaments-${formatIsoDay(now)}.csv`;
}

/** Download tournament rows as Excel-friendly CSV (UTF-8 BOM). */
export function exportTournamentsToCSV(
  tournaments: Pick<Tournament, 'title' | 'startDate' | 'startTime' | 'features'>[],
  filename?: string,
) {
  const headers = ['Название', 'Дата', 'Время начала', 'Особенности'];
  const rows = [...tournaments].sort(compareByStart).map((tournament) => [
    tournament.title.trim(),
    formatExportDate(tournament.startDate),
    formatExportTime(tournament.startTime),
    formatExportFeatures(tournament.features),
  ]);
  downloadCsv(filename ?? tournamentExportFilename('', ''), headers, rows, ';');
}
