import { parseBlindLevel, type BlindStructure } from '../data/blindStructures';
import { withRequestDeadline } from './network';
import { supabase, logSupabaseError } from './supabase';

/** One tournament ladder for any signed-in player. Admins keep the full catalog elsewhere. */
export async function loadPublicBlindLadder(tournamentId: string): Promise<BlindStructure | null> {
  const { data, error } = await withRequestDeadline(
    supabase.rpc('club_public_blind_ladder', { p_tournament_id: tournamentId }),
    15_000,
  );
  if (error) {
    logSupabaseError(error, 'public blind ladder');
    throw new Error('Не удалось загрузить структуру турнира');
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as { id?: unknown; name?: unknown; levels?: unknown };
  const levels = Array.isArray(row.levels)
    ? row.levels.flatMap((item) => {
        const level = parseBlindLevel(item);
        return level ? [level] : [];
      })
    : [];
  return {
    id: typeof row.id === 'string' && row.id ? row.id : tournamentId,
    name: typeof row.name === 'string' ? row.name : '',
    levels,
    levelDuration: 20,
    guarantee: 0,
    payouts: [],
  };
}
