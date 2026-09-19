import { breakComment, isBreakLevel, type BlindStructure } from '../data/blindStructures';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { isActiveTransaction } from './transactionVoid';
import { cashierPlayers, cashierStillPlaying } from './tournamentArrival';

const ADDON_WORD = 'адд?он[а-яё]*|add[-\\s]?on';
/** Re-entry and rebuy are the same cashier badge in this club. */
const REBUY_WORD = 'ре-?ба[а-яё]*|re[-\\s]?buy|р[еэ]-?энтри|re[-\\s]?entry';
const START_WORD = '(?:начальн|стартов)[а-яё]*\\s+стек[а-яё]*|starting[-\\s]stack';
/** Only spaces and punctuation may sit between the word and its amount. */
const GAP = '[\\s:—–\\-=(]*';
/** «30 000 за аддон» keeps the amount in front of the word behind a preposition. */
const GAP_BEFORE = `${GAP}(?:за|на|for)?${GAP}`;
/** The lookahead forbids stopping mid-number, so «1 000» never reads as «100». */
const AMOUNT =
  '(\\d[\\d\\s\\u00a0\\u202f]*)(?![\\d]|[\\s\\u00a0\\u202f]*\\d)(к|k|тыс[а-яё.]*)?';
/** «Ребай — 1 000 ₽» is a price, not a stack. */
const NOT_MONEY = '(?!\\s*(?:₽|руб|р\\.))';
/** A stack is written in chips, so «300 бб» is a blind count, not a stack. */
const MIN_DECLARED_STACK = 1000;

function toChips(digits: string, thousands: string | undefined): number | null {
  const base = Number(digits.replace(/[\s\u00a0\u202f]/g, ''));
  if (!Number.isFinite(base) || base <= 0) return null;
  const value = thousands ? base * 1000 : base;
  return value >= 1 ? Math.round(value) : null;
}

/** «Аддон 20 000», «аддон: 20к», «30 000 за аддон» → chips, or null. */
export function chipAmountNear(text: string, word: string): number | null {
  const source = (text ?? '').replace(/\u00a0/g, ' ');
  if (!source.trim()) return null;
  const after = new RegExp(`(?:${word})${GAP}${AMOUNT}${NOT_MONEY}`, 'i').exec(source);
  if (after) {
    const chips = toChips(after[1], after[2]);
    if (chips !== null) return chips;
  }
  const before = new RegExp(`${AMOUNT}${GAP_BEFORE}(?:${word})`, 'i').exec(source);
  if (before) return toChips(before[1], before[2]);
  return null;
}

const WORD_MULTIPLIERS: [RegExp, number][] = [
  [/^(?:двойн|два|double)/i, 2],
  [/^(?:тройн|три|triple)/i, 3],
  [/^(?:четверн|четыре)/i, 4],
];
const MULTIPLIER_TOKEN =
  '(двойн[а-яё]*|тройн[а-яё]*|четверн[а-яё]*|два|три|четыре|double|triple|\\d{1,2})';
/** «двойной стартовый стек», «3 стартовых стека», «2 стека». */
const MULTIPLIER_PHRASES = [
  new RegExp(`${MULTIPLIER_TOKEN}\\s+(?:[а-яё]+\\s+)?(?:начальн|стартов)[а-яё]*\\s+стек`, 'i'),
  new RegExp(`${MULTIPLIER_TOKEN}\\s+стек[а-яё]*`, 'i'),
];

/**
 * «за двойной стартовый стек», «ребай — 3 стартовых стека» → how many starting
 * stacks the badge is worth. Only sentences about that badge are read.
 */
export function stackMultiplierNear(text: string, word: string): number | null {
  const source = (text ?? '').replace(/\u00a0/g, ' ');
  if (!new RegExp(`(?:${word})`, 'i').test(source)) return null;
  for (const phrase of MULTIPLIER_PHRASES) {
    const token = phrase.exec(source)?.[1];
    if (!token) continue;
    if (/^\d{1,2}$/.test(token)) {
      const count = Number(token);
      if (count >= 2 && count <= 10) return count;
      continue;
    }
    const named = WORD_MULTIPLIERS.find(([pattern]) => pattern.test(token));
    if (named) return named[1];
  }
  return null;
}

