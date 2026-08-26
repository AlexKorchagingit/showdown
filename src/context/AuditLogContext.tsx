import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { addLog, fetchLogs } from '../lib/logApi';
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
      console.error('SUPABASE LOG ERROR:', error);
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
      const ok = await addLog({
        admin_id: userId || account?.id || null,
        admin_email: email,
        admin_name: account?.nickname ?? '',
        action_type: draft.actionType,
        target_user_id: draft.targetUserId ?? null,
        target_user_email: draft.targetUserEmail ?? null,
        target_user_name: draft.targetUserName ?? null,
        target_tournament_id: draft.targetTournamentId ?? null,
        target_tournament_name: draft.targetTournamentName ?? null,
        details: draft.details ?? null,
      });
      if (!ok) return;
      await refreshLogs();
    },
    [account?.id, account?.nickname, email, refreshLogs, userId],
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

export function useLogAction() {
  const { logAction } = useAuditLog();
  return logAction;
}
