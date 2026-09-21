import { describe, expect, it } from 'vitest';
import {
  FREE_ITEM_IDS,
  SHOP_ITEMS,
  avatarUrlForChar,
  findShopItem,
  isIncludedFree,
} from './shopItems';

describe('DISCUS achievement character', () => {
  it('is in the shop catalogue but is not a free starter skin', () => {
    const karen = findShopItem('char_karen');
    expect(karen).toMatchObject({
      id: 'char_karen',
      type: 'character',
      name: 'DISCUS',
      price: 0,
      buyable: false,
    });
    expect(karen?.image).toContain('/characters/char_karen.png');
    expect(isIncludedFree(karen!)).toBe(false);
    expect(FREE_ITEM_IDS).toContain('char_base');
    expect(FREE_ITEM_IDS).not.toContain('char_karen');
    expect(SHOP_ITEMS.filter(isIncludedFree).every((item) => item.price === 0)).toBe(true);
  });

  it('uses the dedicated head-shot for lists and rating', () => {
    expect(avatarUrlForChar('char_karen')).toContain('/avatars/karen.png');
  });
});
