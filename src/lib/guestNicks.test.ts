import { describe, expect, it } from 'vitest';
import { collectGuestNicks, guestBindConflicts } from './guestNicks';
import type { Participant, Tournament } from '../types/tournament';

function seat(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, ...patch };
}

function event(id: string, startDate: string, participants: Participant[], title = id): Tournament {
  return {
    id,
    title,
    imageUrl: '',
    address: '',
    startDate,
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features: [],
    participants,
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30_000,
    levelDuration: '20 мин',
    isClosed: true,
  };
}

describe('nick-only players', () => {
  const tournaments = [
    event('t-1', '2026-09-10', [
      seat('t-1:guest-ivan', { userId: null, nickname: 'Иван', place: 4 }),
      seat('user-1', { userId: 'user-1', nickname: 'Club' }),
    ]),
    event('t-2', '2026-10-02', [
      seat('t-2:guest-ivan', { userId: null, nickname: 'Иван К.' }),
      seat('t-2:guest-olga', { userId: null, nickname: 'Ольга', place: 1 }),
    ]),
  ];

  it('groups one nick across tournaments and puts the newest first', () => {
    const rows = collectGuestNicks(tournaments);
    expect(rows.map((row) => row.key)).toEqual(['guest-ivan', 'guest-olga']);
    const ivan = rows[0]!;
    expect(ivan.nickname).toBe('Иван К.');
    expect(ivan.lastDate).toBe('2026-10-02');
    expect(ivan.appearances.map((row) => row.tournamentId)).toEqual(['t-2', 't-1']);
    expect(ivan.appearances[1]?.place).toBe(4);
  });

  it('does not list club accounts', () => {
    expect(collectGuestNicks(tournaments).some((row) => row.key === 'user-1')).toBe(false);
  });

  it('warns when the chosen account already sits in one of the nick tournaments', () => {
    const withDouble = [
      tournaments[0]!,
      event(
        't-2',
        '2026-10-02',
        [
          seat('t-2:guest-ivan', { userId: null, nickname: 'Иван' }),
          seat('user-9', { userId: 'user-9', nickname: 'Real' }),
        ],
        'CHILL OUT',
      ),
    ];
    const ivan = collectGuestNicks(withDouble).find((row) => row.key === 'guest-ivan')!;
    expect(guestBindConflicts(ivan, 'user-9', withDouble)).toEqual(['CHILL OUT · 2026-10-02']);
    expect(guestBindConflicts(ivan, 'user-2', withDouble)).toEqual([]);
  });
});
