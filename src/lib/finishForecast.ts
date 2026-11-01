import { isBreakLevel, type BlindLevel } from '../data/blindStructures';
import { overlaySeriesKey } from './overlayPlan';
import { clockToMinutes, formatClockMinutes } from './playedClock';

export function moscowClock(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '0';
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: Number(read('hour')) * 60 + Number(read('minute')),
  };
}

/** Minutes since the cards started. A clock after midnight counts as the next day. */
export function elapsedSinceStart(startDate: string, startClock: string, now = new Date()): number {
  const moscow = moscowClock(now);
  const start = clockToMinutes(startClock);
  const dayGap = Math.round((Date.parse(`${moscow.date}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const days = Number.isFinite(dayGap) ? Math.max(0, dayGap) : 0;
  return Math.max(0, days * 24 * 60 + moscow.minutes - start);
}

/** Typical length once the field and rebuys are at the series norm. */
const BASE_HOURS: Record<string, number> = {
  freeroll: 5.8,
  chill: 6.3,
  phoenix: 6.1,
  freezeout: 6.4,
  deepstack: 6.4,
  bounty: 6.8,
  team: 6.5,
  triple: 5.6,
};

const MIN_LEVEL_MINUTES = 8;
const MAX_LEVEL_MINUTES = 30;
/** A stored 1000-minute rung is not a level the floor plays. Leave it alone. */
const REAL_LEVEL_MAX = 90;

export function forecastDurationMinutes(input: {
  series: string;
  field: number;
  rebuys: number;
  addons: number;
  normPeople: number;
  normRebuys: number;
  normAddons: number;
  elapsedMinutes?: number;
  playersLeft?: number;
}): number {
  const base = BASE_HOURS[input.series] ?? 6.2;
  let hours = base
    + 0.04 * (input.field - input.normPeople)
    + 0.06 * (input.rebuys - input.normRebuys)
    + 0.03 * (input.addons - input.normAddons);
  hours = Math.min(10, Math.max(4, hours));

  const elapsed = input.elapsedMinutes ?? 0;
  const field = Math.max(0, input.field);
  const left = input.playersLeft;
  if (elapsed >= 30 && field > 0 && typeof left === 'number') {
    const remainingShare = Math.min(1, Math.max(0, left / field));
    const progress = 1 - remainingShare ** 0.7;
    if (progress >= 0.2) {
      const paceHours = (elapsed / 60) / progress;
      hours = hours * 0.45 + paceHours * 0.55;
      hours = Math.min(10, Math.max(elapsed / 60 + 0.25, hours));
    }
  }
  return Math.round(hours * 60);
}

export function forecastEndMinutes(input: {
  startMinutes: number;
  series: string;
  field: number;
  rebuys: number;
  addons: number;
  normPeople: number;
  normRebuys: number;
  normAddons: number;
  elapsedMinutes?: number;
  playersLeft?: number;
}): number {
  return input.startMinutes + forecastDurationMinutes(input);
}

/** Usual finish for this series, before the live field and rebuys move it. */
export function typicalEndMinutes(startMinutes: number, series: string): number {
  return startMinutes + Math.round((BASE_HOURS[series] ?? 6.2) * 60);
}

export function seriesKeyOf(title: string): string {
  return overlaySeriesKey(title);
}

function isRealPlayingLevel(level: BlindLevel): boolean {
  return !isBreakLevel(level) && level.durationMinutes > 0 && level.durationMinutes < REAL_LEVEL_MAX;
}

/**
 * Scale future playing levels so the remaining forecast moves toward the target.
 * Breaks, levels already played, and bogus 1000-minute rungs stay put.
 */
export function suggestLevelMinutes(input: {
  levels: readonly BlindLevel[];
  currentIndex: number;
  remainingForecastMinutes: number;
  targetRemainingMinutes: number;
}): number[] {
  const current = input.levels.map((level) => Math.max(0, Math.round(level.durationMinutes)));
  const future = input.levels
    .map((level, index) => ({ level, index }))
    .filter((row) => row.index > input.currentIndex && isRealPlayingLevel(row.level));
  const oldPlay = future.reduce((sum, row) => sum + row.level.durationMinutes, 0);
  if (oldPlay <= 0 || input.remainingForecastMinutes <= 0) return current;

  const futureBreak = input.levels.reduce((sum, level, index) => {
    if (index <= input.currentIndex || !isBreakLevel(level)) return sum;
    return sum + Math.max(0, level.durationMinutes);
  }, 0);
  const playForecast = Math.max(1, input.remainingForecastMinutes - futureBreak);
  const targetPlay = Math.max(0, input.targetRemainingMinutes - futureBreak);
  const factor = Math.min(1.5, Math.max(0.5, targetPlay / playForecast));
  const next = [...current];
  for (const row of future) {
    const minutes = Math.round(row.level.durationMinutes * factor);
    next[row.index] = Math.min(MAX_LEVEL_MINUTES, Math.max(MIN_LEVEL_MINUTES, minutes));
  }
  return next;
}

export function remainingAfterDurationChange(input: {
  levels: readonly BlindLevel[];
  currentIndex: number;
  nextMinutes: readonly number[];
  remainingForecastMinutes: number;
}): number {
  const playOf = (minutes: readonly number[]) => input.levels.reduce((sum, level, index) => {
    if (index <= input.currentIndex || !isRealPlayingLevel(level)) return sum;
    return sum + (minutes[index] ?? level.durationMinutes);
  }, 0);
  const oldPlay = playOf(input.levels.map((level) => level.durationMinutes));
  const newPlay = playOf(input.nextMinutes);
  if (oldPlay <= 0) return input.remainingForecastMinutes;
  const futureBreak = input.levels.reduce((sum, level, index) => {
    if (index <= input.currentIndex || !isBreakLevel(level)) return sum;
    return sum + Math.max(0, level.durationMinutes);
  }, 0);
  const playForecast = Math.max(0, input.remainingForecastMinutes - futureBreak);
  return futureBreak + playForecast * (newPlay / oldPlay);
}

export function formatFinishShift(currentEnd: number, nextEnd: number): string {
  const delta = Math.round(nextEnd - currentEnd);
  const from = formatClockMinutes(currentEnd);
  const to = formatClockMinutes(nextEnd);
  if (delta === 0) return `Конец остаётся ${to}`;
  const minutes = Math.abs(delta);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const span = hours > 0 ? `${hours} ч${rest > 0 ? ` ${rest} мин` : ''}` : `${rest} мин`;
  return delta < 0 ? `Конец ${from} → ${to}, раньше на ${span}` : `Конец ${from} → ${to}, позже на ${span}`;
}

export { formatClockMinutes };
