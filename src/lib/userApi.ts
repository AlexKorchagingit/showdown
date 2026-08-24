import { isSuperAdmin } from './admin';
import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  FREE_ITEM_IDS,
  avatarUrlForChar,
} from '../data/shopItems';
import { getClubDirectory, removeClubDirectory, setClubDirectory, upsertClubDirectory } from './clubDirectory';
import { writeSession } from './session';
import { supabase } from './supabase';
import { userFromRow, userToRow, type MappedUser, type UserRow } from './supabaseMap';
import { STARTING_COINS, generateNickname } from './userStorage';

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
  if (error) return { status: 'error', message: error.message || 'Не удалось загрузить пользователя' };
  if (!data) return { status: 'missing' };
  const row = asUserRow(data);
  if (!row) return { status: 'error', message: 'Некорректная запись пользователя' };
  return { status: 'found', user: userFromRow(row) };
}

export async function lookupUserById(userId: string): Promise<UserLookupResult> {
  if (!userId) return { status: 'missing' };
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  return lookupFromQuery(data, error);
}

export async function lookupUserByEmail(email: string): Promise<UserLookupResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { status: 'missing' };
  const { data, error } = await supabase.from('users').select('*').eq('email', normalized).maybeSingle();
  return lookupFromQuery(data, error);
}

/** Resolve the signed-in account. Network errors stay `error` so we do not log people out offline. */
export async function lookupSessionAccount(userId: string, email: string): Promise<UserLookupResult> {
  if (userId) {
    const byId = await lookupUserById(userId);
    if (byId.status === 'found' || byId.status === 'error') return byId;
  }
  if (email) return lookupUserByEmail(email);
  return { status: 'missing' };
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
  const { data, error } = await supabase.from('users').select('*').order('nickname', { ascending: true });
  if (error || !data) return [];
  const users = data.flatMap((item) => {
    const row = asUserRow(item);
    return row ? [userFromRow(row)] : [];
  });
  setClubDirectory(users);
  return users;
}

export async function loginOrRegisterUser(
  email: string,
  agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const normalized = normalizeEmail(email);
  const existing = await fetchUserByEmail(normalized);
  if (existing) {
    let next = existing;
    const isNew = Boolean(agreementsAcceptedAt && !existing.agreementsAcceptedAt);
    if (isNew && agreementsAcceptedAt) {
      await supabase
        .from('users')
        .update({ agreements_accepted_at: agreementsAcceptedAt })
        .eq('id', existing.id);
      next = { ...existing, agreementsAcceptedAt };
    }
    writeSession(normalized, next.id);
    upsertClubDirectory(next);
    return { user: next, isNew };
  }

  const nickname = generateNickname();
  const { id: _generatedId, ...insertRow } = userToRow({
    id: 'pending',
    email: normalized,
    nickname,
    isAdmin: isSuperAdmin(normalized),
    coins: STARTING_COINS,
    agreementsAcceptedAt,
    ownedItems: [...FREE_ITEM_IDS],
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
    equippedAvatar: [avatarUrlForChar(DEFAULT_CHARACTER_ID), DEFAULT_CHARACTER_ID, DEFAULT_BG_ID],
  });

  const { data, error } = await supabase.from('users').insert(insertRow).select('*').single();
  if (error || !data) {
    const raced = await fetchUserByEmail(normalized);
    if (raced) {
      writeSession(normalized, raced.id);
      upsertClubDirectory(raced);
      return { user: raced, isNew: false };
    }
    throw new Error(error?.message || 'Не удалось создать пользователя');
  }
  const created = asUserRow(data);
  if (!created) throw new Error('Не удалось создать пользователя');
  const mapped = userFromRow(created);
  writeSession(normalized, mapped.id);
  upsertClubDirectory(mapped);
  return { user: mapped, isNew: true };
}

export async function deleteUserRow(userId: string): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  const { error: unlinkError } = await supabase
    .from('participants')
    .update({ user_id: null })
    .eq('user_id', userId);
  if (unlinkError) return { ok: false, code: unlinkError.code, message: unlinkError.message };

  const { error: txError } = await supabase.from('transactions').delete().eq('user_id', userId);
  if (txError) return { ok: false, code: txError.code, message: txError.message };

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (!error) {
    removeClubDirectory(userId);
    return { ok: true };
  }
  return { ok: false, code: error.code, message: error.message };
}

export async function updateUserRow(
  userId: string,
  patch: Record<string, unknown>,
): Promise<MappedUser | null> {
  const { data, error } = await supabase.from('users').update(patch).eq('id', userId).select('*').single();
  if (error || !data) return null;
  const row = asUserRow(data);
  if (!row) return null;
  const mapped = userFromRow(row);
  upsertClubDirectory(mapped);
  return mapped;
}

export function mappedUserToPatch(changes: Partial<MappedUser>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (changes.nickname != null) patch.nickname = changes.nickname;
  if (changes.birthDate != null) patch.birth_date = changes.birthDate;
  if (changes.slogan != null) patch.slogan = changes.slogan;
  if (changes.coins != null) patch.ruby_balance = Math.max(0, Math.trunc(changes.coins));
  if (changes.rubyBalance != null) patch.ruby_balance = Math.max(0, Math.trunc(changes.rubyBalance));
  if (changes.ownedItems != null) patch.owned_items = changes.ownedItems;
  if (changes.equippedChar != null) patch.equipped_char = changes.equippedChar;
  if (changes.equippedBg != null) patch.equipped_bg = changes.equippedBg;
  if (changes.pendingNotifications != null) patch.pending_notifications = changes.pendingNotifications;
  if (changes.agreementsAcceptedAt != null) patch.agreements_accepted_at = changes.agreementsAcceptedAt;
  if (changes.isAdmin != null) patch.is_admin = changes.isAdmin;
  if (changes.equippedChar != null || changes.equippedBg != null) {
    const charId = changes.equippedChar;
    const bgId = changes.equippedBg;
    patch.equipped_avatar = [
      avatarUrlForChar(charId || DEFAULT_CHARACTER_ID),
      charId,
      bgId,
    ].filter((item): item is string => Boolean(item));
  }
  return patch;
}

export { getClubDirectory };
export type { MappedUser };
