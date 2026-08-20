import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadAuditLogs, logAction as persistLogAction, subscribeAuditLogs } from '../lib/auditLogStorage';
import { useUser } from './UserContext';
import type { ActionLog, LogActionDraft } from '../types/auditLog';

interface AuditLogContextValue {
  logs: ActionLog[];
  logAction: (draft: LogActionDraft) => void;
}

const AuditLogContext = createContext<AuditLogContextValue | null>(null);

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const { email } = useUser();
  const [logs, setLogs] = useState<ActionLog[]>(() => loadAuditLogs());

  useEffect(() => subscribeAuditLogs(() => setLogs(loadAuditLogs())), []);

  const logAction = useCallback(
    (draft: LogActionDraft) => {
      persistLogAction(email, draft);
    },
    [email],
  );

  const value = useMemo(() => ({ logs, logAction }), [logs, logAction]);

  return <AuditLogContext.Provider value={value}>{children}</AuditLogContext.Provider>;
}

export function useAuditLog() {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAuditLog must be used within AuditLogProvider');
  return ctx;
}

/** `logAction` bound to the signed-in admin. */
export function useLogAction() {
  const { logAction } = useAuditLog();
  return logAction;
}
