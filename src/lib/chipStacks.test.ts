import { describe, expect, it } from 'vitest';
import {
  chipAmountNear,
  declaredStartingStack,
  rebuyLimitFrom,
  stackMultiplierNear,
  timerChipTotals,
} from './chipStacks';
import type { BlindLevel, BlindStructure } from '../data/blindStructures';
import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';

const REBUY_WORD = 'ре-?ба[а-яё]*|re[-\\s]?buy|р[еэ]-?энтри|re[-\\s]?entry';
const ADDON_WORD = 'адд?он[а-яё]*|add[-\\s]?on';

function level(patch: Partial<BlindLevel> = {}): BlindLevel {
  return { level: 1, smallBlind: 100, bigBlind: 200, ante: 200, durationMinutes: 20, ...patch };
}

function structure(levels: BlindLevel[]): BlindStructure {
  return { id: 'bs', name: 'Test', levels, levelDuration: 20, guarantee: 0, payouts: [] };
}

function lateRegBreak(comment: string): BlindLevel {
  return level({
    smallBlind: 0,
    bigBlind: 0,
    ante: 0,
    isBreak: true,
    isLateRegEnd: true,
    comment,
  });
}

function player(id: string, patch: Partial<Participant> = {}): Participant {
  return { id, userId: id, nickname: id, rating: 0, arrived: true, ...patch };
}

