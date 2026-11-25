import { describe, expect, it } from 'vitest';
import {
  chargeCountsAsRevenue,
  nightInFinancePeriod,
  revenueNight,
} from './tournamentRevenue';

describe('tournament night revenue', () => {
  const starts = new Map([['deep', '2026-11-24']]);

  it('keeps a payment after midnight on the evening the tournament started', () => {
    const night = revenueNight(
      {
        tournamentId: 'deep',
        date: '2026-11-24T16:10:00Z',
        updatedAt: '2026-11-24T22:30:00Z',
        status: 'paid',
      },
      starts,
    );
    expect(night?.getFullYear()).toBe(2026);
    expect(night?.getMonth()).toBe(10);
    expect(night?.getDate()).toBe(24);
    const duringNight = new Date(2026, 10, 25, 1, 30, 0);
    expect(nightInFinancePeriod(night!, 'today', duringNight)).toBe(true);
  });

  it('treats the next evening as a new night once the morning cutoff has passed', () => {
    const evening = new Date(2026, 10, 25, 19, 0, 0);
    const tonight = revenueNight(
      {
        tournamentId: 'deep',
        date: '2026-11-25T16:00:00Z',
        status: 'paid',
      },
      new Map([['deep', '2026-11-25']]),
    );
    expect(nightInFinancePeriod(tonight!, 'today', evening)).toBe(true);
    const yesterday = revenueNight(
      { tournamentId: 'deep', date: '2026-11-24T16:00:00Z', status: 'paid' },
      starts,
    );
    expect(nightInFinancePeriod(yesterday!, 'today', evening)).toBe(false);
  });

  it('does not count tickets or voided rows as revenue', () => {
    expect(chargeCountsAsRevenue({ type: 'buy-in', amount: 1000, status: 'paid' })).toBe(true);
    expect(chargeCountsAsRevenue({ type: 'ticket', amount: 1000, status: 'paid' })).toBe(false);
    expect(chargeCountsAsRevenue({ type: 'buy-in', amount: 1000, status: 'paid', voidedAt: 'x' })).toBe(false);
    expect(chargeCountsAsRevenue({ type: 'buy-in', amount: 1000, status: 'unpaid' })).toBe(false);
  });
});
