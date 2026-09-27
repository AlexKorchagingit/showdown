import { describe, expect, it } from 'vitest';
import { finalTableSize, itmPlaceCount } from '../data/prizeStructure';
import {
  collectPlayerGameHistory,
  computePlayerAdminStats,
  summarizePlayerGameHistory,
} from './playerAnalytics';
import type { Participant, Tournament } from '../types/tournament';
import type { Transaction } from '../types/finance';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, userId: id, nickname: id, rating: 0, arrived: true, ...patch };
}

function event(
  id: string,
  participants: Participant[],
  patch: Partial<Tournament> = {},
): Tournament {
  return {
    id,
    title: id,
    imageUrl: '',
    address: '',
    startDate: '2026-09-01',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 10_000,
    about: '',
    features: [],
    participants,
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '20 мин',
    isClosed: true,
    ...patch,
  };
}

function fieldOf(size: number, heroPlace: number): Participant[] {
  return Array.from({ length: size }, (_, index) => {
    const place = index + 1;
    return player(`p${place}`, {
      place,
      arrived: true,
      ...(place === heroPlace ? { id: 'hero', userId: 'hero', nickname: 'hero' } : {}),
    });
  });
}

describe('player profile history', () => {
  it('ignores no-shows when sizing the field and skips open events', () => {
    const closed = event('closed', [
      player('hero', { place: 2 }),
      player('ghost', { arrived: false }),
      player('other', { place: 1 }),
    ]);
    const open = event(
      'live',
      [player('hero', { place: undefined, arrived: true })],
      { isClosed: false },
    );
    const history = collectPlayerGameHistory([closed, open], ['hero']);
    expect(history).toHaveLength(1);
    expect(history[0]?.field).toBe(2);
    expect(history[0]?.place).toBe(2);
  });

  it('counts finals as the closed-lobby final table, not a hard top-9', () => {
    expect(itmPlaceCount(23)).toBe(9);
    expect(finalTableSize(23)).toBe(10);
    const bubble = collectPlayerGameHistory([event('big', fieldOf(23, 10))], ['hero']);
    const itm = collectPlayerGameHistory([event('itm', fieldOf(23, 9))], ['hero']);
    const miss = collectPlayerGameHistory([event('out', fieldOf(23, 11))], ['hero']);
    expect(summarizePlayerGameHistory(bubble)).toMatchObject({
      games: 1,
      finals: 1,
      top9: 0,
      top3: 0,
      wins: 0,
    });
    expect(summarizePlayerGameHistory(itm)).toMatchObject({ finals: 1, top9: 1 });
    expect(summarizePlayerGameHistory(miss)).toMatchObject({ finals: 0, top9: 0 });
  });
});

describe('player admin dashboard', () => {
  it('treats an open check-in as a visit but not as a finished ITM sample', () => {
    const live = event('live', [player('hero')], { isClosed: false });
    const done = event('done', fieldOf(22, 8));
    const stats = computePlayerAdminStats('hero', 'hero', [live, done], [], () => 0);
    expect(stats.tournamentsPlayed).toBe(2);
    expect(stats.finishedCount).toBe(1);
    expect(stats.itmCount).toBe(1);
    expect(stats.winrate).toBe(100);
    expect(itmPlaceCount(22)).toBe(8);
  });

  it('does not put an unpaid open visit into prize points', () => {
    const live = event('live', [player('hero')], { isClosed: false });
    const stats = computePlayerAdminStats('hero', 'hero', [live], [], () => 0);
    expect(stats.prizePoints).toBe(0);
    expect(stats.prizeRows).toEqual([]);
  });

  it('finds a finisher stored only in results', () => {
    const tournament = event('archived', [player('other', { place: 2 })], {
      results: [player('hero', { place: 1 })],
    });
    const history = collectPlayerGameHistory([tournament], ['hero']);
    expect(history).toHaveLength(1);
    const stats = computePlayerAdminStats('hero', 'hero', [tournament], [], () => 0);
    expect(stats.tournamentsPlayed).toBe(1);
    expect(stats.itmCount).toBe(1);
  });

  it('counts paid LTV and unpaid debt without void rows', () => {
    const txs: Transaction[] = [
      {
        id: 'p',
        date: '2026-09-01T12:00:00Z',
        userId: 'hero',
        tournamentId: 'done',
        type: 'buy-in',
        amount: 1000,
        status: 'paid',
        comment: '',
        isDealer: false,
        dealerHours: 0,
      },
      {
        id: 'u',
        date: '2026-09-01T12:00:00Z',
        userId: 'hero',
        tournamentId: 'done',
        type: 'rebuy',
        amount: 1000,
        status: 'unpaid',
        comment: '',
        isDealer: false,
        dealerHours: 0,
      },
      {
        id: 'v',
        date: '2026-09-01T12:00:00Z',
        userId: 'hero',
        tournamentId: 'done',
        type: 'addon',
        amount: 7000,
        status: 'paid',
        comment: '',
        isDealer: false,
        dealerHours: 0,
        voidedAt: '2026-09-01T13:00:00Z',
      },
    ];
    const stats = computePlayerAdminStats('hero', 'hero', [event('done', fieldOf(10, 1))], txs, () => 0);
    expect(stats.ltv).toBe(1000);
    expect(stats.clubDebt).toBe(1000);
    expect(stats.rebuyCount).toBe(1);
    expect(stats.addonCount).toBe(0);
  });
});
