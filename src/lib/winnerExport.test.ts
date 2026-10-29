import { describe, expect, it } from 'vitest';
import { ratingPointsForPlace } from '../data/prizeStructure';
import { winnerExportRows, winnerExportText } from './winnerExport';
import type { Participant, Tournament } from '../types/tournament';

function player(id: string, place: number, knockouts = 0): Participant {
  return { id, nickname: id, rating: 0, place, knockouts, arrived: true };
}

function tournament(patch: Partial<Tournament> = {}): Tournament {
  return {
    id: 't',
    title: 'FREEROLL',
    imageUrl: '',
    address: '',
    startDate: '2026-10-25',
    startTime: '19:00',
    totalSeats: 30,
    guarantee: 10_000,
    about: '',
    features: [],
    participants: [],
    lateRegUntil: '',
    blindStructure: '',
    stackSize: 0,
    levelDuration: '',
    isClosed: true,
    ...patch,
  };
}

describe('winner export', () => {
  it('numbers prize places and adds knockout points only when there are knockouts', () => {
    const players = [player('Ann', 1), player('Bob', 2, 1), player('Carl', 8, 3)];
    const event = tournament({ participants: players, isBounty: true, guarantee: 10_000 });
    const rows = winnerExportRows(players, event, 10);
    expect(rows.map((row) => row.nickname)).toEqual(['Ann', 'Bob']);
    expect(rows[0]).toMatchObject({ place: 1, points: ratingPointsForPlace(1, 10_000, 10), knockoutPoints: 0 });
    expect(rows[1]?.knockoutPoints).toBe(100);
    expect(winnerExportText(event.title, rows)).toBe(
      [
        'FREEROLL',
        `1. Ann — ${ratingPointsForPlace(1, 10_000, 10).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')}`,
        `2. Bob — ${ratingPointsForPlace(2, 10_000, 10).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')} +100`,
      ].join('\n'),
    );
  });
});
