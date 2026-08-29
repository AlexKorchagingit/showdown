import { supabase, logSupabaseError } from './supabase';
import {
  TIMER_SESSION_LOG_ACTION,
  TIMER_SESSION_LOG_ID,
  TIMER_SESSION_ROW_ID,
  parseTimerSnapshot,
  type TimerSnapshot,
} from './timerSession';

type StorageMode = 'table' | 'logs';

let storageMode: StorageMode | null = null;
let saveChain: Promise<void> = Promise.resolve();

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || /could not find the table/i.test(error.message ?? '');
}

async function resolveStorageMode(): Promise<StorageMode> {
  if (storageMode) return storageMode;
  const { error } = await supabase
    .from('timer_sessions')
    .select('id')
    .eq('id', TIMER_SESSION_ROW_ID)
    .maybeSingle();
  storageMode = error && isMissingTable(error) ? 'logs' : 'table';
  if (error && !isMissingTable(error)) {
    logSupabaseError(error, 'timer session probe');
    storageMode = 'logs';
  }
  return storageMode;
}

async function loadFromTable(): Promise<TimerSnapshot | null> {
  const { data, error } = await supabase
    .from('timer_sessions')
    .select('payload')
    .eq('id', TIMER_SESSION_ROW_ID)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      storageMode = 'logs';
      return loadFromLogs();
    }
    logSupabaseError(error, 'timer session');
    return null;
  }
  return parseTimerSnapshot(data?.payload);
}

async function loadFromLogs(): Promise<TimerSnapshot | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('details')
    .eq('id', TIMER_SESSION_LOG_ID)
    .maybeSingle();
  if (error) {
    logSupabaseError(error, 'timer session log');
    return null;
  }
  return parseTimerSnapshot(data?.details);
}

export async function loadTimerSession(): Promise<TimerSnapshot | null> {
  const mode = await resolveStorageMode();
  return mode === 'table' ? loadFromTable() : loadFromLogs();
}

async function saveToTable(snapshot: TimerSnapshot): Promise<boolean> {
  const { error } = await supabase.from('timer_sessions').upsert(
    { id: TIMER_SESSION_ROW_ID, payload: snapshot },
    { onConflict: 'id' },
  );
  if (!error) return true;
  if (isMissingTable(error)) {
    storageMode = 'logs';
    return saveToLogs(snapshot);
  }
  logSupabaseError(error, 'save timer session');
  return false;
}

async function saveToLogs(snapshot: TimerSnapshot): Promise<boolean> {
  const { error } = await supabase.from('logs').upsert(
    {
      id: TIMER_SESSION_LOG_ID,
      timestamp: new Date().toISOString(),
      admin_id: null,
      admin_email: 'timer@showdown.internal',
      admin_name: 'Timer',
      action_type: TIMER_SESSION_LOG_ACTION,
      target_user_id: null,
      target_user_email: null,
      target_user_name: null,
      target_tournament_id: null,
      target_tournament_name: null,
      details: JSON.stringify(snapshot),
    },
    { onConflict: 'id' },
  );
  if (!error) return true;
  logSupabaseError(error, 'save timer session log');
  return false;
}

export function queueTimerSessionSave(snapshot: TimerSnapshot): void {
  saveChain = saveChain
    .then(async () => {
      const mode = await resolveStorageMode();
      if (mode === 'table') {
        await saveToTable(snapshot);
        return;
      }
      await saveToLogs(snapshot);
    })
    .catch((error) => {
      console.error(error);
    });
}

export async function timerSessionStorageMode(): Promise<StorageMode> {
  return resolveStorageMode();
}
