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

/** Deletion must be redesigned as a reviewed atomic server operation. */
export async function deleteUserRow(_userId: string): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  return { ok: false, code: 'deletion_disabled',
    message: 'Удаление профилей отключено на время переноса прав, чтобы сохранить финансовую историю.' };
}

export async function updateUserRow(
  userId: string,
  patch: Record<string, unknown>,
): Promise<MappedUser | null> {
  if (['owned_items','equipped_char','equipped_bg','equipped_avatar'].some((field) => field in patch)) {
    throw new Error('Инвентарь и внешний вид изменяются только серверной командой магазина');
  }
  const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select('*').single();
  if (error || !data) {
    logSupabaseError(error, 'update user');
    return null;
  }
  const row = asUserRow(data);
  if (!row) return null;
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
  if (['ownedItems','equippedChar','equippedBg','equippedAvatar'].some((field) => field in changes)) {
    throw new Error('Инвентарь и внешний вид изменяются только серверной командой магазина');
  }
  const patch: Record<string, unknown> = {};
  if (changes.nickname != null) patch.nickname = changes.nickname;
  if (changes.birthDate != null) patch.birth_date = changes.birthDate;
  if (changes.slogan != null) patch.slogan = changes.slogan;
  if (changes.coins != null) patch.ruby_balance = Math.max(0, Math.trunc(changes.coins));
  if (changes.rubyBalance != null) patch.ruby_balance = Math.max(0, Math.trunc(changes.rubyBalance));
  if (changes.pendingNotifications != null) patch.pending_notifications = changes.pendingNotifications;
  if (changes.agreementsAcceptedAt != null) patch.agreements_accepted_at = changes.agreementsAcceptedAt;
  return patch;
}

export { getClubDirectory };
export type { MappedUser };
