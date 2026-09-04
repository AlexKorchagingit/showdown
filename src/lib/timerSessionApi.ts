import { supabase, logSupabaseError } from './supabase';
import { TIMER_SESSION_ROW_ID, parseTimerSnapshot, type TimerSnapshot } from './timerSession';

let saveChain: Promise<void> = Promise.resolve();

export async function loadTimerSession(): Promise<TimerSnapshot | null> {
  const { data, error } = await supabase
    .from('timer_sessions')
    .select('payload')
    .eq('id', TIMER_SESSION_ROW_ID)
    .maybeSingle();
  if (error) {
    logSupabaseError(error, 'timer session');
    return null;
  }
  return parseTimerSnapshot(data?.payload);
}

async function saveTimerSession(snapshot: TimerSnapshot): Promise<void> {
  const { data, error } = await supabase.rpc('club_save_timer_session', { p_snapshot: snapshot });
  if (error) {
    logSupabaseError(error, 'save timer session');
    throw new Error('Не удалось сохранить таймер');
  }
  const confirmed=parseTimerSnapshot(data);
  if (!confirmed || confirmed.writeId!==snapshot.writeId)
    throw new Error('Состояние таймера изменено другим администратором');
}

export function queueTimerSessionSave(snapshot: TimerSnapshot): void {
  saveChain = saveChain
    .then(() => saveTimerSession(snapshot))
    .catch((error) => console.error(error));
}
