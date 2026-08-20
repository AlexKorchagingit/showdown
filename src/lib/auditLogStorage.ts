import { AUDIT_LOG_STORAGE_KEY, type ActionLog, type LogActionDraft } from '../types/auditLog';
import { adminAccount, adminDisplayName } from './playerName';

const MAX_LOGS = 2000;

const listeners = new Set<() => void>();
let memoryLogs: ActionLog[] | null = null;

function newLogId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isActionLog(value: unknown): value is ActionLog {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ActionLog>;
  return (
    typeof row.id === 'string' &&
    typeof row.timestamp === 'number' &&
    typeof row.adminEmail === 'string' &&
    typeof row.actionType === 'string'
  );
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

function readStoredLogs(): ActionLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActionLog).map(normalizeLog);
  } catch {
    return [];
  }
}

export function loadAuditLogs(): ActionLog[] {
  if (memoryLogs) return memoryLogs;
  memoryLogs = readStoredLogs();
  return memoryLogs;
}

function persistAuditLogs(logs: ActionLog[]) {
  memoryLogs = logs;
  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    /* Quota or private mode — keep the in-memory journal. */
  }
  listeners.forEach((listener) => listener());
}

export function subscribeAuditLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Append an admin action to `club_audit_logs` (newest first). */
export function logAction(adminEmail: string, draft: LogActionDraft): ActionLog {
  const admin = adminAccount(adminEmail);
  const entry: ActionLog = {
    id: newLogId(),
    timestamp: Date.now(),
    adminId: admin.id,
    adminEmail: admin.email || adminEmail,
    adminName: admin.nickname,
    actionType: draft.actionType,
    ...(draft.targetUserId ? { targetUserId: draft.targetUserId } : {}),
    ...(draft.targetUserEmail ? { targetUserEmail: draft.targetUserEmail } : {}),
    ...(draft.targetUserName ? { targetUserName: draft.targetUserName } : {}),
    ...(draft.targetTournamentId ? { targetTournamentId: draft.targetTournamentId } : {}),
    ...(draft.targetTournamentName ? { targetTournamentName: draft.targetTournamentName } : {}),
    ...(draft.details ? { details: draft.details } : {}),
  };
  persistAuditLogs([entry, ...loadAuditLogs()].slice(0, MAX_LOGS));
  return entry;
}
