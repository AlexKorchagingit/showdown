import { supabase } from './supabase';

/** Ask the server to deal a new random seat to every arrived player. */
export async function reshuffleFinalDraw(tournamentId: string): Promise<void> {
  const { error } = await supabase.rpc('club_reshuffle_final_draw', {
    p_tournament_id: tournamentId,
  });
  if (error) throw new Error(error.message || 'Не удалось перемешать рассадку');
}
