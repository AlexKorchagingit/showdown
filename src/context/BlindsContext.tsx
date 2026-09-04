import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  addBlindStructure,
  durationSeconds,
  replaceBlindStructure,
  seedBlindStructures,
  type BlindLevel,
  type BlindStructure,
} from '../data/blindStructures';
import {
  playLevelUp,
  unlockBlindsAudio,
} from '../lib/blindsAudio';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';
import {
  TIMER_SESSION_CACHE_KEY,
  TIMER_SESSION_CHANNEL,
  TIMER_SESSION_ROW_ID,
  computeLiveClock,
  durationsFromStructure,
  emptyTimerSnapshot,
  freezeTimerSnapshot,
  parseTimerSnapshot,
  readTimerSessionCache,
  writeTimerSessionCache,
  type TimerSnapshot,
} from '../lib/timerSession';
import {
  loadTimerSession,
  queueTimerSessionSave,
} from '../lib/timerSessionApi';

interface BlindsState {
  structures: BlindStructure[];
  snapshot: TimerSnapshot;
  levelIndex: number;
  secondsLeft: number;
  isRunning: boolean;
  linkedTournamentId: string | null;
  avgStackOverride: number | null;
  chipleaderId: string | null;
  totalEntries: number | null;
  rebuyCount: number | null;
  chipleaderStack: number | null;
  levelUpNonce: number;
}

type BlindsAction =
  | { type: 'add'; structure: BlindStructure }
  | { type: 'replace'; structure: BlindStructure }
  | { type: 'commit'; snapshot: TimerSnapshot; now: number; silent?: boolean }
  | { type: 'tick'; now: number };

function findStructure(state: BlindsState, id: string | null): BlindStructure | undefined {
  if (!id) return undefined;
  return state.structures.find((s) => s.id === id);
}

function applySnapshot(
  state: BlindsState,
  snapshot: TimerSnapshot,
  now: number,
  silent = false,
): BlindsState {
  const live = computeLiveClock(snapshot, now);
  const leveledUp = !silent && live.levelIndex > state.levelIndex;
  return {
    ...state,
    snapshot,
    levelIndex: live.levelIndex,
    secondsLeft: live.secondsLeft,
    isRunning: live.isRunning,
    linkedTournamentId: snapshot.tournamentId,
    avgStackOverride: snapshot.avgStackOverride,
    chipleaderId: snapshot.chipleaderId,
    totalEntries: snapshot.totalEntries,
    rebuyCount: snapshot.rebuyCount,
    chipleaderStack: snapshot.chipleaderStack,
    levelUpNonce: leveledUp ? state.levelUpNonce + 1 : state.levelUpNonce,
  };
}

function afterStructureChange(state: BlindsState, next: BlindStructure): BlindsState {
  const structures = state.structures.map((s) => (s.id === next.id ? next : s));
  const synced: BlindsState = { ...state, structures };
  if (state.snapshot.structureId !== next.id) return synced;
  const durations = durationsFromStructure(next);
  const snapshot: TimerSnapshot = { ...state.snapshot, levelDurations: durations };
  return applySnapshot(synced, snapshot, Date.now(), true);
}

function reducer(state: BlindsState, action: BlindsAction): BlindsState {
  switch (action.type) {
    case 'add':
      return { ...state, structures: [...state.structures, action.structure] };
    case 'replace':
      return afterStructureChange(state, action.structure);
    case 'commit':
      return applySnapshot(state, action.snapshot, action.now, action.silent);
    case 'tick': {
      const live = computeLiveClock(state.snapshot, action.now);
      if (
        !live.isRunning &&
        !state.isRunning &&
        live.levelIndex === state.levelIndex &&
        live.secondsLeft === state.secondsLeft
      ) {
        return state;
      }
      return applySnapshot(state, state.snapshot, action.now);
    }
    default:
      return state;
  }
}

