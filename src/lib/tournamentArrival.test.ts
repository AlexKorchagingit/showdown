import { describe, expect, it } from 'vitest';
import {
  cashierFieldSize,
  cashierPlayers,
  finishedLobbyPlayers,
  hasArrivedWithoutPlace,
  isArrivedPlayer,
} from './tournamentArrival';
import type { Participant, Tournament } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, ...patch };
}

describe('tournament arrival', () => {
  it('treats a missing arrived flag as already in the cashier', () => {
    expect(isArrivedPlayer(player('a'))).toBe(true);
    expect(isArrivedPlayer(player('b', { arrived: true }))).toBe(true);
    expect(isArrivedPlayer(player('c', { arrived: false }))).toBe(false);
  });

  it('keeps only checked-in seats in the cashier field', () => {
    const participants = [
      player('showed', { arrived: true }),
      player('signed-up', { arrived: false }),
      player('legacy'),
    ];
    expect(cashierPlayers(participants).map((row) => row.id)).toEqual(['showed', 'legacy']);
    expect(cashierFieldSize({ participants } as Tournament)).toBe(2);
  });

  it('lists only cashier bust-outs for a closed lobby', () => {
    const participants = [
      player('winner', { arrived: true, place: 1 }),
      player('no-show', { arrived: false }),
      player('still-here', { arrived: true }),
    ];
    expect(finishedLobbyPlayers(participants).map((row) => row.id)).toEqual(['winner']);
    expect(hasArrivedWithoutPlace(participants)).toBe(true);
  });
});
