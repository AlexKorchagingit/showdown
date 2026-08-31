import { supabase, logSupabaseError } from './supabase';
import { logFromRow, type LogRow } from './supabaseMap';
import type { ActionLog } from '../types/auditLog';
import { TIMER_SESSION_LOG_ACTION, TIMER_SESSION_LOG_ID } from './timerSession';
import { BLIND_STRUCTURES_LOG_ACTION, BLIND_STRUCTURES_LOG_ID } from './blindStructuresSync';

function asLogRow(data: unknown): LogRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('action_type' in data)) return null;
  return data as LogRow;
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === 'me') return null;
  return trimmed;
}

/** Payload written to `public.logs`. Keys MUST stay snake_case. */
export type AddLogInput = {
  admin_id?: string | null;
  admin_email: string;
  admin_name?: string | null;
  action_type: string;
  target_user_id?: string | null;
  target_user_email?: string | null;
  target_user_name?: string | null;
  target_tournament_id?: string | null;
  target_tournament_name?: string | null;
  details?: string | null;
};

export async function fetchLogs(): Promise<ActionLog[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    logSupabaseError(error, 'logs');
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((item) => {
    const row = asLogRow(item);
    if (!row) return [];
    if (row.id === TIMER_SESSION_LOG_ID || row.action_type === TIMER_SESSION_LOG_ACTION) return [];
    if (row.id === BLIND_STRUCTURES_LOG_ID || row.action_type === BLIND_STRUCTURES_LOG_ACTION) return [];
    return [logFromRow(row)];
  });
}

/**
 * Insert one journal row. Does not touch React state.
 * Returns true only when Postgres accepted the insert.
 */
export async function addLog(input: AddLogInput): Promise<boolean> {
  const payload = {
    admin_id: emptyToNull(input.admin_id),
    admin_email: input.admin_email.trim().toLowerCase(),
    admin_name: input.admin_name?.trim() || '',
    action_type: input.action_type,
    target_user_id: emptyToNull(input.target_user_id),
    target_user_email: emptyToNull(input.target_user_email),
    target_user_name: emptyToNull(input.target_user_name),
    target_tournament_id: emptyToNull(input.target_tournament_id),
    target_tournament_name: emptyToNull(input.target_tournament_name),
    details: emptyToNull(input.details),
  };

  const { error } = await supabase.from('logs').insert([payload]);
  if (!error) return true;
  logSupabaseError(error, 'insert log');

  const fkFailed = Boolean(
    payload.admin_id || payload.target_user_id || payload.target_tournament_id,
  );
  if (!fkFailed) return false;

  const { error: retryError } = await supabase.from('logs').insert([
    {
      ...payload,
      admin_id: null,
      target_user_id: null,
      target_tournament_id: null,
    },
  ]);
  if (retryError) {
    logSupabaseError(retryError, 'logs retry');
    return false;
  }
  return true;
}
