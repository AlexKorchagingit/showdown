import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { isActiveTransaction } from './transactionVoid';
import { cashierPlayers, cashierStillPlaying } from './tournamentArrival';

/** Only spaces and punctuation may sit between the word and its amount. */
const GAP = '[\\s:—–\\-=(]*';
/** The lookahead forbids stopping mid-number, so «1 000» never reads as «100». */
const AMOUNT =
  '(\\d[\\d\\s\\u00a0\\u202f]*)(?![\\d]|[\\s\\u00a0\\u202f]*\\d)(к|k|тыс[а-яё.]*)?';
/** «Ребай — 1 000 ₽» is a price, not a stack. */
const NOT_MONEY = '(?!\\s*(?:₽|руб|р\\.))';

/**
 * «ОСОБЕННОСТИ — Начальный стек 50 000 (500 бб)». The qualified wording is read
 * first so a bare «стек» somewhere in the blurb cannot win over it.
 */
/** `\w` skips Cyrillic, so word endings need their own class. */
const TAIL = '[а-яёa-z]*';
const STACK_WORDS = [
  `(?:начальн|стартов|глубок)${TAIL}\\s+ст[еэ]к${TAIL}`,
  `ст[еэ]к${TAIL}`,
];

/** Below this a number is big blinds or a price, not a stack of chips. */
const MIN_STARTING_STACK = 500;

function toChips(digits: string, thousands: string | undefined): number | null {
  const base = Number(digits.replace(/[\s\u00a0\u202f]/g, ''));
  if (!Number.isFinite(base) || base <= 0) return null;
  const value = thousands ? base * 1000 : base;
  return value >= 1 ? Math.round(value) : null;
}

/** «Начальный стек 50 000 (500 бб)» → 50000. The bracketed big blinds are ignored. */
export function chipAmountNear(text: string, word: string): number | null {
  const source = (text ?? '').replace(/\u00a0/g, ' ');
  if (!source.trim()) return null;
  const match = new RegExp(`(?:${word})${GAP}${AMOUNT}${NOT_MONEY}`, 'i').exec(source);
  return match ? toChips(match[1], match[2]) : null;
}

/**
 * The stack a player actually receives is the one announced in the lobby, so the
 * tournament features win over the `stackSize` field, which no screen edits.
 */
export function declaredStartingStack(tournament: Tournament | undefined): number | null {
  if (!tournament) return null;
  const sources = [...tournament.features, tournament.about];
  for (const words of STACK_WORDS) {
    for (const text of sources) {
      const chips = chipAmountNear(text, words);
      if (chips !== null && chips >= MIN_STARTING_STACK) return chips;
    }
  }
  return null;
}

export type TimerChipTotals = {
  /** «Вход» and «Билет» chips in the tournament cashier — a ticket is an entry. */
  entries: number;
  /** «Ребай» chips. */
  rebuys: number;
  /** «Аддон» chips. */
  addons: number;
  /** Cashier seats without a finishing place. */
  active: number;
  startingStack: number;
  /** Starting stack for every entry in the cashier. */
  totalChips: number;
  /** Whole chips: totalChips spread over the players still in the game. */
  avgStack: number;
  /** True when the cashier has no entry charges and seats were counted instead. */
  entriesFromSeats: boolean;
  /** True when the lobby announced the starting stack. */
  startingStackDeclared: boolean;
};

const EMPTY_TOTALS: TimerChipTotals = {
  entries: 0,
  rebuys: 0,
  addons: 0,
  active: 0,
  startingStack: 0,
  totalChips: 0,
  avgStack: 0,
  entriesFromSeats: true,
  startingStackDeclared: false,
};

/**
 * Everything the timer shows comes from the cashier: entries and rebuys are
 * counted from its chips, and the average stack is the announced starting stack
 * times the entries, spread over the players who are still in the game.
 * Cancelled charges are not counted.
 */
export function timerChipTotals(
  tournament: Tournament | undefined,
  transactions: Transaction[],
): TimerChipTotals {
  if (!tournament) return EMPTY_TOTALS;

  const ledger = transactions.filter(
    (tx) => tx.tournamentId === tournament.id && isActiveTransaction(tx),
  );
  const ticketEntries = ledger.filter((tx) => tx.type === 'buy-in' || tx.type === 'ticket').length;
  const seats = cashierPlayers(tournament.participants).length;
  // A tournament whose charges are not entered yet still has a field to show.
  const entries = ticketEntries > 0 ? ticketEntries : seats;

  const declared = declaredStartingStack(tournament);
  const startingStack = Math.max(0, declared ?? tournament.stackSize);
  const active = cashierStillPlaying(tournament.participants).length;
  const totalChips = startingStack * entries;

  return {
    entries,
    rebuys: ledger.filter((tx) => tx.type === 'rebuy').length,
    addons: ledger.filter((tx) => tx.type === 'addon').length,
    active,
    startingStack,
    totalChips,
    avgStack: active > 0 ? Math.round(totalChips / active) : 0,
    entriesFromSeats: ticketEntries === 0,
    startingStackDeclared: declared !== null,
  };
}
