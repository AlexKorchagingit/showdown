export type BlindLevel = {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
  isBreak?: boolean;
};

export type TournamentStructure = {
  id: string;
  name: string;
  levels: BlindLevel[];
};

export interface PrizePlace {
  place: number;
  share: number;
}

export interface BlindStructure extends TournamentStructure {
  /** Default minutes used when adding a new level. */
  levelDuration: number;
  guarantee: number;
  payouts: PrizePlace[];
}

export const DEFAULT_PAYOUTS: PrizePlace[] = [
  { place: 1, share: 50 },
  { place: 2, share: 30 },
  { place: 3, share: 12 },
  { place: 4, share: 8 },
];

const STORAGE_KEY = 'showdown.blindStructures';
const STORAGE_VERSION = 'extended-v1';

type BlindStep = { sb: number; bb: number };

/** Playing levels before the scheduled break. */
const PRE_BREAK_STEPS: BlindStep[] = [
  { sb: 100, bb: 100 },
  { sb: 100, bb: 200 },
  { sb: 200, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 400, bb: 800 },
  { sb: 500, bb: 1000 },
  { sb: 600, bb: 1200 },
];

/** Playing levels after the scheduled break. */
const POST_BREAK_STEPS: BlindStep[] = [
  { sb: 1000, bb: 1500 },
  { sb: 1000, bb: 2000 },
  { sb: 1500, bb: 3000 },
  { sb: 2000, bb: 4000 },
  { sb: 2500, bb: 5000 },
  { sb: 3000, bb: 6000 },
  { sb: 4000, bb: 8000 },
  { sb: 5000, bb: 10000 },
  { sb: 6000, bb: 12000 },
  { sb: 10000, bb: 15000 },
  { sb: 10000, bb: 20000 },
  { sb: 15000, bb: 30000 },
  { sb: 20000, bb: 40000 },
  { sb: 30000, bb: 60000 },
  { sb: 40000, bb: 80000 },
  { sb: 50000, bb: 100000 },
  { sb: 100000, bb: 200000 },
];

const BREAK_MINUTES = 20;

export function durationSeconds(level: BlindLevel | undefined, fallbackMinutes = 20): number {
  const minutes = level?.durationMinutes ?? fallbackMinutes;
  return Math.max(1, minutes) * 60;
}

