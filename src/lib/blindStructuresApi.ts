import { supabase, logSupabaseError } from './supabase';
import { withRequestDeadline } from './network';
import { createLatestWriteQueue } from './latestWriteQueue';
import {
  parseBlindStructuresSnapshot,
  type BlindStructuresSnapshot,
} from './blindStructuresSync';

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

async function saveBlindStructures(snapshot: BlindStructuresSnapshot): Promise<void> {
  const { data, error } = await supabase.rpc('club_save_blind_structures', {
    p_snapshot: snapshot,
  });
  if (error) {
    logSupabaseError(error, 'save blind structures');
    throw new Error('Не удалось сохранить структуру блайндов');
  }
  const confirmed = parseBlindStructuresSnapshot(data);
  if (!confirmed || confirmed.writeId !== snapshot.writeId) {
    throw new Error('Структура блайндов изменена другим администратором');
  }
}

export const queueBlindStructuresSave = createLatestWriteQueue(saveBlindStructures);
