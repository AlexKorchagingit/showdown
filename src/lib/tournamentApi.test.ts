import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
  logSupabaseError: vi.fn(),
}));
import { fetchParticipantsByTournament, participantListsEqual } from './tournamentApi';
import { supabase } from './supabase';
import type { Participant } from '../types/tournament';

type PageResult = { data: unknown[] | null; error: { message: string } | null };

function pagedParticipants(total: number, failure?: string) {
  const starts: number[] = [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.range = (from: number, to: number) => {
    starts.push(from);
    let result: PageResult;
    if (failure) {
      result = { data: null, error: { message: failure } };
    } else {
      const last = Math.min(to, total - 1);
      const data = Array.from({ length: Math.max(0, last - from + 1) }, (_, index) => ({
        id: `t-${(from + index) % 40}:u-${from + index}`,
        tournament_id: `t-${(from + index) % 40}`,
        user_id: `u-${from + index}`,
        nickname: `n${from + index}`,
        rating: 0,
        place: null,
        knockouts: 0,
        rubies_awarded: null,
        comment: null,
      }));
      result = { data, error: null };
    }
    const page = Promise.resolve(result) as Promise<PageResult> & { eq: () => unknown };
    page.eq = () => page;
    return page;
  };
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return starts;
}

describe('reading every roster', () => {
  it('walks past the 1000-row API limit instead of dropping the newest seats', async () => {
    const starts = pagedParticipants(2300);
    const grouped = await fetchParticipantsByTournament();
    expect(starts).toEqual([0, 1000, 2000]);
    expect([...grouped.values()].reduce((sum, rows) => sum + rows.length, 0)).toBe(2300);
  });

  it('fails loudly so the loaded rosters are kept', async () => {
    pagedParticipants(10, 'network down');
    await expect(fetchParticipantsByTournament()).rejects.toThrow('network down');
  });
});

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
      [roster[0], { ...roster[1], teamPartnerId: 'a' }],
      [roster[0], { ...roster[1], equippedAvatar: 'cat.png' }],
      [roster[0], { ...roster[1], rosterRevision: 2 }],
      [roster[1], roster[0]],
    ];
    for (const next of changes) expect(participantListsEqual(roster, next)).toBe(false);
  });
});
