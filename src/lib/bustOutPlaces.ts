import type { Participant, Tournament } from '../types/tournament';
import { cashierPlayers } from './tournamentArrival';

function hasPlace(player: Participant): boolean {
  return typeof player.place === 'number' && player.place >= 1;
}

function bustOutOrder(participants: Participant[]): Participant[] {
  return participants
    .filter(hasPlace)
    .sort((a, b) => (b.place ?? 0) - (a.place ?? 0));
}

/**
 * Bust-out places always fill the bottom of the cashier field: whoever left
 * first is last. So a late entry pushes every finished player one place down
 * and frees the bottom place for the next bust-out, and a seat that leaves the
 * field before busting pulls them back up.
 *
 * Closed tournaments keep their final places — points and rubies are already
 * awarded against them. The same array is returned when nothing moves, so
 * callers can skip the write.
 */
export function alignBustOutPlaces(
  participants: Participant[],
  tournament: Pick<Tournament, 'isClosed'>,
): Participant[] {
  if (tournament.isClosed === true) return participants;

  const order = bustOutOrder(participants);
  if (order.length === 0) return participants;

  const fieldSize = cashierPlayers(participants).length;
  const aligned = new Map(order.map((player, index) => [player.id, fieldSize - index]));

  let moved = false;
  const next = participants.map((player) => {
    const place = aligned.get(player.id);
    if (place === undefined || place === player.place) return player;
    moved = true;
    return { ...player, place };
  });
  return moved ? next : participants;
}
