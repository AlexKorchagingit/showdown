import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { logAction as persistLogAction } from '../lib/auditLogStorage';
import { fetchLogs } from '../lib/logApi';
import { useUser } from './UserContext';
import type { ActionLog, LogActionDraft } from '../types/auditLog';

interface AuditLogContextValue {
  logs: ActionLog[];
  isLoading: boolean;
  refreshLogs: () => Promise<void>;
  logAction: (draft: LogActionDraft) => Promise<void>;
}

const AuditLogContext = createContext<AuditLogContextValue | null>(null);

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const { email, userId, account } = useUser();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await fetchLogs();
      setLogs(rows);
    } catch (error) {
      console.error(error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  const logAction = useCallback(
    async (draft: LogActionDraft) => {
      const saved = await persistLogAction(email, draft, {
        adminId: userId || account?.id,
        adminName: account?.nickname,
      });
      if (!saved) return;
      setLogs((prev) => [saved, ...prev.filter((row) => row.id !== saved.id)]);
    },
    [account?.id, account?.nickname, email, userId],
  );

  const value = useMemo(
    () => ({ logs, isLoading, refreshLogs, logAction }),
    [isLoading, logAction, logs, refreshLogs],
  );

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
