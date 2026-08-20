import { ALL_PARTICIPANTS } from '../data/participants';
import { findClubUserByIdOrNick, getClubDirectory } from './clubDirectory';

export type SystemPlayer = {
  id: string;
  nickname: string;
  email?: string;
};

function fallbackEmail(nickname: string): string {
  const local = nickname.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.') || 'player';
  return `${local}@mail.ru`;
}

/** Resolve a roster/account email so cashier rows can tell players apart. */
export function playerEmail(id: string, nickname: string): string | undefined {
  const fromClub = findClubUserByIdOrNick(id, nickname);
  if (fromClub) return fromClub.email;
  if (nickname.trim()) return fallbackEmail(nickname);
  return undefined;
}

/** Club roster plus leftover catalog nicknames, unique by nickname. */
export function systemPlayerDirectory(): SystemPlayer[] {
  const directory: SystemPlayer[] = getClubDirectory().map((user) => ({
    id: user.id,
    nickname: user.nickname,
    email: user.email,
  }));
  const nicknames = new Set(directory.map((player) => player.nickname.toLowerCase()));
  const ids = new Set(directory.map((player) => player.id));

  for (const player of ALL_PARTICIPANTS) {
    if (nicknames.has(player.nickname.toLowerCase()) || ids.has(player.id)) continue;
    directory.push({
      id: player.id,
      nickname: player.nickname,
      email: playerEmail(player.id, player.nickname),
    });
    nicknames.add(player.nickname.toLowerCase());
    ids.add(player.id);
  }

  return directory;
}