export function structureDurationLabel(structure: BlindStructure): string {
  if (structure.levels.length === 0) return `${structure.levelDuration} мин`;
  const values = structure.levels.map((l) => l.durationMinutes);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min} мин` : `${min}–${max} мин`;
}

function sameStep(a: BlindStep, b: BlindStep): boolean {
  return a.sb === b.sb && a.bb === b.bb;
}

function omitSteps(steps: BlindStep[], omit: BlindStep[]): BlindStep[] {
  return steps.filter((step) => !omit.some((skip) => sameStep(step, skip)));
}

function playingLevel(level: number, step: BlindStep, durationMinutes: number): BlindLevel {
  return {
    level,
    smallBlind: step.sb,
    bigBlind: step.bb,
    ante: step.bb,
    durationMinutes,
  };
}

function breakLevel(): BlindLevel {
  return {
    level: 0,
    smallBlind: 0,
    bigBlind: 0,
    ante: 0,
    durationMinutes: BREAK_MINUTES,
    isBreak: true,
  };
}

export interface ExtendedLevelOptions {
  preMinutes: number;
  postMinutes: number;
  extraBeforeBreak?: BlindStep;
  omitAfterBreak?: BlindStep[];
}

/** Extended smooth ladder: BB ante = BB, 20-minute break after the early levels. */
export function buildExtendedLevels(options: ExtendedLevelOptions): BlindLevel[] {
  const pre = options.extraBeforeBreak
    ? [...PRE_BREAK_STEPS, options.extraBeforeBreak]
    : PRE_BREAK_STEPS;
  const post = options.omitAfterBreak
    ? omitSteps(POST_BREAK_STEPS, options.omitAfterBreak)
    : POST_BREAK_STEPS;

  const levels: BlindLevel[] = [];
  let n = 1;
  for (const step of pre) {
    levels.push(playingLevel(n, step, options.preMinutes));
    n += 1;
  }
  levels.push(breakLevel());
  for (const step of post) {
    levels.push(playingLevel(n, step, options.postMinutes));
    n += 1;
  }
  return levels;
}

/** Used when an admin creates a custom structure from the form. */
export function buildLevels(
  _count: number,
  _startingBigBlind = 200,
  durationMinutes = 20,
): BlindLevel[] {
  return buildExtendedLevels({
    preMinutes: durationMinutes,
    postMinutes: durationMinutes,
  });
}

function makeStructure(
  id: string,
  name: string,
  guarantee: number,
  options: ExtendedLevelOptions,
): BlindStructure {
  return {
    id,
    name,
    levelDuration: options.preMinutes,
    guarantee,
    levels: buildExtendedLevels(options),
    payouts: DEFAULT_PAYOUTS.map((place) => ({ ...place })),
  };
}

const DEEP_EXTRA: BlindStep = { sb: 800, bb: 1600 };
const FREEROLL_OMIT: BlindStep[] = [
  { sb: 1000, bb: 1500 },
  { sb: 2500, bb: 5000 },
  { sb: 6000, bb: 12000 },
];
const PHOENIX_OMIT: BlindStep[] = [
  { sb: 1500, bb: 3000 },
  { sb: 6000, bb: 12000 },
  { sb: 10000, bb: 15000 },
];

/**
 * Canonical club structures — names match tournament titles exactly.
 * Persisted to localStorage so admin edits survive reloads.
 */
export const BLIND_STRUCTURES: BlindStructure[] = [
  makeStructure('bs-grand-opening', 'Grand Opening', 20000, {
    preMinutes: 20,
    postMinutes: 15,
    extraBeforeBreak: DEEP_EXTRA,
  }),
  makeStructure('bs-freeroll', 'Freeroll', 8000, {
    preMinutes: 15,
    postMinutes: 12,
    omitAfterBreak: FREEROLL_OMIT,
  }),
  makeStructure('bs-triple-life', 'Triple Life', 12000, {
    preMinutes: 15,
    postMinutes: 12,
  }),
  makeStructure('bs-phoenix', 'Phoenix', 12000, {
    preMinutes: 15,
    postMinutes: 12,
    omitAfterBreak: PHOENIX_OMIT,
  }),
  makeStructure('bs-freezeout', 'Freezeout', 15000, {
    preMinutes: 15,
    postMinutes: 12,
  }),
  makeStructure('bs-chill-out', 'Chill out', 10000, {
    preMinutes: 15,
    postMinutes: 12,
    omitAfterBreak: FREEROLL_OMIT,
  }),
  makeStructure('bs-bounty-hunter', 'Bounty Hunter', 10000, {
    preMinutes: 20,
    postMinutes: 15,
  }),
  makeStructure('bs-deepstack', 'Deepstack', 15000, {
    preMinutes: 20,
    postMinutes: 15,
    extraBeforeBreak: DEEP_EXTRA,
  }),
];

function cloneLevel(level: BlindLevel): BlindLevel {
  return { ...level };
}

function cloneStructure(structure: BlindStructure): BlindStructure {
  return {
    ...structure,
    levels: structure.levels.map(cloneLevel),
    payouts: structure.payouts.map((place) => ({ ...place })),
  };
}

function catalogClone(): BlindStructure[] {
  return BLIND_STRUCTURES.map(cloneStructure);
}

interface StoredPayload {
  version: string;
  structures: BlindStructure[];
}

function readStore(): BlindStructure[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.structures)) {
      return null;
    }
    return parsed.structures.map(cloneStructure);
  } catch {
    return null;
  }
}

function writeStore(structures: BlindStructure[]) {
  try {
    const payload: StoredPayload = {
      version: STORAGE_VERSION,
      structures: structures.map(cloneStructure),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable */
  }
}

let cache: BlindStructure[] | null = null;

function getStore(): BlindStructure[] {
  if (cache) return cache;
  cache = readStore() ?? catalogClone();
  writeStore(cache);
  return cache;
}

export function seedBlindStructures(): BlindStructure[] {
  return getStore().map(cloneStructure);
}

export function addBlindStructure(structure: BlindStructure): BlindStructure {
  const store = getStore();
  store.push(cloneStructure(structure));
  writeStore(store);
  return structure;
}

export function replaceBlindStructure(next: BlindStructure): void {
  const store = getStore();
  const index = store.findIndex((s) => s.id === next.id);
  if (index >= 0) store[index] = cloneStructure(next);
  else store.push(cloneStructure(next));
  writeStore(store);
}

export function findBlindStructure(id: string | null): BlindStructure | undefined {
  if (!id) return undefined;
  return getStore().find((s) => s.id === id);
}

export function formatBlinds(level: BlindLevel | undefined): string {
  if (!level) return '—';
  if (level.isBreak) return 'Перерыв';
  const base = `${level.smallBlind.toLocaleString('ru-RU')}/${level.bigBlind.toLocaleString('ru-RU')}`;
  return level.ante > 0 ? `${base} (${level.ante.toLocaleString('ru-RU')})` : base;
}

export function renumberLevels(levels: BlindLevel[]): BlindLevel[] {
  let n = 0;
  return levels.map((level) => {
    if (level.isBreak) return { ...level, level: 0 };
    n += 1;
    return { ...level, level: n };
  });
}
