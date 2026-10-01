import { TIMER_ROUTE } from './timerTournament';

/** Repeating cashier read. Slower than the old 15s poll on every tab. */
export const FINANCE_POLL_MS = 60_000;

/** Once the full book is loaded, a narrower month read must not replace it. */
export function effectiveFinanceScope(
  current: 'month' | 'all',
  requested?: 'month' | 'all',
): 'month' | 'all' {
  if (current === 'all' || requested === 'all') return 'all';
  return 'month';
}

export type FinanceWatch = 'off' | 'month' | 'all';

/**
 * Nothing downloads the ledger until a screen that shows it is open.
 * Cashier repeats the current month plus debts. History screens take the full book once.
 */
export function financeWatchMode(pathname: string): FinanceWatch {
  if (pathname === '/admin/finance' || pathname.startsWith('/admin/finance/')) return 'month';
  if (pathname === TIMER_ROUTE || pathname.startsWith('/admin/tournaments/')) return 'month';
  if (
    pathname === '/admin/statistic'
    || pathname === '/profile'
    || pathname.startsWith('/profile/')
  ) {
    return 'all';
  }
  return 'off';
}
