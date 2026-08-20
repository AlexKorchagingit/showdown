import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import { logFromRow, type LogRow } from './supabaseMap';
import type { ActionLog } from '../types/auditLog';

function asLogRow(data: unknown): LogRow | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const id = row.id;
  const action = row.action_type ?? row.actionType;
  if (typeof id !== 'string' || typeof action !== 'string') return null;
  const timestamp = row.timestamp ?? row.created_at;
  return {
    id,
    timestamp: typeof timestamp === 'string' ? timestamp : new Date().toISOString(),
    admin_id: typeof row.admin_id === 'string' ? row.admin_id : null,
    admin_email: typeof row.admin_email === 'string' ? row.admin_email : '',
    admin_name: typeof row.admin_name === 'string' ? row.admin_name : '',
    action_type: action,
    target_user_id: typeof row.target_user_id === 'string' ? row.target_user_id : null,
    target_user_email: typeof row.target_user_email === 'string' ? row.target_user_email : null,
    target_user_name: typeof row.target_user_name === 'string' ? row.target_user_name : null,
    target_tournament_id: typeof row.target_tournament_id === 'string' ? row.target_tournament_id : null,
    target_tournament_name: typeof row.target_tournament_name === 'string' ? row.target_tournament_name : null,
    details: typeof row.details === 'string' ? row.details : null,
  };
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

let lastLogError: string | null = null;

export function getLastLogError(): string | null {
  return lastLogError;
}

/**
 * Journal row for PostgREST. Foreign-key id columns are omitted on purpose:
 * `logs_admin_id_fkey` / `logs_target_user_id_fkey` reject session ids that are
 * not already in `users`, and the UI already stores names/emails on the row.
 */
export function buildLogInsertPayload(input: AddLogInput): Record<string, string> {
  const payload: Record<string, string> = {
    admin_email: input.admin_email.trim().toLowerCase() || 'unknown',
    admin_name: input.admin_name?.trim() || '',
    action_type: input.action_type.trim(),
  };
  const targetEmail = emptyToNull(input.target_user_email);
  if (targetEmail) payload.target_user_email = targetEmail.toLowerCase();
  const targetName = emptyToNull(input.target_user_name);
  if (targetName) payload.target_user_name = targetName;
  const tournamentName = emptyToNull(input.target_tournament_name);
  if (tournamentName) payload.target_tournament_name = tournamentName;
  const details = emptyToNull(input.details);
  if (details) payload.details = details;
  return payload;
}

export async function fetchLogs(): Promise<ActionLog[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    lastLogError = error.message;
    console.error('SUPABASE LOG ERROR:', error);
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((item) => {
    const row = asLogRow(item);
    return row ? [logFromRow(row)] : [];
  });
}

async function postLogRow(payload: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${supabaseUrl}/rest/v1/logs`, {
    method: 'POST',
    cache: 'no-store',
    keepalive: true,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok || response.status === 201) {
    return { ok: true };
  }

  const body = await response.text();
  return { ok: false, error: `${response.status} ${body || response.statusText}` };
}

/**
 * Insert one journal row. Does not touch React state.
 * Returns true only when Postgres accepted the insert.
 */
export async function addLog(input: AddLogInput): Promise<boolean> {
  const payload = buildLogInsertPayload(input);
  if (!payload.action_type) {
    lastLogError = 'Пустой action_type';
    console.error('SUPABASE LOG ERROR:', lastLogError);
    return false;
  }

  const first = await postLogRow(payload);
  if (first.ok) {
    lastLogError = null;
    return true;
  }

  console.error('SUPABASE LOG ERROR:', first.error);

  const minimal = {
    admin_email: payload.admin_email,
    admin_name: payload.admin_name,
    action_type: payload.action_type,
    ...(payload.details ? { details: payload.details } : {}),
  };
  const retry = await postLogRow(minimal);
  if (retry.ok) {
    lastLogError = null;
    return true;
  }

  lastLogError = retry.error || first.error || 'Не удалось записать лог';
  console.error('SUPABASE LOG ERROR:', lastLogError);
  return false;
}
