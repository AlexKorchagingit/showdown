export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** Duration of this specific level, in minutes. */
  durationMinutes: number;
}

export interface PrizePlace {
  place: number;
  share: number;
}

export interface BlindStructure {
  id: string;
  name: string;
  /** Default minutes used when adding a new level. */
  levelDuration: number;
  guarantee: number;
  levels: BlindLevel[];
  payouts: PrizePlace[];
}

export const DEFAULT_PAYOUTS: PrizePlace[] = [
  { place: 1, share: 50 },
  { place: 2, share: 30 },
  { place: 3, share: 12 },
  { place: 4, share: 8 },
];

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

/** Classic doubling ladder — ante starts once the blinds get meaningful. */
export function buildLevels(
  count: number,
  startingBigBlind = 200,
  durationMinutes = 20,
): BlindLevel[] {
  return Array.from({ length: count }, (_, index) => {
    const bigBlind = startingBigBlind * 2 ** Math.floor(index / 2) * (index % 2 === 0 ? 1 : 1.5);
    const rounded = Math.round(bigBlind / 100) * 100;
    return {
      level: index + 1,
      smallBlind: rounded / 2,
      bigBlind: rounded,
      ante: index >= 2 ? rounded : 0,
      durationMinutes,
    };
  });
}

function cloneStructure(structure: BlindStructure): BlindStructure {
  return {
    ...structure,
    levels: structure.levels.map((level) => ({ ...level })),
    payouts: structure.payouts.map((place) => ({ ...place })),
  };
}

/** Single in-memory source of truth: the timer route resolves ids from here. */
export const BLIND_STRUCTURES: BlindStructure[] = [
  {
    id: 'bs-royal',
    name: 'ROYAL FREEZEOUT',
    levelDuration: 20,
    guarantee: 19100,
    levels: buildLevels(12),
    payouts: DEFAULT_PAYOUTS,
  },
  {
    id: 'bs-bounty',
    name: 'GOLDEN BOUNTY',
    levelDuration: 20,
    guarantee: 45000,
    levels: buildLevels(10, 300),
    payouts: DEFAULT_PAYOUTS,
  },
  {
    id: 'bs-turbo',
    name: 'TURBO CHAMPIONSHIP',
    levelDuration: 10,
    guarantee: 12000,
    levels: buildLevels(14, 200, 10),
    payouts: DEFAULT_PAYOUTS,
  },
];

export function seedBlindStructures(): BlindStructure[] {
  return BLIND_STRUCTURES.map(cloneStructure);
}

export function addBlindStructure(structure: BlindStructure): BlindStructure {
  BLIND_STRUCTURES.push(cloneStructure(structure));
  return structure;
}

export function replaceBlindStructure(next: BlindStructure): void {
  const index = BLIND_STRUCTURES.findIndex((s) => s.id === next.id);
  if (index >= 0) BLIND_STRUCTURES[index] = cloneStructure(next);
  else BLIND_STRUCTURES.push(cloneStructure(next));
}

export function findBlindStructure(id: string | null): BlindStructure | undefined {
  if (!id) return undefined;
  return BLIND_STRUCTURES.find((s) => s.id === id);
}

export function formatBlinds(level: BlindLevel | undefined): string {
  if (!level) return '—';
  const base = `${level.smallBlind.toLocaleString('ru-RU')}/${level.bigBlind.toLocaleString('ru-RU')}`;
  return level.ante > 0 ? `${base} (${level.ante.toLocaleString('ru-RU')})` : base;
}

export function renumberLevels(levels: BlindLevel[]): BlindLevel[] {
  return levels.map((level, index) => ({ ...level, level: index + 1 }));
}
