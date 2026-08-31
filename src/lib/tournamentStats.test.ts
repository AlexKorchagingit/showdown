import { describe, expect, it } from 'vitest';
import { autoAvgStack, remainingPlayers, tournamentPlayerCounts } from './tournamentStats';
import type { Participant, Tournament } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, ...patch };
}

function event(participants: Participant[]): Tournament {
  return {
    id: 't1',
    title: 'Test',
    imageUrl: '',
    address: '',
    startDate: '2026-08-31',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 10000,
    about: '',
    features: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed: false,
    participants,
  };
}

describe('timer counts from the cashier', () => {
  it('ignores lobby sign-ups that are not checked in', () => {
    const tournament = event([
      player('here', { arrived: true }),
      player('signed-up', { arrived: false }),
      player('busted', { arrived: true, place: 9 }),
    ]);
    expect(remainingPlayers(tournament).map((row) => row.id)).toEqual(['here']);
    expect(tournamentPlayerCounts(tournament)).toEqual({ remaining: 1, registered: 2 });
  });

  it('builds average stack from the cashier field, not the whole lobby', () => {
    const tournament = event([
      player('a', { arrived: true }),
      player('b', { arrived: true }),
      player('ghost', { arrived: false }),
    ]);
    expect(autoAvgStack(tournament)).toBe(30000);
  });
});
