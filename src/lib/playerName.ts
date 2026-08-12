import { ALL_PARTICIPANTS } from '../data/participants';
import { mockUsers } from '../data/mockUsers';
import { MOCK_PLAYERS_GENERAL, MOCK_PLAYERS_SEASONAL } from '../types/player';

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

export interface PublicProfileStats {
  nickname: string;
  points?: number;
  played?: number;
  won?: number;
  knockouts?: number;
}

export function resolvePublicProfile(
  playerId: string,
  state?: Partial<PublicProfileStats> | null,
): PublicProfileStats {
  const fromPool = ALL_PARTICIPANTS.find((p) => p.id === playerId);
  const fromGeneral = MOCK_PLAYERS_GENERAL.find((p) => p.id === playerId);

  return {
    nickname: state?.nickname || fromGeneral?.nickname || fromPool?.nickname || playerNickname(playerId),
    points: state?.points ?? fromGeneral?.points ?? fromPool?.rating,
    played: state?.played ?? fromGeneral?.played,
    won: state?.won ?? fromGeneral?.won,
    knockouts: state?.knockouts ?? fromGeneral?.knockouts,
  };
}
