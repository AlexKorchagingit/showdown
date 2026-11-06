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

/** True once the Moscow clock has reached the advertised start. */
export function tournamentHasStarted(startDate: string, startClock: string, now = new Date()): boolean {
  const moscow = moscowClock(now);
  const day = startDate.slice(0, 10);
  if (moscow.date < day) return false;
  if (moscow.date > day) return true;
  return moscow.minutes >= clockToMinutes(startClock);
}

/** Minutes since the cards started. A clock after midnight counts as the next day. */
export function elapsedSinceStart(startDate: string, startClock: string, now = new Date()): number {
  const moscow = moscowClock(now);
  const start = clockToMinutes(startClock);
  const dayGap = Math.round((Date.parse(`${moscow.date}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const days = Number.isFinite(dayGap) ? Math.max(0, dayGap) : 0;
  return Math.max(0, days * 24 * 60 + moscow.minutes - start);
}

/**
 * Usual length once the field and rebuys are at the series norm.
 * Deepstack is the clock from closed nights (about 17:15–00:00), not a short early guess.
 */
const BASE_HOURS: Record<string, number> = {
  freeroll: 5.8,
  chill: 6.3,
  phoenix: 6.1,
  freezeout: 6.4,
  deepstack: 6.7,
  bounty: 6.8,
  team: 6.5,
  triple: 5.6,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  const elapsed = input.elapsedMinutes ?? 0;
  const field = Math.max(0, input.field);
  const normPeople = Math.max(0, input.normPeople);

  // A small field and zero rebuys in the first hours are not the final totals.
  // Registration stays open, and most rebuys are still ahead.
  const fieldTrust = clamp(elapsed / 240, 0, 1);
  const rebuyTrust = clamp((elapsed - 60) / 180, 0, 1);
  const people = normPeople + (field - normPeople) * fieldTrust;
  const peopleScale = normPeople > 0 ? people / normPeople : 1;
  const expectedRebuys = input.normRebuys * peopleScale;
  const expectedAddons = input.normAddons * peopleScale;
  const rebuys = expectedRebuys + (input.rebuys - expectedRebuys) * rebuyTrust;
  const addons = expectedAddons + (input.addons - expectedAddons) * rebuyTrust;

  let hours = base
    + 0.025 * (people - normPeople)
    + 0.03 * (rebuys - input.normRebuys)
    + 0.02 * (addons - input.normAddons);
  hours = clamp(hours, 4.5, 9);
  const prior = hours;

  // Elapsed ÷ a small early bust rate used to invent a ten-hour night.
  // Trust that pace only once half the field is out, and only as a nudge.
  const left = input.playersLeft;
  if (elapsed >= 90 && field >= 8 && typeof left === 'number') {
    const busted = 1 - clamp(left / field, 0, 1);
    if (busted >= 0.5) {
      const progress = Math.max(0.2, 1 - clamp(left / field, 0, 1) ** 0.8);
      const paceHours = (elapsed / 60) / progress;
      const weight = clamp((busted - 0.5) / 0.5, 0, 1) * 0.45;
      hours = prior * (1 - weight) + paceHours * weight;
      hours = clamp(hours, prior - 1.25, prior + 1.25);
    }
  }
  hours = Math.max(hours, elapsed / 60 + 0.15);
  return Math.round(clamp(hours, 0.25, 10) * 60);
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

/**
 * Usual finish for this series, before the live field and rebuys move it.
 * The cashier end is the time written when the night closes. It is a record,
 * not a target, so the pace grid always aims here.
 */
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