/**
 * «Ограничение по ре-энтри в 1 шт.» → one badge per player. «Без ограничений»
 * and silence both mean an unlimited count.
 */
export function rebuyLimitFrom(text: string): number | null {
  const source = (text ?? '').replace(/\u00a0/g, ' ');
  if (!new RegExp(`(?:${REBUY_WORD})`, 'i').test(source)) return null;
  if (/без\s+ограничен/i.test(source)) return null;
  if (/без\s+(?:возможности|прав[а-яё]*)/i.test(source)) return 0;
  if (/одиночн[а-яё]*|один[а-яё]*\s+(?:ре-?ба[а-яё]*|р[еэ]-?энтри)/i.test(source)) return 1;
  const limited = /(?:ограничен[а-яё]*|не\s+более|максимум|лимит)[^\d]{0,24}(\d{1,2})/i.exec(source);
  if (limited) return Number(limited[1]);
  const badges = /(\d{1,2})\s*(?:шт|раз)/i.exec(source);
  return badges ? Number(badges[1]) : null;
}

/**
 * Break notes on the ladder are the operative document, so they win over the
 * tournament blurb. The late-registration break is checked first: that is where
 * the club writes the addon stack.
 */
function chipSources(
  structure: BlindStructure | undefined,
  tournament: Tournament | undefined,
): string[] {
  const breaks = (structure?.levels ?? []).filter(isBreakLevel);
  const lateReg = breaks.filter((level) => level.isLateRegEnd === true);
  const others = breaks.filter((level) => level.isLateRegEnd !== true);
  return [
    ...lateReg.map(breakComment),
    ...others.map(breakComment),
    ...(tournament?.features ?? []),
    tournament?.about ?? '',
  ].filter((text) => text.trim().length > 0);
}

/**
 * A stack far below the starting one is almost certainly the entry fee written
 * without a currency sign, so it is ignored in favour of the starting stack.
 */
function declaredStack(sources: string[], word: string, startingStack: number): number | null {
  const floor = startingStack * 0.2;
  for (const text of sources) {
    const chips = chipAmountNear(text, word);
    if (chips !== null && chips >= floor) return chips;
  }
  return null;
}

/** «ОСОБЕННОСТИ — Начальный стек 50 000 (500 бб)» is the operative stack. */
export function declaredStartingStack(tournament: Tournament | undefined): number | null {
  for (const text of [...(tournament?.features ?? []), tournament?.about ?? '']) {
    // «Ре-энтри за тройной стартовый стек» describes a rebuy, not the start.
    if (new RegExp(`(?:${REBUY_WORD}|${ADDON_WORD})`, 'i').test(text)) continue;
    const chips = chipAmountNear(text, START_WORD);
    if (chips !== null && chips >= MIN_DECLARED_STACK) return chips;
  }
  return null;
}

function stackMultiplier(sources: string[], word: string): number | null {
  for (const text of sources) {
    const multiplier = stackMultiplierNear(text, word);
    if (multiplier !== null) return multiplier;
  }
  return null;
}

function rebuyLimit(tournament: Tournament | undefined): number | null {
  for (const text of [...(tournament?.features ?? []), tournament?.about ?? '']) {
    const limit = rebuyLimitFrom(text);
    if (limit !== null) return limit;
  }
  return null;
}

/** Rebuy badges beyond the tournament limit cannot have put chips on the table. */
function countWithinLimit(rows: Transaction[], limit: number | null): number {
  if (limit === null) return rows.length;
  if (limit <= 0) return 0;
  const perPlayer = new Map<string, number>();
  let counted = 0;
  for (const row of rows) {
    const used = perPlayer.get(row.userId) ?? 0;
    if (used >= limit) continue;
    perPlayer.set(row.userId, used + 1);
    counted += 1;
  }
  return counted;
}

