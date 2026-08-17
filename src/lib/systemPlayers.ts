import { mockUsers } from '../data/mockUsers';
import { ALL_PARTICIPANTS } from '../data/participants';

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
  const nick = nickname.trim().toLowerCase();
  const byNick = mockUsers.find((user) => user.nickname.toLowerCase() === nick);
  if (byNick) return byNick.email;
  const byId = mockUsers.find((user) => user.id === id || `user-${user.id}` === id);
  if (byId) return byId.email;
  if (nickname.trim()) return fallbackEmail(nickname);
  return undefined;
}

/** Club roster plus admin-panel accounts, unique by nickname. */
export function systemPlayerDirectory(): SystemPlayer[] {
  const directory: SystemPlayer[] = ALL_PARTICIPANTS.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    email: playerEmail(player.id, player.nickname),
  }));
  const nicknames = new Set(directory.map((player) => player.nickname.toLowerCase()));
  const ids = new Set(directory.map((player) => player.id));

  for (const user of mockUsers) {
    if (nicknames.has(user.nickname.toLowerCase())) continue;
    const id = ids.has(user.id) ? `user-${user.id}` : user.id;
    directory.push({ id, nickname: user.nickname, email: user.email });
    nicknames.add(user.nickname.toLowerCase());
    ids.add(id);
  }

  return directory;
}
