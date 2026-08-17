import { mockUsers } from '../data/mockUsers';
import { ALL_PARTICIPANTS } from '../data/participants';

export type SystemPlayer = {
  id: string;
  nickname: string;
  email?: string;
};

/** Club roster plus admin-panel accounts, unique by nickname. */
export function systemPlayerDirectory(): SystemPlayer[] {
  const directory: SystemPlayer[] = ALL_PARTICIPANTS.map((player) => ({
    id: player.id,
    nickname: player.nickname,
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
