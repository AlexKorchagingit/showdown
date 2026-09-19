import { describe, expect, it } from 'vitest';
import { filterStatisticTournaments } from './statsPeriod';
import type { Tournament } from '../types/tournament';

function event(id: string, hidden = false): Tournament {
  return {
    id,
    title: id,
    imageUrl: '',
    address: '',
    startDate: '2026-09-19',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features: [],
    participants: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed: false,
    hidden,
  };
}

describe('filterStatisticTournaments', () => {
  it('drops hidden events from the club Statistic sample', () => {
    const rows = filterStatisticTournaments(
      [event('open'), event('ghost', true)],
      'all',
      'all',
      new Date('2026-09-19T12:00:00'),
    );
    expect(rows.map((row) => row.id)).toEqual(['open']);
  });
});
