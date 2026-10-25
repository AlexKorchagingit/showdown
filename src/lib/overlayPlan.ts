import { calculatePayouts, itmPlaceCount } from '../data/prizeStructure';
import { isActiveTransaction } from './transactionVoid';
import { cashierPlayers } from './tournamentArrival';
import { isTeamBattleEvent } from './teamBattle';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

export type OverlayNight = {
  label: string;
  people: number;
  rebuys: number;
  addons: number;
};

export type SeriesAverages = {
  key: string;
  label: string;
  nights: number;
  people: number;
  rebuys: number;
  addons: number;
};

/** Recurring series. One-off titles stay on their own so they do not inherit Chill out's crowd. */
export function overlaySeriesKey(title: string): string {
  const name = title.toUpperCase();
  if (name.includes('TEAM')) return 'team';
  if (name.includes('CHILL')) return 'chill';
  if (name.includes('PHOENIX')) return 'phoenix';
  if (name.includes('FREEZE')) return 'freezeout';
  if (name.includes('DEEP')) return 'deepstack';
  if (name.includes('BOUNTY') || name.includes('MYSTERY')) return 'bounty';
  if (name.includes('TRIPLE')) return 'triple';
  if (name.includes('FREEROLL')) return 'freeroll';
  return `title:${name.trim()}`;
}

export function overlaySeriesLabel(key: string, fallbackTitle: string): string {
  const labels: Record<string, string> = {
    chill: 'Chill out',
    phoenix: 'Phoenix',
    freezeout: 'Freezeout',
    deepstack: 'Deepstack',
    bounty: 'Bounty',
    triple: 'Triple Life',
    freeroll: 'Freeroll',
    team: 'Командный',
  };
  return labels[key] ?? fallbackTitle;
}

function fieldSize(tournament: Tournament): number {
  if (tournament.participants.length > 0) return cashierPlayers(tournament.participants).length;
  return Math.max(0, tournament.arrivedCount ?? 0);
}

function entryCounts(tournamentId: string, transactions: readonly Transaction[]): { rebuys: number; addons: number } {
  let rebuys = 0;
  let addons = 0;
  for (const tx of transactions) {
    if (tx.tournamentId !== tournamentId || !isActiveTransaction(tx)) continue;
    if (tx.type === 'rebuy') rebuys += 1;
    if (tx.type === 'addon') addons += 1;
  }
  return { rebuys, addons };
}

/** The overlay form starts here, and a night with no saved rate uses the same number. */
export const DEFAULT_OVERLAY_PER_HEAD = 100;

/** Open prize nights. Closed results and team battles keep the guarantee already stored. */
export function overlayIsLive(tournament: Tournament): boolean {
  return !(
    tournament.isClosed ||
    tournament.resultsEntered ||
    tournament.rubiesDistributed ||
    isTeamBattleEvent(tournament)
  );
}

/**
 * This night's saved rate, otherwise the latest saved rate of the same series,
 * otherwise the form default. The base stays this night's own guarantee.
 */
export function overlayRate(
  tournament: Tournament,
  tournaments: readonly Tournament[],
): { base: number; perHead: number } {
  const base = tournament.overlayBase ?? tournament.guarantee;
  if (typeof tournament.overlayPerHead === 'number') {
    return { base, perHead: tournament.overlayPerHead };
  }
  const key = overlaySeriesKey(tournament.title);
  const inherited = tournaments
    .filter((row) => row.id !== tournament.id && overlaySeriesKey(row.title) === key && typeof row.overlayPerHead === 'number')
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))[0]?.overlayPerHead;
  return { base, perHead: inherited ?? DEFAULT_OVERLAY_PER_HEAD };
}

/** Average field and the overlay rate for this series. */
export function lobbyOverlayFigures(
  tournament: Tournament,
  tournaments: readonly Tournament[],
): { people: number; perHead: number } | null {
  const stats = seriesAverages(tournament, tournaments, []);
  const people = stats.nights > 0 ? Math.round(stats.people) : 0;
  if (people <= 0) return null;
  return { people, perHead: overlayRate(tournament, tournaments).perHead };
}

