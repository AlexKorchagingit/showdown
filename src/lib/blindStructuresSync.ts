import {
  isCatalogBlindStructures,
  parseBlindStructureList,
  type BlindStructure,
  type BlindStructuresLocalMeta,
} from '../data/blindStructures';

export const BLIND_STRUCTURES_ROW_ID = 'blind-structures';
export const BLIND_STRUCTURES_LOG_ID = 'blinds-structures';
export const BLIND_STRUCTURES_LOG_ACTION = '__blind_structures__';
export const BLIND_STRUCTURES_CHANNEL = 'showdown-blind-structures';

export type BlindStructuresSnapshot = {
  v: 1;
  writeId: string;
  revision: number;
  updatedAt: number;
  structures: BlindStructure[];
  migrations?: string[];
};

function parseMigrations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function newBlindStructuresWriteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseBlindStructuresSnapshot(raw: unknown): BlindStructuresSnapshot | null {
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
  const row = value as Partial<BlindStructuresSnapshot>;
  if (row.v !== 1) return null;
  if (typeof row.writeId !== 'string' || !row.writeId) return null;
  const structures = parseBlindStructureList(row.structures);
  if (!structures) return null;
  const revision = Number(row.revision);
  const updatedAt = Number(row.updatedAt);
  return {
    v: 1,
    writeId: row.writeId,
    revision: Number.isFinite(revision) ? Math.max(0, Math.trunc(revision)) : 0,
    updatedAt: Number.isFinite(updatedAt) ? Math.max(0, updatedAt) : 0,
    structures,
    migrations: parseMigrations(row.migrations),
  };
}

export function makeBlindStructuresSnapshot(
  structures: BlindStructure[],
  previousRevision: number,
  migrations: string[] = [],
): BlindStructuresSnapshot {
  return {
    v: 1,
    writeId: newBlindStructuresWriteId(),
    revision: previousRevision + 1,
    updatedAt: Date.now(),
    structures,
    migrations,
  };
}

export type StructuresSyncDecision = 'apply' | 'keep' | 'upload';

/**
 * First club-wide save used to live only in one browser. Prefer that custom
 * local copy over a catalog seed another device uploaded as revision 0/1.
 */
export function decideBlindStructuresSync(
  local: BlindStructuresLocalMeta & { custom: boolean },
  remote: BlindStructuresSnapshot,
): StructuresSyncDecision {
  if (remote.writeId === local.writeId) return 'keep';
  const remoteCustom = !isCatalogBlindStructures(remote.structures);
  if (local.custom && !remoteCustom && local.revision <= 1 && remote.revision <= 1) {
    return 'upload';
  }
  if (remote.revision < local.revision) return 'upload';
  if (remote.revision === local.revision && remote.updatedAt < local.updatedAt) return 'keep';
  if (
    remote.revision === local.revision &&
    remote.updatedAt === local.updatedAt &&
    remote.writeId < local.writeId
  ) {
    return 'keep';
  }
  return 'apply';
}
