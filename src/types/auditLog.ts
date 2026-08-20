export interface ActionLog {
  id: string;
  timestamp: number;
  adminId: string;
  adminEmail: string;
  adminName: string;
  actionType: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  targetTournamentId?: string;
  targetTournamentName?: string;
  details?: string;
  /** @deprecated Kept so older localStorage rows still parse. */
  description?: string;
  /** @deprecated Older rows stored a single target label here. */
  targetName?: string;
}

export type LogActionDraft = {
  actionType: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  targetTournamentId?: string;
  targetTournamentName?: string;
  details?: string;
};

export const AUDIT_LOG_STORAGE_KEY = 'club_audit_logs';
