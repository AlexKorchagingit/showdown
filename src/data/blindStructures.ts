export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface PrizePlace {
  place: number;
  share: number;
}

export interface BlindStructure {
  id: string;
  name: string;
  /** Minutes per level */
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

/** Classic doubling ladder — ante starts once the blinds get meaningful. */
export function buildLevels(count: number, startingBigBlind = 200): BlindLevel[] {
  return Array.from({ length: count }, (_, index) => {
    const bigBlind = startingBigBlind * 2 ** Math.floor(index / 2) * (index % 2 === 0 ? 1 : 1.5);
    const rounded = Math.round(bigBlind / 100) * 100;
    return {
      smallBlind: rounded / 2,
      bigBlind: rounded,
      ante: index >= 2 ? rounded : 0,
    };
  });
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
    levels: buildLevels(14, 200),
    payouts: DEFAULT_PAYOUTS,
  },
];

export function addBlindStructure(structure: BlindStructure): BlindStructure {
  BLIND_STRUCTURES.push(structure);
  return structure;
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
