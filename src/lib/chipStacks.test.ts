import { describe, expect, it } from 'vitest';
import { chipAmountNear, timerChipTotals } from './chipStacks';
import type { BlindLevel, BlindStructure } from '../data/blindStructures';
import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

function level(patch: Partial<BlindLevel> = {}): BlindLevel {
  return { level: 1, smallBlind: 100, bigBlind: 200, ante: 200, durationMinutes: 20, ...patch };
}

function structure(levels: BlindLevel[]): BlindStructure {
  return { id: 'bs', name: 'Test', levels, levelDuration: 20, guarantee: 0, payouts: [] };
}

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, userId: id, nickname: id, rating: 0, arrived: true, ...patch };
}

function tournament(participants: Participant[], patch: Partial<Tournament> = {}): Tournament {
  return {
    id: 'event',
    title: 'Test',
    imageUrl: '',
    address: '',
    startDate: '2026-09-12',
    startTime: '19:00',
    totalSeats: 27,
    guarantee: 0,
    about: '',
    features: [],
    lateRegUntil: '21:00',
    blindStructure: 'Test',
    stackSize: 30000,
    levelDuration: '20 мин',
    isClosed: false,
    participants,
    ...patch,
  };
}

function charge(id: string, type: Transaction['type'], patch: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: '2026-09-12T19:00:00Z',
    tournamentId: 'event',
    userId: 'a',
    type,
    amount: 1000,
    status: 'unpaid',
    comment: '',
    isDealer: false,
    dealerHours: 0,
    ...patch,
  };
}

describe('chip amounts written by hand', () => {
  it('reads the amount after or before the word, with thousand shorthands', () => {
    const addon = 'адд?он\\w*|add[-\\s]?on';
    expect(chipAmountNear('Аддон 20 000, вывод номинала 100', addon)).toBe(20000);
    expect(chipAmountNear('аддон: 20к', addon)).toBe(20000);
    expect(chipAmountNear('Даём 25 000 за аддон', addon)).toBe(25000);
    expect(chipAmountNear('Аддон по желанию', addon)).toBeNull();
    expect(chipAmountNear('', addon)).toBeNull();
  });

  it('does not read a price as a stack', () => {
    const addon = 'адд?он\\w*|add[-\\s]?on';
    expect(chipAmountNear('Аддон — 1 000 ₽', addon)).toBeNull();
    expect(chipAmountNear('Аддон 1000 руб.', addon)).toBeNull();
    expect(chipAmountNear('Аддон 1 000 ₽, стек 20 000 за аддон', addon)).toBe(20000);
  });
});

describe('average stack from the cashier', () => {
  const field = [
    player('a'),
    player('b'),
    player('c', { place: 3 }),
    player('lobby', { arrived: false }),
  ];

  it('spreads every bought stack over the players still in the game', () => {
    const totals = timerChipTotals(
      tournament(field),
      structure([
        level(),
        level({
          level: 2,
          smallBlind: 0,
          bigBlind: 0,
          ante: 0,
          isBreak: true,
          isLateRegEnd: true,
          comment: 'Аддон 20 000, ребай 15 000',
        }),
      ]),
      [charge('t1', 'rebuy'), charge('t2', 'addon'), charge('t3', 'buy-in')],
    );

    expect(totals).toMatchObject({
      entries: 3,
      active: 2,
      rebuys: 1,
      addons: 1,
      rebuyStack: 15000,
      addonStack: 20000,
      usesStartingStackFallback: false,
    });
    expect(totals.totalChips).toBe(30000 * 3 + 15000 + 20000);
    expect(totals.avgStack).toBe(Math.round(125000 / 2));
  });

  it('falls back to the starting stack when no note declares one', () => {
    const totals = timerChipTotals(tournament(field), structure([level()]), [charge('t1', 'rebuy')]);
    expect(totals.rebuyStack).toBe(30000);
    expect(totals.usesStartingStackFallback).toBe(true);
    expect(totals.avgStack).toBe(Math.round((30000 * 3 + 30000) / 2));
  });

  it('prefers the late-registration break note over the tournament blurb', () => {
    const totals = timerChipTotals(
      tournament(field, { features: ['Аддон 40 000'] }),
      structure([
        level({
          smallBlind: 0,
          bigBlind: 0,
          ante: 0,
          isBreak: true,
          isLateRegEnd: true,
          comment: 'Аддон 20 000',
        }),
      ]),
      [charge('t1', 'addon')],
    );
    expect(totals.addonStack).toBe(20000);
  });

  it('ignores an entry fee described without a currency sign', () => {
    const totals = timerChipTotals(
      tournament(field, { features: ['Ребай 1000', 'Аддон 1000'] }),
      structure([level()]),
      [charge('t1', 'rebuy')],
    );
    expect(totals.rebuyStack).toBe(30000);
    expect(totals.usesStartingStackFallback).toBe(true);
  });

  it('reads the tournament description when the ladder says nothing', () => {
    const totals = timerChipTotals(
      tournament(field, { features: ['Аддон 40 000'] }),
      structure([level()]),
      [charge('t1', 'addon')],
    );
    expect(totals.addonStack).toBe(40000);
  });

  it('ignores charges from other tournaments and keeps zero when nobody plays', () => {
    const totals = timerChipTotals(
      tournament([player('a', { place: 1 })]),
      structure([level()]),
      [charge('t1', 'rebuy', { tournamentId: 'other' })],
    );
    expect(totals.rebuys).toBe(0);
    expect(totals.avgStack).toBe(0);
  });

  it('reports nothing without a bound tournament', () => {
    expect(timerChipTotals(undefined, structure([level()]), []).avgStack).toBe(0);
  });
});
