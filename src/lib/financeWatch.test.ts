import { describe, expect, it } from 'vitest';
import { financeWatchMode } from './financeWatch';

describe('financeWatchMode', () => {
  it('keeps the cashier on the current month until all-time is asked', () => {
    expect(financeWatchMode('/admin/finance')).toBe('month');
    expect(financeWatchMode('/admin/finance/tournaments/t-1')).toBe('month');
  });

  it('loads the live field when the timer or lobby editor opens', () => {
    expect(financeWatchMode('/admin/blinds/timer')).toBe('month');
    expect(financeWatchMode('/admin/tournaments/t-1')).toBe('month');
  });

  it('loads the whole book only for history screens', () => {
    expect(financeWatchMode('/admin/statistic')).toBe('all');
    expect(financeWatchMode('/profile')).toBe('all');
    expect(financeWatchMode('/profile/user-1')).toBe('all');
  });

  it('does not download on the rest of the app', () => {
    expect(financeWatchMode('/')).toBe('off');
    expect(financeWatchMode('/admin/tournaments')).toBe('off');
    expect(financeWatchMode('/tournaments/t-1')).toBe('off');
  });
});