export type TimerChipTotals = {
  /** Entry badges in the cashier: «Вход» and «Билет». */
  entries: number;
  /** True when the cashier has no entry badges and checked-in seats were used. */
  entriesFromSeats: boolean;
  /** Checked-in seats, including the players already out. */
  seats: number;
  /** Seats without a finishing place. */
  active: number;
  rebuys: number;
  /** Rebuy badges dropped because the tournament allows fewer per player. */
  rebuysBeyondLimit: number;
  /** Rebuys allowed per player, or null when unlimited. */
  rebuyLimit: number | null;
  addons: number;
  startingStack: number;
  /** True when the starting stack came from the lobby text, not the card field. */
  startingStackDeclared: boolean;
  rebuyStack: number;
  /** Set when the rebuy stack is «тройной стартовый стек» and similar. */
  rebuyStackMultiplier: number | null;
  addonStack: number;
  totalChips: number;
  avgStack: number;
};

const EMPTY_TOTALS: TimerChipTotals = {
  entries: 0,
  entriesFromSeats: false,
  seats: 0,
  active: 0,
  rebuys: 0,
  rebuysBeyondLimit: 0,
  rebuyLimit: null,
  addons: 0,
  startingStack: 0,
  startingStackDeclared: false,
  rebuyStack: 0,
  rebuyStackMultiplier: null,
  addonStack: 0,
  totalChips: 0,
  avgStack: 0,
};

/**
 * Chips in play come from the cashier badges: a starting stack per entry plus
 * the stack behind every rebuy and addon. The average is spread over the players
 * who are still in the game and is always a whole number of chips.
 */
export function timerChipTotals(
  tournament: Tournament | undefined,
  structure: BlindStructure | undefined,
  transactions: Transaction[],
): TimerChipTotals {
  if (!tournament) return EMPTY_TOTALS;

  const ledger = transactions.filter(
    (tx) => tx.tournamentId === tournament.id && isActiveTransaction(tx),
  );
  const entryBadges = ledger.filter((tx) => tx.type === 'buy-in' || tx.type === 'ticket');
  const rebuyBadges = ledger.filter((tx) => tx.type === 'rebuy');
  const addons = ledger.filter((tx) => tx.type === 'addon').length;

  const seats = cashierPlayers(tournament.participants).length;
  const active = cashierStillPlaying(tournament.participants).length;
  // A freeroll charges nobody, so the checked-in field is the only entry count.
  const entriesFromSeats = entryBadges.length === 0;
  const entries = entriesFromSeats ? seats : entryBadges.length;

  const limit = rebuyLimit(tournament);
  const rebuys = countWithinLimit(rebuyBadges, limit);

  const declaredStarting = declaredStartingStack(tournament);
  const startingStack = Math.max(0, declaredStarting ?? tournament.stackSize);
  const sources = chipSources(structure, tournament);
  const declaredRebuy = declaredStack(sources, REBUY_WORD, startingStack);
  const rebuyMultiplier = declaredRebuy === null ? stackMultiplier(sources, REBUY_WORD) : null;
  const rebuyStack = declaredRebuy ?? startingStack * (rebuyMultiplier ?? 1);
  const addonStack = declaredStack(sources, ADDON_WORD, startingStack) ?? startingStack;

  const totalChips = startingStack * entries + rebuyStack * rebuys + addonStack * addons;

  return {
    entries,
    entriesFromSeats: entriesFromSeats && seats > 0,
    seats,
    active,
    rebuys,
    rebuysBeyondLimit: rebuyBadges.length - rebuys,
    rebuyLimit: limit,
    addons,
    startingStack,
    startingStackDeclared: declaredStarting !== null,
    rebuyStack,
    rebuyStackMultiplier: rebuyMultiplier,
    addonStack,
    totalChips,
    avgStack: active > 0 ? Math.round(totalChips / active) : 0,
  };
}
