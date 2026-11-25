import { isComplimentaryCharge } from './entryFee';
import { startOfDay, type FinancePeriod } from './financePeriod';
import { parseTournamentDay } from './statsPeriod';
import type { Transaction } from '../types/finance';

/**
 * A tournament night starts in the evening and is still the same night after midnight.
 * Before this hour, «сегодня» is the evening that already began.
 */
export const CLUB_NIGHT_CUTOFF_HOUR = 6;

export function clubNightStart(now = new Date()): Date {
  const day = startOfDay(now);
  if (now.getHours() < CLUB_NIGHT_CUTOFF_HOUR) day.setDate(day.getDate() - 1);
  return day;
}

/** Paid money. Tickets and zero-amount comps are not revenue. */
export function chargeCountsAsRevenue(tx: {
  type: string;
  amount: number;
  status: string;
  voidedAt?: string | null;
}): boolean {
  return !tx.voidedAt && tx.status === 'paid' && tx.amount > 0 && !isComplimentaryCharge(tx);
}

/** The evening a charge belongs to when it has no tournament start date. */
export function timestampClubNight(iso: string): Date | null {
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) return null;
  const day = startOfDay(ts);
  if (ts.getHours() < CLUB_NIGHT_CUTOFF_HOUR) day.setDate(day.getDate() - 1);
  return day;
}

export function financeNightBounds(
  period: FinancePeriod,
  now = new Date(),
): { start: Date; end: Date } | null {
  if (period === 'all') return null;
  const end = clubNightStart(now);
  const start = new Date(end);
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setDate(start.getDate() - 29);
  return { start, end };
}

export function nightInFinancePeriod(day: Date, period: FinancePeriod, now = new Date()): boolean {
  const bounds = financeNightBounds(period, now);
  if (!bounds) return true;
  const ts = startOfDay(day).getTime();
  return ts >= bounds.start.getTime() && ts <= bounds.end.getTime();
}

/**
 * Revenue follows the tournament's start date, so a rebuy at 01:30 stays on the
 * evening the tournament began. A charge with no known start falls back to the club night.
 */
export function revenueNight(
  tx: Pick<Transaction, 'tournamentId' | 'date' | 'updatedAt' | 'status'>,
  startByTournament: ReadonlyMap<string, string>,
): Date | null {
  const start = startByTournament.get(tx.tournamentId);
  if (start) {
    const night = parseTournamentDay(start);
    if (night) return night;
  }
  const stamp = tx.status === 'paid' ? (tx.updatedAt ?? tx.date) : tx.date;
  return timestampClubNight(stamp);
}

export function sameNight(day: Date | null, other: Date): boolean {
  if (!day) return false;
  return startOfDay(day).getTime() === startOfDay(other).getTime();
}

/** One column per club night in the selected cashier period. */
export function nightsInFinancePeriod(
  period: FinancePeriod,
  now = new Date(),
  sampleNights: Date[] = [],
): Date[] {
  const bounds = financeNightBounds(period, now);
  let start: Date;
  let end: Date;
  if (!bounds) {
    end = clubNightStart(now);
    let earliest = end.getTime();
    for (const night of sampleNights) {
      const ts = startOfDay(night).getTime();
      if (ts < earliest) earliest = ts;
    }
    start = new Date(earliest);
  } else {
    start = bounds.start;
    end = bounds.end;
  }
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end).getTime();
  while (cursor.getTime() <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
