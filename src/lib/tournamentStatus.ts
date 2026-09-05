import type { Participant, Tournament } from '../types/tournament';
import { cashierPlayers, hasArrivedWithoutPlace } from './tournamentArrival';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** Combines the `YYYY-MM-DD` + `HH:MM` pair into a local Date, or null if unparsable. */
function toStartDate(dateString: string, timeString: string): Date | null {
  const date = DATE_RE.exec((dateString ?? '').trim());
  if (!date) return null;

  const time = TIME_RE.exec((timeString ?? '').trim());
  const hours = time ? Number(time[1]) : 0;
  const minutes = time ? Number(time[2]) : 0;

  const start = new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hours, minutes);
  return Number.isNaN(start.getTime()) ? null : start;
}

/** A tournament is past only after an admin closes it — never by calendar date. */
export function isFinished(tournament: Pick<Tournament, 'isClosed'>): boolean {
  return tournament.isClosed === true;
}

/** @deprecated Use isFinished(tournament); kept for call sites that still pass date/time. */
export function isTournamentPast(_dateString: string, _timeString: string): boolean {
  return false;
}

/** Chronological compare of two tournaments by their start moment. */
export function compareByStart(
  a: Pick<Tournament, 'startDate' | 'startTime'>,
  b: Pick<Tournament, 'startDate' | 'startTime'>,
): number {
  const aStart = toStartDate(a.startDate, a.startTime)?.getTime() ?? 0;
  const bStart = toStartDate(b.startDate, b.startTime)?.getTime() ?? 0;
  return aStart - bStart;
}

/** Participants are always shown best-first (open tournaments). */
export function sortByRating<T extends { rating: number }>(participants: T[]): T[] {
  return [...participants].sort((a, b) => b.rating - a.rating);
}

export function hasMissingPlaces(tournament: Pick<Tournament, 'participants'>): boolean {
  return hasArrivedWithoutPlace(tournament.participants);
}

/** Closed events that still need places from admin. */
export function needsResults(tournament: Tournament): boolean {
  return isFinished(tournament) && tournament.participants.length > 0 && hasMissingPlaces(tournament);
}

/** Lowest unassigned finishing place (N, then N-1, …). */
export function nextEliminatedPlace(participants: Participant[]): number | null {
  const n = participants.length;
  if (n === 0) return null;
  const used = new Set(
    participants
      .map((p) => p.place)
      .filter((place): place is number => typeof place === 'number' && place >= 1),
  );
  for (let place = n; place >= 1; place--) {
    if (!used.has(place)) return place;
  }
  return null;
}

/** Placed players first (1…N), anyone without a place at the bottom. */
export function sortByPlace<T extends { place?: number }>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    const aPlace = a.place ?? Number.POSITIVE_INFINITY;
    const bPlace = b.place ?? Number.POSITIVE_INFINITY;
    if (aPlace !== bPlace) return aPlace - bPlace;
    return 0;
  });
}

/** Open events: A–Z by nickname. Closed events: finishing place 1…N. */
export function sortFinancePlayers<T extends { place?: number; nickname: string }>(
  participants: T[],
  closed: boolean,
): T[] {
  if (closed) return sortByPlace(participants);
  return [...participants].sort((a, b) =>
    a.nickname.localeCompare(b.nickname, 'ru', { sensitivity: 'base' }),
  );
}

/** True when the field can be closed: N−1 eliminated (winner left) or every seat has a place. */
export function canCloseTournament(participants: Participant[]): boolean {
  const field = cashierPlayers(participants);
  const total = field.length;
  if (total === 0) return true;
  const placed = field.filter((p) => typeof p.place === 'number' && p.place >= 1).length;
  return placed >= total - 1;
}
