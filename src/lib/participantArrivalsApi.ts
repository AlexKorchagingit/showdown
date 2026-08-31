import { supabase, logSupabaseError } from './supabase';
import {
  PARTICIPANT_ARRIVALS_LOG_ACTION,
  PARTICIPANT_ARRIVALS_LOG_ID,
  parseArrivalSnapshot,
  upsertTournamentArrivals,
  type ArrivalSnapshot,
} from './participantArrivals';

let cache: ArrivalSnapshot | null | undefined;
let saveChain: Promise<void> = Promise.resolve();

export async function loadArrivalSnapshot(): Promise<ArrivalSnapshot | null> {
  if (cache !== undefined) return cache;
  const { data, error } = await supabase
    .from('logs')
    .select('details')
    .eq('id', PARTICIPANT_ARRIVALS_LOG_ID)
    .maybeSingle();
  if (error) {
    logSupabaseError(error, 'participant arrivals');
    cache = null;
    return null;
  }
  cache = parseArrivalSnapshot(data?.details);
  return cache;
}

export function peekArrivalCache(): ArrivalSnapshot | null {
  return cache ?? null;
}

async function writeArrivalSnapshot(snapshot: ArrivalSnapshot): Promise<boolean> {
  cache = snapshot;
  const { error } = await supabase.from('logs').upsert(
    {
      id: PARTICIPANT_ARRIVALS_LOG_ID,
      timestamp: new Date().toISOString(),
      admin_id: null,
      admin_email: 'arrivals@showdown.internal',
      admin_name: 'Arrivals',
      action_type: PARTICIPANT_ARRIVALS_LOG_ACTION,
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
  logSupabaseError(error, 'save participant arrivals');
  return false;
}

export function queueArrivalSnapshotSave(snapshot: ArrivalSnapshot): Promise<void> {
  cache = snapshot;
  const pending = saveChain.then(async () => {
    await writeArrivalSnapshot(snapshot);
  });
  saveChain = pending.catch((error) => {
    console.error(error);
  });
  return pending;
}

export async function persistTournamentArrivals(
  tournamentId: string,
  players: { id: string; userId?: string | null; arrived?: boolean }[],
): Promise<ArrivalSnapshot> {
  const current = await loadArrivalSnapshot();
  const next = upsertTournamentArrivals(current, tournamentId, players);
  await queueArrivalSnapshotSave(next);
  return next;
}
