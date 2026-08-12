import type { Participant, Tournament } from '../types/tournament';

export function remainingPlayers(tournament: Tournament | undefined): Participant[] {
  if (!tournament) return [];
  return tournament.participants.filter((p) => typeof p.place !== 'number');
}

export function tournamentPlayerCounts(tournament: Tournament | undefined): {
  remaining: number;
  registered: number;
} {
  const registered = tournament?.participants.length ?? 0;
  return { remaining: remainingPlayers(tournament).length, registered };
}

/** Starting chips in play divided by players still seated. */
export function autoAvgStack(tournament: Tournament | undefined): number {
  if (!tournament) return 0;
  const { remaining, registered } = tournamentPlayerCounts(tournament);
  if (remaining <= 0) return 0;
  return Math.round((registered * tournament.stackSize) / remaining);
}
