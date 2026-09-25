import { describe, expect, it } from 'vitest';
import { DEFAULT_ENTRY_FEE, FREEZEOUT_ENTRY_FEE } from '../types/finance';
import { chargeAmountFor, isFreezeoutEvent } from './entryFee';

function event(
  title: string,
  blindStructure = '',
  blindStructureId?: string,
) {
  return { title, blindStructure, blindStructureId };
}

describe('isFreezeoutEvent', () => {
  it('detects freezeout from the title, structure name, or catalog id', () => {
    expect(isFreezeoutEvent(event('Freezeout'))).toBe(true);
    expect(isFreezeoutEvent(event('Friday freeze-out turbo'))).toBe(true);
    expect(isFreezeoutEvent(event('Фризаут'))).toBe(true);
    expect(isFreezeoutEvent(event('Фриззаут вечер'))).toBe(true);
    expect(isFreezeoutEvent(event('Chill', 'Freezeout'))).toBe(true);
    expect(isFreezeoutEvent(event('Friday', '', 'bs-freezeout'))).toBe(true);
  });

  it('does not treat other formats as freezeout', () => {
    expect(isFreezeoutEvent(event('Chill out'))).toBe(false);
    expect(isFreezeoutEvent(event('TEAM BATTLE', 'TEAM BATTLE'))).toBe(false);
    expect(isFreezeoutEvent(event('Bounty Hunter', 'Bounty Hunter', 'bs-bounty-hunter'))).toBe(false);
    expect(isFreezeoutEvent(null)).toBe(false);
  });
});

describe('chargeAmountFor', () => {
  it('keeps the default 1000 tariff and free tickets', () => {
    expect(chargeAmountFor('buy-in', event('Chill out'))).toBe(DEFAULT_ENTRY_FEE);
    expect(chargeAmountFor('rebuy', event('Phoenix'))).toBe(DEFAULT_ENTRY_FEE);
    expect(chargeAmountFor('ticket', event('Freezeout'))).toBe(0);
  });

  it('charges 1200 on freezeout paid entries', () => {
    expect(chargeAmountFor('buy-in', event('Freezeout'))).toBe(FREEZEOUT_ENTRY_FEE);
    expect(chargeAmountFor('rebuy', event('FREEROLL Freezeout'))).toBe(FREEZEOUT_ENTRY_FEE);
    expect(chargeAmountFor('addon', event('Night', 'Freezeout'))).toBe(FREEZEOUT_ENTRY_FEE);
  });
});
