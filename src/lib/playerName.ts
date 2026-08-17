import { ALL_PARTICIPANTS } from '../data/participants';
import { mockUsers } from '../data/mockUsers';
import { MOCK_PLAYERS_GENERAL, MOCK_PLAYERS_SEASONAL, type RatingPlayer } from '../types/player';

/** Best-effort nickname lookup for finance rows and public profiles. */
export function playerNickname(userId: string): string {
  const fromPool = ALL_PARTICIPANTS.find((p) => p.id === userId);
  if (fromPool) return fromPool.nickname;

  const fromUsers = mockUsers.find((u) => u.id === userId);
  if (fromUsers) return fromUsers.nickname;

  const fromGeneral = MOCK_PLAYERS_GENERAL.find((p) => p.id === userId);
  if (fromGeneral) return fromGeneral.nickname;

  for (const list of Object.values(MOCK_PLAYERS_SEASONAL)) {
    const hit = list.find((p) => p.id === userId);
    if (hit) return hit.nickname;
  }

  return userId;
}

/** Club nickname for an admin email, falling back to the local part of the address. */
export function adminDisplayName(email: string): string {
  return adminAccount(email).nickname;
}

export function adminAccount(email: string): { id: string; nickname: string; email: string } {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { id: 'admin', nickname: 'Админ', email: '' };
  const fromUsers = mockUsers.find((user) => user.email.trim().toLowerCase() === normalized);
  if (fromUsers) return { id: fromUsers.id, nickname: fromUsers.nickname, email: fromUsers.email };
  const local = normalized.split('@')[0]?.trim();
  return { id: normalized, nickname: local || email, email };
}

export interface PublicProfileStats {
  nickname: string;
  ratingPlace?: number;
  points?: number;
  played?: number;
  won?: number;
  knockouts?: number;
  finals?: number;
  headsUp?: number;
  top3?: number;
}

function rankedGeneral(): RatingPlayer[] {
  return [...MOCK_PLAYERS_GENERAL].sort((a, b) => b.points - a.points);
}

/** 1-based place in the general rating, then by club pool rating. */
export function ratingPlaceForId(playerId: string): number | undefined {
  const generalIdx = rankedGeneral().findIndex((p) => p.id === playerId);
  if (generalIdx >= 0) return generalIdx + 1;

  const pool = [...ALL_PARTICIPANTS].sort((a, b) => b.rating - a.rating);
  const poolIdx = pool.findIndex((p) => p.id === playerId);
  return poolIdx >= 0 ? poolIdx + 1 : undefined;
}

function deriveFinals(played?: number, won?: number): number | undefined {
  if (played == null && won == null) return undefined;
  return Math.max(won ?? 0, Math.round((played ?? 0) * 0.4));
}

function deriveHeadsUp(won?: number): number | undefined {
  if (won == null) return undefined;
  return Math.max(0, Math.round(won * 0.6));
}

function deriveTop3(played?: number, won?: number): number | undefined {
  if (played == null && won == null) return undefined;
  return Math.max(won ?? 0, Math.round((played ?? 0) * 0.25));
}

export function resolvePublicProfile(
  playerId: string,
  state?: Partial<PublicProfileStats> | null,
): PublicProfileStats {
  const fromPool = ALL_PARTICIPANTS.find((p) => p.id === playerId);
  const fromGeneral = MOCK_PLAYERS_GENERAL.find((p) => p.id === playerId);
  const played = state?.played ?? fromGeneral?.played;
  const won = state?.won ?? fromGeneral?.won;

  return {
    nickname: state?.nickname || fromGeneral?.nickname || fromPool?.nickname || playerNickname(playerId),
    ratingPlace: state?.ratingPlace ?? ratingPlaceForId(playerId),
    points: state?.points ?? fromGeneral?.points ?? fromPool?.rating,
    played,
    won,
    knockouts: state?.knockouts ?? fromGeneral?.knockouts,
    finals: state?.finals ?? deriveFinals(played, won),
    headsUp: state?.headsUp ?? deriveHeadsUp(won),
    top3: state?.top3 ?? deriveTop3(played, won),
  };
}
