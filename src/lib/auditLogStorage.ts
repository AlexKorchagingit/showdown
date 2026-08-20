import type { ActionLog, LogActionDraft } from '../types/auditLog';
import { findClubUser } from './clubDirectory';
import { insertAuditLog } from './logApi';
import { adminAccount, adminDisplayName } from './playerName';
import { readSessionUserId } from './session';

function newLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeLog(row: ActionLog): ActionLog {
  const admin = adminAccount(row.adminEmail);
  return {
    ...row,
    adminId: row.adminId || admin.id,
    adminName: row.adminName || adminDisplayName(row.adminEmail),
    targetUserName: row.targetUserName || undefined,
    targetTournamentName: row.targetTournamentName || undefined,
    details: row.details || undefined,
  };
}

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

export type LogActor = {
  adminId?: string;
  adminName?: string;
};

/** Append an admin/user action to the `logs` table (newest first in the UI). */
export async function logAction(
  adminEmail: string,
  draft: LogActionDraft,
  actor?: LogActor,
): Promise<ActionLog | null> {
  const admin = findClubUser({ email: adminEmail }) ?? adminAccount(adminEmail);
  const adminId = actor?.adminId || readSessionUserId() || admin.id;
  const entry: ActionLog = {
    id: newLogId(),
    timestamp: Date.now(),
    adminId,
    adminEmail: admin.email || adminEmail,
    adminName: actor?.adminName || admin.nickname,
    actionType: draft.actionType,
    ...(draft.targetUserId ? { targetUserId: draft.targetUserId } : {}),
    ...(draft.targetUserEmail ? { targetUserEmail: draft.targetUserEmail } : {}),
    ...(draft.targetUserName ? { targetUserName: draft.targetUserName } : {}),
    ...(draft.targetTournamentId ? { targetTournamentId: draft.targetTournamentId } : {}),
    ...(draft.targetTournamentName ? { targetTournamentName: draft.targetTournamentName } : {}),
    ...(draft.details ? { details: draft.details } : {}),
  };

  return insertAuditLog(normalizeLog(entry));
}
