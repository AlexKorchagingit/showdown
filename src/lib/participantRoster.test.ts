import { describe, expect, it } from 'vitest';
import { alignBustOutPlaces } from './bustOutPlaces';
import { rebaseParticipantRoster, rosterSeatKey } from './participantRoster';
import type { Participant } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, arrived: true, ...patch };
}

const tournamentId = 't-live';

describe('rebaseParticipantRoster', () => {
  it('deletes one cashier seat without dropping server-only players or bust-outs', () => {
    const previous = [
      player('keep', { place: 10 }),
      player('gone'),
      player('still'),
    ];
    const next = previous.filter((row) => row.id !== 'gone');
    const baseline = [
      player('keep', { place: 12, arrived: true }),
      player('gone'),
      player('still', { arrived: true }),
      player('late-reg', { arrived: false }),
      player('also-busted', { place: 11 }),
    ];
    const rebased = rebaseParticipantRoster(tournamentId, previous, next, baseline);
    expect(rebased.map((row) => row.id).sort()).toEqual(
      ['also-busted', 'keep', 'late-reg', 'still'].sort(),
    );
    expect(rebased.find((row) => row.id === 'keep')?.place).toBe(12);
    expect(rebased.find((row) => row.id === 'also-busted')?.place).toBe(11);
    expect(rebased.find((row) => row.id === 'late-reg')?.arrived).toBe(false);
    const aligned = alignBustOutPlaces(rebased, { isClosed: false });
    expect(aligned.find((row) => row.id === 'keep')?.place).toBe(3);
    expect(aligned.find((row) => row.id === 'also-busted')?.place).toBe(2);
  });

  it('does not un-arrive or un-place players when a stale screen only deletes one seat', () => {
    const previous = [
      player('a'),
      player('b', { place: 8, arrived: false }),
      player('c', { arrived: false }),
    ];
    const next = [player('a'), player('b', { place: 8, arrived: false })];
    const baseline = [
      player('a', { arrived: true }),
      player('b', { place: 9, arrived: true }),
      player('c', { arrived: true }),
    ];
    const rebased = rebaseParticipantRoster(tournamentId, previous, next, baseline);
    expect(rebased).toHaveLength(2);
    expect(rebased.find((row) => row.id === 'a')?.arrived).toBe(true);
    expect(rebased.find((row) => row.id === 'b')).toMatchObject({ place: 9, arrived: true });
  });

  it('keeps a guest bind as remove+add so the seat can reuse the old row', () => {
    const previous = [player('guest-ivan', { userId: null, arrived: true })];
    const next = [player('user-1', { userId: 'user-1', arrived: true, nickname: 'Ivan', place: 7 })];
    const baseline = [player('guest-ivan', { userId: null, arrived: true, place: 7 })];
    const rebased = rebaseParticipantRoster(tournamentId, previous, next, baseline);
    expect(rebased).toHaveLength(1);
    expect(rebased[0]).toMatchObject({ id: 'user-1', userId: 'user-1', nickname: 'Ivan', place: 7 });
  });

  it('applies an arrived tick from the lobby onto the live row', () => {
    const previous = [player('a', { arrived: false }), player('b', { arrived: true, place: 4 })];
    const next = [player('a', { arrived: true }), player('b', { arrived: true, place: 4 })];
    const baseline = [
      player('a', { arrived: false, comment: 'должен' }),
      player('b', { arrived: true, place: 5 }),
    ];
    const rebased = rebaseParticipantRoster(tournamentId, previous, next, baseline);
    expect(rebased.find((row) => row.id === 'a')).toMatchObject({
      arrived: true,
      comment: 'должен',
    });
    expect(rebased.find((row) => row.id === 'b')?.place).toBe(5);
  });

  it('matches bound seats by user id even when client ids differ in shape', () => {
    expect(
      rosterSeatKey({ id: `${tournamentId}:u1`, userId: 'u1' }, tournamentId),
    ).toBe(rosterSeatKey({ id: 'u1', userId: 'u1' }, tournamentId));
  });
});
