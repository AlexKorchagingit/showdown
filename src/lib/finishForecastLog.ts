import { isClockText } from './playedClock';

/** How far apart the cashier keeps forecast snapshots. */
export const FORECAST_MARK_GAP_MS = 2 * 60 * 60 * 1000;

export type FinishForecastMark = {
  /** ISO time the forecast was written. */
  at: string;
  /** Forecasted finish, `HH:MM`. */
  end: string;
};

export function parseFinishForecasts(raw: unknown): FinishForecastMark[] {
  if (!Array.isArray(raw)) return [];
  const marks: FinishForecastMark[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const at = (item as { at?: unknown }).at;
    const end = (item as { end?: unknown }).end;
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) continue;
    if (typeof end !== 'string' || !isClockText(end)) continue;
    marks.push({ at, end });
  }
  return marks;
}

/** A new snapshot is due when none exists yet, or the last one is at least two hours old. */
export function shouldRecordForecast(
  marks: readonly FinishForecastMark[],
  now = Date.now(),
): boolean {
  const last = marks[marks.length - 1];
  if (!last) return true;
  const at = Date.parse(last.at);
  if (!Number.isFinite(at)) return true;
  return now - at >= FORECAST_MARK_GAP_MS;
}

export function formatForecastMarkTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}
