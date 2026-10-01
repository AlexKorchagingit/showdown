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

export type FinanceWatch = 'off' | 'month' | 'all' | 'live';

/** Timer and a tournament cashier repeat the full book so every screen shares one average stack. */
export const FINANCE_LIVE_POLL_MS = 15_000;

export function financeWatchRepeats(mode: FinanceWatch): boolean {
  return mode === 'month' || mode === 'live';
}

export function financeWatchScope(mode: FinanceWatch): 'month' | 'all' {
  return mode === 'month' ? 'month' : 'all';
}

/**
 * Nothing downloads the ledger until a screen that shows it is open.
 * The finance overview repeats the current month plus debts.
 * The timer repeats the full book: a live event's buy-ins are not limited to this calendar month,
 * and a second screen must see the same plates.
 */
export function financeWatchMode(pathname: string): FinanceWatch {
  if (pathname === TIMER_ROUTE || pathname.startsWith('/admin/finance/tournaments/')) return 'live';
  if (pathname === '/admin/finance' || pathname.startsWith('/admin/finance/')) return 'month';
  if (pathname.startsWith('/admin/tournaments/')) return 'all';
  if (
    pathname === '/admin/statistic'
    || pathname === '/profile'
    || pathname.startsWith('/profile/')
  ) {
    return 'all';
  }
  return 'off';
}
