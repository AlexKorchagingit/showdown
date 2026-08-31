import {
  durationSeconds,
  type BlindStructure,
  type LevelListChange,
} from '../data/blindStructures';

export const TIMER_SESSION_CACHE_KEY = 'showdown.timerSession';
export const TIMER_SESSION_CHANNEL = 'showdown-timer-session';
export const TIMER_SESSION_ROW_ID = 'live';
export const TIMER_SESSION_LOG_ID = 'blinds-timer-session';
export const TIMER_SESSION_LOG_ACTION = '__timer_session__';

export type TimerSnapshot = {
  v: 1;
  writeId: string;
  revision: number;
  updatedAt: number;
  structureId: string | null;
  tournamentId: string | null;
  levelIndex: number;
  secondsLeft: number;
  isRunning: boolean;
  anchorAt: string;
  levelDurations: number[];
  avgStackOverride: number | null;
  chipleaderId: string | null;
  totalEntries: number | null;
  rebuyCount: number | null;
  chipleaderStack: number | null;
};

export type LiveTimerClock = {
  levelIndex: number;
  secondsLeft: number;
  isRunning: boolean;
};

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asDurationList(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) return [20 * 60];
  const durations = value.map((item) => Math.max(1, Math.trunc(asFiniteNumber(item, 20 * 60))));
  return durations.length ? durations : [20 * 60];
}

export function newTimerWriteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function durationsFromStructure(structure: BlindStructure | undefined): number[] {
  if (!structure?.levels.length) return [20 * 60];
  return structure.levels.map((level) => durationSeconds(level, structure.levelDuration));
}

export function emptyTimerSnapshot(): TimerSnapshot {
  return {
    v: 1,
    writeId: 'boot',
    revision: 0,
    updatedAt: 0,
    structureId: null,
    tournamentId: null,
    levelIndex: 0,
    secondsLeft: 20 * 60,
    isRunning: false,
    anchorAt: new Date(0).toISOString(),
    levelDurations: [20 * 60],
    avgStackOverride: null,
    chipleaderId: null,
    totalEntries: null,
    rebuyCount: null,
    chipleaderStack: null,
  };
}

export function parseTimerSnapshot(raw: unknown): TimerSnapshot | null {
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<TimerSnapshot>;
  if (row.v !== 1) return null;
  if (typeof row.writeId !== 'string' || !row.writeId) return null;
  if (typeof row.anchorAt !== 'string' || !row.anchorAt) return null;

  const levelDurations = asDurationList(row.levelDurations);
  const last = Math.max(0, levelDurations.length - 1);
  const levelIndex = Math.min(last, Math.max(0, Math.trunc(asFiniteNumber(row.levelIndex, 0))));

  return {
    v: 1,
    writeId: row.writeId,
    revision: Math.max(0, Math.trunc(asFiniteNumber(row.revision, 0))),
    updatedAt: Math.max(0, asFiniteNumber(row.updatedAt, 0)),
    structureId: asNullableString(row.structureId),
    tournamentId: asNullableString(row.tournamentId),
    levelIndex,
    secondsLeft: Math.max(0, asFiniteNumber(row.secondsLeft, levelDurations[levelIndex] ?? 20 * 60)),
    isRunning: row.isRunning === true,
    anchorAt: row.anchorAt,
    levelDurations,
    avgStackOverride: asNullableNumber(row.avgStackOverride),
    chipleaderId: asNullableString(row.chipleaderId),
    totalEntries: asNullableNumber(row.totalEntries),
    rebuyCount: asNullableNumber(row.rebuyCount),
    chipleaderStack: asNullableNumber(row.chipleaderStack),
  };
}

export function computeLiveClock(snapshot: TimerSnapshot, nowMs = Date.now()): LiveTimerClock {
  const last = Math.max(0, snapshot.levelDurations.length - 1);
  let index = Math.min(last, Math.max(0, snapshot.levelIndex));
  let left = Math.max(0, snapshot.secondsLeft);
  let running = snapshot.isRunning === true;

  if (!running) {
    return { levelIndex: index, secondsLeft: left, isRunning: false };
  }

  const anchorMs = Date.parse(snapshot.anchorAt);
  const elapsed = Number.isFinite(anchorMs) ? Math.max(0, (nowMs - anchorMs) / 1000) : 0;
  left -= elapsed;

  while (left <= 0) {
    if (index >= last) {
      return { levelIndex: last, secondsLeft: 0, isRunning: false };
    }
    index += 1;
    left += snapshot.levelDurations[index] ?? 20 * 60;
  }

  return { levelIndex: index, secondsLeft: left, isRunning: true };
}

function durationsEqual(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Keep the live clock on the same physical rung after the structure list changes.
 * Insert-after-index `i` shifts later rungs; a duration edit of the current
 * level only caps remaining time so it cannot exceed the new length.
 */
export function timerPatchForStructure(
  snapshot: TimerSnapshot,
  structure: BlindStructure,
  change?: LevelListChange,
  nowMs = Date.now(),
): Partial<TimerSnapshot> | null {
  const nextDurations = durationsFromStructure(structure);
  const live = computeLiveClock(snapshot, nowMs);
  let levelIndex = live.levelIndex;
  if (typeof change?.insertedAt === 'number' && live.levelIndex > change.insertedAt) {
    levelIndex += 1;
  } else if (typeof change?.removedAt === 'number' && live.levelIndex > change.removedAt) {
    levelIndex -= 1;
  }
  const last = Math.max(0, nextDurations.length - 1);
  levelIndex = Math.min(last, Math.max(0, levelIndex));
  const nextDuration = nextDurations[levelIndex] ?? 20 * 60;
  const secondsLeft = Math.min(Math.max(0, live.secondsLeft), nextDuration);
  const durationsChanged = !durationsEqual(nextDurations, snapshot.levelDurations);
  const indexChanged = levelIndex !== live.levelIndex;
  const capped = secondsLeft + 0.05 < live.secondsLeft;
  if (!durationsChanged && !indexChanged && !capped) return null;
  return {
    levelIndex,
    secondsLeft,
    isRunning: live.isRunning && secondsLeft > 0,
    levelDurations: nextDurations,
  };
}

export function freezeTimerSnapshot(
  snapshot: TimerSnapshot,
  patch: Partial<TimerSnapshot>,
  nowMs = Date.now(),
): TimerSnapshot {
  const live = computeLiveClock(snapshot, nowMs);
  return {
    ...snapshot,
    levelIndex: live.levelIndex,
    secondsLeft: live.secondsLeft,
    isRunning: live.isRunning,
    writeId: newTimerWriteId(),
    revision: snapshot.revision + 1,
    updatedAt: nowMs,
    anchorAt: new Date(nowMs).toISOString(),
    ...patch,
  };
}

export function readTimerSessionCache(): TimerSnapshot | null {
  try {
    const raw = localStorage.getItem(TIMER_SESSION_CACHE_KEY);
    return raw ? parseTimerSnapshot(raw) : null;
  } catch {
    return null;
  }
}

export function writeTimerSessionCache(snapshot: TimerSnapshot): void {
  try {
    localStorage.setItem(TIMER_SESSION_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage unavailable */
  }
}
