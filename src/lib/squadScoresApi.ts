import { supabase } from './supabase';
import { SQUAD_EVENT_ID } from './squadScores';

export type SquadScoreWrite = {
  seat_id: string;
  squad_no: number | null;
  squad_points: number;
};

/** Save the one-off 13 Oct team board. Other tournaments are rejected by the server. */
export async function saveSquadScores(tournamentId: string, rows: SquadScoreWrite[]): Promise<void> {
  if (tournamentId !== SQUAD_EVENT_ID) {
    throw new Error('Командный зачёт есть только у турнира 13 октября');
  }
  const { data, error } = await supabase.rpc('club_save_squad_scores', {
    p_tournament_id: tournamentId,
    p_rows: rows,
  });
  if (error) throw new Error(error.message || 'Не удалось сохранить команды');
  const result = data as { tournament_id?: string } | null;
  if (!result || result.tournament_id !== tournamentId) {
    throw new Error('Сервер не подтвердил командный зачёт');
  }
}
