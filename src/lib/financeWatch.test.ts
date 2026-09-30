import { describe, expect, it } from 'vitest';
import { financeWatchMode } from './financeWatch';

describe('financeWatchMode', () => {
  it('repeats the ledger only on cashier screens', () => {
    expect(financeWatchMode('/admin/finance')).toBe('poll');
    expect(financeWatchMode('/admin/finance/tournaments/t-1')).toBe('poll');
  });

  it('refreshes once on screens that show the loaded plates', () => {
    expect(financeWatchMode('/admin/blinds/timer')).toBe('once');
    expect(financeWatchMode('/admin/statistic')).toBe('once');
    expect(financeWatchMode('/admin/tournaments/t-1')).toBe('once');
    expect(financeWatchMode('/profile')).toBe('once');
    expect(financeWatchMode('/profile/user-1')).toBe('once');
  });

  it('does not keep downloading on the rest of the app', () => {
    expect(financeWatchMode('/')).toBe('off');
    expect(financeWatchMode('/admin/tournaments')).toBe('off');
    expect(financeWatchMode('/admin/blinds/settings')).toBe('off');
    expect(financeWatchMode('/tournaments/t-1')).toBe('off');
  });
});
