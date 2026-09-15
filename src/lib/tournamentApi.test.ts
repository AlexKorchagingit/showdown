import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
  logSupabaseError: vi.fn(),
}));
import { participantListsEqual } from './tournamentApi';
import type { Participant } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, ...patch };
}

describe('roster equality guard', () => {
  const roster = [player('a', { arrived: true }), player('b', { arrived: true, place: 9 })];

  it('treats an unchanged roster as equal, whatever the object identity', () => {
    expect(participantListsEqual(roster, roster.map((row) => ({ ...row })))).toBe(true);
    expect(participantListsEqual([], [])).toBe(true);
  });

  it('notices anything the lobby or the cashier shows', () => {
    const changes: Participant[][] = [
      [roster[0]],
      [roster[0], { ...roster[1], place: 10 }],
      [roster[0], { ...roster[1], arrived: false }],
      [roster[0], { ...roster[1], nickname: 'Другой' }],
      [roster[0], { ...roster[1], knockouts: 2 }],
      [roster[0], { ...roster[1], comment: 'должен 1000' }],
      [roster[0], { ...roster[1], equippedAvatar: 'cat.png' }],
      [roster[1], roster[0]],
    ];
    for (const next of changes) expect(participantListsEqual(roster, next)).toBe(false);
  });
});
