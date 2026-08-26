export type FinancePeriod = 'today' | 'week' | 'month' | 'all';

export function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Local calendar day as `YYYY-MM-DD`. */
export function formatIsoDay(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

/** Inclusive lower bound for the selected cashier period. `'all'` is unbounded. */
export function periodStart(period: FinancePeriod, now = new Date()): Date {
  if (period === 'all') return new Date(0);
  const start = startOfDay(now);
  if (period === 'today') return start;
  if (period === 'week') {
    start.setDate(start.getDate() - 6);
    return start;
  }
  start.setDate(start.getDate() - 29);
  return start;
}

export function isInPeriod(isoDate: string, period: FinancePeriod, now = new Date()): boolean {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return false;
  if (period === 'all') return true;
  return ts >= periodStart(period, now).getTime() && ts <= now.getTime() + 60_000;
}

/** One calendar day per tick from period start through today (inclusive). */
export function datesInPeriod(
  period: FinancePeriod,
  now = new Date(),
  sampleIsoDates: Iterable<string> = [],
): Date[] {
  const end = startOfDay(now);
  let start = periodStart(period, now);
  if (period === 'all') {
    let earliest = Number.POSITIVE_INFINITY;
    for (const iso of sampleIsoDates) {
      const ts = new Date(iso).getTime();
      if (Number.isFinite(ts) && ts < earliest) earliest = ts;
    }
    start = Number.isFinite(earliest) ? startOfDay(new Date(earliest)) : end;
  }

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function sameDay(isoDate: string, day: Date): boolean {
  const ts = new Date(isoDate);
  if (Number.isNaN(ts.getTime())) return false;
  return startOfDay(ts).getTime() === startOfDay(day).getTime();
}
