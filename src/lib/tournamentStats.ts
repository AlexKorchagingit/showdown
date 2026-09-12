import type { Participant, Tournament } from '../types/tournament';
import { cashierPlayers, cashierStillPlaying } from './tournamentArrival';

/** Players still in the cashier field (checked in, no finishing place). */
export function remainingPlayers(tournament: Tournament | undefined): Participant[] {
  if (!tournament) return [];
  return cashierStillPlaying(tournament.participants);
}

/** Nickname of the player who finished each assigned place. */
export function nicknamesByPlace(tournament: Tournament | undefined): Map<number, string> {
  const byPlace = new Map<number, string>();
  if (!tournament) return byPlace;
  const pool = [...tournament.participants, ...(tournament.results ?? [])];
  for (const player of pool) {
    if (typeof player.place === 'number' && player.place >= 1 && !byPlace.has(player.place)) {
      byPlace.set(player.place, player.nickname);
    }
  }
  return byPlace;
}

export function tournamentPlayerCounts(tournament: Tournament | undefined): {
  remaining: number;
  registered: number;
} {
  const registered = tournament ? cashierPlayers(tournament.participants).length : 0;
  return { remaining: remainingPlayers(tournament).length, registered };
}
