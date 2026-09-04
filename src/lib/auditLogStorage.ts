import type { ActionLog } from '../types/auditLog';

export function logActionLabel(log: ActionLog): string {
  if (log.description && log.description !== log.actionType) return log.description;
  return log.actionType;
}

export function logTargetLabel(log: ActionLog): string | undefined {
  const parts: string[] = [];
  const user = log.targetUserName || log.targetUserEmail;
  if (user) parts.push(`Пользователь: ${user}`);
  if (log.targetTournamentName) parts.push(`Турнир: ${log.targetTournamentName}`);
  if (parts.length === 0 && log.targetName) parts.push(log.targetName);
  return parts.length ? parts.join(' / ') : undefined;
}
