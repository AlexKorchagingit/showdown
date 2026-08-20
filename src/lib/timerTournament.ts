import type { BlindStructure } from '../data/blindStructures';
import type { Tournament } from '../types/tournament';

export const TIMER_ROUTE = '/admin/blinds/timer';

export function timerPathForTournament(tournamentId: string): string {
  return `${TIMER_ROUTE}?tournament=${encodeURIComponent(tournamentId)}`;
}

export function timerPathForStructure(structureId: string): string {
  return `${TIMER_ROUTE}?structure=${encodeURIComponent(structureId)}`;
}

/**
 * Which blind ladder this event uses.
 * Prefers `blindStructureId`; falls back to the catalog name stored on the tournament.
 * Never matches `tournament.title` against `structure.name`.
 */
export function resolveStructureForTournament(
  tournament: Tournament | undefined,
  structures: BlindStructure[],
): BlindStructure | undefined {
  if (!tournament) return undefined;
  if (tournament.blindStructureId) {
    const byId = structures.find((row) => row.id === tournament.blindStructureId);
    if (byId) return byId;
  }
  const name = tournament.blindStructure?.trim();
  if (!name) return undefined;
  return structures.find((row) => row.name === name);
}

export function openTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.filter((tournament) => tournament.isClosed !== true);
}

export function tournamentsUsingStructure(
  tournaments: Tournament[],
  structure: BlindStructure,
): Tournament[] {
  return tournaments.filter((tournament) => {
    if (tournament.blindStructureId && tournament.blindStructureId === structure.id) return true;
    return tournament.blindStructure.trim() === structure.name;
  });
}
