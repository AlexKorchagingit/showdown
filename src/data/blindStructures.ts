export type BlindLevel = {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
  isBreak?: boolean;
  isLateRegEnd?: boolean;
  /** Optional note shown on the timer during this break (chip race, color-up, …). */
  comment?: string;
};

export const BREAK_COMMENT_MAX = 80;

/** Breaks are explicit. A 0 small-blind is a break only for old rows without `isBreak: false`. */
export function isBreakLevel(level: BlindLevel | undefined): boolean {
  if (!level) return false;
  if (level.isBreak === false) return false;
  return level.isBreak === true || level.smallBlind === 0;
}

export function breakComment(level: BlindLevel | undefined): string {
  if (!level || !isBreakLevel(level)) return '';
  const note = level.comment?.trim() ?? '';
  return note.slice(0, BREAK_COMMENT_MAX);
}

/** Club rule: ante always matches the big blind. */
export function withAnteFromBigBlind<T extends Pick<BlindLevel, 'bigBlind' | 'ante'>>(level: T): T {
  return { ...level, ante: Math.max(0, level.bigBlind) };
}

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

export const BLIND_STRUCTURES_STORAGE_KEY = 'showdown.blindStructures';
const STORAGE_KEY = BLIND_STRUCTURES_STORAGE_KEY;
const STORAGE_VERSION = 'club-breaks-v4';

export type BlindStructuresLocalMeta = {
  revision: number;
  writeId: string;
  updatedAt: number;
};

export type LevelListChange = {
  /** Index of the row the new level was inserted after (`-1` = prepend). */
  insertedAt?: number;
  /** Index of the removed row in the previous list. */
  removedAt?: number;
};

type BlindStep = { sb: number; bb: number };

