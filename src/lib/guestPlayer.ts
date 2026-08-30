import { avatarUrlForChar, DEFAULT_BG_ID, DEFAULT_CHARACTER_ID } from '../data/shopItems';
import type { Participant, Tournament } from '../types/tournament';
import { sanitizeParticipantUserId, unwrapParticipantSeatKey, type MappedUser } from './supabaseMap';

export const GUEST_ID_PREFIX = 'guest-';
/** Same cap as the profile nickname field. */
export const GUEST_NICKNAME_MAX = 17;
export const GUEST_NICKNAME_MIN = 2;

/** PK suffix / in-memory id for a seat (`opening:guest-ivan` → `guest-ivan`). */
export function guestSeatKey(playerId: string, tournamentId = ''): string {
  const trimmed = playerId.trim();
  if (!trimmed) return '';
  if (tournamentId) return unwrapParticipantSeatKey(tournamentId, trimmed);
  const colon = trimmed.lastIndexOf(':');
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}

export function isGuestParticipantId(id?: string | null): boolean {
  return new RegExp(`^${GUEST_ID_PREFIX}`, 'i').test(guestSeatKey(id ?? ''));
}

/** Seat is a nick-only placeholder, not a row in `users`. */
export function isUnboundGuestSeat(player: Pick<Participant, 'id' | 'userId'>): boolean {
  if (sanitizeParticipantUserId(player.userId ?? '')) return false;
  if (sanitizeParticipantUserId(player.id)) return false;
  return isGuestParticipantId(player.id);
}

export function slugGuestNickname(nickname: string): string {
  const slug = nickname
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^a-z0-9а-я]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'player';
}

export function guestParticipantId(nickname: string, takenIds: Iterable<string>): string {
  const taken = new Set([...takenIds].map((id) => guestSeatKey(id).toLowerCase()));
  const base = `${GUEST_ID_PREFIX}${slugGuestNickname(nickname)}`;
  let id = base;
  let suffix = 2;
  while (taken.has(id.toLowerCase())) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function normalizeGuestNickname(raw: string): string | null {
  const nickname = raw.trim().replace(/\s+/g, ' ');
  if (nickname.length < GUEST_NICKNAME_MIN || nickname.length > GUEST_NICKNAME_MAX) return null;
  return nickname;
}

export function mappedGuestUser(id: string, nickname: string): MappedUser {
  return {
    id,
    email: '',
    nickname,
    isAdmin: false,
    rubyBalance: 0,
    coins: 0,
    birthDate: '',
    slogan: '',
    ownedItems: [],
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
    equippedAvatar: avatarUrlForChar(DEFAULT_CHARACTER_ID),
    pendingNotifications: [],
  };
}

/** Nick-only seats, keyed by stable `guest-…` id so they share rating across events. */
export function guestUsersFromTournaments(tournaments: Tournament[]): MappedUser[] {
  const byId = new Map<string, MappedUser>();
  for (const tournament of tournaments) {
    for (const player of tournament.participants) {
      if (!isUnboundGuestSeat(player)) continue;
      const id = guestSeatKey(player.id, tournament.id);
      if (!id || byId.has(id)) continue;
      byId.set(id, mappedGuestUser(id, player.nickname));
    }
  }
  return [...byId.values()];
}
