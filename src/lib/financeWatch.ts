import { TIMER_ROUTE } from './timerTournament';

/** Repeating cashier read. Slower than the old 15s poll on every tab. */
export const FINANCE_POLL_MS = 60_000;

export type FinanceWatch = 'poll' | 'once' | 'off';

/**
 * The full ledger is heavy. Repeat it only while a cashier screen is open.
 * Screens that show those plates take one fresh copy when opened.
 */
export function financeWatchMode(pathname: string): FinanceWatch {
  if (pathname === '/admin/finance' || pathname.startsWith('/admin/finance/')) return 'poll';
  if (
    pathname === TIMER_ROUTE
    || pathname === '/admin/statistic'
    || pathname.startsWith('/admin/tournaments/')
    || pathname === '/profile'
    || pathname.startsWith('/profile/')
  ) {
    return 'once';
  }
  return 'off';
}