/** Closed nights of the same series. The selected open event is not part of the average. */
export function seriesAverages(
  tournament: Tournament,
  tournaments: readonly Tournament[],
  transactions: readonly Transaction[],
): SeriesAverages {
  const key = overlaySeriesKey(tournament.title);
  const nights = tournaments.filter(
    (row) => row.isClosed && overlaySeriesKey(row.title) === key && fieldSize(row) > 0,
  );
  const totals = nights.reduce(
    (sum, row) => {
      const entries = entryCounts(row.id, transactions);
      return {
        people: sum.people + fieldSize(row),
        rebuys: sum.rebuys + entries.rebuys,
        addons: sum.addons + entries.addons,
      };
    },
    { people: 0, rebuys: 0, addons: 0 },
  );
  const count = nights.length;
  return {
    key,
    label: overlaySeriesLabel(key, tournament.title),
    nights: count,
    people: count ? totals.people / count : 0,
    rebuys: count ? totals.rebuys / count : 0,
    addons: count ? totals.addons / count : 0,
  };
}

export function busiestNight(
  tournament: Tournament,
  tournaments: readonly Tournament[],
  transactions: readonly Transaction[],
): OverlayNight | null {
  const key = overlaySeriesKey(tournament.title);
  const nights = tournaments.filter(
    (row) => row.isClosed && overlaySeriesKey(row.title) === key && fieldSize(row) > 0,
  );
  const busiest = nights.reduce<Tournament | null>((best, row) => {
    if (!best || fieldSize(row) > fieldSize(best)) return row;
    return best;
  }, null);
  if (!busiest) return null;
  const entries = entryCounts(busiest.id, transactions);
  return {
    label: `Самый полный, ${busiest.startDate.slice(8, 10)}.${busiest.startDate.slice(5, 7)}`,
    people: fieldSize(busiest),
    rebuys: entries.rebuys,
    addons: entries.addons,
  };
}

/**
 * Base is the ordinary night. People above the series average add a full overlay.
 * Every rebuy adds half, every addon a quarter, including on an ordinary night.
 */
export function overlayGuarantee(input: {
  base: number;
  perHead: number;
  normPeople: number;
  people: number;
  rebuys: number;
  addons: number;
}): number {
  const base = Math.max(0, Math.round(Number(input.base) || 0));
  const perHead = Math.max(0, Math.round(Number(input.perHead) || 0));
  const extraPeople = Math.max(0, Math.round(input.people) - Math.round(input.normPeople));
  const rebuys = Math.max(0, Math.round(input.rebuys));
  const addons = Math.max(0, Math.round(input.addons));
  return base + extraPeople * perHead + rebuys * Math.round(perHead / 2) + addons * Math.round(perHead / 4);
}

export type OverlayPreview = {
  perHead: number;
  people: number;
  itm: number;
  guarantee: number;
  first: number;
};

/**
 * Prize pool on the timer and at close.
 * A saved overlay grows the base from the live cashier field.
 * Closed nights keep the guarantee they were paid with.
 * Team battles keep their own split.
 */
export function livePrizePool(
  tournament: Tournament,
  tournaments: readonly Tournament[],
  transactions: readonly Transaction[],
): number {
  const stored = Math.max(0, Math.round(Number(tournament.guarantee) || 0));
  if (!overlayIsLive(tournament)) return stored;
  const stats = seriesAverages(tournament, tournaments, transactions);
  const entries = entryCounts(tournament.id, transactions);
  const rate = overlayRate(tournament, tournaments);
  return overlayGuarantee({
    base: rate.base,
    perHead: rate.perHead,
    normPeople: stats.nights > 0 ? Math.round(stats.people) : 17,
    people: fieldSize(tournament),
    rebuys: entries.rebuys,
    addons: entries.addons,
  });
}

export function overlayPreview(input: {
  base: number;
  perHead: number;
  normPeople: number;
  people: number;
  rebuys: number;
  addons: number;
}): OverlayPreview {
  const people = Math.max(0, Math.round(input.people));
  const guarantee = overlayGuarantee({ ...input, people });
  const itm = itmPlaceCount(people);
  const first = calculatePayouts(people, guarantee)[0]?.points ?? 0;
  return { perHead: Math.max(0, Math.round(Number(input.perHead) || 0)), people, itm, guarantee, first };
}

export const OVERLAY_SAMPLES = [0, 80, 100, 120, 150, 250] as const;

export function overlaySampleHeads(current: number): number[] {
  const heads = new Set<number>(OVERLAY_SAMPLES);
  const typed = Math.max(0, Math.round(current) || 0);
  heads.add(typed);
  return [...heads].sort((a, b) => a - b);
}
