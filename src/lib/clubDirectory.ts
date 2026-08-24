import type { MappedUser } from './supabaseMap';

let directory: MappedUser[] = [];

export function setClubDirectory(users: MappedUser[]) {
  directory = users;
}

export function upsertClubDirectory(user: MappedUser) {
  const index = directory.findIndex((row) => row.id === user.id || row.email === user.email);
  if (index >= 0) directory[index] = user;
  else directory.push(user);
}

export function removeClubDirectory(userId: string) {
  if (!userId) return;
  directory = directory.filter((row) => row.id !== userId);
}

export function getClubDirectory(): MappedUser[] {
  return directory;
}

export function findClubUser(options: {
  id?: string | null;
  nickname?: string | null;
  email?: string | null;
}): MappedUser | undefined {
  const id = options.id?.trim();
  const email = options.email?.trim().toLowerCase();
  const nick = options.nickname?.trim().toLowerCase();
  return directory.find((user) => {
    if (id && (user.id === id || id === 'me')) return id !== 'me' || false;
    if (id && user.id === id) return true;
    if (email && user.email.toLowerCase() === email) return true;
    if (nick && user.nickname.toLowerCase() === nick) return true;
    return false;
  });
}

export function findClubUserByIdOrNick(id?: string | null, nickname?: string | null): MappedUser | undefined {
  const playerId = id?.trim();
  const nick = nickname?.trim().toLowerCase();
  if (playerId && playerId !== 'me') {
    const byId = directory.find((user) => user.id === playerId);
    if (byId) return byId;
  }
  if (nick) return directory.find((user) => user.nickname.toLowerCase() === nick);
  return undefined;
}
