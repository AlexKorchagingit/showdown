import { describe, expect, it } from 'vitest';
import type { Tournament } from '../types/tournament';
import { formatTournamentHeldOn, openTournaments } from './timerTournament';

function event(id: string, startDate: string, startTime = '19:00', isClosed = false): Tournament {
  return {
    id,
    title: id,
    imageUrl: '',
    address: '',
    startDate,
    startTime,
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features: [],
    participants: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed,
  };
}

describe('formatTournamentHeldOn', () => {
  it('prints the calendar day and start time without a timezone shift', () => {
    const label = formatTournamentHeldOn('2026-08-30', '19:00');
    expect(label).toContain('30');
    expect(label.toLowerCase()).toContain('август');
    expect(label).toContain('19:00');
  });

  it('falls back to a dash when both date and time are empty', () => {
    expect(formatTournamentHeldOn('', '')).toBe('—');
  });
});

describe('openTournaments', () => {
  it('lists open events from nearest to furthest start, skipping closed ones', () => {
    const rows = openTournaments([
      event('far', '2026-12-01', '21:00'),
      event('closed', '2026-09-01', '12:00', true),
      event('soon', '2026-09-02', '19:00'),
      event('today-late', '2026-09-01', '21:00'),
      event('today-early', '2026-09-01', '12:00'),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['today-early', 'today-late', 'soon', 'far']);
  });
});
