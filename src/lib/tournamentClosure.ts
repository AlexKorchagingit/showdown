import type { Participant } from '../types/tournament';
import { createOperationRequests } from './operationRequests';
import { participantRowId } from './supabaseMap';
import { supabase } from './supabase';

type CloseResult = {
  request_id: string;
  tournament_id: string;
  players: number;
  credited_rubies: number;
};

type CloseIntent = {
  tournamentId: string;
  results: Array<{ id: string; place: number; knockouts: number }>;
};

const queues = new Map<string, ReturnType<typeof createOperationRequests<CloseIntent, CloseResult>>>();

function closeQueue(actorId: string) {
  let queue = queues.get(actorId);
  if (queue) return queue;
  queue = createOperationRequests(async (input) => {
    const { data, error } = await supabase.rpc('club_close_tournament', {
      p_request_id: input.requestId,
      p_tournament_id: input.tournamentId,
      p_results: input.results,
    });
    if (error) throw new Error(error.message || 'Не удалось закрыть турнир');
    const result = data as CloseResult | null;
    if (!result || result.request_id !== input.requestId || result.tournament_id !== input.tournamentId) {
      throw new Error('Сервер не подтвердил закрытие турнира');
    }
    return result;
  }, (intent) => ({
    tournamentId: intent.tournamentId.trim(),
    results: [...intent.results].sort((left, right) => left.id.localeCompare(right.id)),
  }), 'showdown.tournament-close.v1', undefined, {
    scope: actorId,
    storage: () => window.sessionStorage,
  });
  queues.set(actorId, queue);
  return queue;
}

/** The server derives rating and ruby awards; the client submits only final places/knockouts. */
export function closeTournamentOnServer(options: {
  actorId: string;
  tournamentId: string;
  participants: Participant[];
}): Promise<CloseResult> {
  if (!options.actorId.trim()) throw new Error('Не удалось подтвердить администратора');
  return closeQueue(options.actorId)({
    tournamentId: options.tournamentId,
    results: options.participants.map((participant) => ({
      id: participantRowId(options.tournamentId, participant.id),
      place: participant.place ?? 0,
      knockouts: participant.knockouts ?? 0,
    })),
  });
}
