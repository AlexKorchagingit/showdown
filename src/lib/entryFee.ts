import { DEFAULT_ENTRY_FEE, FREEZEOUT_ENTRY_FEE, type TransactionType } from '../types/finance';
import type { Tournament } from '../types/tournament';

const FREEZEOUT_RE = /freeze[\s-]?out|фриз{1,2}[\s-]?аут/i;

/** Title, assigned structure name, or catalog id looks like Freezeout. */
export function isFreezeoutEvent(
  tournament:
    | Pick<Tournament, 'title' | 'blindStructure' | 'blindStructureId'>
    | null
    | undefined,
): boolean {
  if (!tournament) return false;
  return FREEZEOUT_RE.test(
    `${tournament.title} ${tournament.blindStructure ?? ''} ${tournament.blindStructureId ?? ''}`,
  );
}

/** Cash amount the server writes for a charge. Tickets stay free. */
export function chargeAmountFor(
  type: TransactionType,
  tournament:
    | Pick<Tournament, 'title' | 'blindStructure' | 'blindStructureId'>
    | null
    | undefined,
): number {
  if (type === 'ticket') return 0;
  return isFreezeoutEvent(tournament) ? FREEZEOUT_ENTRY_FEE : DEFAULT_ENTRY_FEE;
}

/** A cashier plate that counts as chips but not as money: legacy ticket, or a comped entry/rebuy/addon. */
export function isComplimentaryCharge(tx: {
  type: string;
  amount: number;
  status: string;
  voidedAt?: string | null;
}): boolean {
  if (tx.voidedAt) return false;
  if (tx.type === 'ticket') return true;
  return tx.status === 'paid'
    && tx.amount === 0
    && (tx.type === 'buy-in' || tx.type === 'rebuy' || tx.type === 'addon');
}
