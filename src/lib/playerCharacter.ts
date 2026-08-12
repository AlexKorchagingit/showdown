import { mockUsers } from '../data/mockUsers';
import {
  DEFAULT_CHARACTER_ID,
  resolveImage,
  shopItemsOfType,
} from '../data/shopItems';
import { loadUserData } from './userStorage';

const CHARACTERS = shopItemsOfType('character');

/** Resolve a player's equipped character id (own profile, stored mock user, or a stable fallback). */
export function equippedCharForPlayer(
  playerId: string,
  nickname: string,
  selfChar: string,
): string {
  if (playerId === 'me') return selfChar || DEFAULT_CHARACTER_ID;

  const user = mockUsers.find((u) => u.id === playerId || u.nickname === nickname);
  if (user) {
    const saved = loadUserData(user.email).equippedChar;
    if (saved) return saved;
  }

  if (CHARACTERS.length === 0) return DEFAULT_CHARACTER_ID;
  const hash = [...`${playerId}:${nickname}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CHARACTERS[hash % CHARACTERS.length]?.id ?? DEFAULT_CHARACTER_ID;
}

export function characterImageForPlayer(
  playerId: string,
  nickname: string,
  selfChar: string,
): string {
  return resolveImage(equippedCharForPlayer(playerId, nickname, selfChar), 'character');
}
