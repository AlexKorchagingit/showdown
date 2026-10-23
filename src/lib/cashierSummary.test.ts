import { describe, expect, it } from 'vitest';
import { cashierSummary } from './cashierSummary';
import type { Transaction, TransactionType } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, nickname: id, rating: 0, arrived: true, ...patch };
}

function tx(id: string, userId: string, type: TransactionType, patch: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: '2026-10-16T18:00:00Z',
    userId,
    tournamentId: 't1',
    type,
    amount: 1000,
    status: 'paid',
    comment: '',
    isDealer: false,
    dealerHours: 0,
    ...patch,
  };
}

function event(participants: Participant[]): Tournament {
  return {
    id: 't1',
    title: 'Test',
    imageUrl: '',
    address: '',
    startDate: '2026-10-16',
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

describe('cashier top line', () => {
  it('matches the timer for players still in', () => {
    const tournament = event([
      player('a'),
      player('b'),
      player('c', { place: 3 }),
      player('lobby', { arrived: false }),
    ]);
    const summary = cashierSummary(tournament, []);
    expect(summary.remaining).toBe(2);
    expect(summary.field).toBe(3);
  });

  it('counts people, and keeps the repeated badges visible', () => {
    const tournament = event([player('a'), player('b'), player('c')]);
    const ledger = [
      tx('1', 'a', 'rebuy'),
      tx('2', 'a', 'rebuy'),
      tx('3', 'b', 'rebuy'),
      tx('4', 'c', 'addon'),
      tx('5', 'a', 'buy-in'),
    ];
    const summary = cashierSummary(tournament, ledger);
    expect(summary.rebuyPeople).toBe(2);
    expect(summary.rebuyTotal).toBe(3);
    expect(summary.addonPeople).toBe(1);
    expect(summary.addonTotal).toBe(1);
  });

  it('counts people who still owe something today in Moscow', () => {
    const tournament = event([player('a'), player('b'), player('c')]);
    const ledger = [
      tx('1', 'a', 'buy-in', { status: 'unpaid', date: '2026-10-23T14:00:00Z' }),
      tx('2', 'a', 'rebuy', { status: 'unpaid', date: '2026-10-23T18:30:00Z' }),
      tx('3', 'b', 'buy-in', { status: 'unpaid', date: '2026-10-22T20:00:00Z' }),
      tx('4', 'c', 'buy-in', { status: 'paid', date: '2026-10-23T15:00:00Z' }),
      tx('5', 'c', 'rebuy', { status: 'unpaid', date: '2026-10-23T15:10:00Z', voidedAt: '2026-10-23T16:00:00Z' }),
    ];
    expect(cashierSummary(tournament, ledger, '2026-10-23').unpaidPeople).toBe(1);
  });

  it('does not count a charge when nobody is in the cashier', () => {
    const tournament = event([player('a', { arrived: false })]);
    const ledger = [
      tx('1', 'a', 'buy-in', { status: 'unpaid', date: '2026-10-23T14:00:00Z' }),
    ];
    expect(cashierSummary(tournament, ledger, '2026-10-23').unpaidPeople).toBe(0);
  });

  it('skips cancelled badges and other tournaments', () => {
    const tournament = event([player('a'), player('b')]);
    const ledger = [
      tx('1', 'a', 'rebuy', { voidedAt: '2026-10-16T19:00:00Z' }),
      tx('2', 'b', 'rebuy', { tournamentId: 'other' }),
      tx('3', 'b', 'addon'),
    ];
    const summary = cashierSummary(tournament, ledger);
    expect(summary.rebuyPeople).toBe(0);
    expect(summary.addonPeople).toBe(1);
  });

  it('is empty without a tournament', () => {
    expect(cashierSummary(undefined, [])).toEqual({
      remaining: 0,
      field: 0,
      rebuyPeople: 0,
      rebuyTotal: 0,
      addonPeople: 0,
      addonTotal: 0,
      unpaidPeople: 0,
    });
  });
});
