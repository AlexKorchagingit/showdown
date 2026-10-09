import { describe, expect, it } from 'vitest';
import { drawRandomPlayers, eligibleDrawPlayers } from './timerDraw';

const people = [
  { id: 'a', nickname: 'Аня' },
  { id: 'b', nickname: 'Боря' },
  { id: 'c', nickname: '  ' },
  { id: 'a', nickname: 'Аня-дубль' },
  { id: 'd', nickname: 'Дина' },
];

describe('timer random draw', () => {
  it('drops excluded seats and a repeated id', () => {
    expect(eligibleDrawPlayers(people, ['b']).map((row) => row.id)).toEqual(['a', 'c', 'd']);
    expect(eligibleDrawPlayers(people, ['b'])[1]?.nickname).toBe('c');
  });

  it('draws one person from the people who were not removed', () => {
    const drawn = drawRandomPlayers(people, ['a', 'c'], 1, () => 0);
    expect(drawn.map((row) => row.id)).toEqual(['d']);
  });

  it('never draws more people than are left in the pool', () => {
    const drawn = drawRandomPlayers(people, [], 9, () => 0);
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn.map((row) => row.id)).size).toBe(4);
  });

  it('returns nobody when the count is zero or everyone is excluded', () => {
    expect(drawRandomPlayers(people, [], 0)).toEqual([]);
    expect(drawRandomPlayers(people, ['a', 'b', 'c', 'd'], 2)).toEqual([]);
  });
});
