import { describe, expect, it } from 'vitest';
import { nextEliminatedPlace, sortFinancePlayers } from './tournamentStatus';
import type { Participant } from '../types/tournament';

function player(id: string, nickname: string, place?: number): Participant {
  return { id, nickname, rating: 0, arrived: true, place };
}

describe('sortFinancePlayers', () => {
  const live = [
    player('1', 'Яна'),
    player('2', 'Борис', 12),
    player('3', 'Анна'),
    player('4', 'Виктор', 14),
    player('5', 'Глеб', 13),
  ];

  it('lists players still in the game A–Z, then bust-outs in the order they left', () => {
    expect(sortFinancePlayers(live, false).map((row) => row.nickname)).toEqual([
      'Анна',
      'Яна',
      'Виктор',
      'Глеб',
      'Борис',
    ]);
  });

  it('does not mutate the given list', () => {
    const source = [...live];
    sortFinancePlayers(source, false);
    expect(source).toEqual(live);
  });

  it('keeps the results order for a closed tournament', () => {
    expect(sortFinancePlayers(live, true).map((row) => row.nickname)).toEqual([
      'Борис',
      'Глеб',
      'Виктор',
      'Яна',
      'Анна',
    ]);
  });
});

describe('nextEliminatedPlace', () => {
  it('hands out the bottom place freed by a late entry', () => {
    const field = Array.from({ length: 11 }, (_, index) => player(`p${index}`, `p${index}`));
    field[0] = player('p0', 'p0', 11);
    expect(nextEliminatedPlace(field)).toBe(10);
  });
});
