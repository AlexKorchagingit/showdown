import { describe, expect, it } from 'vitest';
import { nicknamesByPlace, prizePointsForTimerPlace, remainingPlayers, tournamentPlayerCounts } from './tournamentStats';
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

  it('counts the cashier field, not the whole lobby', () => {
    const tournament = event([
      player('a', { arrived: true }),
      player('b', { arrived: true }),
      player('ghost', { arrived: false }),
    ]);
    expect(tournamentPlayerCounts(tournament)).toEqual({ remaining: 2, registered: 2 });
  });
});

describe('TEAM BATTLE timer labels', () => {
  it('joins both nicks on the team scoring place and splits the shown points', () => {
    const tournament = {
      ...event([
        player('Алиса', { arrived: true, place: 1, teamPartnerId: 'Борис', nickname: 'Алиса' }),
        player('Борис', { arrived: true, place: 4, teamPartnerId: 'Алиса', nickname: 'Борис' }),
        player('solo-a', { arrived: true, place: 2 }),
        player('solo-b', { arrived: true, place: 3 }),
      ]),
      title: 'TEAM BATTLE',
      guarantee: 12_000,
    };
    expect(nicknamesByPlace(tournament).get(1)).toBe('Алиса / Борис');
    expect(nicknamesByPlace(tournament).has(4)).toBe(false);
    expect(prizePointsForTimerPlace(tournament, 1, 7800, 4)).toBe(3900);
    expect(prizePointsForTimerPlace(tournament, 2, 4200, 4)).toBe(4200);
  });
});
