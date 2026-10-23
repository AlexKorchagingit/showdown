import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';
import { isActiveTransaction } from './transactionVoid';
import { tournamentPlayerCounts } from './tournamentStats';

export type CashierSummary = {
  /** Cashier players still without a finishing place. */
  remaining: number;
  /** Everyone who is in the cashier field, out or not. */
  field: number;
  /** People with at least one rebuy badge. */
  rebuyPeople: number;
  /** All rebuy badges, so a repeated rebuy is still visible. */
  rebuyTotal: number;
  addonPeople: number;
  addonTotal: number;
  /** People with an unpaid charge in this tournament dated today (Moscow). */
  unpaidPeople: number;
};

function distinctPeople(rows: Transaction[]): number {
  return new Set(rows.map((row) => row.userId).filter(Boolean)).size;
}

/** Calendar day in Europe/Moscow, `YYYY-MM-DD`. */
export function moscowCalendarDate(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function onMoscowDay(iso: string, day: string): boolean {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return moscowCalendarDate(parsed) === day;
}

/**
 * Top line of the tournament cashier. «В игре» uses the same counts as the timer,
 * and rebuy/addon are counted per person from the cancelled-free ledger.
 */
export function cashierSummary(
  tournament: Tournament | undefined,
  transactions: Transaction[],
  today: string = moscowCalendarDate(),
): CashierSummary {
  const { remaining, registered } = tournamentPlayerCounts(tournament);
  if (!tournament) {
    return {
      remaining,
      field: registered,
      rebuyPeople: 0,
      rebuyTotal: 0,
      addonPeople: 0,
      addonTotal: 0,
      unpaidPeople: 0,
    };
  }
  const ledger = transactions.filter(
    (tx) => tx.tournamentId === tournament.id && isActiveTransaction(tx),
  );
  const rebuys = ledger.filter((tx) => tx.type === 'rebuy');
  const addons = ledger.filter((tx) => tx.type === 'addon');
  const unpaidToday = ledger.filter(
    (tx) => tx.status === 'unpaid' && onMoscowDay(tx.date, today),
  );
  return {
    remaining,
    field: registered,
    rebuyPeople: distinctPeople(rebuys),
    rebuyTotal: rebuys.length,
    addonPeople: distinctPeople(addons),
    addonTotal: addons.length,
    unpaidPeople: distinctPeople(unpaidToday),
  };
}
