export interface ActionLog {
  id: string;
  timestamp: number;
  adminEmail: string;
  actionType: string;
  description: string;
  targetUserEmail?: string;
}

export const AUDIT_LOG_STORAGE_KEY = 'club_audit_logs';
