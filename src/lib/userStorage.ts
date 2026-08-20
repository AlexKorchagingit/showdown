import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  FREE_ITEM_IDS,
} from '../data/shopItems';

export const SLOGAN_PLACEHOLDER = 'Ставлю вот такую стопку белых фишек';

export const STARTING_COINS = 1500;
const LEGACY_STARTING_COINS = 50000;
const SUPERADMIN_EMAIL = 'anaak-01@mail.ru';
const SHOP_WIPE_VERSION = 'shop-wipe-v1';

export interface PendingNotification {
  id: string;
  message: string;
  amount: number;
}

export interface UserData {
  nickname: string;
  birthDate: string;
  slogan: string;
  coins: number;
  ownedItems: string[];
  equippedChar: string;
  equippedBg: string;
  pendingNotifications: PendingNotification[];
  /** ISO timestamp of when registration policies were accepted. */
  agreementsAcceptedAt?: string;
}

/** Keys used before the record moved to `userData_<email>`. */
const PREVIOUS_KEY_PREFIX = 'profile_';
const LEGACY_SHARED_KEYS = {
  nickname: 'profile_nickname',
  birthDate: 'profile_birth_date',
  slogan: 'profile_slogan',
} as const;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function userDataKey(email: string): string {
  return `userData_${normalizeEmail(email)}`;
}

/** Storage throws in private browsing modes, where losing data beats crashing. */
function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function generateNickname(): string {
  return `Личность№${Math.floor(Math.random() * 10000)}`;
}

export function createDefaultUserData(): UserData {
  return {
    nickname: generateNickname(),
    birthDate: '',
    slogan: '',
    coins: STARTING_COINS,
    ownedItems: [...FREE_ITEM_IDS],
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
    pendingNotifications: [],
  };
}

function parseNotifications(raw: unknown): PendingNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<PendingNotification>;
    const amount = Number(row.amount);
    if (typeof row.id !== 'string' || typeof row.message !== 'string') return [];
    if (!Number.isFinite(amount) || amount === 0) return [];
    return [{ id: row.id, message: row.message, amount }];
  });
}

/** New accounts and old records stuck at 0 always start with the club grant. */
function resolveCoins(parsed: Partial<UserData>): number {
  if (!Number.isFinite(parsed.coins)) return STARTING_COINS;
  const value = Number(parsed.coins);
  if (value === 0) return STARTING_COINS;
  if (value === LEGACY_STARTING_COINS) return STARTING_COINS;
  return value;
}

function withDefaults(parsed: Partial<UserData>): UserData {
  const defaults = createDefaultUserData();
  return {
    nickname: parsed.nickname || defaults.nickname,
    birthDate: parsed.birthDate ?? '',
    slogan: parsed.slogan ?? '',
    coins: resolveCoins(parsed),
    ownedItems: [
      ...new Set([
        DEFAULT_CHARACTER_ID,
        DEFAULT_BG_ID,
        ...FREE_ITEM_IDS,
        ...(Array.isArray(parsed.ownedItems) ? parsed.ownedItems : []),
      ]),
    ],
    equippedChar: parsed.equippedChar || DEFAULT_CHARACTER_ID,
    equippedBg:
      !parsed.equippedBg || parsed.equippedBg === 'bg_1'
        ? DEFAULT_BG_ID
        : parsed.equippedBg,
    pendingNotifications: parseNotifications(parsed.pendingNotifications),
    agreementsAcceptedAt: parseIsoTimestamp(parsed.agreementsAcceptedAt),
  };
}

function parseIsoTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

