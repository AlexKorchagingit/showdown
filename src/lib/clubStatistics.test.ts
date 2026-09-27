import { describe, expect, it } from 'vitest';
import { collectTopFinalists, computeClubStatistics } from './clubStatistics';
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

function tx(
  id: string,
  patch: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    date: '2026-09-01T12:00:00Z',
    userId: 'hero',
    tournamentId: 'night',
    type: 'buy-in',
    amount: 1000,
    status: 'paid',
    comment: '',
    isDealer: false,
    dealerHours: 0,
    ...patch,
  };
}

const club = [
  { id: 'hero', nickname: 'Hero' },
  { id: 'rival', nickname: 'Rival' },
];

describe('club Statistic formulas', () => {
  it('counts attendance from club check-ins, not signup no-shows', () => {
    const tournament = event('night', [
      player('hero'),
      player('ghost', { arrived: false, place: undefined }),
      player('guest-ivan', { id: 'guest-ivan', userId: null, arrived: true }),
    ]);
    const stats = computeClubStatistics([tournament], [], club);
    expect(stats.averageAttendance).toBe(1);
    expect(stats.seatedCount).toBe(1);
    expect(stats.topAttendance).toEqual([{ id: 'hero', nickname: 'Hero', value: 1 }]);
  });

  it('averages the paid charge, not unpaid rows mixed into the denominator', () => {
    const tournament = event('night', [player('hero')]);
    const stats = computeClubStatistics(
      [tournament],
      [tx('paid'), tx('debt', { id: 'debt', status: 'unpaid', amount: 3000, type: 'rebuy' })],
      club,
    );
    expect(stats.averageCheck).toBe(1000);
    expect(stats.biggestCheck.amount).toBe(1000);
    expect(stats.debtorPercent).toBe(75);
  });

  it('counts a 10th-place bubble of a 23-player field as a finalist', () => {
    const participants = Array.from({ length: 23 }, (_, index) =>
      player(`p${index + 1}`, { place: index + 1 }),
    );
    participants[9] = player('hero', { place: 10 });
    const tournament = event('deep', participants);
    const names = new Map(club.map((row) => [row.id, row.nickname]));
    const known = new Set(club.map((row) => row.id));
    expect(collectTopFinalists([tournament], known, names)).toEqual([
      { id: 'hero', nickname: 'Hero', value: 1 },
    ]);
  });
});
