import type { ActionLog, LogActionDraft } from '../types/auditLog';
import { addLog } from './logApi';
import { findClubUser } from './clubDirectory';
import { adminAccount, adminDisplayName } from './playerName';
import { readSessionUserId } from './session';

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

/** @deprecated Prefer `addLog` from `logApi`. Kept for login consent and camelCase call sites. */
export async function logAction(
  adminEmail: string,
  draft: LogActionDraft,
  actor?: LogActor,
): Promise<boolean> {
  const admin = findClubUser({ email: adminEmail }) ?? adminAccount(adminEmail);
  const sessionId = readSessionUserId();
  const directoryId = findClubUser({ email: adminEmail })?.id;
  const adminId = actor?.adminId || sessionId || directoryId || null;

  return addLog({
    admin_id: adminId,
    admin_email: admin.email || adminEmail,
    admin_name: actor?.adminName || admin.nickname || adminDisplayName(adminEmail),
    action_type: draft.actionType,
    target_user_id: draft.targetUserId ?? null,
    target_user_email: draft.targetUserEmail ?? null,
    target_user_name: draft.targetUserName ?? null,
    target_tournament_id: draft.targetTournamentId ?? null,
    target_tournament_name: draft.targetTournamentName ?? null,
    details: draft.details ?? null,
  });
}
