import { describe, expect, it } from 'vitest';
import {
  CARD_RANKS,
  CARD_SUITS,
  cardName,
  isCardCode,
  normalizeHandCards,
  normalizeHandOfDay,
  parseCard,
  rankLabel,
  toggleHandCard,
  visibleHand,
} from './pokerCards';

describe('poker cards', () => {
  it('knows all 52 cards and rejects anything else', () => {
    const all = CARD_RANKS.flatMap((rank) => CARD_SUITS.map((suit) => `${rank}${suit}`));
    expect(all).toHaveLength(52);
    expect(all.every(isCardCode)).toBe(true);
    for (const bad of ['', 'A', '1s', 'Ax', 'as', 'AsK', 10, null, undefined]) {
      expect(isCardCode(bad)).toBe(false);
    }
  });

  it('parses and names a card', () => {
    expect(parseCard('Td')).toEqual({ rank: 'T', suit: 'd' });
    expect(parseCard('Zz')).toBeNull();
    expect(rankLabel('T')).toBe('10');
    expect(rankLabel('K')).toBe('K');
    expect(cardName('As')).toBe('Туз пик');
    expect(cardName('Th')).toBe('10 червей');
  });

  it('keeps at most two distinct valid cards', () => {
    expect(normalizeHandCards(['As', 'As', 'Kh', 'Qd'])).toEqual(['As', 'Kh']);
    expect(normalizeHandCards(['As', 'bad', 7, 'Kh'])).toEqual(['As', 'Kh']);
    expect(normalizeHandCards('As')).toEqual([]);
  });

  it('reads a stored hand and treats a missing one as not set', () => {
    expect(normalizeHandOfDay(undefined)).toBeUndefined();
    expect(normalizeHandOfDay(null)).toBeUndefined();
    expect(normalizeHandOfDay({ on: true, cards: ['As', 'Ks'] })).toEqual({ on: true, cards: ['As', 'Ks'] });
    expect(normalizeHandOfDay({ on: 'yes', cards: ['As'] })).toEqual({ on: false, cards: ['As'] });
  });

  it('shows a hand only when it is on and complete', () => {
    expect(visibleHand(undefined)).toBeNull();
    expect(visibleHand({ on: false, cards: ['As', 'Ks'] })).toBeNull();
    expect(visibleHand({ on: true, cards: ['As'] })).toBeNull();
    expect(visibleHand({ on: true, cards: ['As', 'Ks'] })).toEqual(['As', 'Ks']);
  });

  it('toggles cards: add, remove, and replace the older of two', () => {
    expect(toggleHandCard([], 'As')).toEqual(['As']);
    expect(toggleHandCard(['As'], 'Kh')).toEqual(['As', 'Kh']);
    expect(toggleHandCard(['As', 'Kh'], 'As')).toEqual(['Kh']);
    expect(toggleHandCard(['As', 'Kh'], 'Qd')).toEqual(['Kh', 'Qd']);
  });
});