function bootState(): BlindsState {
  const snapshot = readTimerSessionCache() ?? emptyTimerSnapshot();
  const live = computeLiveClock(snapshot);
  return {
    structures: seedBlindStructures(),
    snapshot,
    levelIndex: live.levelIndex,
    secondsLeft: live.secondsLeft,
    isRunning: live.isRunning,
    linkedTournamentId: snapshot.tournamentId,
    avgStackOverride: snapshot.avgStackOverride,
    chipleaderId: snapshot.chipleaderId,
    totalEntries: snapshot.totalEntries,
    rebuyCount: snapshot.rebuyCount,
    chipleaderStack: snapshot.chipleaderStack,
    levelUpNonce: 0,
  };
}

interface BlindsContextValue {
  timerReady: boolean;
  structures: BlindStructure[];
  activeStructureId: string | null;
  levelIndex: number;
  secondsLeft: number;
  levelDurationSeconds: number;
  isRunning: boolean;
  activeStructure: BlindStructure | undefined;
  addStructure: (structure: BlindStructure) => void;
  updateStructure: (structure: BlindStructure) => void;
  updateLevels: (structureId: string, levels: BlindLevel[]) => void;
  ensureTimer: (structureId: string | null) => void;
  setRunning: (value: boolean) => void;
  restartLevel: () => void;
  skipLevel: (delta: -1 | 1) => void;
  adjustSeconds: (delta: number) => void;
  linkedTournamentId: string | null;
  avgStackOverride: number | null;
  chipleaderId: string | null;
  totalEntries: number | null;
  rebuyCount: number | null;
  chipleaderStack: number | null;
  setLinkedTournament: (tournamentId: string | null) => void;
  setAvgStackOverride: (value: number | null) => void;
  setChipleader: (userId: string | null) => void;
  setTotalEntries: (value: number | null) => void;
  setRebuyCount: (value: number | null) => void;
  setChipleaderStack: (value: number | null) => void;
}

const BlindsContext = createContext<BlindsContextValue | null>(null);

function openTimerChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    return new BroadcastChannel(TIMER_SESSION_CHANNEL);
  } catch {
    return null;
  }
}

