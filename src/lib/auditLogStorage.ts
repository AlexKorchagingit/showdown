import { AUDIT_LOG_STORAGE_KEY, type ActionLog } from '../types/auditLog';

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
    typeof row.actionType === 'string' &&
    typeof row.description === 'string'
  );
}

function readStoredLogs(): ActionLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActionLog);
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
export function logAction(
  adminEmail: string,
  actionType: string,
  description: string,
  targetUserEmail?: string,
): ActionLog {
  const entry: ActionLog = {
    id: newLogId(),
    timestamp: Date.now(),
    adminEmail,
    actionType,
    description,
    ...(targetUserEmail ? { targetUserEmail } : {}),
  };
  persistAuditLogs([entry, ...loadAuditLogs()].slice(0, MAX_LOGS));
  return entry;
}
