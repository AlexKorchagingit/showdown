import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  FREE_ITEM_IDS,
} from '../data/shopItems';

export const SLOGAN_PLACEHOLDER = 'Ставлю вот такую стопку белых фишек';

export const STARTING_COINS = 5000;

export interface UserData {
  nickname: string;
  birthDate: string;
  slogan: string;
  coins: number;
  ownedItems: string[];
  equippedChar: string;
  equippedBg: string;
}

/** Legacy shared keys from before profiles were stored per account. */
const LEGACY_KEYS = {
  nickname: 'profile_nickname',
  birthDate: 'profile_birth_date',
  slogan: 'profile_slogan',
} as const;

function storageKey(email: string): string {
  return `profile_${email.trim().toLowerCase()}`;
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
function normalize(data: UserData): UserData {
  const ownedItems = [...new Set([...FREE_ITEM_IDS, ...data.ownedItems])];
  return { ...data, ownedItems };
}

function readLegacyProfile(): Partial<UserData> {
  const nickname = localStorage.getItem(LEGACY_KEYS.nickname);
  const birthDate = localStorage.getItem(LEGACY_KEYS.birthDate);
  const slogan = localStorage.getItem(LEGACY_KEYS.slogan);

  if (nickname === null && birthDate === null && slogan === null) return {};

  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key));

  return {
    ...(nickname ? { nickname } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(slogan ? { slogan } : {}),
  };
}

export function loadUserData(email: string): UserData {
  const defaults = createDefaultUserData();
  if (!email) return defaults;

  const raw = localStorage.getItem(storageKey(email));

  if (!raw) {
    const created = normalize({ ...defaults, ...readLegacyProfile() });
    saveUserData(email, created);
    return created;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserData>;
    return normalize({
      nickname: parsed.nickname || defaults.nickname,
      birthDate: parsed.birthDate ?? '',
      slogan: parsed.slogan ?? '',
      coins: Number.isFinite(parsed.coins) ? Number(parsed.coins) : defaults.coins,
      ownedItems: Array.isArray(parsed.ownedItems) ? parsed.ownedItems : defaults.ownedItems,
      equippedChar: parsed.equippedChar || defaults.equippedChar,
      equippedBg: parsed.equippedBg || defaults.equippedBg,
    });
  } catch {
    saveUserData(email, defaults);
    return defaults;
  }
}

export function saveUserData(email: string, data: UserData) {
  if (!email) return;
  localStorage.setItem(storageKey(email), JSON.stringify(data));
}
