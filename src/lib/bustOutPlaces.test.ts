import { describe, expect, it } from 'vitest';
import { alignBustOutPlaces } from './bustOutPlaces';
import type { Participant } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, arrived: true, ...patch };
}

function field(size: number, placed: Record<string, number> = {}): Participant[] {
  return Array.from({ length: size }, (_, index) => {
    const id = `p${index + 1}`;
    return player(id, id in placed ? { place: placed[id] } : {});
  });
}

const open = { isClosed: false };

function places(participants: Participant[]): Record<string, number | undefined> {
  return Object.fromEntries(
    participants.filter((row) => row.place !== undefined).map((row) => [row.id, row.place]),
  );
}

describe('alignBustOutPlaces', () => {
  it('pushes the bust-out down when a late entry joins the field', () => {
    const before = field(10, { p1: 10 });
    const after = alignBustOutPlaces([...before, player('late')], open);
    expect(places(after)).toEqual({ p1: 11 });
  });

  it('keeps the bust-out order while shifting every finished player', () => {
    const before = field(10, { p1: 10, p2: 9, p3: 8 });
    const after = alignBustOutPlaces([...before, player('late')], open);
    expect(places(after)).toEqual({ p1: 11, p2: 10, p3: 9 });
  });

  it('leaves a seat that is not checked in out of the field', () => {
    const before = field(10, { p1: 10 });
    const after = alignBustOutPlaces([...before, player('signed-up', { arrived: false })], open);
    expect(places(after)).toEqual({ p1: 10 });
  });

  it('pulls places back up when a player leaves the field before busting', () => {
    const before = field(11, { p1: 11, p2: 10 });
    const after = alignBustOutPlaces(
      before.filter((row) => row.id !== 'p11'),
      open,
    );
    expect(places(after)).toEqual({ p1: 10, p2: 9 });
  });

  it('closes the gap left by a player who returned to the game', () => {
    const returned = field(11, { p1: 11, p2: 10 }).map((row) =>
      row.id === 'p1' ? { ...row, place: undefined } : row,
    );
    expect(places(alignBustOutPlaces(returned, open))).toEqual({ p2: 11 });
  });

  it('returns the same array when nothing has to move', () => {
    const participants = field(10, { p1: 10, p2: 9 });
    expect(alignBustOutPlaces(participants, open)).toBe(participants);
  });

  it('never touches the final places of a closed tournament', () => {
    const participants = field(3, { p1: 3, p2: 2, p3: 1 });
    const withLateSeat = [...participants, player('late')];
    expect(alignBustOutPlaces(withLateSeat, { isClosed: true })).toBe(withLateSeat);
  });
});
