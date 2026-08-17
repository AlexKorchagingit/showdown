import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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

interface BlindsState {
  structures: BlindStructure[];
  activeStructureId: string | null;
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
  | { type: 'ensure'; structureId: string }
  | { type: 'setRunning'; value: boolean }
  | { type: 'restart' }
  | { type: 'skip'; delta: -1 | 1 }
  | { type: 'adjust'; delta: number }
  | { type: 'tick'; elapsed: number }
  | { type: 'linkTournament'; tournamentId: string | null }
  | { type: 'setAvgStack'; value: number | null }
  | { type: 'setChipleader'; userId: string | null }
  | { type: 'setTotalEntries'; value: number | null }
  | { type: 'setRebuyCount'; value: number | null }
  | { type: 'setChipleaderStack'; value: number | null };

function findStructure(state: BlindsState, id: string | null): BlindStructure | undefined {
  if (!id) return undefined;
  return state.structures.find((s) => s.id === id);
}

function fullDuration(state: BlindsState, index = state.levelIndex): number {
  const structure = findStructure(state, state.activeStructureId);
  return durationSeconds(structure?.levels[index]);
}

function clampIndex(state: BlindsState, index: number): number {
  const structure = findStructure(state, state.activeStructureId);
  const last = Math.max(0, (structure?.levels.length ?? 1) - 1);
  return Math.min(last, Math.max(0, index));
}

function afterStructureChange(state: BlindsState, next: BlindStructure): BlindsState {
  const structures = state.structures.map((s) => (s.id === next.id ? next : s));
  const synced: BlindsState = { ...state, structures };

  if (state.activeStructureId !== next.id) return synced;

  const levelIndex = clampIndex(synced, state.levelIndex);
  const maxSeconds = durationSeconds(next.levels[levelIndex]);
  return {
    ...synced,
    levelIndex,
    secondsLeft: Math.min(state.secondsLeft, maxSeconds),
  };
}

function reducer(state: BlindsState, action: BlindsAction): BlindsState {
  switch (action.type) {
    case 'add':
      return { ...state, structures: [...state.structures, action.structure] };
    case 'replace':
      return afterStructureChange(state, action.structure);
    case 'ensure': {
      const structure = findStructure(state, action.structureId);
      if (!structure) return state;
      if (state.activeStructureId === action.structureId) return state;
      return {
        ...state,
        activeStructureId: action.structureId,
        levelIndex: 0,
        secondsLeft: durationSeconds(structure.levels[0]),
        isRunning: false,
      };
    }
    case 'setRunning':
      return { ...state, isRunning: action.value };
    case 'restart':
      return { ...state, secondsLeft: fullDuration(state), isRunning: false };
    case 'adjust':
      return { ...state, secondsLeft: Math.max(0, state.secondsLeft + action.delta) };
    case 'skip': {
      const structure = findStructure(state, state.activeStructureId);
      if (!structure) return state;
      const nextIndex = clampIndex(state, state.levelIndex + action.delta);
      if (nextIndex === state.levelIndex) {
        if (action.delta < 0) {
          return { ...state, secondsLeft: fullDuration(state), isRunning: false };
        }
        return state;
      }
      return {
        ...state,
        levelIndex: nextIndex,
        secondsLeft: durationSeconds(structure.levels[nextIndex]),
      };
    }
    case 'tick': {
      if (!state.isRunning) return state;
      const structure = findStructure(state, state.activeStructureId);
      if (!structure) return { ...state, isRunning: false };

      let left = state.secondsLeft - action.elapsed;
      let index = state.levelIndex;
      let running = true;

      while (left <= 0 && running) {
        if (index >= structure.levels.length - 1) {
          left = 0;
          running = false;
          break;
        }
        index += 1;
        left += durationSeconds(structure.levels[index]);
      }

      const leveledUp = index > state.levelIndex;

      return {
        ...state,
        secondsLeft: left,
        levelIndex: index,
        isRunning: running,
        levelUpNonce: leveledUp ? state.levelUpNonce + 1 : state.levelUpNonce,
      };
    }
    case 'linkTournament':
      return {
        ...state,
        linkedTournamentId: action.tournamentId,
        chipleaderId: action.tournamentId === state.linkedTournamentId ? state.chipleaderId : null,
        chipleaderStack:
          action.tournamentId === state.linkedTournamentId ? state.chipleaderStack : null,
      };
    case 'setAvgStack':
      return { ...state, avgStackOverride: action.value };
    case 'setChipleader':
      return {
        ...state,
        chipleaderId: action.userId,
        chipleaderStack: action.userId === state.chipleaderId ? state.chipleaderStack : null,
      };
    case 'setTotalEntries':
      return { ...state, totalEntries: action.value };
    case 'setRebuyCount':
      return { ...state, rebuyCount: action.value };
    case 'setChipleaderStack':
      return { ...state, chipleaderStack: action.value };
    default:
      return state;
  }
}

interface BlindsContextValue {
  structures: BlindStructure[];
  activeStructureId: string | null;
  levelIndex: number;
  secondsLeft: number;
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

export function BlindsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    structures: seedBlindStructures(),
    activeStructureId: null,
    levelIndex: 0,
    secondsLeft: 20 * 60,
    isRunning: false,
    linkedTournamentId: null,
    avgStackOverride: null,
    chipleaderId: null,
    totalEntries: null,
    rebuyCount: null,
    chipleaderStack: null,
    levelUpNonce: 0,
  }));

  const prevNonceRef = useRef(0);

  useEffect(() => {
    if (!state.isRunning) return;

    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      dispatch({ type: 'tick', elapsed });
    }, 250);

    return () => window.clearInterval(id);
  }, [state.isRunning]);

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

  const ensureTimer = useCallback((structureId: string | null) => {
    if (structureId) dispatch({ type: 'ensure', structureId });
  }, []);

  const setRunning = useCallback((value: boolean) => {
    if (value) unlockBlindsAudio();
    dispatch({ type: 'setRunning', value });
  }, []);

  const value = useMemo<BlindsContextValue>(
    () => ({
      structures: state.structures,
      activeStructureId: state.activeStructureId,
      levelIndex: state.levelIndex,
      secondsLeft: state.secondsLeft,
      isRunning: state.isRunning,
      activeStructure: findStructure(state, state.activeStructureId),
      addStructure,
      updateStructure,
      updateLevels,
      ensureTimer,
      setRunning,
      restartLevel: () => dispatch({ type: 'restart' }),
      skipLevel: (delta) => dispatch({ type: 'skip', delta }),
      adjustSeconds: (delta) => dispatch({ type: 'adjust', delta }),
      linkedTournamentId: state.linkedTournamentId,
      avgStackOverride: state.avgStackOverride,
      chipleaderId: state.chipleaderId,
      totalEntries: state.totalEntries,
      rebuyCount: state.rebuyCount,
      chipleaderStack: state.chipleaderStack,
      setLinkedTournament: (tournamentId) => dispatch({ type: 'linkTournament', tournamentId }),
      setAvgStackOverride: (value) => dispatch({ type: 'setAvgStack', value }),
      setChipleader: (userId) => dispatch({ type: 'setChipleader', userId }),
      setTotalEntries: (value) => dispatch({ type: 'setTotalEntries', value }),
      setRebuyCount: (value) => dispatch({ type: 'setRebuyCount', value }),
      setChipleaderStack: (value) => dispatch({ type: 'setChipleaderStack', value }),
    }),
    [state, addStructure, updateStructure, updateLevels, ensureTimer, setRunning],
  );

  return <BlindsContext.Provider value={value}>{children}</BlindsContext.Provider>;
}

export function useBlinds() {
  const ctx = useContext(BlindsContext);
  if (!ctx) throw new Error('useBlinds must be used within BlindsProvider');
  return ctx;
}
