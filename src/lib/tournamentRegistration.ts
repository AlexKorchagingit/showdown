import { createOperationRequests } from './operationRequests';
import { supabase } from './supabase';

type RegistrationIntent = { tournamentId: string; registered: boolean };
type RegistrationResult = { request_id: string; tournament_id: string; registered: boolean };

const queues = new Map<string, ReturnType<typeof createOperationRequests<RegistrationIntent, RegistrationResult>>>();

function registrationQueue(actorId: string) {
  let queue = queues.get(actorId);
  if (queue) return queue;
  queue = createOperationRequests(async (input) => {
    const { data, error } = await supabase.rpc('club_set_registration', {
      p_request_id: input.requestId,
      p_tournament_id: input.tournamentId,
      p_registered: input.registered,
    });
    if (error) throw new Error(error.message || 'Не удалось обновить запись');
    const result = data as RegistrationResult | null;
    if (!result || result.request_id !== input.requestId ||
      result.tournament_id !== input.tournamentId || result.registered !== input.registered) {
      throw new Error('Сервер не подтвердил запись на турнир');
    }
    return result;
  }, (intent) => ({ tournamentId: intent.tournamentId.trim(), registered: intent.registered }),
  'showdown.registration.v1', undefined, { scope: actorId, storage: () => window.sessionStorage });
  queues.set(actorId, queue);
  return queue;
}

export function setTournamentRegistration(
  actorId: string,
  tournamentId: string,
  registered: boolean,
): Promise<RegistrationResult> {
  if (!actorId.trim()) throw new Error('Не удалось подтвердить игрока');
  return registrationQueue(actorId)({ tournamentId, registered });
}
