import {
  blindStructuresFingerprint,
  isCatalogBlindStructures,
  parseBlindStructureList,
  withTripleLifeLadderCopyMigration,
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

/**
 * Convert the local-storage payload into the same snapshot shape used by the
 * server and BroadcastChannel transports. Keeping migration markers here is
 * essential: dropping them makes every other tab repeat the migration and
 * publish a new revision indefinitely.
 */
export function parseBlindStructuresStorageSnapshot(raw: string): BlindStructuresSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as {
      structures?: unknown;
      revision?: unknown;
      writeId?: unknown;
      updatedAt?: unknown;
      migrations?: unknown;
    };
    return parseBlindStructuresSnapshot({
      v: 1,
      writeId: typeof parsed.writeId === 'string' && parsed.writeId ? parsed.writeId : 'storage',
      revision: parsed.revision,
      updatedAt: parsed.updatedAt,
      structures: parsed.structures,
      migrations: parsed.migrations,
    });
  } catch {
    return null;
  }
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
 *
 * `fingerprint` is the local ladder content. Passing it is what stops two open
 * tabs from trading revisions forever: a poll that returns the server row
 * before our own save has landed looks "behind", and uploading again bumped the
 * revision, which made the other tab look behind in turn. Identical content
 * needs no write at all, no matter which revision label it carries.
 */
export function decideBlindStructuresSync(
  local: BlindStructuresLocalMeta & { custom: boolean; fingerprint?: string },
  remote: BlindStructuresSnapshot,
): StructuresSyncDecision {
  if (remote.writeId === local.writeId) return 'keep';
  if (local.fingerprint != null && local.fingerprint === blindStructuresFingerprint(remote.structures)) {
    return remote.revision > local.revision ? 'apply' : 'keep';
  }
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

export type BlindStructuresRemoteApplyOptions = {
  allowUpload?: boolean;
  allowRepublishMigration?: boolean;
};

export type BlindStructuresRemoteApplyPlan =
  | { kind: 'keep' }
  | { kind: 'upload' }
  | {
      kind: 'meta';
      writeId: string;
      revision: number;
      updatedAt: number;
      migrations: string[];
      republish: boolean;
    }
  | {
      kind: 'replace';
      writeId: string;
      revision: number;
      updatedAt: number;
      structures: BlindStructure[];
      migrations: string[];
      republish: boolean;
    };

/**
 * Poll/realtime/channel must never upload: a stale 25 KB catalog reply used to
 * make two admin tabs rewrite `blind-structures` until the timer tab froze.
 * Matching fingerprints only adopt revision metadata so React does not rebuild
 * the ladder on every 2.5s tick.
 */
export function planBlindStructuresRemoteApply(
  local: BlindStructuresLocalMeta & {
    custom: boolean;
    fingerprint: string;
  },
  remote: BlindStructuresSnapshot,
  options: BlindStructuresRemoteApplyOptions = {},
): BlindStructuresRemoteApplyPlan {
  const decision = decideBlindStructuresSync(local, remote);
  if (decision === 'keep') return { kind: 'keep' };
  if (decision === 'upload') {
    return options.allowUpload === true ? { kind: 'upload' } : { kind: 'keep' };
  }
  const migrated = withTripleLifeLadderCopyMigration(
    remote.structures,
    remote.migrations ?? [],
  );
  const republish = options.allowRepublishMigration === true && migrated.changed;
  const meta = {
    writeId: remote.writeId,
    revision: remote.revision,
    updatedAt: remote.updatedAt,
    migrations: migrated.migrations,
    republish,
  };
  if (local.fingerprint === blindStructuresFingerprint(migrated.structures)) {
    return { kind: 'meta', ...meta };
  }
  return { kind: 'replace', ...meta, structures: migrated.structures };
}
