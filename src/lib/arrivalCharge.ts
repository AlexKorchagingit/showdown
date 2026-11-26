import { isFreerollEvent } from './eventFormat';
import { ledgerChargeId } from './guestPlayer';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

/**
 * The single entry plate created when someone is marked arrived.
 * It can be cancelled when that person leaves, as long as nothing else
 * (a rebuy, an addon, a paid entry) is still on their account.
 */
export function loneArrivalCharge(
  transactions: readonly Transaction[],
  tournament: Pick<Tournament, 'id' | 'eventFormat' | 'isBounty' | 'title' | 'blindStructure'>,
  userId: string | null | undefined,
): Transaction | undefined {
  const uid = ledgerChargeId(userId ?? '');
  if (!uid) return undefined;
  const rows = transactions.filter(
    (tx) => tx.tournamentId === tournament.id && tx.userId === uid && !tx.voidedAt,
  );
  const freeroll = isFreerollEvent(tournament);
  const arrivalRows = rows.filter((tx) =>
    freeroll ? tx.type === 'ticket' : tx.type === 'buy-in' && tx.status === 'unpaid',
  );
  const kept = rows.some((tx) => !arrivalRows.includes(tx));
  if (arrivalRows.length === 1 && !kept) return arrivalRows[0];
  return undefined;
}
