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
  BLIND_STRUCTURES_STORAGE_KEY,
  durationSeconds,
  inferLevelListChange,
  isCatalogBlindStructures,
  persistBlindStructuresLocal,
  readBlindStructuresLocalMeta,
  replaceBlindStructure,
  seedBlindStructures,
  withTripleLifeLadderCopyMigration,
  type BlindLevel,
  type BlindStructure,
  type LevelListChange,
} from '../data/blindStructures';
import { loadBlindStructuresSnapshot, queueBlindStructuresSave } from '../lib/blindStructuresApi';
import {
  BLIND_STRUCTURES_CHANNEL,
  BLIND_STRUCTURES_LOG_ID,
  BLIND_STRUCTURES_ROW_ID,
  decideBlindStructuresSync,
  makeBlindStructuresSnapshot,
  parseBlindStructuresSnapshot,
  type BlindStructuresSnapshot,
} from '../lib/blindStructuresSync';
import {
  playLevelUp,
  unlockBlindsAudio,
} from '../lib/blindsAudio';
import { supabase } from '../lib/supabase';
import {
  TIMER_SESSION_CACHE_KEY,
  TIMER_SESSION_CHANNEL,
  TIMER_SESSION_LOG_ID,
  TIMER_SESSION_ROW_ID,
  computeLiveClock,
  durationsFromStructure,
  emptyTimerSnapshot,
  freezeTimerSnapshot,
  parseTimerSnapshot,
  readTimerSessionCache,
  timerPatchForStructure,
  writeTimerSessionCache,
  type TimerSnapshot,
} from '../lib/timerSession';
import {
  loadTimerSession,
  queueTimerSessionSave,
  timerSessionStorageMode,
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
  | { type: 'setStructures'; structures: BlindStructure[] }
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

function replaceStructureList(structures: BlindStructure[], next: BlindStructure): BlindStructure[] {
  const index = structures.findIndex((row) => row.id === next.id);
  if (index < 0) return [...structures, next];
  return structures.map((row, i) => (i === index ? next : row));
}

function reducer(state: BlindsState, action: BlindsAction): BlindsState {
  switch (action.type) {
    case 'add':
      return { ...state, structures: [...state.structures, action.structure] };
    case 'replace':
      return { ...state, structures: replaceStructureList(state.structures, action.structure) };
    case 'setStructures':
      return { ...state, structures: action.structures };
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
  updateLevels: (structureId: string, levels: BlindLevel[], change?: LevelListChange) => void;
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

function openBroadcastChannel(name: string): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

export function BlindsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, bootState);
  const [timerReady, setTimerReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const readyRef = useRef(false);
  const lastWriteIdRef = useRef(state.snapshot.writeId);
  const persistTimerRef = useRef<number | null>(null);
  const persistStructuresTimerRef = useRef<number | null>(null);
  const pendingStructuresRef = useRef<BlindStructuresSnapshot | null>(null);
  const prevNonceRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const structuresChannelRef = useRef<BroadcastChannel | null>(null);
  const structuresMetaRef = useRef(readBlindStructuresLocalMeta());
  const lastStructuresWriteIdRef = useRef(structuresMetaRef.current.writeId);

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
    let cancelled = false;
    const channel = openBroadcastChannel(TIMER_SESSION_CHANNEL);
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
    void timerSessionStorageMode().then((mode) => {
      if (cancelled) return;
      realtime = supabase
        .channel('blinds-timer-session')
        .on(
          'postgres_changes',
          mode === 'table'
            ? { event: '*', schema: 'public', table: 'timer_sessions', filter: `id=eq.${TIMER_SESSION_ROW_ID}` }
            : { event: '*', schema: 'public', table: 'logs', filter: `id=eq.${TIMER_SESSION_LOG_ID}` },
          (payload) => {
            const row = payload.new as { payload?: unknown; details?: unknown } | undefined;
            const snapshot = parseTimerSnapshot(row?.payload ?? row?.details);
            if (snapshot) applyRemote(snapshot, true);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(poll);
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      channel?.close();
      channelRef.current = null;
      if (realtime) void supabase.removeChannel(realtime);
    };
  }, [applyRemote]);

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

  const syncTimerToStructure = useCallback(
    (structure: BlindStructure, change?: LevelListChange) => {
      const snapshot = stateRef.current.snapshot;
      if (snapshot.structureId !== structure.id) return;
      const patch = timerPatchForStructure(snapshot, structure, change);
      if (patch) commit(patch, { persist: 'now', silent: true });
    },
    [commit],
  );

  const publishStructures = useCallback(
    (structures: BlindStructure[], persist: 'now' | 'debounce') => {
      const migrated = withTripleLifeLadderCopyMigration(
        structures,
        structuresMetaRef.current.migrations ?? [],
      );
      const snapshot = makeBlindStructuresSnapshot(
        migrated.structures,
        structuresMetaRef.current.revision,
        migrated.migrations,
      );
      structuresMetaRef.current = {
        revision: snapshot.revision,
        writeId: snapshot.writeId,
        updatedAt: snapshot.updatedAt,
        migrations: snapshot.migrations,
      };
      lastStructuresWriteIdRef.current = snapshot.writeId;
      persistBlindStructuresLocal(migrated.structures, structuresMetaRef.current);
      pendingStructuresRef.current = snapshot;
      try {
        structuresChannelRef.current?.postMessage(snapshot);
      } catch {
        /* channel closed */
      }
      if (persistStructuresTimerRef.current) {
        window.clearTimeout(persistStructuresTimerRef.current);
        persistStructuresTimerRef.current = null;
      }
      if (persist === 'debounce') {
        persistStructuresTimerRef.current = window.setTimeout(() => {
          persistStructuresTimerRef.current = null;
          pendingStructuresRef.current = null;
          queueBlindStructuresSave(snapshot);
        }, 400);
        return;
      }
      pendingStructuresRef.current = null;
      queueBlindStructuresSave(snapshot);
    },
    [],
  );

  const applyRemoteStructures = useCallback(
    (snapshot: BlindStructuresSnapshot) => {
      if (snapshot.writeId === lastStructuresWriteIdRef.current) return;
      const local = structuresMetaRef.current;
      const decision = decideBlindStructuresSync(
        {
          ...local,
          custom: !isCatalogBlindStructures(stateRef.current.structures),
        },
        snapshot,
      );
      if (decision === 'keep') return;
      if (decision === 'upload') {
        publishStructures(stateRef.current.structures, 'now');
        return;
      }
      const migrated = withTripleLifeLadderCopyMigration(
        snapshot.structures,
        snapshot.migrations ?? [],
      );
      const previous = stateRef.current.structures;
      lastStructuresWriteIdRef.current = snapshot.writeId;
      structuresMetaRef.current = {
        revision: snapshot.revision,
        writeId: snapshot.writeId,
        updatedAt: snapshot.updatedAt,
        migrations: migrated.migrations,
      };
      persistBlindStructuresLocal(migrated.structures, structuresMetaRef.current);
      dispatch({ type: 'setStructures', structures: migrated.structures });
      const activeId = stateRef.current.snapshot.structureId;
      if (activeId) {
        const next = migrated.structures.find((row) => row.id === activeId);
        const prev = previous.find((row) => row.id === activeId);
        if (next) {
          syncTimerToStructure(next, prev ? inferLevelListChange(prev.levels, next.levels) : undefined);
        }
      }
      if (migrated.changed) publishStructures(migrated.structures, 'now');
    },
    [publishStructures, syncTimerToStructure],
  );

  useEffect(() => {
    let cancelled = false;
    const channel = openBroadcastChannel(BLIND_STRUCTURES_CHANNEL);
    structuresChannelRef.current = channel;
    if (channel) {
      channel.onmessage = (event) => {
        const snapshot = parseBlindStructuresSnapshot(event.data);
        if (snapshot) applyRemoteStructures(snapshot);
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== BLIND_STRUCTURES_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          structures?: unknown;
          revision?: unknown;
          writeId?: unknown;
          updatedAt?: unknown;
        };
        const snapshot = parseBlindStructuresSnapshot({
          v: 1,
          writeId: typeof parsed.writeId === 'string' && parsed.writeId ? parsed.writeId : 'storage',
          revision: parsed.revision,
          updatedAt: parsed.updatedAt,
          structures: parsed.structures,
        });
        if (snapshot) applyRemoteStructures(snapshot);
      } catch {
        /* ignore malformed cache */
      }
    };
    window.addEventListener('storage', onStorage);

    void loadBlindStructuresSnapshot()
      .then((remote) => {
        if (cancelled) return;
        if (!remote) {
          publishStructures(stateRef.current.structures, 'now');
          return;
        }
        applyRemoteStructures(remote);
      })
      .catch((error) => {
        console.error(error);
      });

    const poll = window.setInterval(() => {
      void loadBlindStructuresSnapshot()
        .then((remote) => {
          if (remote) applyRemoteStructures(remote);
        })
        .catch((error) => {
          console.error(error);
        });
    }, 2500);

    let realtime: ReturnType<typeof supabase.channel> | null = null;
    void timerSessionStorageMode().then((mode) => {
      if (cancelled) return;
      realtime = supabase
        .channel('blinds-structures-sync')
        .on(
          'postgres_changes',
          mode === 'table'
            ? {
                event: '*',
                schema: 'public',
                table: 'timer_sessions',
                filter: `id=eq.${BLIND_STRUCTURES_ROW_ID}`,
              }
            : { event: '*', schema: 'public', table: 'logs', filter: `id=eq.${BLIND_STRUCTURES_LOG_ID}` },
          (payload) => {
            const row = payload.new as { payload?: unknown; details?: unknown } | undefined;
            const snapshot = parseBlindStructuresSnapshot(row?.payload ?? row?.details);
            if (snapshot) applyRemoteStructures(snapshot);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.clearInterval(poll);
      if (persistStructuresTimerRef.current) {
        window.clearTimeout(persistStructuresTimerRef.current);
        persistStructuresTimerRef.current = null;
      }
      const pending = pendingStructuresRef.current;
      if (pending) {
        pendingStructuresRef.current = null;
        queueBlindStructuresSave(pending);
      }
      channel?.close();
      structuresChannelRef.current = null;
      if (realtime) void supabase.removeChannel(realtime);
    };
  }, [applyRemoteStructures, publishStructures]);

  const addStructure = useCallback(
    (structure: BlindStructure) => {
      addBlindStructure(structure);
      dispatch({ type: 'add', structure });
      publishStructures([...stateRef.current.structures, structure], 'now');
    },
    [publishStructures],
  );

  const updateStructure = useCallback(
    (structure: BlindStructure) => {
      replaceBlindStructure(structure);
      dispatch({ type: 'replace', structure });
      publishStructures(replaceStructureList(stateRef.current.structures, structure), 'debounce');
      syncTimerToStructure(structure);
    },
    [publishStructures, syncTimerToStructure],
  );

  const updateLevels = useCallback(
    (structureId: string, levels: BlindLevel[], change?: LevelListChange) => {
      const current = stateRef.current.structures.find((row) => row.id === structureId);
      if (!current) return;
      const next = { ...current, levels };
      replaceBlindStructure(next);
      dispatch({ type: 'replace', structure: next });
      publishStructures(replaceStructureList(stateRef.current.structures, next), 'debounce');
      syncTimerToStructure(next, change);
    },
    [publishStructures, syncTimerToStructure],
  );

  const ensureTimer = useCallback(
    (structureId: string | null) => {
      if (!structureId || !readyRef.current) return;
      const current = stateRef.current;
      const live = computeLiveClock(current.snapshot);
      const structure = current.structures.find((row) => row.id === structureId);
      if (!structure) return;
      if (current.snapshot.structureId === structureId) {
        syncTimerToStructure(structure);
        return;
      }
      if (live.isRunning) return;
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
    [commit, syncTimerToStructure],
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
