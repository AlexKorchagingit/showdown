import { describe, expect, it } from 'vitest';
import type { BlindStructure } from '../data/blindStructures';
import { emptyTimerSnapshot, freezeTimerSnapshot, timerPatchForStructure } from './timerSession';

function sampleStructure(levels: BlindStructure['levels']): BlindStructure {
  return {
    id: 'bs-test',
    name: 'Test',
    levelDuration: 20,
    guarantee: 0,
    payouts: [],
    levels,
  };
}

function playing(level: number, minutes = 20): BlindStructure['levels'][number] {
  return {
    level,
    smallBlind: 100 * level,
    bigBlind: 200 * level,
    ante: 200 * level,
    durationMinutes: minutes,
  };
}

describe('timerPatchForStructure', () => {
  it('shifts the clock forward when a level is inserted before the current rung', () => {
    const structure = sampleStructure([playing(1), playing(2), playing(3), playing(4)]);
    const snapshot = freezeTimerSnapshot(emptyTimerSnapshot(), {
      structureId: 'bs-test',
      levelIndex: 2,
      secondsLeft: 500,
      isRunning: false,
      levelDurations: [1200, 1200, 1200],
    });
    const patch = timerPatchForStructure(snapshot, structure, { insertedAt: 1 });
    expect(patch?.levelIndex).toBe(3);
    expect(patch?.secondsLeft).toBe(500);
    expect(patch?.levelDurations).toHaveLength(4);
  });

  it('stays on the same rung when inserting after the current level', () => {
    const structure = sampleStructure([playing(1), playing(2), playing(3)]);
    const snapshot = freezeTimerSnapshot(emptyTimerSnapshot(), {
      structureId: 'bs-test',
      levelIndex: 1,
      secondsLeft: 800,
      isRunning: false,
      levelDurations: [1200, 1200],
    });
    const patch = timerPatchForStructure(snapshot, structure, { insertedAt: 1 });
    expect(patch?.levelIndex).toBe(1);
    expect(patch?.secondsLeft).toBe(800);
  });

  it('caps remaining time when the current level gets shorter', () => {
    const structure = sampleStructure([playing(1, 10), playing(2)]);
    const snapshot = freezeTimerSnapshot(emptyTimerSnapshot(), {
      structureId: 'bs-test',
      levelIndex: 0,
      secondsLeft: 1100,
      isRunning: true,
      levelDurations: [1200, 1200],
    });
    const patch = timerPatchForStructure(snapshot, structure);
    expect(patch?.secondsLeft).toBe(600);
    expect(patch?.levelDurations?.[0]).toBe(600);
  });

  it('does nothing when only blinds change', () => {
    const structure = sampleStructure([playing(1), playing(2)]);
    structure.levels[0] = { ...structure.levels[0], smallBlind: 150, bigBlind: 300, ante: 300 };
    const snapshot = freezeTimerSnapshot(emptyTimerSnapshot(), {
      structureId: 'bs-test',
      levelIndex: 0,
      secondsLeft: 900,
      isRunning: false,
      levelDurations: [1200, 1200],
    });
    expect(timerPatchForStructure(snapshot, structure)).toBeNull();
  });
});
