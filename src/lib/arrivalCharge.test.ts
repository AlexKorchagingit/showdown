import { describe, expect, it } from 'vitest';
import { loneArrivalCharge } from './arrivalCharge';
import type { Transaction } from '../types/finance';
import type { Tournament } from '../types/tournament';

function tx(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: 'entry',
    date: '2026-11-25T03:20:00Z',
    tournamentId: 'night',
    userId: 'alex',
    type: 'buy-in',
    amount: 1200,
    status: 'unpaid',
    comment: '',
    isDealer: false,
    dealerHours: 0,
    ...patch,
  };
}

const night = { id: 'night', title: 'FREEZEOUT', blindStructure: '', isBounty: false } as Tournament;

describe('lone arrival charge', () => {
  it('returns the unpaid entry of a player who is leaving', () => {
    expect(loneArrivalCharge([tx()], night, 'alex')?.id).toBe('entry');
  });

  it('keeps a paid entry and an entry that already has a rebuy', () => {
    expect(loneArrivalCharge([tx({ status: 'paid' })], night, 'alex')).toBeUndefined();
    expect(
      loneArrivalCharge([tx(), tx({ id: 'rebuy', type: 'rebuy' })], night, 'alex'),
    ).toBeUndefined();
  });

  it('cancels a freeroll ticket and ignores a cancelled row', () => {
    const ticket = tx({ type: 'ticket', status: 'paid', amount: 0, comment: 'Фриролл' });
    expect(loneArrivalCharge([ticket], { ...night, eventFormat: 'freeroll' }, 'alex')?.id).toBe('entry');
    expect(loneArrivalCharge([tx({ voidedAt: '2026-11-25T04:00:00Z' })], night, 'alex')).toBeUndefined();
  });
});
