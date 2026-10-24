import { supabase } from './supabase';

export type SavedTournamentOverlay = {
  guarantee: number;
  overlayBase: number;
  overlayPerHead: number;
  guaranteeLocked: boolean;
};

export async function saveTournamentOverlay(
  tournamentId: string,
  base: number,
  perHead: number,
): Promise<SavedTournamentOverlay> {
  const { data, error } = await supabase.rpc('club_save_tournament_overlay', {
    p_tournament_id: tournamentId,
    p_base: base,
    p_per_head: perHead,
  });
  if (error || !data || typeof data !== 'object') {
    throw new Error(error?.message || 'Не удалось сохранить оверлей');
  }
  const row = data as {
    guarantee?: number;
    overlay_base?: number;
    overlay_per_head?: number;
    guarantee_locked?: boolean;
  };
  if (typeof row.guarantee !== 'number' || typeof row.overlay_base !== 'number' || typeof row.overlay_per_head !== 'number') {
    throw new Error('Сервер не подтвердил оверлей');
  }
  return {
    guarantee: row.guarantee,
    overlayBase: row.overlay_base,
    overlayPerHead: row.overlay_per_head,
    guaranteeLocked: row.guarantee_locked === true,
  };
}
