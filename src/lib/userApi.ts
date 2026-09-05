import { getClubDirectory, setClubDirectory, upsertClubDirectory } from './clubDirectory';
import { supabase, logSupabaseError } from './supabase';
import { userFromRow, type MappedUser, type UserRow } from './supabaseMap';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function asUserRow(data: unknown): UserRow | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Partial<UserRow>;
  if (typeof row.id !== 'string' || typeof row.email !== 'string') return null;
  return row as UserRow;
}

export type UserLookupResult =
  | { status: 'found'; user: MappedUser }
  | { status: 'missing' }
  | { status: 'error'; message: string };

function lookupFromQuery(
  data: unknown,
  error: { message?: string } | null,
): UserLookupResult {
  if (error) {
    logSupabaseError(error, 'users lookup');
    return { status: 'error', message: error.message || 'Не удалось загрузить пользователя' };
  }
  if (!data) return { status: 'missing' };
  const row = asUserRow(data);
  if (!row) return { status: 'error', message: 'Некорректная запись пользователя' };
  return { status: 'found', user: userFromRow(row) };
}

export async function lookupUserById(userId: string): Promise<UserLookupResult> {
  if (!userId) return { status: 'missing' };
  const { data, error } = await supabase.rpc('club_directory');
  return lookupFromQuery(data?.find((row: UserRow) => row.id === userId), error);
}

export async function lookupUserByEmail(email: string): Promise<UserLookupResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { status: 'missing' };
  const { data, error } = await supabase.rpc('club_directory');
  return lookupFromQuery(data?.find((row: UserRow) => row.email?.trim().toLowerCase() === normalized), error);
}

/** Resolve the signed-in account. Network errors stay `error` so we do not log people out offline. */
export async function lookupSessionAccount(_userId?: string, _email?: string): Promise<UserLookupResult> {
  // Cache keys/arguments are never used to select the authenticated principal.
  const { data, error } = await supabase.rpc('club_current_account');
  return lookupFromQuery(data, error);
}

export async function fetchUserById(userId: string): Promise<MappedUser | null> {
  const result = await lookupUserById(userId);
  return result.status === 'found' ? result.user : null;
}

export async function fetchUserByEmail(email: string): Promise<MappedUser | null> {
  const result = await lookupUserByEmail(email);
  return result.status === 'found' ? result.user : null;
}

export async function fetchClubUsers(): Promise<MappedUser[]> {
  const { data, error } = await supabase.rpc('club_directory');
  if (error || !data) {
    logSupabaseError(error, 'club users');
    return [];
  }
  const users = data.flatMap((item: unknown) => {
    const row = asUserRow(item);
    return row ? [userFromRow(row)] : [];
  });
  setClubDirectory(users);
  return users;
}

export { loginOrRegisterUser } from './loginAccount';

export async function updateUserRow(
  userId: string,
  patch: Record<string, unknown>,
): Promise<MappedUser | null> {
  const allowed = new Set(['nickname', 'birth_date', 'slogan']);
  if (Object.keys(patch).length === 0 || Object.keys(patch).some((field) => !allowed.has(field))) {
    throw new Error('Это поле профиля изменяется только специальной серверной командой');
  }
  const { data, error } = await supabase.rpc('club_update_profile', { p_changes: patch });
  if (error || !data) {
    logSupabaseError(error, 'update user');
    throw new Error(error?.message || 'Не удалось сохранить профиль');
  }
  const row = asUserRow(data);
  if (!row || row.id !== userId) throw new Error('Сервер вернул другой профиль');
  const mapped = userFromRow(row);
  const authoritative = await fetchUserById(userId);
  if (authoritative) {
    upsertClubDirectory(authoritative);
    return authoritative;
  }
  upsertClubDirectory(mapped);
  return mapped;
}

export function mappedUserToPatch(changes: Partial<MappedUser>): Record<string, unknown> {
  const allowed = new Set(['nickname', 'birthDate', 'slogan']);
  if (Object.keys(changes).some((field) => !allowed.has(field))) {
    throw new Error('Защищённые поля профиля нельзя изменять обычным сохранением');
  }
  const patch: Record<string, unknown> = {};
  if (changes.nickname != null) patch.nickname = changes.nickname;
  if (changes.birthDate != null) patch.birth_date = changes.birthDate;
  if (changes.slogan != null) patch.slogan = changes.slogan;
  return patch;
}

export { getClubDirectory };
export type { MappedUser };
