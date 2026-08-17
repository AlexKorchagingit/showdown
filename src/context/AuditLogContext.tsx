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
import type { ActionLog } from '../types/auditLog';

interface AuditLogContextValue {
  logs: ActionLog[];
  logAction: (
    adminEmail: string,
    actionType: string,
    description: string,
    targetUserEmail?: string,
  ) => void;
}

const AuditLogContext = createContext<AuditLogContextValue | null>(null);

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<ActionLog[]>(() => loadAuditLogs());

  useEffect(() => subscribeAuditLogs(() => setLogs(loadAuditLogs())), []);

  const logAction = useCallback(
    (
      adminEmail: string,
      actionType: string,
      description: string,
      targetUserEmail?: string,
    ) => {
      persistLogAction(adminEmail, actionType, description, targetUserEmail);
    },
    [],
  );

  const value = useMemo(() => ({ logs, logAction }), [logs, logAction]);

  return <AuditLogContext.Provider value={value}>{children}</AuditLogContext.Provider>;
}

export function useAuditLog() {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAuditLog must be used within AuditLogProvider');
  return ctx;
}

/** `logAction` bound to the signed-in admin email. */
export function useLogAction() {
  const { logAction } = useAuditLog();
  const { email } = useUser();
  return useCallback(
    (actionType: string, description: string, targetUserEmail?: string) => {
      logAction(email, actionType, description, targetUserEmail);
    },
    [logAction, email],
  );
}
