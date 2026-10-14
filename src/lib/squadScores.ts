import { knockoutBountyPoints } from '../data/prizeStructure';
import type { Participant, Tournament } from '../types/tournament';
import { teamRatingPointsForPlayer } from './teamBattle';

/**
 * FREEROLL TEAM BATTLE that started on 13 Oct 2026.
 * The six-team scoreboard exists only for this event.
 */
export const SQUAD_EVENT_ID = 't-9afeed39-2f42-49aa-bf94-d7b36e8a18b0';
export const SQUAD_TEAM_COUNT = 6;

export function isSquadScoreEvent(tournament: { id?: string } | null | undefined): boolean {
  return tournament?.id === SQUAD_EVENT_ID;
}

export function squadNoOf(player: Pick<Participant, 'squadNo'>): number | null {
  const value = player.squadNo;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > SQUAD_TEAM_COUNT) {
    return null;
  }
  return value;
}

/** Blank and negative entries count as zero informational points. */
export function squadPointsOf(player: Pick<Participant, 'squadPoints'>): number {
  const value = player.squadPoints;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1_000_000, Math.floor(value));
}

/** True once an admin has put at least one player on a team. */
export function squadBoardActive(players: readonly Pick<Participant, 'squadNo'>[]): boolean {
  return players.some((player) => squadNoOf(player) != null);
}

export type SquadAward = {
  /** Informational points summed per team. Index 0 is unused. */
  teamPoints: number[];
  awardById: Map<string, number>;
};

/**
 * Split `guarantee` across the six teams in proportion to their очки.
 * Inside a team every player receives the same whole number of rating;
 * a remainder that would make them unequal is left unawarded.
 */
export function squadAwards(players: readonly Participant[], guarantee: number): SquadAward {
  const teamPoints = [0, 0, 0, 0, 0, 0, 0];
  const members: Participant[][] = [[], [], [], [], [], [], []];
  for (const player of players) {
    const team = squadNoOf(player);
    if (team == null) continue;
    members[team]!.push(player);
    teamPoints[team] = (teamPoints[team] ?? 0) + squadPointsOf(player);
  }

  const awardById = new Map<string, number>();
  const pool = Math.max(0, Math.floor(Number(guarantee) || 0));
  const total = teamPoints.reduce((sum, value) => sum + value, 0);
  const teamAward = [0, 0, 0, 0, 0, 0, 0];
  if (pool > 0 && total > 0) {
    const rows = [1, 2, 3, 4, 5, 6].map((team) => {
      const exact = (pool * (teamPoints[team] ?? 0)) / total;
      const base = Math.floor(exact);
      return { team, base, rest: exact - base };
    });
    let leftover = pool - rows.reduce((sum, row) => sum + row.base, 0);
    const order = [...rows].sort((a, b) => b.rest - a.rest || a.team - b.team);
    for (const row of order) {
      if (leftover <= 0) break;
      row.base += 1;
      leftover -= 1;
    }
    for (const row of rows) teamAward[row.team] = row.base;
  }

  for (let team = 1; team <= SQUAD_TEAM_COUNT; team += 1) {
    const group = members[team] ?? [];
    if (group.length === 0) continue;
    const each = Math.floor((teamAward[team] ?? 0) / group.length);
    for (const player of group) awardById.set(player.id, each);
  }
  return { teamPoints, awardById };
}

/**
 * Rating this seat takes from the event.
 * The 13 Oct scoreboard replaces place prizes once a team is assigned.
 */
export function eventRatingAward(
  player: Participant,
  tournament: Pick<Tournament, 'id' | 'title' | 'blindStructure' | 'guarantee' | 'participants' | 'isBounty'>,
  fieldSize: number,
): number {
  if (isSquadScoreEvent(tournament) && squadBoardActive(tournament.participants)) {
    return squadAwards(tournament.participants, tournament.guarantee).awardById.get(player.id) ?? 0;
  }
  return (
    teamRatingPointsForPlayer(player, tournament, fieldSize) +
    knockoutBountyPoints(player.knockouts, tournament.isBounty === true)
  );
}
