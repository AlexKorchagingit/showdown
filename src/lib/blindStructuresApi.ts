import { supabase, logSupabaseError } from './supabase';
import { withRequestDeadline } from './network';
import { createLatestWriteQueue } from './latestWriteQueue';
import {
  BLIND_STRUCTURES_ROW_ID,
  parseBlindStructuresRevision,
  parseBlindStructuresSnapshot,
  retryBlindStructuresSnapshot,
  type BlindStructuresRevision,
  type BlindStructuresSnapshot,
} from './blindStructuresSync';

let savesInFlight = 0;

/** True while a catalog save is still talking to the server. */
export function blindStructuresSaveInFlight(): boolean {
  return savesInFlight > 0;
}

/** Hold remote catalog replacements until the matching save finishes. */
export function beginBlindStructuresSave(): void {
  savesInFlight += 1;
}

/** A few dozen bytes: revision, write id, and timestamp. Not the ladder catalog. */
export async function loadBlindStructuresRevision(): Promise<BlindStructuresRevision | null> {
  const { data, error } = await withRequestDeadline(
    supabase
      .from('timer_sessions')
      .select('revision:payload->>revision, writeId:payload->>writeId, updatedAt:payload->>updatedAt')
      .eq('id', BLIND_STRUCTURES_ROW_ID)
      .maybeSingle(),
    15_000,
  );
  if (error) {
    logSupabaseError(error, 'blind structures revision');
    return null;
  }
  return parseBlindStructuresRevision(data);
}

export async function loadBlindStructuresSnapshot(): Promise<BlindStructuresSnapshot | null> {
  const { data, error } = await withRequestDeadline(
    supabase.rpc('club_blind_structures_snapshot'),
    15_000,
  );
  if (error) {
    logSupabaseError(error, 'blind structures');
    return null;
  }
  return parseBlindStructuresSnapshot(data);
}

async function postBlindStructures(snapshot: BlindStructuresSnapshot): Promise<BlindStructuresSnapshot> {
  const { data, error } = await supabase.rpc('club_save_blind_structures', {
    p_snapshot: snapshot,
  });
  if (error) {
    logSupabaseError(error, 'save blind structures');
    throw new Error('Не удалось сохранить структуру блайндов');
  }
  const confirmed = parseBlindStructuresSnapshot(data);
  if (!confirmed) throw new Error('Сервер не подтвердил структуру блайндов');
  return confirmed;
}

async function saveBlindStructures(snapshot: BlindStructuresSnapshot): Promise<void> {
  try {
    let attempt = snapshot;
    let confirmed = await postBlindStructures(attempt);
    if (confirmed.writeId !== attempt.writeId) {
      attempt = retryBlindStructuresSnapshot(attempt, confirmed);
      confirmed = await postBlindStructures(attempt);
    }
    if (confirmed.writeId !== attempt.writeId) {
      throw new Error('Структура блайндов изменена другим администратором');
    }
  } finally {
    savesInFlight -= 1;
  }
}

export const queueBlindStructuresSave = createLatestWriteQueue(saveBlindStructures);
