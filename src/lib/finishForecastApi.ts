import { supabase } from './supabase';
import { parseFinishForecasts, type FinishForecastMark } from './finishForecastLog';

export async function appendFinishForecast(
  tournamentId: string,
  end: string,
): Promise<FinishForecastMark[]> {
  const { data, error } = await supabase.rpc('club_append_finish_forecast', {
    p_tournament_id: tournamentId,
    p_end: end,
  });
  if (error) throw new Error(error.message || 'Не удалось записать прогноз конца');
  return parseFinishForecasts(data);
}
