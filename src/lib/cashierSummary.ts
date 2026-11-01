import type { Transaction } from '../types/finance';
import type { Participant, Tournament } from '../types/tournament';
import { cashierPlayers } from './tournamentArrival';
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
  /** Cashier players who still owe an entry, rebuy or addon in this tournament. */
  unpaidPeople: number;
};

function distinctPeople(rows: Transaction[]): number {
  return new Set(rows.map((row) => row.userId).filter(Boolean)).size;
}

function chargeIds(players: Participant[]): Set<string> {
  const ids = new Set<string>();
  for (const player of players) {
    if (player.id) ids.add(player.id);
    if (player.userId) ids.add(player.userId);
  }
  return ids;
}

/**
 * Top line of the tournament cashier. «В игре» uses the same counts as the timer,
 * and rebuy/addon are counted per person from the cancelled-free ledger.
 */
export function cashierSummary(
  tournament: Tournament | undefined,
  transactions: Transaction[],
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
  const cashierIds = chargeIds(cashierPlayers(tournament.participants));
  const unpaid = ledger.filter((tx) => tx.status === 'unpaid' && cashierIds.has(tx.userId));
  return {
    remaining,
    field: registered,
    rebuyPeople: distinctPeople(rebuys),
    rebuyTotal: rebuys.length,
    addonPeople: distinctPeople(addons),
    addonTotal: addons.length,
    unpaidPeople: distinctPeople(unpaid),
  };
}
