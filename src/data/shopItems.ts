import { asset } from '../lib/assets';

export type ShopItemType = 'character' | 'bg';

export interface ShopItem {
  id: string;
  type: ShopItemType;
  name: string;
  image: string;
  price: number;
}

export const DEFAULT_CHARACTER_ID = 'char_base';
export const DEFAULT_BG_ID = 'bg_1';

export const SHOP_ITEMS: ShopItem[] = [
  { id: DEFAULT_CHARACTER_ID, type: 'character', name: 'Базовый',   image: asset('/characters/char_base.png'),    price: 0 },
  { id: 'char_baron',         type: 'character', name: 'Барон',     image: asset('/characters/char_baron.png'),   price: 1000 },
  { id: 'char_cowboy',        type: 'character', name: 'Ковбой',    image: asset('/characters/char_cowboy.png'),  price: 1200 },
  { id: 'char_fortune',       type: 'character', name: 'Гадалка',   image: asset('/characters/char_fortune.png'), price: 1500 },
  { id: 'char_knight',        type: 'character', name: 'Рыцарь',    image: asset('/characters/char_knight.png'),  price: 1800 },
  { id: 'char_jester',        type: 'character', name: 'Шут',       image: asset('/characters/char_jester.png'),  price: 2000 },
  { id: 'char_mage',          type: 'character', name: 'Маг',       image: asset('/characters/char_mage.png'),    price: 2200 },
  { id: 'char_duchess',       type: 'character', name: 'Герцогиня', image: asset('/characters/char_duchess.png'), price: 2500 },
  { id: 'char_villain',       type: 'character', name: 'Злодей',    image: asset('/characters/char_villain.png'), price: 3000 },
  { id: 'char_king',          type: 'character', name: 'Король',    image: asset('/characters/char_king.png'),    price: 4000 },
  { id: 'bg_1',               type: 'bg',        name: 'Фон 1',     image: asset('/backgrounds/bg_1.png'),        price: 0 },
  { id: 'bg_2',               type: 'bg',        name: 'Фон 2',     image: asset('/backgrounds/bg_2.png'),        price: 1200 },
  { id: 'bg_3',               type: 'bg',        name: 'Фон 3',     image: asset('/backgrounds/bg_3.png'),        price: 1500 },
  { id: 'bg_4',               type: 'bg',        name: 'Фон 4',     image: asset('/backgrounds/bg_4.png'),        price: 1800 },
  { id: 'bg_5',               type: 'bg',        name: 'Фон 5',     image: asset('/backgrounds/bg_5.png'),        price: 2000 },
  { id: 'bg_6',               type: 'bg',        name: 'Фон 6',     image: asset('/backgrounds/bg_6.png'),        price: 2200 },
  { id: 'bg_7',               type: 'bg',        name: 'Фон 7',     image: asset('/backgrounds/bg_7.png'),        price: 2500 },
  { id: 'bg_8',               type: 'bg',        name: 'Фон 8',     image: asset('/backgrounds/bg_8.png'),        price: 2800 },
  { id: 'bg_9',               type: 'bg',        name: 'Фон 9',     image: asset('/backgrounds/bg_9.png'),        price: 3000 },
  { id: 'bg_10',              type: 'bg',        name: 'Фон 10',    image: asset('/backgrounds/bg_10.png'),       price: 3200 },
  { id: 'bg_11',              type: 'bg',        name: 'Фон 11',    image: asset('/backgrounds/bg_11.png'),       price: 3500 },
];

/** Free items are owned from the very first launch. */
export const FREE_ITEM_IDS = SHOP_ITEMS.filter((item) => item.price === 0).map((item) => item.id);

export function findShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}

export function shopItemsOfType(type: ShopItemType): ShopItem[] {
  return SHOP_ITEMS.filter((item) => item.type === type);
}

/** Falls back to the free item when a saved id no longer exists in the catalogue. */
export function resolveImage(id: string, type: ShopItemType): string {
  const item = findShopItem(id);
  if (item?.type === type) return item.image;
  const fallbackId = type === 'character' ? DEFAULT_CHARACTER_ID : DEFAULT_BG_ID;
  return findShopItem(fallbackId)!.image;
}
