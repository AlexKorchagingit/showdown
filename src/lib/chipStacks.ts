import { breakComment, isBreakLevel, type BlindStructure } from '../data/blindStructures';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { cashierPlayers, cashierStillPlaying } from './tournamentArrival';

const ADDON_WORD = 'адд?он\\w*|add[-\\s]?on';
const REBUY_WORD = 'ре-?ба[йя]\\w*|re[-\\s]?buy';
/** Only spaces and punctuation may sit between the word and its amount. */
const GAP = '[\\s:—–\\-=(]*';
/** «30 000 за аддон» keeps the amount in front of the word behind a preposition. */
const GAP_BEFORE = `${GAP}(?:за|на|for)?${GAP}`;
const AMOUNT = '(\\d[\\d\\s\\u00a0\\u202f]*)(к|k|тыс[а-яё.]*)?';

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
  const after = new RegExp(`(?:${word})${GAP}${AMOUNT}`, 'i').exec(source);
  if (after) {
    const chips = toChips(after[1], after[2]);
    if (chips !== null) return chips;
  }
  const before = new RegExp(`${AMOUNT}${GAP_BEFORE}(?:${word})`, 'i').exec(source);
  if (before) return toChips(before[1], before[2]);
  return null;
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

function firstChipAmount(sources: string[], word: string): number | null {
  for (const text of sources) {
    const chips = chipAmountNear(text, word);
    if (chips !== null) return chips;
  }
  return null;
}

export type TimerChipTotals = {
  /** Checked-in seats (cashier field). */
  entries: number;
  /** Seats without a finishing place. */
  active: number;
  rebuys: number;
  addons: number;
  startingStack: number;
  rebuyStack: number;
  addonStack: number;
  totalChips: number;
  avgStack: number;
  /** True when the rebuy/addon stack had to fall back to the starting stack. */
  usesStartingStackFallback: boolean;
};

const EMPTY_TOTALS: TimerChipTotals = {
  entries: 0,
  active: 0,
  rebuys: 0,
  addons: 0,
  startingStack: 0,
  rebuyStack: 0,
  addonStack: 0,
  totalChips: 0,
  avgStack: 0,
  usesStartingStackFallback: true,
};

/**
 * Chips in play from the cashier ledger: starting stacks for every entry plus a
 * stack for each rebuy and addon. The average is spread over the players who
 * are still in the game.
 */
export function timerChipTotals(
  tournament: Tournament | undefined,
  structure: BlindStructure | undefined,
  transactions: Transaction[],
): TimerChipTotals {
  if (!tournament) return EMPTY_TOTALS;

  const ledger = transactions.filter((tx) => tx.tournamentId === tournament.id);
  const rebuys = ledger.filter((tx) => tx.type === 'rebuy').length;
  const addons = ledger.filter((tx) => tx.type === 'addon').length;

  const startingStack = Math.max(0, tournament.stackSize);
  const sources = chipSources(structure, tournament);
  const declaredRebuy = firstChipAmount(sources, REBUY_WORD);
  const declaredAddon = firstChipAmount(sources, ADDON_WORD);
  const rebuyStack = declaredRebuy ?? startingStack;
  const addonStack = declaredAddon ?? startingStack;

  const entries = cashierPlayers(tournament.participants).length;
  const active = cashierStillPlaying(tournament.participants).length;
  const totalChips = startingStack * entries + rebuyStack * rebuys + addonStack * addons;

  return {
    entries,
    active,
    rebuys,
    addons,
    startingStack,
    rebuyStack,
    addonStack,
    totalChips,
    avgStack: active > 0 ? Math.round(totalChips / active) : 0,
    usesStartingStackFallback: declaredRebuy === null && declaredAddon === null,
  };
}
