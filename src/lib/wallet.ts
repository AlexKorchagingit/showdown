import { supabase } from './supabase';
import { SHOP_ITEMS, type ShopItem } from '../data/shopItems';
import { createOperationRequests, type RequestPersistence } from './operationRequests';
import type { PendingNotification } from './userStorage';

export type CatalogItem = { id: string; type: 'character' | 'bg'; name: string; price: number; active: boolean; revision: number };
export type Wallet = {
  userId: string; revision: number; coins: number; ownedItems: string[];
  equippedChar: string; equippedBg: string; pendingNotifications: PendingNotification[]; catalog: CatalogItem[];
};
export type ShopIntent = { action: 'buy'; itemId: string; catalogRevision: number } | { action: 'equip'; itemId: string };
const ERROR = 'Сервер не подтвердил состояние кошелька. Обновите данные.';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function parseWallet(value: unknown, userId: string): Wallet {
  if (!record(value) || !userId || value.user_id !== userId || !integer(value.revision)
    || !integer(value.ruby_balance) || value.ruby_balance > 2147483647 || !strings(value.owned_items)
    || typeof value.equipped_char !== 'string' || typeof value.equipped_bg !== 'string'
    || !Array.isArray(value.pending_notifications) || !Array.isArray(value.catalog)) throw new Error(ERROR);
  const ids = new Set<string>();
  const pendingNotifications = value.pending_notifications.map((n): PendingNotification => {
    if (!record(n) || typeof n.id !== 'string' || !n.id || ids.has(n.id) || typeof n.message !== 'string'
      || !integer(n.amount) || n.amount < 1) throw new Error(ERROR);
    ids.add(n.id);
    return { id: n.id, message: n.message, amount: n.amount };
  });
  ids.clear();
  const catalog = value.catalog.map((c): CatalogItem => {
    if (!record(c) || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.name !== 'string'
      || (c.type !== 'bg' && c.type !== 'character') || !integer(c.price) || c.price > 2147483647
      || !integer(c.revision) || c.revision < 1 || typeof c.active !== 'boolean') throw new Error(ERROR);
    ids.add(c.id);
    return { id: c.id, name: c.name, type: c.type, price: c.price, revision: c.revision, active: c.active };
  });
  return { userId, revision: value.revision, coins: value.ruby_balance, ownedItems: value.owned_items,
    equippedChar: value.equipped_char, equippedBg: value.equipped_bg, pendingNotifications, catalog };
}

export async function fetchWallet(userId: string): Promise<Wallet> {
  const { data, error } = await supabase.rpc('club_wallet_snapshot');
  if (error) throw new Error('Не удалось загрузить кошелёк. Повторите загрузку перед операцией.');
  return parseWallet(data, userId);
}

export async function sendShopCommand(userId: string, input: ShopIntent & { requestId: string }): Promise<Wallet> {
  const args = { p_request_id: input.requestId, p_item_id: input.itemId };
  const { data, error } = input.action === 'buy'
    ? await supabase.rpc('club_buy_item', { ...args, p_catalog_revision: input.catalogRevision })
    : await supabase.rpc('club_equip_item', args);
  if (error?.code === 'PT402') throw new Error('Недостаточно рубинов. Обновите баланс.');
  if (error?.code === 'PT409') throw new Error('Цена или доступность товара изменились. Обновите магазин перед покупкой.');
  if (error) throw new Error('Не удалось подтвердить операцию магазина. Повторите ту же операцию или обновите данные.');
  if (!record(data) || data.request_id !== input.requestId) throw new Error(ERROR);
  return parseWallet(data.wallet, userId);
}

export async function claimRubyNotification(userId: string, notificationId: string): Promise<Wallet> {
  const { data, error } = await supabase.rpc('club_claim_ruby_notification', { p_notification_id: notificationId });
  if (error) throw new Error('Не удалось подтвердить получение бонуса. Повторите получение этого же бонуса или обновите данные.');
  if (!record(data) || data.notification_id !== notificationId) throw new Error(ERROR);
  return parseWallet(data.wallet, userId);
}

export function createShopRequests(userId: string, createId?: () => string, persistence?: RequestPersistence,
  send: (input: ShopIntent & { requestId: string }) => Promise<Wallet> = (input) => sendShopCommand(userId, input)) {
  return createOperationRequests<ShopIntent, Wallet>(send, (input) => input.action === 'buy'
    ? { action: 'buy', itemId: input.itemId, catalogRevision: input.catalogRevision }
    : { action: 'equip', itemId: input.itemId }, 'showdown.shop.v1', createId, persistence);
}

export function mergeWallet(previous: Wallet | null, incoming: Wallet): Wallet {
  if (!previous || previous.userId !== incoming.userId) return incoming;
  // Catalog revisions are independent of balance revisions. Never restore a stale price either.
  return { ...(previous.revision > incoming.revision ? previous : incoming),
    catalog: mergeCatalog(previous.catalog, incoming.catalog) };
}

function mergeCatalog(previous: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  const known = new Map(previous.map((item) => [item.id, item]));
  return incoming.map((item) => (known.get(item.id)?.revision ?? 0) > item.revision ? known.get(item.id)! : item);
}

/** Art stays in this build; prices and availability always come from the server. */
export function shopCatalogItems(wallet: Wallet): ShopItem[] {
  const catalog = new Map(wallet.catalog.map((entry) => [entry.id, entry]));
  return SHOP_ITEMS.flatMap((art) => {
    const entry = catalog.get(art.id);
    if (!entry || art.type !== entry.type || (!entry.active && !wallet.ownedItems.includes(entry.id))) return [];
    return [{ ...art, name: entry.name, price: entry.price }];
  });
}
