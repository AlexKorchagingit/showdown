import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  FREE_ITEM_IDS,
} from '../data/shopItems';

export const SLOGAN_PLACEHOLDER = 'Ставлю вот такую стопку белых фишек';

export const STARTING_COINS = 30000;

export interface UserData {
  nickname: string;
  birthDate: string;
  slogan: string;
  coins: number;
  ownedItems: string[];
  equippedChar: string;
  equippedBg: string;
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

function generateNickname(): string {
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
  };
}

/** Free items must stay owned even if an older record predates them. */
function withDefaults(parsed: Partial<UserData>): UserData {
  const defaults = createDefaultUserData();
  return {
    nickname: parsed.nickname || defaults.nickname,
    birthDate: parsed.birthDate ?? '',
    slogan: parsed.slogan ?? '',
    coins: Number.isFinite(parsed.coins) ? Number(parsed.coins) : defaults.coins,
    ownedItems: [
      ...new Set([
        ...FREE_ITEM_IDS,
        ...(Array.isArray(parsed.ownedItems) ? parsed.ownedItems : []),
      ]),
    ],
    equippedChar: parsed.equippedChar || defaults.equippedChar,
    equippedBg: parsed.equippedBg || defaults.equippedBg,
  };
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

export function loadUserData(email: string): UserData {
  if (!email) return createDefaultUserData();

  const current = parseRecord(readKey(userDataKey(email)));
  if (current) return withDefaults(current);

  // Nothing under the current key: carry over an older record for this account
  const previous = parseRecord(readKey(`${PREVIOUS_KEY_PREFIX}${normalizeEmail(email)}`));
  const restored = withDefaults(previous ?? takeLegacySharedProfile());

  saveUserData(email, restored);
  removeKey(`${PREVIOUS_KEY_PREFIX}${normalizeEmail(email)}`);
  return restored;
}

export function saveUserData(email: string, data: UserData) {
  if (!email) return;
  writeKey(userDataKey(email), JSON.stringify(data));
}
