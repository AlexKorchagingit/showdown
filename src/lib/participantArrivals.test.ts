import { describe, expect, it } from 'vitest';
import {
  applyArrivalOverlay,
  parseArrivalSnapshot,
  upsertTournamentArrivals,
} from './participantArrivals';
import type { Participant } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, ...patch };
}

describe('participant arrival overlay', () => {
  it('parses a logs JSON snapshot', () => {
    const parsed = parseArrivalSnapshot(
      JSON.stringify({ v: 1, byTournament: { opening: { 'user-1': true, skip: false } } }),
    );
    expect(parsed).toEqual({ v: 1, byTournament: { opening: { 'user-1': true } } });
    expect(parseArrivalSnapshot('nope')).toBeNull();
  });

  it('applies checked-in seats onto fetched players', () => {
    const overlay = {
      v: 1 as const,
      byTournament: { opening: { 'user-1': true as const, 'guest-ivan': true as const } },
    };
    const next = applyArrivalOverlay('opening', [
      player('user-1'),
      player('guest-ivan', { userId: null }),
      player('user-2'),
    ], overlay);
    expect(next.map((row) => [row.id, row.arrived])).toEqual([
      ['user-1', true],
      ['guest-ivan', true],
      ['user-2', false],
    ]);
  });

  it('rewrites one tournament map from the current seats', () => {
    const previous = {
      v: 1 as const,
      byTournament: { opening: { 'user-1': true as const }, other: { 'user-9': true as const } },
    };
    const next = upsertTournamentArrivals(previous, 'opening', [
      player('user-1', { arrived: false }),
      player('user-2', { userId: 'user-2', arrived: true }),
    ]);
    expect(next.byTournament.opening).toEqual({ 'user-2': true });
    expect(next.byTournament.other).toEqual({ 'user-9': true });
  });
});