/** Smooth ladder — keeps in-between rungs for weekend / deep events. */
const SMOOTH_STEPS: BlindStep[] = [
  { sb: 100, bb: 100 },
  { sb: 100, bb: 200 },
  { sb: 200, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 400, bb: 800 },
  { sb: 500, bb: 1000 },
  { sb: 600, bb: 1200 },
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

/** Classic ladder — no 1500/3000-style in-between rungs (Freeroll, Chill out, Phoenix). */
const CLASSIC_STEPS: BlindStep[] = [
  { sb: 100, bb: 200 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 400, bb: 800 },
  { sb: 500, bb: 1000 },
  { sb: 600, bb: 1200 },
  { sb: 1000, bb: 2000 },
  { sb: 2000, bb: 4000 },
  { sb: 3000, bb: 6000 },
  { sb: 4000, bb: 8000 },
  { sb: 5000, bb: 10000 },
  { sb: 6000, bb: 12000 },
  { sb: 10000, bb: 20000 },
  { sb: 15000, bb: 30000 },
  { sb: 20000, bb: 40000 },
  { sb: 30000, bb: 60000 },
  { sb: 40000, bb: 80000 },
  { sb: 50000, bb: 100000 },
  { sb: 100000, bb: 200000 },
];

export function durationSeconds(level: BlindLevel | undefined, fallbackMinutes = 20): number {
  const minutes = level?.durationMinutes ?? fallbackMinutes;
  return Math.max(1, minutes) * 60;
}

export function structureDurationLabel(structure: BlindStructure): string {
  const playing = structure.levels.filter((l) => !isBreakLevel(l));
  if (playing.length === 0) return `${structure.levelDuration} мин`;
  const values = playing.map((l) => l.durationMinutes);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min} мин` : `${min}–${max} мин`;
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

function breakLevel(durationMinutes: number, lateRegEnd = false, upcoming?: BlindStep): BlindLevel {
  const sb = upcoming && upcoming.sb > 0 ? upcoming.sb : 100;
  const bb = upcoming && upcoming.bb > 0 ? upcoming.bb : 200;
  return {
    level: 0,
    smallBlind: sb,
    bigBlind: bb,
    ante: bb,
    durationMinutes,
    isBreak: true,
    ...(lateRegEnd ? { isLateRegEnd: true } : {}),
  };
}

export interface ClubLevelOptions {
  steps: BlindStep[];
  /** Playing minutes until the first break (~2 hours). */
  preBreakMinutes: number;
  /** Playing minutes between the two breaks. */
  midMinutes: number;
  /** Playing minutes after late-reg close. */
  postBreakMinutes: number;
  /** Target play time before each break. */
  breakAfterMinutes?: number;
  firstBreakMinutes?: number;
  secondBreakMinutes?: number;
}

/**
 * Inserts two breaks after ~2 hours of play each.
 * The second break is the late-registration close.
 * Break rows keep the upcoming blinds so the clock never shows 0/0.
 */
export function buildClubLevels(options: ClubLevelOptions): BlindLevel[] {
  const playTarget = options.breakAfterMinutes ?? 120;
  const preCount = Math.max(1, Math.round(playTarget / options.preBreakMinutes));
  const midCount = Math.max(1, Math.round(playTarget / options.midMinutes));
  const levels: BlindLevel[] = [];
  let n = 1;

  options.steps.forEach((step, index) => {
    if (index === preCount) {
      levels.push(breakLevel(options.firstBreakMinutes ?? 15, false, step));
    }
    if (index === preCount + midCount) {
      levels.push(breakLevel(options.secondBreakMinutes ?? 15, true, step));
    }

    const minutes =
      index < preCount
        ? options.preBreakMinutes
        : index < preCount + midCount
          ? options.midMinutes
          : options.postBreakMinutes;
    levels.push(playingLevel(n, step, minutes));
    n += 1;
  });

  return levels;
}

/** Used when an admin creates a custom structure from the form. */
export function buildLevels(
  _count: number,
  _startingBigBlind = 200,
  durationMinutes = 20,
): BlindLevel[] {
  return buildClubLevels({
    steps: SMOOTH_STEPS,
    preBreakMinutes: durationMinutes,
    midMinutes: durationMinutes,
    postBreakMinutes: Math.max(12, durationMinutes - 5),
  });
}

function makeStructure(
  id: string,
  name: string,
  guarantee: number,
  options: ClubLevelOptions,
): BlindStructure {
  return {
    id,
    name,
    levelDuration: options.preBreakMinutes,
    guarantee,
    levels: buildClubLevels(options),
    payouts: DEFAULT_PAYOUTS.map((place) => ({ ...place })),
  };
}

/** Classic weekday: 15 min to first break, 12 min after; no 1500/3000 rungs. */
const CLASSIC_WEEKDAY: ClubLevelOptions = {
  steps: CLASSIC_STEPS,
  preBreakMinutes: 15,
  midMinutes: 12,
  postBreakMinutes: 12,
  firstBreakMinutes: 15,
  secondBreakMinutes: 15,
};

/** Classic with even clocks (Triple Life). */
const CLASSIC_SPORT: ClubLevelOptions = {
  steps: CLASSIC_STEPS,
  preBreakMinutes: 15,
  midMinutes: 15,
  postBreakMinutes: 12,
  firstBreakMinutes: 15,
  secondBreakMinutes: 15,
};

/** Smooth weekday freezeout. */
const SMOOTH_WEEKDAY: ClubLevelOptions = {
  steps: SMOOTH_STEPS,
  preBreakMinutes: 15,
  midMinutes: 15,
  postBreakMinutes: 15,
  firstBreakMinutes: 15,
  secondBreakMinutes: 15,
};

/** Weekend / bounty: 20 min to the breaks, 15 after late reg. */
const WEEKEND: ClubLevelOptions = {
  steps: SMOOTH_STEPS,
  preBreakMinutes: 20,
  midMinutes: 20,
  postBreakMinutes: 15,
  firstBreakMinutes: 20,
  secondBreakMinutes: 20,
};

/** Deepstack: longer clocks. */
const DEEPSTACK: ClubLevelOptions = {
  steps: SMOOTH_STEPS,
  preBreakMinutes: 25,
  midMinutes: 20,
  postBreakMinutes: 15,
  firstBreakMinutes: 20,
  secondBreakMinutes: 20,
};

/**
 * Canonical club structures. Live timers bind to a Tournament by `tournamentId`,
 * then resolve this catalog via `blindStructureId` (preferred) or `blindStructure` name.
 * Persisted to localStorage so admin edits survive reloads.
 */
export const BLIND_STRUCTURES: BlindStructure[] = [
  makeStructure('bs-grand-opening', 'Grand Opening', 20000, WEEKEND),
  makeStructure('bs-freeroll', 'Freeroll', 8000, CLASSIC_WEEKDAY),
  makeStructure('bs-triple-life', 'Triple Life', 12000, CLASSIC_SPORT),
  makeStructure('bs-phoenix', 'Phoenix', 12000, CLASSIC_WEEKDAY),
  makeStructure('bs-freezeout', 'Freezeout', 15000, SMOOTH_WEEKDAY),
  makeStructure('bs-chill-out', 'Chill out', 10000, CLASSIC_WEEKDAY),
  makeStructure('bs-bounty-hunter', 'Bounty Hunter', 10000, WEEKEND),
  makeStructure('bs-deepstack', 'Deepstack', 15000, DEEPSTACK),
];

function cloneLevel(level: BlindLevel): BlindLevel {
  const next: BlindLevel = withAnteFromBigBlind({ ...level });
  if (isBreakLevel(level)) {
    next.isBreak = true;
    const comment = breakComment(level);
    if (comment) next.comment = comment;
    else delete next.comment;
  } else {
    next.isBreak = false;
    delete next.comment;
  }
  return next;
}

function withBreakBlinds(levels: BlindLevel[]): BlindLevel[] {
  return levels.map((level, index) => {
    if (!isBreakLevel(level)) return withAnteFromBigBlind(level);
    if (level.smallBlind > 0 && level.bigBlind > 0) {
      return withAnteFromBigBlind({ ...level, isBreak: true });
    }
    const next = levels.slice(index + 1).find((row) => !isBreakLevel(row));
    const prev = levels.slice(0, index).reverse().find((row) => !isBreakLevel(row));
    const source = next ?? prev;
    const bigBlind = source?.bigBlind || 200;
    return {
      ...level,
      isBreak: true,
      smallBlind: source?.smallBlind || 100,
      bigBlind,
      ante: bigBlind,
    };
  });
}

function cloneStructure(structure: BlindStructure): BlindStructure {
  return {
    ...structure,
    levels: withBreakBlinds(structure.levels.map(cloneLevel)),
    payouts: structure.payouts.map((place) => ({ ...place })),
  };
}

function catalogClone(): BlindStructure[] {
  return BLIND_STRUCTURES.map(cloneStructure);
}

interface StoredPayload {
  version: string;
  structures: BlindStructure[];
  revision?: number;
  writeId?: string;
  updatedAt?: number;
}

const BOOT_META: BlindStructuresLocalMeta = {
  revision: 0,
  writeId: 'boot',
  updatedAt: 0,
};

let cacheMeta: BlindStructuresLocalMeta = { ...BOOT_META };

function asMetaNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function readStore(): BlindStructure[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.structures)) {
      return null;
    }
    cacheMeta = {
      revision: Math.trunc(asMetaNumber(parsed.revision, 0)),
      writeId: typeof parsed.writeId === 'string' && parsed.writeId ? parsed.writeId : 'boot',
      updatedAt: asMetaNumber(parsed.updatedAt, 0),
    };
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
      revision: cacheMeta.revision,
      writeId: cacheMeta.writeId,
      updatedAt: cacheMeta.updatedAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Could not persist blind structures locally', error);
  }
}

let cache: BlindStructure[] | null = null;

function getStore(): BlindStructure[] {
  if (cache) return cache;
  cache = readStore() ?? catalogClone();
  writeStore(cache);
  return cache;
}

export function readBlindStructuresLocalMeta(): BlindStructuresLocalMeta {
  getStore();
  return { ...cacheMeta };
}

export function persistBlindStructuresLocal(
  structures: BlindStructure[],
  meta: BlindStructuresLocalMeta,
): void {
  cache = structures.map(cloneStructure);
  cacheMeta = { ...meta };
  writeStore(cache);
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseBlindLevel(raw: unknown): BlindLevel | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const smallBlind = Math.max(0, asFiniteNumber(row.smallBlind, 0));
  const bigBlind = Math.max(0, asFiniteNumber(row.bigBlind, 0));
  const explicitBreak = row.isBreak;
  const isBreak =
    explicitBreak === true || (explicitBreak !== false && smallBlind === 0);
  const note = typeof row.comment === 'string' ? row.comment.trim().slice(0, BREAK_COMMENT_MAX) : '';
  const level: BlindLevel = {
    level: Math.max(0, Math.trunc(asFiniteNumber(row.level, 0))),
    smallBlind,
    bigBlind,
    ante: bigBlind,
    durationMinutes: Math.max(1, asFiniteNumber(row.durationMinutes, 20)),
  };
  level.isBreak = isBreak;
  if (row.isLateRegEnd === true) level.isLateRegEnd = true;
  if (note) level.comment = note;
  return level;
}

export function parseBlindStructure(raw: unknown): BlindStructure | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id.trim()) return null;
  if (typeof row.name !== 'string' || !row.name.trim()) return null;
  if (!Array.isArray(row.levels) || row.levels.length === 0) return null;
  const levels = row.levels.flatMap((item) => {
    const level = parseBlindLevel(item);
    return level ? [level] : [];
  });
  if (!levels.length) return null;
  const payouts = Array.isArray(row.payouts)
    ? row.payouts.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const prize = item as Partial<PrizePlace>;
        const place = Math.trunc(asFiniteNumber(prize.place, 0));
        const share = asFiniteNumber(prize.share, 0);
        if (place < 1) return [];
        return [{ place, share }];
      })
    : DEFAULT_PAYOUTS.map((place) => ({ ...place }));
  return cloneStructure({
    id: row.id.trim(),
    name: row.name.trim(),
    levelDuration: Math.max(1, asFiniteNumber(row.levelDuration, 20)),
    guarantee: Math.max(0, asFiniteNumber(row.guarantee, 0)),
    levels,
    payouts: payouts.length ? payouts : DEFAULT_PAYOUTS.map((place) => ({ ...place })),
  });
}

export function parseBlindStructureList(raw: unknown): BlindStructure[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const list = raw.flatMap((item) => {
    const structure = parseBlindStructure(item);
    return structure ? [structure] : [];
  });
  return list.length ? list : null;
}

function levelSignature(level: BlindLevel): string {
  return [
    isBreakLevel(level) ? 'b' : 'p',
    level.smallBlind,
    level.bigBlind,
    level.ante,
    level.durationMinutes,
    level.isLateRegEnd ? 'lr' : '',
    breakComment(level),
  ].join(':');
}

/** Detect a single inserted or removed row so the live clock can stay on the same rung. */
export function inferLevelListChange(
  prev: BlindLevel[],
  next: BlindLevel[],
): LevelListChange {
  const prevSig = prev.map(levelSignature);
  const nextSig = next.map(levelSignature);
  if (next.length === prev.length + 1) {
    let insertedAt: number | undefined;
    for (let i = 0; i < next.length; i += 1) {
      const without = [...nextSig.slice(0, i), ...nextSig.slice(i + 1)];
      if (without.every((sig, j) => sig === prevSig[j])) {
        insertedAt = i - 1;
      }
    }
    if (insertedAt !== undefined) return { insertedAt };
  }
  if (next.length === prev.length - 1) {
    let removedAt: number | undefined;
    for (let i = 0; i < prev.length; i += 1) {
      const without = [...prevSig.slice(0, i), ...prevSig.slice(i + 1)];
      if (without.every((sig, j) => sig === nextSig[j])) {
        removedAt = i;
      }
    }
    if (removedAt !== undefined) return { removedAt };
  }
  return {};
}

function lastPlayingAtOrBefore(levels: BlindLevel[], index: number): BlindLevel | undefined {
  for (let i = index; i >= 0; i -= 1) {
    if (!isBreakLevel(levels[i])) return levels[i];
  }
  return levels.find((level) => !isBreakLevel(level));
}

export function insertPlayingLevelAfter(levels: BlindLevel[], afterIndex: number): BlindLevel[] {
  const index = Math.min(Math.max(-1, Math.trunc(afterIndex)), levels.length - 1);
  const template = lastPlayingAtOrBefore(levels, index);
  const bigBlind = template?.bigBlind || 200;
  const inserted: BlindLevel = {
    level: 0,
    smallBlind: template?.smallBlind || 100,
    bigBlind,
    ante: bigBlind,
    durationMinutes: template?.durationMinutes ?? 20,
    isBreak: false,
  };
  const next = [...levels];
  next.splice(index + 1, 0, inserted);
  return withBreakBlinds(renumberLevels(next));
}

export function insertBreakAfter(levels: BlindLevel[], afterIndex: number): BlindLevel[] {
  const index = Math.min(Math.max(-1, Math.trunc(afterIndex)), levels.length - 1);
  const upcoming = levels.slice(index + 1).find((level) => !isBreakLevel(level));
  const previous = lastPlayingAtOrBefore(levels, index);
  const source = upcoming ?? previous;
  const inserted: BlindLevel = {
    level: 0,
    smallBlind: source?.smallBlind || 100,
    bigBlind: source?.bigBlind || 200,
    ante: source?.bigBlind || 200,
    durationMinutes: 15,
    isBreak: true,
  };
  const next = [...levels];
  next.splice(index + 1, 0, inserted);
  return withBreakBlinds(renumberLevels(next));
}

export function blindStructuresFingerprint(structures: BlindStructure[]): string {
  return JSON.stringify(
    structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      levelDuration: structure.levelDuration,
      guarantee: structure.guarantee,
      levels: structure.levels.map((level) => ({
        level: level.level,
        smallBlind: level.smallBlind,
        bigBlind: level.bigBlind,
        ante: level.ante,
        durationMinutes: level.durationMinutes,
        isBreak: isBreakLevel(level),
        isLateRegEnd: level.isLateRegEnd === true,
        comment: breakComment(level),
      })),
      payouts: structure.payouts,
    })),
  );
}

let catalogFingerprint: string | null = null;

export function isCatalogBlindStructures(structures: BlindStructure[]): boolean {
  catalogFingerprint ??= blindStructuresFingerprint(catalogClone());
  return blindStructuresFingerprint(structures) === catalogFingerprint;
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
  if (isBreakLevel(level)) return breakComment(level) || 'ПЕРЕРЫВ';
  const base = `${level.smallBlind.toLocaleString('ru-RU')}/${level.bigBlind.toLocaleString('ru-RU')}`;
  return level.ante > 0 ? `${base} (${level.ante.toLocaleString('ru-RU')})` : base;
}

/** Label under the timer clock: denomination, or «Перерыв» when the next rung is a break. */
export function formatNextBlinds(level: BlindLevel | undefined): string {
  if (!level) return 'финальный уровень';
  if (isBreakLevel(level)) return 'Перерыв';
  return formatBlinds(level);
}

export function renumberLevels(levels: BlindLevel[]): BlindLevel[] {
  let n = 0;
  return levels.map((level) => {
    if (isBreakLevel(level)) {
      return withAnteFromBigBlind({ ...level, isBreak: true, level: 0 });
    }
    n += 1;
    return withAnteFromBigBlind({ ...level, level: n });
  });
}

function secondsUntilMatch(
  levels: BlindLevel[],
  levelIndex: number,
  secondsLeft: number,
  match: (level: BlindLevel) => boolean,
): number | null {
  if (levels.length === 0) return null;
  const current = levels[levelIndex];
  const searchFrom = current && match(current) ? levelIndex + 1 : levelIndex;
  const target = levels.findIndex((level, index) => index >= searchFrom && match(level));
  if (target < 0) return null;

  let total = Math.max(0, secondsLeft);
  for (let index = levelIndex + 1; index < target; index += 1) {
    total += durationSeconds(levels[index]);
  }
  return total;
}

/** Remaining seconds until the next `isBreak` level starts. Null if none left. */
export function secondsUntilNextBreak(
  levels: BlindLevel[],
  levelIndex: number,
  secondsLeft: number,
): number | null {
  return secondsUntilMatch(levels, levelIndex, secondsLeft, (level) => isBreakLevel(level));
}

/** The next upcoming break after the current level, if any. */
export function upcomingBreakLevel(
  levels: BlindLevel[],
  levelIndex: number,
): BlindLevel | undefined {
  return levels.find((level, index) => index > levelIndex && isBreakLevel(level));
}

/** Remaining seconds until the `isLateRegEnd` level starts. Null if none exists. */
export function secondsUntilLateRegEnd(
  levels: BlindLevel[],
  levelIndex: number,
  secondsLeft: number,
): number | null {
  return secondsUntilMatch(levels, levelIndex, secondsLeft, (level) => level.isLateRegEnd === true);
}

export function isLateRegClosed(levels: BlindLevel[], levelIndex: number): boolean {
  const target = levels.findIndex((level) => level.isLateRegEnd === true);
  if (target < 0) return false;
  return levelIndex >= target;
}

export function formatEta(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