export function BlindsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useUser();
  const [state, dispatch] = useReducer(reducer, undefined, bootState);
  const [timerReady, setTimerReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const readyRef = useRef(false);
  const lastWriteIdRef = useRef(state.snapshot.writeId);
  const persistTimerRef = useRef<number | null>(null);
  const prevNonceRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const publish = useCallback((snapshot: TimerSnapshot, persist: 'now' | 'debounce' | 'none') => {
    lastWriteIdRef.current = snapshot.writeId;
    writeTimerSessionCache(snapshot);
    try {
      channelRef.current?.postMessage(snapshot);
    } catch {
      /* channel closed */
    }
    if (persist === 'none') return;
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (persist === 'debounce') {
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null;
        queueTimerSessionSave(snapshot);
      }, 400);
      return;
    }
    queueTimerSessionSave(snapshot);
  }, []);

  const commit = useCallback(
    (patch: Partial<TimerSnapshot>, options?: { persist?: 'now' | 'debounce' | 'none'; silent?: boolean }) => {
      const now = Date.now();
      const snapshot = freezeTimerSnapshot(stateRef.current.snapshot, patch, now);
      dispatch({ type: 'commit', snapshot, now, silent: options?.silent });
      publish(snapshot, options?.persist ?? 'now');
    },
    [publish],
  );

  const applyRemote = useCallback((snapshot: TimerSnapshot, silent: boolean) => {
    if (snapshot.writeId === lastWriteIdRef.current) return;
    const local = stateRef.current.snapshot;
    if (snapshot.revision < local.revision) return;
    if (snapshot.revision === local.revision && snapshot.updatedAt < local.updatedAt) return;
    lastWriteIdRef.current = snapshot.writeId;
    writeTimerSessionCache(snapshot);
    dispatch({ type: 'commit', snapshot, now: Date.now(), silent });
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      readyRef.current = true;
      setTimerReady(true);
      return;
    }
    setTimerReady(false);
    let cancelled = false;
    const channel = openTimerChannel();
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (event) => {
        const snapshot = parseTimerSnapshot(event.data);
        if (snapshot) applyRemote(snapshot, true);
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== TIMER_SESSION_CACHE_KEY || !event.newValue) return;
      const snapshot = parseTimerSnapshot(event.newValue);
      if (snapshot) applyRemote(snapshot, true);
    };
    window.addEventListener('storage', onStorage);

    void (async () => {
      try {
        const remote = await loadTimerSession();
        if (cancelled) return;
        if (remote) applyRemote(remote, true);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          readyRef.current = true;
          setTimerReady(true);
        }
      }
    })();

    const poll = window.setInterval(() => {
      void loadTimerSession()
        .then((remote) => {
          if (remote) applyRemote(remote, true);
        })
        .catch((error) => {
          console.error(error);
        });
    }, 2500);

    let realtime: ReturnType<typeof supabase.channel> | null = null;
    realtime = supabase
      .channel('blinds-timer-session')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timer_sessions', filter: `id=eq.${TIMER_SESSION_ROW_ID}` },
        (payload) => {
          const row = payload.new as { payload?: unknown } | undefined;
          const snapshot = parseTimerSnapshot(row?.payload);
          if (snapshot) applyRemote(snapshot, true);
        })
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(poll);
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      channel?.close();
      channelRef.current = null;
      if (realtime) void supabase.removeChannel(realtime);
    };
  }, [applyRemote, isAdmin]);

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'tick', now: Date.now() });
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (state.levelUpNonce === 0 || state.levelUpNonce === prevNonceRef.current) return;
    prevNonceRef.current = state.levelUpNonce;
    playLevelUp();
  }, [state.levelUpNonce]);

  const addStructure = useCallback((structure: BlindStructure) => {
    addBlindStructure(structure);
    dispatch({ type: 'add', structure });
  }, []);

  const updateStructure = useCallback((structure: BlindStructure) => {
    replaceBlindStructure(structure);
    dispatch({ type: 'replace', structure });
  }, []);

  const updateLevels = useCallback(
    (structureId: string, levels: BlindLevel[]) => {
      const current = state.structures.find((s) => s.id === structureId);
      if (!current) return;
      const next = { ...current, levels };
      replaceBlindStructure(next);
      dispatch({ type: 'replace', structure: next });
    },
    [state.structures],
  );

  const ensureTimer = useCallback(
    (structureId: string | null) => {
      if (!structureId || !readyRef.current) return;
      const current = stateRef.current;
      const live = computeLiveClock(current.snapshot);
      if (current.snapshot.structureId === structureId) return;
      if (live.isRunning) return;
      const structure = current.structures.find((row) => row.id === structureId);
      if (!structure) return;
      const durations = durationsFromStructure(structure);
      commit(
        {
          structureId,
          levelIndex: 0,
          secondsLeft: durations[0] ?? 20 * 60,
          isRunning: false,
          levelDurations: durations,
        },
        { persist: 'now', silent: true },
      );
    },
    [commit],
  );

  const setRunning = useCallback(
    (value: boolean) => {
      if (value) unlockBlindsAudio();
      commit({ isRunning: value });
    },
    [commit],
  );

  const restartLevel = useCallback(() => {
    const current = stateRef.current;
    const live = computeLiveClock(current.snapshot);
    const duration = current.snapshot.levelDurations[live.levelIndex] ?? 20 * 60;
    commit({
      levelIndex: live.levelIndex,
      secondsLeft: duration,
      isRunning: false,
    });
  }, [commit]);

  const skipLevel = useCallback(
    (delta: -1 | 1) => {
      const current = stateRef.current;
      const live = computeLiveClock(current.snapshot);
      const last = Math.max(0, current.snapshot.levelDurations.length - 1);
      const nextIndex = Math.min(last, Math.max(0, live.levelIndex + delta));
      if (nextIndex === live.levelIndex) {
        if (delta < 0) {
          commit({
            secondsLeft: current.snapshot.levelDurations[nextIndex] ?? live.secondsLeft,
            isRunning: false,
          });
        }
        return;
      }
      commit({
        levelIndex: nextIndex,
        secondsLeft: current.snapshot.levelDurations[nextIndex] ?? 20 * 60,
      });
    },
    [commit],
  );

  const adjustSeconds = useCallback(
    (delta: number) => {
      const live = computeLiveClock(stateRef.current.snapshot);
      commit({ secondsLeft: Math.max(0, live.secondsLeft + delta) });
    },
    [commit],
  );

  const setLinkedTournament = useCallback(
    (tournamentId: string | null) => {
      const current = stateRef.current.snapshot;
      commit({
        tournamentId,
        chipleaderId: tournamentId === current.tournamentId ? current.chipleaderId : null,
        chipleaderStack: tournamentId === current.tournamentId ? current.chipleaderStack : null,
      });
    },
    [commit],
  );

  const setAvgStackOverride = useCallback(
    (value: number | null) => {
      commit({ avgStackOverride: value }, { persist: 'debounce' });
    },
    [commit],
  );

  const setChipleader = useCallback(
    (userId: string | null) => {
      const current = stateRef.current.snapshot;
      commit({
        chipleaderId: userId,
        chipleaderStack: userId === current.chipleaderId ? current.chipleaderStack : null,
      });
    },
    [commit],
  );

  const setTotalEntries = useCallback(
    (value: number | null) => {
      commit({ totalEntries: value }, { persist: 'debounce' });
    },
    [commit],
  );

  const setRebuyCount = useCallback(
    (value: number | null) => {
      commit({ rebuyCount: value }, { persist: 'debounce' });
    },
    [commit],
  );

  const setChipleaderStack = useCallback(
    (value: number | null) => {
      commit({ chipleaderStack: value }, { persist: 'debounce' });
    },
    [commit],
  );

  const activeStructure = findStructure(state, state.snapshot.structureId);
  const levelDurationSeconds =
    state.snapshot.levelDurations[state.levelIndex] ??
    durationSeconds(activeStructure?.levels[state.levelIndex], activeStructure?.levelDuration);

  const value = useMemo<BlindsContextValue>(
    () => ({
      timerReady,
      structures: state.structures,
      activeStructureId: state.snapshot.structureId,
      levelIndex: state.levelIndex,
      secondsLeft: state.secondsLeft,
      levelDurationSeconds,
      isRunning: state.isRunning,
      activeStructure,
      addStructure,
      updateStructure,
      updateLevels,
      ensureTimer,
      setRunning,
      restartLevel,
      skipLevel,
      adjustSeconds,
      linkedTournamentId: state.linkedTournamentId,
      avgStackOverride: state.avgStackOverride,
      chipleaderId: state.chipleaderId,
      totalEntries: state.totalEntries,
      rebuyCount: state.rebuyCount,
      chipleaderStack: state.chipleaderStack,
      setLinkedTournament,
      setAvgStackOverride,
      setChipleader,
      setTotalEntries,
      setRebuyCount,
      setChipleaderStack,
    }),
    [
      timerReady,
      state,
      levelDurationSeconds,
      activeStructure,
      addStructure,
      updateStructure,
      updateLevels,
      ensureTimer,
      setRunning,
      restartLevel,
      skipLevel,
      adjustSeconds,
      setLinkedTournament,
      setAvgStackOverride,
      setChipleader,
      setTotalEntries,
      setRebuyCount,
      setChipleaderStack,
    ],
  );

  return <BlindsContext.Provider value={value}>{children}</BlindsContext.Provider>;
}

export function useBlinds() {
  const ctx = useContext(BlindsContext);
  if (!ctx) throw new Error('useBlinds must be used within BlindsProvider');
  return ctx;
}
