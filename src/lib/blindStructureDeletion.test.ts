import { describe, expect, it } from 'vitest';
import type { BlindStructure } from '../data/blindStructures';
import type { Tournament } from '../types/tournament';
import {
  structureDeleteBlock,
  structureDeleteBlockMessage,
  structureDeleteConfirm,
} from './blindStructureDeletion';

function structure(id: string, name = id): BlindStructure {
  return { id, name, levelDuration: 20, guarantee: 0, levels: [], payouts: [] };
}

function event(id: string, patch: Partial<Tournament> = {}): Tournament {
  return {
    id,
    title: id,
    imageUrl: '',
    address: '',
    startDate: '2026-10-09',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features: [],
    participants: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '20 мин',
    isClosed: false,
    ...patch,
  };
}

describe('deleting a blind structure', () => {
  const chill = structure('bs-chill', 'CHILL OUT');
  const other = structure('bs-other', 'Other');
  const idle = { isRunning: false, activeStructureId: null };

  it('allows an unused structure', () => {
    expect(structureDeleteBlock(other, [chill, other], [event('a', { blindStructureId: 'bs-chill' })], idle)).toBeNull();
  });

  it('never removes the last structure', () => {
    expect(structureDeleteBlock(chill, [chill], [], idle)).toEqual({ kind: 'last' });
  });

  it('refuses while the timer is running on it, but not when it is paused', () => {
    expect(
      structureDeleteBlock(chill, [chill, other], [], { isRunning: true, activeStructureId: 'bs-chill' }),
    ).toEqual({ kind: 'running' });
    expect(
      structureDeleteBlock(chill, [chill, other], [], { isRunning: false, activeStructureId: 'bs-chill' }),
    ).toBeNull();
    expect(
      structureDeleteBlock(chill, [chill, other], [], { isRunning: true, activeStructureId: 'bs-other' }),
    ).toBeNull();
  });

  it('refuses while a not yet closed tournament uses it, by id or by name', () => {
    const byId = event('t-1', { title: 'Friday', blindStructureId: 'bs-chill' });
    const byName = event('t-2', { title: 'Saturday', blindStructure: 'CHILL OUT', startDate: '2026-10-10' });
    const block = structureDeleteBlock(chill, [chill, other], [byId, byName], idle);
    expect(block).toEqual({
      kind: 'in-use',
      titles: ['Friday · 2026-10-09', 'Saturday · 2026-10-10'],
    });
  });

  it('lets closed tournaments keep the name and does not block on them', () => {
    const closed = event('t-3', { blindStructureId: 'bs-chill', isClosed: true });
    expect(structureDeleteBlock(chill, [chill, other], [closed], idle)).toBeNull();
  });

  it('explains every refusal in plain words', () => {
    expect(structureDeleteBlockMessage({ kind: 'last' }, 'X')).toMatch(/последняя/);
    expect(structureDeleteBlockMessage({ kind: 'running' }, 'X')).toMatch(/«X»/);
    const titles = Array.from({ length: 7 }, (_, i) => `T${i}`);
    const text = structureDeleteBlockMessage({ kind: 'in-use', titles }, 'X');
    expect(text).toContain('T0');
    expect(text).toContain('и ещё 2');
    expect(text).not.toContain('T6');
    expect(structureDeleteConfirm('X')).toMatch(/нельзя/);
  });
});
