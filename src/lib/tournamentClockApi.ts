import { supabase } from './supabase';
import { clockFromStored } from './playedClock';

export async function saveTournamentClock(
  tournamentId: string,
  start: string,
  end: string,
): Promise<{ playedStart?: string; playedEnd?: string }> {
  const { data, error } = await supabase.rpc('club_save_tournament_clock', {
    p_tournament_id: tournamentId,
    p_start: start,
    p_end: end,
  });
  if (error || !data || typeof data !== 'object') {
    throw new Error(error?.message || 'Не удалось сохранить начало и конец');
  }
  const row = data as { played_start?: string | null; played_end?: string | null };
  return {
    playedStart: clockFromStored(row.played_start),
    playedEnd: clockFromStored(row.played_end),
  };
}
