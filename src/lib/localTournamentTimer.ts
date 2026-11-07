import type { BlindLevel, BlindStructure } from '../data/blindStructures';
import { durationSeconds } from '../data/blindStructures';
import type { HandOfDay } from './pokerCards';
import { safeLocalStorage } from './safeStorage';
import {
  cloneTimerLevels,
  computeLiveClock,
  durationsFromStructure,
  emptyTimerSnapshot,
  freezeTimerSnapshot,
  parseTimerSnapshot,
  type TimerSnapshot,
} from './timerSession';

function storageKey(tournamentId: string): string {
  return `showdown.timerLocal.${tournamentId}`;
}

export function readLocalTournamentTimer(tournamentId: string): TimerSnapshot | null {
  try {
    const raw = safeLocalStorage.getItem(storageKey(tournamentId));
    const snapshot = raw ? parseTimerSnapshot(raw) : null;
    if (!snapshot || snapshot.tournamentId !== tournamentId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeLocalTournamentTimer(snapshot: TimerSnapshot): void {
  if (!snapshot.tournamentId) return;
  safeLocalStorage.setItem(storageKey(snapshot.tournamentId), JSON.stringify(snapshot));
}

/** A fresh stopped clock on the first level. It is never the shared floor session. */
export function createLocalTournamentTimer(
  tournamentId: string,
  structure: BlindStructure,
): TimerSnapshot {
  const durations = durationsFromStructure(structure);
  const levels = cloneTimerLevels(structure.levels);
  return {
    ...emptyTimerSnapshot(),
    tournamentId,
    structureId: structure.id,
    levelIndex: 0,
    secondsLeft: durations[0] ?? 20 * 60,
    isRunning: false,
    levelDurations: durations,
    ...(levels.length ? { levels } : {}),
    anchorAt: new Date().toISOString(),
  };
}

export function commitLocalTournamentTimer(
  snapshot: TimerSnapshot,
  patch: Partial<TimerSnapshot>,
  nowMs = Date.now(),
): TimerSnapshot {
  const next = freezeTimerSnapshot(snapshot, patch, nowMs);
  writeLocalTournamentTimer(next);
  return next;
}

export function localTimerLevelDurations(levels: readonly BlindLevel[], fallbackMinutes = 20): number[] {
  if (levels.length === 0) return [fallbackMinutes * 60];
  return levels.map((level) => durationSeconds(level, fallbackMinutes));
}

export function localHandOfDay(snapshot: TimerSnapshot | null): HandOfDay | undefined {
  return snapshot?.handOfDay;
}

export { computeLiveClock };
