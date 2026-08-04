import type { Tournament } from '../types/tournament';

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

/** A tournament is finished once its start moment has passed. Status is never stored. */
export function isTournamentPast(dateString: string, timeString: string): boolean {
  const start = toStartDate(dateString, timeString);
  if (!start) return false;
  return start.getTime() <= Date.now();
}

export function isFinished(tournament: Pick<Tournament, 'startDate' | 'startTime'>): boolean {
  return isTournamentPast(tournament.startDate, tournament.startTime);
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

/** Participants are always shown best-first. */
export function sortByRating<T extends { rating: number }>(participants: T[]): T[] {
  return [...participants].sort((a, b) => b.rating - a.rating);
}
