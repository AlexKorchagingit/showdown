import { describe, expect, it } from 'vitest';
import {
  BLIND_STRUCTURES,
  blindStructuresFingerprint,
  type BlindStructure,
} from '../data/blindStructures';
import {
  decideBlindStructuresSync,
  parseBlindStructuresSnapshot,
  parseBlindStructuresStorageSnapshot,
  planBlindStructuresRemoteApply,
} from './blindStructuresSync';

function customStructure(): BlindStructure {
  return {
    ...BLIND_STRUCTURES[0],
    id: 'bs-custom',
    name: 'Custom',
    levels: BLIND_STRUCTURES[0].levels.map((level, index) =>
      index === 0 ? { ...level, smallBlind: 250, bigBlind: 500, ante: 500 } : level,
    ),
  };
}

describe('blind structures snapshot', () => {
  it('parses a JSON payload from the logs fallback', () => {
    const snapshot = parseBlindStructuresSnapshot(
      JSON.stringify({
        v: 1,
        writeId: 'abc',
        revision: 3,
        updatedAt: 100,
        structures: [BLIND_STRUCTURES[0]],
      }),
    );
    expect(snapshot?.writeId).toBe('abc');
    expect(snapshot?.revision).toBe(3);
    expect(snapshot?.structures[0]?.id).toBe(BLIND_STRUCTURES[0].id);
    expect(snapshot?.migrations).toEqual([]);
  });

  it('keeps a migrations list on the snapshot', () => {
    const snapshot = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'abc',
      revision: 3,
      updatedAt: 100,
      structures: [BLIND_STRUCTURES[0]],
      migrations: ['copy-triple-life-ladder-v1'],
    });
    expect(snapshot?.migrations).toEqual(['copy-triple-life-ladder-v1']);
  });

  it('preserves migration markers received through a storage event', () => {
    const snapshot = parseBlindStructuresStorageSnapshot(JSON.stringify({
      version: 'club-breaks-v4',
      writeId: 'another-tab',
      revision: 8,
      updatedAt: 250,
      structures: [BLIND_STRUCTURES[0]],
      migrations: ['copy-triple-life-ladder-v1'],
    }));

    expect(snapshot?.writeId).toBe('another-tab');
    expect(snapshot?.revision).toBe(8);
    expect(snapshot?.migrations).toEqual(['copy-triple-life-ladder-v1']);
  });

  it('ignores malformed storage events', () => {
    expect(parseBlindStructuresStorageSnapshot('{not-json')).toBeNull();
  });

  it('prefers a local custom copy over a first catalog seed from another device', () => {
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'tv',
      revision: 1,
      updatedAt: 50,
      structures: BLIND_STRUCTURES,
    });
    expect(remote).not.toBeNull();
    expect(
      decideBlindStructuresSync(
        { revision: 0, writeId: 'boot', updatedAt: 0, custom: true },
        remote!,
      ),
    ).toBe('upload');
  });

  it('never uploads a ladder the server already stores', () => {
    const structures = [customStructure()];
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'other-tab',
      revision: 3,
      updatedAt: 200,
      structures,
    });
    expect(remote).not.toBeNull();
    expect(
      decideBlindStructuresSync(
        {
          revision: 9,
          writeId: 'this-tab',
          updatedAt: 500,
          custom: true,
          fingerprint: blindStructuresFingerprint(structures),
        },
        remote!,
      ),
    ).toBe('keep');
  });

  it('applies a newer remote revision', () => {
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'phone',
      revision: 4,
      updatedAt: 200,
      structures: [customStructure()],
    });
    expect(remote).not.toBeNull();
    expect(
      decideBlindStructuresSync(
        { revision: 2, writeId: 'tv', updatedAt: 10, custom: false },
        remote!,
      ),
    ).toBe('apply');
  });

  it('never uploads from a stale poll even when the local revision is ahead', () => {
    const localStructures = [customStructure()];
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'stale-server',
      revision: 3,
      updatedAt: 100,
      structures: BLIND_STRUCTURES,
    });
    expect(remote).not.toBeNull();
    expect(
      planBlindStructuresRemoteApply(
        {
          revision: 9,
          writeId: 'this-tab',
          updatedAt: 500,
          custom: true,
          fingerprint: blindStructuresFingerprint(localStructures),
        },
        remote!,
      ),
    ).toEqual({ kind: 'keep' });
  });

  it('adopts a newer matching snapshot as metadata only', () => {
    const structures = [customStructure()];
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'other-tab',
      revision: 12,
      updatedAt: 800,
      structures,
      migrations: ['copy-triple-life-ladder-v1'],
    });
    expect(remote).not.toBeNull();
    const plan = planBlindStructuresRemoteApply(
      {
        revision: 9,
        writeId: 'this-tab',
        updatedAt: 500,
        custom: true,
        fingerprint: blindStructuresFingerprint(structures),
      },
      remote!,
    );
    expect(plan).toMatchObject({
      kind: 'meta',
      writeId: 'other-tab',
      revision: 12,
      republish: false,
    });
  });

  it('replaces when the remote ladder actually changed', () => {
    const remote = parseBlindStructuresSnapshot({
      v: 1,
      writeId: 'editor',
      revision: 10,
      updatedAt: 900,
      structures: [customStructure()],
      migrations: ['copy-triple-life-ladder-v1'],
    });
    expect(remote).not.toBeNull();
    const plan = planBlindStructuresRemoteApply(
      {
        revision: 9,
        writeId: 'timer-tab',
        updatedAt: 400,
        custom: true,
        fingerprint: blindStructuresFingerprint(BLIND_STRUCTURES),
      },
      remote!,
    );
    expect(plan.kind).toBe('replace');
    if (plan.kind === 'replace') {
      expect(plan.structures[0]?.id).toBe('bs-custom');
      expect(plan.republish).toBe(false);
    }
  });
});
