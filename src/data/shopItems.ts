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
export const DEFAULT_BG_ID = 'bg_mountains';

export const SHOP_ITEMS: ShopItem[] = [
  { id: DEFAULT_CHARACTER_ID, type: 'character', name: 'Базовый',    image: asset('/char_base.png'),     price: 0 },
  { id: 'char_baron',         type: 'character', name: 'Барон',      image: asset('/char_baron.png'),    price: 1000 },
  { id: 'char_jester',        type: 'character', name: 'Шут',        image: asset('/char_jester.png'),   price: 2000 },
  { id: 'char_duchess',       type: 'character', name: 'Герцогиня',  image: asset('/char_duchess.png'),  price: 2500 },
  { id: DEFAULT_BG_ID,        type: 'bg',        name: 'Горы',       image: asset('/fon1_mountine.png'), price: 0 },
  { id: 'bg_bridge',          type: 'bg',        name: 'Мост',       image: asset('/bg_bridge.png'),     price: 1500 },
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