function parseRecord(raw: string | null): Partial<UserData> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<UserData>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Profile fields that used to live in shared keys, before records were per account. */
function takeLegacySharedProfile(): Partial<UserData> {
  const nickname = readKey(LEGACY_SHARED_KEYS.nickname);
  const birthDate = readKey(LEGACY_SHARED_KEYS.birthDate);
  const slogan = readKey(LEGACY_SHARED_KEYS.slogan);

  if (nickname === null && birthDate === null && slogan === null) return {};

  Object.values(LEGACY_SHARED_KEYS).forEach(removeKey);

  return {
    ...(nickname ? { nickname } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(slogan ? { slogan } : {}),
  };
}

function shopWipeKey(email: string): string {
  return `shop_wipe_${normalizeEmail(email)}`;
}

/** One-shot: superadmin buys the catalogue from scratch again, starting at 1500. */
function maybeWipeSuperadminShop(email: string, data: UserData): UserData {
  if (normalizeEmail(email) !== SUPERADMIN_EMAIL) return data;
  if (readKey(shopWipeKey(email)) === SHOP_WIPE_VERSION) return data;
  writeKey(shopWipeKey(email), SHOP_WIPE_VERSION);
  return {
    ...data,
    coins: STARTING_COINS,
    ownedItems: [...FREE_ITEM_IDS],
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
  };
}

export function loadUserData(email: string): UserData {
  if (!email) return createDefaultUserData();

  const current = parseRecord(readKey(userDataKey(email)));
  if (current) {
    const restored = withDefaults(current);
    const wiped = maybeWipeSuperadminShop(email, restored);
    const rawCoins = current.coins;
    const owned = Array.isArray(current.ownedItems) ? current.ownedItems : [];
    const missingStarter =
      !owned.includes(DEFAULT_CHARACTER_ID) || !owned.includes(DEFAULT_BG_ID);
    const needsPersist =
      wiped !== restored ||
      missingStarter ||
      current.equippedBg === 'bg_1' ||
      !Number.isFinite(rawCoins) ||
      Number(rawCoins) === 0 ||
      Number(rawCoins) === LEGACY_STARTING_COINS;
    if (needsPersist) {
      saveUserData(email, wiped);
    }
    return wiped;
  }

  // Nothing under the current key: carry over an older record for this account
  const previous = parseRecord(readKey(`${PREVIOUS_KEY_PREFIX}${normalizeEmail(email)}`));
  const restored = maybeWipeSuperadminShop(
    email,
    withDefaults(previous ?? takeLegacySharedProfile()),
  );

  saveUserData(email, restored);
  removeKey(`${PREVIOUS_KEY_PREFIX}${normalizeEmail(email)}`);
  return restored;
}

export function saveUserData(email: string, data: UserData) {
  if (!email) return;
  writeKey(userDataKey(email), JSON.stringify(data));
}

const USER_DATA_PREFIX = 'userData_';

export function listStoredUsers(): Array<{ email: string; data: UserData }> {
  const rows: Array<{ email: string; data: UserData }> = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(USER_DATA_PREFIX)) continue;
      const email = key.slice(USER_DATA_PREFIX.length);
      if (!email) continue;
      rows.push({ email, data: loadUserData(email) });
    }
  } catch {
    /* storage unavailable */
  }
  return rows;
}

export function listUsersWithAgreements(): Array<{
  email: string;
  nickname: string;
  agreementsAcceptedAt: string;
}> {
  const byEmail = new Map<string, { email: string; nickname: string; agreementsAcceptedAt: string }>();
  for (const { email, data } of listStoredUsers()) {
    if (!data.agreementsAcceptedAt) continue;
    byEmail.set(email.trim().toLowerCase(), {
      email,
      nickname: data.nickname,
      agreementsAcceptedAt: data.agreementsAcceptedAt,
    });
  }
  return [...byEmail.values()].sort((a, b) =>
    b.agreementsAcceptedAt.localeCompare(a.agreementsAcceptedAt),
  );
}

/** Persist first-time policy consent and return whether this was a new signature. */
export function recordAgreementsAccepted(email: string, acceptedAt: string): UserData & { isNew: boolean } {
  const data = loadUserData(email);
  const iso = parseIsoTimestamp(acceptedAt) ?? new Date().toISOString();
  if (data.agreementsAcceptedAt) return { ...data, isNew: false };
  const next = { ...data, agreementsAcceptedAt: iso };
  saveUserData(email, next);
  return { ...next, isNew: true };
}
