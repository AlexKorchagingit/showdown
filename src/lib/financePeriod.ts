export type FinancePeriod = 'today' | 'week' | 'month';

export function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Inclusive lower bound for the selected cashier period. */
export function periodStart(period: FinancePeriod, now = new Date()): Date {
  const start = startOfDay(now);
  if (period === 'today') return start;
  if (period === 'week') {
    start.setDate(start.getDate() - 6);
    return start;
  }
  start.setDate(1);
  return start;
}

export function isInPeriod(isoDate: string, period: FinancePeriod, now = new Date()): boolean {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= periodStart(period, now).getTime() && ts <= now.getTime() + 60_000;
}
