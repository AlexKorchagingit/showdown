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
export const DEFAULT_BG_ID = 'bg_base';
export const DEFAULT_CHARACTER_LEFT = '18%';

/** Profile portrait offset — some arts sit too far left in the frame. */
export const CHARACTER_PROFILE_LEFT: Record<string, string> = {
  char_cowboy: '26%',
  char_fortune: '26%',
  char_knight: '22%',
  char_jester: '26%',
  char_mage: '30%',
  char_villain: '26%',
  char_baron: '22%',
  char_duchess: '26%',
};

export function characterProfileLeft(id: string): string {
  return CHARACTER_PROFILE_LEFT[id] ?? DEFAULT_CHARACTER_LEFT;
}

const CHARACTERS: ShopItem[] = [
  { id: 'char_base',    type: 'character', name: 'Базовый',   image: asset('/characters/char_base.png'),    price: 0 },
  { id: 'char_jester',  type: 'character', name: 'Шут',       image: asset('/characters/char_jester.png'),  price: 3000 },
  { id: 'char_cowboy',  type: 'character', name: 'Ковбой',    image: asset('/characters/char_cowboy.png'),  price: 3000 },
  { id: 'char_knight',  type: 'character', name: 'Рыцарь',    image: asset('/characters/char_knight.png'),  price: 3000 },
  { id: 'char_fortune', type: 'character', name: 'Гадалка',   image: asset('/characters/char_fortune.png'), price: 6000 },
  { id: 'char_mage',    type: 'character', name: 'Маг',       image: asset('/characters/char_mage.png'),    price: 6000 },
  { id: 'char_villain', type: 'character', name: 'Злодей',    image: asset('/characters/char_villain.png'), price: 12000 },
  { id: 'char_duchess', type: 'character', name: 'Герцогиня', image: asset('/characters/char_duchess.png'), price: 12000 },
  { id: 'char_baron',   type: 'character', name: 'Барон',     image: asset('/characters/char_baron.png'),   price: 12000 },
  { id: 'char_king',    type: 'character', name: 'Король',    image: asset('/characters/char_king.png'),    price: 25000 },
];

/** Paid arts only — `bg_1.jpg` is a duplicate of the free base background. */
const PAID_BACKGROUND_FILES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const BACKGROUNDS: ShopItem[] = [
  { id: DEFAULT_BG_ID, type: 'bg', name: 'Базовый фон', image: asset('/backgrounds/bg_base.jpg'), price: 0 },
  ...PAID_BACKGROUND_FILES.map((n, index) => ({
    id: `bg_${n}`,
    type: 'bg' as const,
    name: `Фон ${index + 1}`,
    image: asset(`/backgrounds/bg_${n}.jpg`),
    price: 1500,
  })),
];

export const SHOP_ITEMS: ShopItem[] = [...CHARACTERS, ...BACKGROUNDS];

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