/** `left` players are still in the game, the rest already busted. */
function field(seats: number, left: number): Participant[] {
  return Array.from({ length: seats }, (_, index) =>
    index < left
      ? player(`p${index + 1}`)
      : player(`p${index + 1}`, { place: seats - index + left }),
  );
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

/** `count` badges of one kind, one per player unless `userId` is pinned. */
function badges(type: Transaction['type'], count: number, patch: Partial<Transaction> = {}): Transaction[] {
  return Array.from({ length: count }, (_, index) =>
    charge(`${type}-${index + 1}`, type, { userId: `p${index + 1}`, ...patch }),
  );
}

describe('chip amounts written by hand', () => {
  it('reads the amount after or before the word, with thousand shorthands', () => {
    expect(chipAmountNear('Аддон 20 000, вывод номинала 100', ADDON_WORD)).toBe(20000);
    expect(chipAmountNear('аддон: 20к', ADDON_WORD)).toBe(20000);
    expect(chipAmountNear('Даём 25 000 за аддон', ADDON_WORD)).toBe(25000);
    expect(chipAmountNear('Аддон по желанию', ADDON_WORD)).toBeNull();
    expect(chipAmountNear('', ADDON_WORD)).toBeNull();
  });

  it('does not read a price as a stack', () => {
    expect(chipAmountNear('Аддон — 1 000 ₽', ADDON_WORD)).toBeNull();
    expect(chipAmountNear('Аддон 1000 руб.', ADDON_WORD)).toBeNull();
    expect(chipAmountNear('Аддон 1 000 ₽, стек 20 000 за аддон', ADDON_WORD)).toBe(20000);
  });

  it('reads the declared starting stack and ignores the big-blind count', () => {
    expect(declaredStartingStack(tournament([], { features: ['Начальный стек 50 000 (500 бб)'] })))
      .toBe(50000);
    expect(declaredStartingStack(tournament([], { features: ['Стартовый стек 30000 (300 бб)'] })))
      .toBe(30000);
    expect(declaredStartingStack(tournament([], { features: ['Начальный стек 300 бб'] }))).toBeNull();
    expect(declaredStartingStack(tournament([], { features: ['Классическая структура'] }))).toBeNull();
    expect(
      declaredStartingStack(
        tournament([], {
          features: ['Ре-энтри 1 шт. — тройной стартовый стек (90 000)', 'Начальный стек 30000'],
        }),
      ),
    ).toBe(30000);
  });

  it('reads how many starting stacks a rebuy is worth', () => {
    expect(stackMultiplierNear('Ре-энтри 1 шт. за тройной стартовый стек', REBUY_WORD)).toBe(3);
    expect(stackMultiplierNear('Ре-энтри за двойной стартовый стек', REBUY_WORD)).toBe(2);
    expect(stackMultiplierNear('Ребай — 3 стартовых стека', REBUY_WORD)).toBe(3);
    expect(stackMultiplierNear('Ребай — 2 стека', REBUY_WORD)).toBe(2);
    expect(stackMultiplierNear('Начальный стек 30000 (300 бб)', REBUY_WORD)).toBeNull();
    expect(stackMultiplierNear('Без ограничений по ре-энтри', REBUY_WORD)).toBeNull();
  });

  it('reads the per-player rebuy limit', () => {
    expect(rebuyLimitFrom('Ограничение по ре-энтри в 1 шт. за тройной стартовый стек')).toBe(1);
    expect(rebuyLimitFrom('Ограничение по рэ-энтри в 1 шт. за двойной стартовый стек')).toBe(1);
    expect(rebuyLimitFrom('Ограничение по ре-энтри в 3 шт.')).toBe(3);
    expect(rebuyLimitFrom('Ре-энтри 1 шт. — тройной стартовый стек')).toBe(1);
    expect(rebuyLimitFrom('Ребай одиночный')).toBe(1);
    expect(rebuyLimitFrom('Без ограничений по ре-энтри')).toBeNull();
    expect(rebuyLimitFrom('Без возможности ре-энтри')).toBe(0);
    expect(rebuyLimitFrom('Начальный стек 30000')).toBeNull();
  });
});

describe('timer totals from the tournament cashier', () => {
  it('FREEROLL 30K: entry badges drive the count, the declared stack the chips', () => {
    const totals = timerChipTotals(
      tournament(field(18, 6), {
        features: ['Начальный стек 30000 (300 бб)', 'Без ограничений по ре-энтри'],
      }),
      structure([level()]),
      [...badges('buy-in', 18), ...badges('rebuy', 4), ...badges('addon', 3)],
    );

    expect(totals).toMatchObject({
      entries: 18,
      entriesFromSeats: false,
      active: 6,
      rebuys: 4,
      rebuysBeyondLimit: 0,
      rebuyLimit: null,
      addons: 3,
      startingStack: 30000,
      startingStackDeclared: true,
      rebuyStack: 30000,
      addonStack: 30000,
    });
    expect(totals.totalChips).toBe(30000 * 25);
    expect(totals.avgStack).toBe(125000);
    expect(Number.isInteger(totals.avgStack)).toBe(true);
  });

  it('DEEPSTACK 50K: a ticket is an entry too', () => {
    const totals = timerChipTotals(
      tournament(field(12, 5), { features: ['Начальный стек 50 000 (500 бб)'], stackSize: 30000 }),
      structure([level()]),
      [...badges('buy-in', 8), ...badges('ticket', 4, { id: 'ticket' })],
    );

    expect(totals.entries).toBe(12);
    expect(totals.startingStack).toBe(50000);
    expect(totals.totalChips).toBe(600000);
    expect(totals.avgStack).toBe(120000);
  });

  it('PHOENIX: a single rebuy per player is worth three starting stacks', () => {
    const phoenix = tournament(field(14, 4), {
      features: [
        'Начальный стек 30000 (300 бб)',
        'Ограничение по ре-энтри в 1 шт. за тройной стартовый стек (90 000)',
      ],
    });
    const totals = timerChipTotals(phoenix, structure([level()]), [
      ...badges('buy-in', 14),
      ...badges('rebuy', 3),
    ]);

    expect(totals).toMatchObject({
      entries: 14,
      rebuys: 3,
      rebuyLimit: 1,
      rebuyStack: 90000,
      rebuyStackMultiplier: 3,
      startingStack: 30000,
    });
    expect(totals.totalChips).toBe(30000 * 14 + 90000 * 3);
    expect(totals.avgStack).toBe(172500);
  });

  it('PHOENIX: a second rebuy badge for the same player is not chips on the table', () => {
    const phoenix = tournament(field(14, 5), {
      features: [
        'Начальный стек 30000 (300 бб)',
        'Ограничение по ре-энтри в 1 шт. за тройной стартовый стек',
      ],
    });
    const totals = timerChipTotals(phoenix, structure([level()]), [
      ...badges('buy-in', 14),
      charge('r1', 'rebuy', { userId: 'p1' }),
      charge('r2', 'rebuy', { userId: 'p1' }),
      charge('r3', 'rebuy', { userId: 'p2' }),
    ]);

    expect(totals).toMatchObject({ rebuys: 2, rebuysBeyondLimit: 1, rebuyStack: 90000 });
    expect(totals.totalChips).toBe(30000 * 14 + 90000 * 2);
    expect(totals.avgStack).toBe(120000);
  });

  it('TRIPLE LIFE: three re-entries per player are all counted', () => {
    const totals = timerChipTotals(
      tournament(field(20, 8), {
        features: ['Начальный стек 30000 (300 бб)', 'Ограничение по ре-энтри в 3 шт.'],
      }),
      structure([level()]),
      [
        ...badges('buy-in', 20),
        charge('r1', 'rebuy', { userId: 'p1' }),
        charge('r2', 'rebuy', { userId: 'p1' }),
        charge('r3', 'rebuy', { userId: 'p1' }),
        charge('r4', 'rebuy', { userId: 'p2' }),
      ],
    );

    expect(totals).toMatchObject({ rebuys: 4, rebuysBeyondLimit: 0, rebuyLimit: 3 });
    expect(totals.totalChips).toBe(30000 * 24);
    expect(totals.avgStack).toBe(90000);
  });

  it('FREEZEOUT: a cancelled entry leaves no chips behind', () => {
    const totals = timerChipTotals(
      tournament(field(10, 4), { features: ['Начальный стек 30000 (300 бб)'] }),
      structure([level()]),
      [
        ...badges('buy-in', 10),
        charge('void', 'buy-in', { userId: 'p11', voidedAt: '2026-09-12T20:00:00Z' }),
        charge('void-rebuy', 'rebuy', { userId: 'p1', voidedAt: '2026-09-12T20:05:00Z' }),
      ],
    );

    expect(totals).toMatchObject({ entries: 10, rebuys: 0 });
    expect(totals.avgStack).toBe(75000);
  });

  it('MONTHLY FREEROLL: with no charges the checked-in field is the entry count', () => {
    const totals = timerChipTotals(
      tournament(field(9, 3), { features: ['Начальный стек 30000 (300 бб)'] }),
      structure([level()]),
      [],
    );

    expect(totals).toMatchObject({ entries: 9, entriesFromSeats: true, seats: 9, active: 3 });
    expect(totals.avgStack).toBe(90000);
  });

  it('CHILL OUT: the late-registration break note sets the addon stack', () => {
    const totals = timerChipTotals(
      tournament(field(16, 7), {
        features: ['Начальный стек 30000 (300 бб)', 'Есть возможность взять аддон'],
      }),
      structure([level(), lateRegBreak('Аддон 20 000, вывод номинала 100')]),
      [...badges('buy-in', 16), ...badges('addon', 5)],
    );

    expect(totals.addonStack).toBe(20000);
    expect(totals.totalChips).toBe(30000 * 16 + 20000 * 5);
    expect(totals.avgStack).toBe(82857);
    expect(Number.isInteger(totals.avgStack)).toBe(true);
  });

  it('falls back to the card stack when the lobby text declares none', () => {
    const totals = timerChipTotals(
      tournament(field(8, 2), { stackSize: 25000 }),
      structure([level()]),
      badges('buy-in', 8),
    );

    expect(totals).toMatchObject({ startingStack: 25000, startingStackDeclared: false });
    expect(totals.avgStack).toBe(100000);
  });

  it('ignores an entry fee described without a currency sign', () => {
    const totals = timerChipTotals(
      tournament(field(6, 3), { features: ['Ребай 1000', 'Аддон 1000'] }),
      structure([level()]),
      [...badges('buy-in', 6), ...badges('rebuy', 1)],
    );

    expect(totals.rebuyStack).toBe(30000);
    expect(totals.addonStack).toBe(30000);
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
