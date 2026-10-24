import { calculatePayouts, itmPlaceCount } from '../data/prizeStructure';
import { isActiveTransaction } from './transactionVoid';
import { cashierPlayers } from './tournamentArrival';
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
