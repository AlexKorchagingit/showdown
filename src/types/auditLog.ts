export interface ActionLog {
  id: string;
  timestamp: number;
  adminEmail: string;
  /** Display name of the admin who performed the action. */
  adminName: string;
  actionType: string;
  /** Short title shown as the first line in the journal. */
  description: string;
  targetUserEmail?: string;
  /** Player or tournament the action was applied to. */
  targetName?: string;
  /** Second-line payload: amounts, places, before/after values. */
  details?: string;
}

export type LogActionDraft = {
  actionType: string;
  description: string;
  targetUserEmail?: string;
  targetName?: string;
  details?: string;
};

export const AUDIT_LOG_STORAGE_KEY = 'club_audit_logs';
