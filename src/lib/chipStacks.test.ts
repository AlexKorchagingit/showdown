import { describe, expect, it } from 'vitest';
import { chipAmountNear, declaredStartingStack, timerChipTotals } from './chipStacks';
import type { Transaction, TransactionType } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, userId: id, nickname: id, rating: 0, arrived: true, ...patch };
}

/** `n` checked-in players, the last `busted` of them with a finishing place. */
function field(n: number, busted = 0): Participant[] {
  return Array.from({ length: n }, (_, index) =>
    index < n - busted ? player(`p${index}`) : player(`p${index}`, { place: n - index }));
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
    // No screen edits this field, so it is only the last-resort fallback.
    stackSize: 50000,
    levelDuration: '20 мин',
    isClosed: false,
    participants,
    ...patch,
  };
}

function charge(id: string, type: TransactionType, patch: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: '2026-09-12T19:00:00Z',
    tournamentId: 'event',
    userId: id,
    type,
    amount: 1000,
    status: 'unpaid',
    comment: '',
    isDealer: false,
    dealerHours: 0,
    ...patch,
  };
}

/** `n` charges of one type, as the cashier writes them per player. */
function charges(type: TransactionType, n: number, patch: Partial<Transaction> = {}): Transaction[] {
  return Array.from({ length: n }, (_, index) => charge(`${type}-${index}`, type, patch));
}

describe('starting stack announced in the lobby', () => {
  it('reads the club wording, ignoring the big blinds in brackets', () => {
    expect(declaredStartingStack(tournament([], { features: ['Начальный стек 30000 (300 бб)'] }))).toBe(30000);
    expect(declaredStartingStack(tournament([], { features: ['Начальный стек 50 000 (500 бб)'] }))).toBe(50000);
    expect(declaredStartingStack(tournament([], { features: ['Стартовый стек — 25к'] }))).toBe(25000);
    expect(declaredStartingStack(tournament([], { about: 'Играем со стартовым стеком 50 000 фишек.' }))).toBe(50000);
  });

  it('prefers the announced stack over a stack mentioned in passing', () => {
    expect(declaredStartingStack(tournament([], {
      about: 'Потеряли стек на бэд-бите? Не беда.',
      features: ['Ограничение по рэ-энтри в 1 шт. за двойной стартовый стек', 'Начальный стек 30000 (300 бб)'],
    }))).toBe(30000);
  });

  it('reports nothing when the lobby says nothing about chips', () => {
    expect(declaredStartingStack(tournament([], { features: ['Вход 1 000 ₽', 'Бонус 300 бб'] }))).toBeNull();
    expect(declaredStartingStack(tournament([], { features: ['Короткий стек 30 бб'] }))).toBeNull();
    expect(declaredStartingStack(undefined)).toBeNull();
  });

  it('does not read a price as a stack', () => {
    expect(chipAmountNear('Начальный стек — 1 000 ₽', 'ст[еэ]к\\w*')).toBeNull();
    expect(chipAmountNear('', 'ст[еэ]к\\w*')).toBeNull();
  });
});

describe('timer totals for real tournaments', () => {
  it('ROYAL 30K: 18 entries, 5 rebuys, 4 left — 30 000 × 18 / 4', () => {
    const totals = timerChipTotals(
      tournament(field(18, 14), { features: ['Начальный стек 30000 (300 бб)'] }),
      [...charges('buy-in', 18), ...charges('rebuy', 5), ...charges('addon', 3)],
    );

    expect(totals).toMatchObject({
      entries: 18, rebuys: 5, addons: 3, active: 4,
      startingStack: 30000, startingStackDeclared: true, entriesFromSeats: false,
    });
    expect(totals.totalChips).toBe(540000);
    expect(totals.avgStack).toBe(135000);
    expect(Number.isInteger(totals.avgStack)).toBe(true);
  });

  it('DEEPSTACK 50K: tickets count as entries, everyone still playing', () => {
    const totals = timerChipTotals(
      tournament(field(12), { features: ['Начальный стек 50 000 (500 бб)'] }),
      [...charges('buy-in', 9), ...charges('ticket', 3)],
    );

    expect(totals).toMatchObject({ entries: 12, active: 12, startingStack: 50000 });
    expect(totals.avgStack).toBe(50000);
  });

  it('RE-ENTRY 30K: a second entry for the same player buys another stack', () => {
    const totals = timerChipTotals(
      tournament(field(10, 4), { features: ['Начальный стек 30000 (300 бб)'] }),
      [...charges('buy-in', 10), charge('re-entry', 'buy-in', { userId: 'p0' })],
    );

    expect(totals.entries).toBe(11);
    expect(totals.avgStack).toBe(Math.round((30000 * 11) / 6));
    expect(totals.avgStack).toBe(55000);
  });

  it('rounds to whole chips when the field does not divide evenly', () => {
    const totals = timerChipTotals(
      tournament(field(7, 4), { features: ['Начальный стек 30000 (300 бб)'] }),
      charges('buy-in', 7),
    );

    expect(totals.avgStack).toBe(70000);
    expect(Number.isInteger(totals.avgStack)).toBe(true);
  });

  it('BOUNTY 30K: a cancelled entry and a cancelled rebuy stop counting', () => {
    const totals = timerChipTotals(
      tournament(field(9, 3), { features: ['Начальный стек 30000 (300 бб)'] }),
      [
        ...charges('buy-in', 9),
        charge('void-entry', 'buy-in', { voidedAt: '2026-09-12T20:00:00Z' }),
        ...charges('rebuy', 2),
        charge('void-rebuy', 'rebuy', { voidedAt: '2026-09-12T20:05:00Z' }),
      ],
    );

    expect(totals).toMatchObject({ entries: 9, rebuys: 2 });
    expect(totals.avgStack).toBe(Math.round((30000 * 9) / 6));
  });

  it('MONTHLY FINAL: the cashier field stands in until the charges are entered', () => {
    const totals = timerChipTotals(
      tournament(field(27, 9), { features: ['Начальный стек 50 000 (500 бб)'] }),
      [],
    );

    expect(totals).toMatchObject({ entries: 27, entriesFromSeats: true, active: 18 });
    expect(totals.avgStack).toBe(75000);
  });

  it('falls back to the tournament card when the lobby announces no stack', () => {
    const totals = timerChipTotals(tournament(field(10, 5)), charges('buy-in', 10));

    expect(totals).toMatchObject({ startingStack: 50000, startingStackDeclared: false });
    expect(totals.avgStack).toBe(100000);
  });

  it('counts only this tournament and needs a player in the game', () => {
    const totals = timerChipTotals(
      tournament([player('a', { place: 1 })], { features: ['Начальный стек 30000'] }),
      [charge('other', 'rebuy', { tournamentId: 'another-event' })],
    );

    expect(totals).toMatchObject({ rebuys: 0, active: 0, avgStack: 0 });
    expect(timerChipTotals(undefined, []).avgStack).toBe(0);
  });
});
