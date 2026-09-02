import type { BlindStructure } from '../data/blindStructures';
import type { Tournament } from '../types/tournament';
import { compareByStart } from './tournamentStatus';

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
  return tournaments.filter((tournament) => tournament.isClosed !== true).sort(compareByStart);
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

function sameLabel(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function usesStructure(tournament: Tournament, structure: BlindStructure): boolean {
  if (tournament.blindStructureId && tournament.blindStructureId === structure.id) return true;
  if (tournament.blindStructure.trim() === structure.name) return true;
  return sameLabel(tournament.title, structure.name);
}

/**
 * Which event the timer session belongs to.
 * Keeps the previously linked tournament when it still uses this ladder,
 * otherwise picks the open event whose title matches the structure name.
 */
export function resolveTournamentForTimer(
  structure: BlindStructure | undefined,
  tournaments: Tournament[],
  linkedTournamentId: string | null,
): Tournament | undefined {
  if (!structure || tournaments.length === 0) return undefined;

  const linked = linkedTournamentId
    ? tournaments.find((row) => row.id === linkedTournamentId)
    : undefined;
  if (linked && usesStructure(linked, structure)) return linked;

  const named = openTournaments(tournaments).find((row) => sameLabel(row.title, structure.name));
  if (named) return named;

  const using = openTournaments(tournamentsUsingStructure(tournaments, structure));
  return using[0];
}

/** Event day + start time, timezone-stable (`YYYY-MM-DD` at noon). */
export function formatTournamentHeldOn(startDate: string, startTime: string): string {
  const day = new Date(`${startDate.trim().slice(0, 10)}T12:00:00`);
  const dateLabel = Number.isNaN(day.getTime())
    ? ''
    : day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = startTime.trim();
  return [dateLabel, time].filter(Boolean).join(' · ') || '—';
}
