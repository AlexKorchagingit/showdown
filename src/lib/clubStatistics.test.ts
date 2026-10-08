import { describe, expect, it } from 'vitest';
import {
  collectTopFinalists,
  computeClubLeaders,
  computeClubStatistics,
  tournamentWasPlayed,
} from './clubStatistics';
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

  it('does not dilute averages with events nobody has checked in to yet', () => {
    const played = event('night', [player('hero'), player('rival')], { startDate: '2026-09-01' });
    const upcoming = event('later', [player('hero', { arrived: false })], {
      startDate: '2026-09-04',
      isClosed: false,
    });
    expect(tournamentWasPlayed(played)).toBe(true);
    expect(tournamentWasPlayed(upcoming)).toBe(false);

    const stats = computeClubStatistics(
      [played, upcoming, event('empty', [], { startDate: '2026-09-05', isClosed: false })],
      [],
      club,
      'all',
      new Date('2026-09-02T12:00:00'),
    );
    expect(stats.tournamentCount).toBe(1);
    expect(stats.averageAttendance).toBe(2);
    expect(stats.attendanceChart.map((row) => row.id)).toEqual(['night']);
  });

  it('draws days after today empty on the week chart and keeps played days', () => {
    const played = event('night', [player('hero'), player('rival')], { startDate: '2026-09-01' });
    const stats = computeClubStatistics(
      [played],
      [],
      club,
      'week',
      new Date('2026-09-02T12:00:00'),
    );
    const byDay = new Map(stats.attendanceChart.map((row) => [row.id, row]));
    expect(byDay.get('2026-09-01')?.players).toBe(2);
    expect(byDay.get('2026-09-01')?.future).toBe(false);
    expect(byDay.get('2026-09-02')?.future).toBe(false);
    expect(byDay.get('2026-09-03')?.future).toBe(true);
    expect(stats.attendanceChart).toHaveLength(7);
  });

  it('reports the seats it could not count instead of hiding them', () => {
    const tournament = event('night', [
      player('hero'),
      player('t-night:guest-ivan', { id: 't-night:guest-ivan', userId: null, nickname: 'Иван' }),
      player('t-night:guest-olga', { id: 't-night:guest-olga', userId: null, nickname: 'Ольга', arrived: false, place: 3 }),
    ]);
    const stats = computeClubStatistics([tournament], [], club);
    expect(stats.seatedCount).toBe(1);
    expect(stats.skippedSeats).toBe(2);
    expect(stats.unboundNicks).toBe(2);
  });
});

describe('top-3 lists', () => {
  const rows = [
    event('a', [player('hero'), player('rival')], { startDate: '2026-09-01' }),
    event('b', [player('hero'), player('rival')], { startDate: '2026-08-15' }),
    event('later', [player('hero', { arrived: false })], { startDate: '2026-12-01', isClosed: false }),
  ];

  it('breaks ties by the rating of the same period, not by the alphabet', () => {
    const byAlphabet = computeClubLeaders(rows, club).attendance.map((row) => row.id);
    expect(byAlphabet).toEqual(['hero', 'rival']);
    const byRating = computeClubLeaders(rows, club, new Map([['rival', 900], ['hero', 100]]))
      .attendance.map((row) => row.id);
    expect(byRating).toEqual(['rival', 'hero']);
  });

  it('ignores events that have not been played', () => {
    const leaders = computeClubLeaders([rows[2]!], club);
    expect(leaders.attendance).toEqual([]);
    expect(leaders.finalists).toEqual([]);
    expect(leaders.bounty).toEqual([]);
  });
});
