import { supabase, logSupabaseError } from './supabase';
import {
  BLIND_STRUCTURES_LOG_ACTION,
  BLIND_STRUCTURES_LOG_ID,
  BLIND_STRUCTURES_ROW_ID,
  parseBlindStructuresSnapshot,
  type BlindStructuresSnapshot,
} from './blindStructuresSync';
import { timerSessionStorageMode } from './timerSessionApi';

let saveChain: Promise<void> = Promise.resolve();

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || /could not find the table/i.test(error.message ?? '');
}

async function loadFromTable(): Promise<BlindStructuresSnapshot | null> {
  const { data, error } = await supabase
    .from('timer_sessions')
    .select('payload')
    .eq('id', BLIND_STRUCTURES_ROW_ID)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      return loadFromLogs();
    }
    logSupabaseError(error, 'blind structures');
    return null;
  }
  return parseBlindStructuresSnapshot(data?.payload);
}

async function loadFromLogs(): Promise<BlindStructuresSnapshot | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('details')
    .eq('id', BLIND_STRUCTURES_LOG_ID)
    .maybeSingle();
  if (error) {
    logSupabaseError(error, 'blind structures log');
    return null;
  }
  return parseBlindStructuresSnapshot(data?.details);
}

export async function loadBlindStructuresSnapshot(): Promise<BlindStructuresSnapshot | null> {
  const mode = await timerSessionStorageMode();
  return mode === 'table' ? loadFromTable() : loadFromLogs();
}

async function saveToTable(snapshot: BlindStructuresSnapshot): Promise<boolean> {
  const { error } = await supabase.from('timer_sessions').upsert(
    { id: BLIND_STRUCTURES_ROW_ID, payload: snapshot },
    { onConflict: 'id' },
  );
  if (!error) return true;
  if (isMissingTable(error)) {
    return saveToLogs(snapshot);
  }
  logSupabaseError(error, 'save blind structures');
  return false;
}

async function saveToLogs(snapshot: BlindStructuresSnapshot): Promise<boolean> {
  const { error } = await supabase.from('logs').upsert(
    {
      id: BLIND_STRUCTURES_LOG_ID,
      timestamp: new Date().toISOString(),
      admin_id: null,
      admin_email: 'blinds@showdown.internal',
      admin_name: 'Blinds',
      action_type: BLIND_STRUCTURES_LOG_ACTION,
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
  logSupabaseError(error, 'save blind structures log');
  return false;
}

export function queueBlindStructuresSave(snapshot: BlindStructuresSnapshot): void {
  saveChain = saveChain
    .then(async () => {
      const mode = await timerSessionStorageMode();
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
