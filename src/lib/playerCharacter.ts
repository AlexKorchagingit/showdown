import {
  DEFAULT_CHARACTER_ID,
  avatarUrlForChar,
  resolveImage,
  shopItemsOfType,
} from '../data/shopItems';
import { findClubUserByIdOrNick } from './clubDirectory';

const CHARACTERS = shopItemsOfType('character');

/** Resolve a player's equipped character id (own profile, club directory, or a stable fallback). */
export function equippedCharForPlayer(
  playerId: string,
  nickname: string,
  selfChar: string,
): string {
  if (playerId === 'me') return selfChar || DEFAULT_CHARACTER_ID;

  const user = findClubUserByIdOrNick(playerId, nickname);
  if (user?.equippedChar) return user.equippedChar;

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

export function avatarUrlForPlayer(
  playerId: string,
  nickname: string,
  selfChar: string,
): string {
  const user = findClubUserByIdOrNick(playerId, nickname);
  if (user?.equippedAvatar) return user.equippedAvatar;
  return avatarUrlForChar(equippedCharForPlayer(playerId, nickname, selfChar));
}
