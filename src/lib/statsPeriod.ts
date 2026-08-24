import { startOfDay } from './financePeriod';
import { compareByStart } from './tournamentStatus';
import type { Tournament } from '../types/tournament';

export type StatsPeriod = 'week' | 'month' | 'all';

export type AttendanceChartRow = {
  id: string;
  label: string;
  title: string;
  players: number;
};

export type AttendanceSeed = {
  tournament: Pick<Tournament, 'id' | 'title' | 'startDate' | 'startTime'>;
  players: number;
};

function isoDay(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function eachDayInclusive(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Axis label: `24.08`, plus year when the event is not in the current calendar year. */
export function formatAttendanceDate(startDate: string, now = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((startDate ?? '').trim());
  if (!match) return (startDate ?? '').trim() || '—';
  const year = Number(match[1]);
  const dayMonth = `${match[3]}.${match[2]}`;
  return year !== now.getFullYear() ? `${dayMonth}.${String(year).slice(-2)}` : dayMonth;
}

function formatAttendanceTime(startTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((startTime ?? '').trim());
  if (!match) return '';
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

/** Local calendar day from `YYYY-MM-DD` (or a longer ISO stamp). */
export function parseTournamentDay(startDate: string): Date | null {
  const raw = (startDate ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) {
    return startOfDay(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

/**
 * Inclusive local range for the statistic selector.
 * Week = current Monday–Sunday; month = current calendar month; all = unbounded.
 */
export function statsPeriodBounds(
  period: StatsPeriod,
  now = new Date(),
): { start: Date; end: Date } | null {
  if (period === 'all') return null;
  if (period === 'month') {
    return {
      start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  const start = startOfDay(now);
  const weekday = start.getDay();
  const fromMonday = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - fromMonday);
  const end = startOfDay(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function tournamentInPeriod(
  startDate: string,
  period: StatsPeriod,
  now = new Date(),
): boolean {
  const bounds = statsPeriodBounds(period, now);
  if (!bounds) return true;
  const day = parseTournamentDay(startDate);
  if (!day) return false;
  const ts = day.getTime();
  return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
}

export function filterStatisticTournaments(
  tournaments: Tournament[],
  period: StatsPeriod,
  formatTitle: string,
  now = new Date(),
): Tournament[] {
  const needle = formatTitle.trim().toLowerCase();
  return tournaments.filter((tournament) => {
    if (needle && needle !== 'all') {
      const title = tournament.title.trim().toLowerCase();
      const structure = tournament.blindStructure.trim().toLowerCase();
      if (title !== needle && structure !== needle) return false;
    }
    return tournamentInPeriod(tournament.startDate, period, now);
  });
}

/** Week/month: one bar per calendar day. All-time: one bar per tournament. */
export function buildAttendanceChart(
  rows: AttendanceSeed[],
  period: StatsPeriod,
  now = new Date(),
): AttendanceChartRow[] {
  const bounds = statsPeriodBounds(period, now);

  if (bounds) {
    const byDay = new Map<string, { players: number; titles: string[] }>();
    for (const day of eachDayInclusive(bounds.start, bounds.end)) {
      byDay.set(isoDay(day), { players: 0, titles: [] });
    }
    for (const { tournament, players } of rows) {
      const day = parseTournamentDay(tournament.startDate);
      if (!day) continue;
      const key = isoDay(day);
      const slot = byDay.get(key);
      if (!slot) continue;
      slot.players += players;
      if (tournament.title.trim()) slot.titles.push(tournament.title.trim());
    }
    return [...byDay.entries()].map(([id, slot]) => ({
      id,
      label: formatAttendanceDate(id, now),
      title: slot.titles.join(' · '),
      players: slot.players,
    }));
  }

  const sorted = [...rows].sort((a, b) => compareByStart(a.tournament, b.tournament));
  const dateCounts = new Map<string, number>();
  for (const { tournament } of sorted) {
    const date = formatAttendanceDate(tournament.startDate, now);
    dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
  }
  return sorted.map(({ tournament, players }) => {
    const date = formatAttendanceDate(tournament.startDate, now);
    const time = formatAttendanceTime(tournament.startTime);
    return {
      id: tournament.id,
      label: (dateCounts.get(date) ?? 0) > 1 && time ? `${date} ${time}` : date,
      title: tournament.title,
      players,
    };
  });
}
