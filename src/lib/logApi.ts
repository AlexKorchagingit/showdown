import { supabase, logSupabaseError } from './supabase';
import { logFromRow, type LogRow } from './supabaseMap';
import type { ActionLog } from '../types/auditLog';

function asLogRow(data: unknown): LogRow | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !('action_type' in data)) return null;
  return data as LogRow;
}

export async function fetchLogs(): Promise<ActionLog[]> {
  const { data, error } = await supabase.rpc('club_audit_snapshot');

  if (error || !Array.isArray(data)) {
    logSupabaseError(error, 'logs');
    throw new Error('Не удалось загрузить журнал');
  }

  return data.map((item) => {
    const row = asLogRow(item);
    if (!row) throw new Error('Сервер вернул повреждённую запись журнала');
    return logFromRow(row);
  });
}
