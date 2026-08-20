import { supabase } from './supabase';
import { logFromRow, logToRow, type LogRow } from './supabaseMap';
import type { ActionLog } from '../types/auditLog';

function asLogRow(data: unknown): LogRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('action_type' in data)) return null;
  return data as LogRow;
}

export async function fetchLogs(): Promise<ActionLog[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Failed to load audit logs', error);
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((item) => {
    const row = asLogRow(item);
    return row ? [logFromRow(row)] : [];
  });
}

async function insertLogRow(row: LogRow): Promise<ActionLog | null> {
  const { data, error } = await supabase.from('logs').insert([row]).select('*').single();
  if (!error && data) {
    const parsed = asLogRow(data);
    return parsed ? logFromRow(parsed) : null;
  }
  console.error('Failed to insert audit log', error, row);
  return null;
}

/** Persist one journal row. Retries without FK ids if users/tournaments constraints reject the insert. */
export async function insertAuditLog(log: ActionLog): Promise<ActionLog | null> {
  const row = logToRow(log);
  const saved = await insertLogRow(row);
  if (saved) return saved;

  const withoutFks: LogRow = {
    ...row,
    admin_id: null,
    target_user_id: null,
    target_tournament_id: null,
  };
  if (
    withoutFks.admin_id === row.admin_id &&
    withoutFks.target_user_id === row.target_user_id &&
    withoutFks.target_tournament_id === row.target_tournament_id
  ) {
    return null;
  }

  return insertLogRow(withoutFks);
}
