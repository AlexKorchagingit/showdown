import { describe, expect, it } from 'vitest';
import { BLIND_STRUCTURES, type BlindStructure } from '../data/blindStructures';
import {
  decideBlindStructuresSync,
  parseBlindStructuresSnapshot,
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
});
