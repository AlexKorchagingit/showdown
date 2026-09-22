import type { Participant, Tournament } from '../types/tournament';
import { isTeamBattleEvent, teamPrizeAtPlace, teamScoringPlace } from './teamBattle';
import { cashierPlayers, cashierStillPlaying } from './tournamentArrival';

/** Players still in the cashier field (checked in, no finishing place). */
export function remainingPlayers(tournament: Tournament | undefined): Participant[] {
  if (!tournament) return [];
  return cashierStillPlaying(tournament.participants);
}

/** Nickname of the player who finished each assigned place. TEAM BATTLE rows join both nicks. */
export function nicknamesByPlace(tournament: Tournament | undefined): Map<number, string> {
  const byPlace = new Map<number, string>();
  if (!tournament) return byPlace;
  if (isTeamBattleEvent(tournament)) {
    const field = cashierPlayers(tournament.participants).length;
    const places = new Set(
      tournament.participants.flatMap((player) => {
        const place = teamScoringPlace(player, tournament.participants, tournament.id);
        return place != null ? [place] : [];
      }),
    );
    for (const place of places) {
      const row = teamPrizeAtPlace(tournament, place, field);
      if (row && row.names.length > 0) byPlace.set(place, row.names.join(' / '));
    }
    return byPlace;
  }
  const pool = [...tournament.participants, ...(tournament.results ?? [])];
  for (const player of pool) {
    if (typeof player.place === 'number' && player.place >= 1 && !byPlace.has(player.place)) {
      byPlace.set(player.place, player.nickname);
    }
  }
  return byPlace;
}

/** Points shown on the blinds-timer prize row (split per person in TEAM BATTLE). */
export function prizePointsForTimerPlace(
  tournament: Tournament | undefined,
  place: number,
  fullPoints: number,
  fieldSize: number,
): number {
  if (!tournament || !isTeamBattleEvent(tournament)) return fullPoints;
  const row = teamPrizeAtPlace(tournament, place, fieldSize);
  if (!row || row.names.length <= 1) return fullPoints;
  return row.pointsEach;
}

export function tournamentPlayerCounts(tournament: Tournament | undefined): {
  remaining: number;
  registered: number;
} {
  const registered = tournament ? cashierPlayers(tournament.participants).length : 0;
  return { remaining: remainingPlayers(tournament).length, registered };
}
