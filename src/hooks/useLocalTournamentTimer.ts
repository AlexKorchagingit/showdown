import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlindLevel, BlindStructure } from '../data/blindStructures';
import type { HandOfDay } from '../lib/pokerCards';
import { normalizeHandCards } from '../lib/pokerCards';
import {
  commitLocalTournamentTimer,
  computeLiveClock,
  createLocalTournamentTimer,
  localTimerLevelDurations,
  readLocalTournamentTimer,
} from '../lib/localTournamentTimer';
import type { TimerSnapshot } from '../lib/timerSession';

/** Device-only clock for a second tournament. It does not read or write the floor timer. */
export function useLocalTournamentTimer(
  tournamentId: string | null,
  structure: BlindStructure | undefined,
) {
  const [snapshot, setSnapshot] = useState<TimerSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const structureRef = useRef(structure);
  structureRef.current = structure;

  useEffect(() => {
    const current = structureRef.current;
    if (!tournamentId || !current) {
      setSnapshot(null);
      return;
    }
    const stored = readLocalTournamentTimer(tournamentId);
    const next = stored?.structureId === current.id
      ? stored
      : createLocalTournamentTimer(tournamentId, current);
    setSnapshot(next);
  }, [structure?.id, tournamentId]);

  const running = snapshot?.isRunning === true;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running, snapshot?.anchorAt]);

  const commit = useCallback((patch: Partial<TimerSnapshot>) => {
    setSnapshot((current) => (current ? commitLocalTournamentTimer(current, patch) : current));
    setNow(Date.now());
  }, []);

  const clock = snapshot ? computeLiveClock(snapshot, now) : null;

  const setRunning = useCallback((value: boolean) => {
    commit({ isRunning: value });
  }, [commit]);

  const restartLevel = useCallback(() => {
    if (!snapshot) return;
    const live = computeLiveClock(snapshot);
    const duration = snapshot.levelDurations[live.levelIndex] ?? 20 * 60;
    commit({ levelIndex: live.levelIndex, secondsLeft: duration, isRunning: false });
  }, [commit, snapshot]);

  const skipLevel = useCallback((delta: -1 | 1) => {
    if (!snapshot) return;
    const live = computeLiveClock(snapshot);
    const last = Math.max(0, snapshot.levelDurations.length - 1);
    const nextIndex = Math.min(last, Math.max(0, live.levelIndex + delta));
    if (nextIndex === live.levelIndex) {
      if (delta < 0) {
        commit({
          secondsLeft: snapshot.levelDurations[nextIndex] ?? live.secondsLeft,
          isRunning: false,
        });
      }
      return;
    }
    commit({
      levelIndex: nextIndex,
      secondsLeft: snapshot.levelDurations[nextIndex] ?? 20 * 60,
    });
  }, [commit, snapshot]);

  const setHandOfDay = useCallback((hand: HandOfDay) => {
    commit({ handOfDay: { on: hand.on, cards: normalizeHandCards(hand.cards) } });
  }, [commit]);

  const applyLevelDurations = useCallback((levels: BlindLevel[]) => {
    if (!snapshot || !structure) return false;
    const live = computeLiveClock(snapshot);
    const durations = localTimerLevelDurations(levels, structure.levelDuration);
    const secondsLeft = Math.min(live.secondsLeft, durations[live.levelIndex] ?? live.secondsLeft);
    commit({
      levels,
      levelDurations: durations,
      secondsLeft,
      isRunning: live.isRunning && secondsLeft > 0,
    });
    return true;
  }, [commit, snapshot, structure]);

  return {
    ready: Boolean(clock && snapshot),
    levelIndex: clock?.levelIndex ?? 0,
    secondsLeft: clock?.secondsLeft ?? 0,
    isRunning: clock?.isRunning ?? false,
    handOfDay: snapshot?.handOfDay,
    snapshot,
    setRunning,
    restartLevel,
    skipLevel,
    setHandOfDay,
    applyLevelDurations,
  };
}
