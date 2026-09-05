import { supabase, logSupabaseError } from './supabase';
import {
  parseBlindStructuresSnapshot,
  type BlindStructuresSnapshot,
} from './blindStructuresSync';

let saveChain: Promise<void> = Promise.resolve();

export async function loadBlindStructuresSnapshot(): Promise<BlindStructuresSnapshot | null> {
  const { data, error } = await supabase.rpc('club_blind_structures_snapshot');
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

export function queueBlindStructuresSave(snapshot: BlindStructuresSnapshot): void {
  saveChain = saveChain
    .then(() => saveBlindStructures(snapshot))
    .catch((error) => {
      console.error(error);
    });
}
