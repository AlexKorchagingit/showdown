import { isSuperAdmin } from './admin';
import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  avatarUrlForChar,
  cosmeticsResetOwnedItems,
} from '../data/shopItems';
import { writeSession } from './session';
import { upsertClubDirectory } from './clubDirectory';
import { supabase, logSupabaseError } from './supabase';
import { userFromRow, userToRow, type MappedUser, type UserRow } from './supabaseMap';
import { STARTING_COINS, generateNickname } from './userStorage';

function logLoginFatal(error: unknown): void {
  console.error('LOGIN FATAL ERROR:', error);
}

function asUserRow(data: unknown): UserRow | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Partial<UserRow>;
  if (typeof row.id !== 'string' || typeof row.email !== 'string') return null;
  return row as UserRow;
}

function finishLogin(user: MappedUser, isNew: boolean): { user: MappedUser; isNew: boolean } {
  writeSession(user.email, user.id);
  upsertClubDirectory(user);
  return { user, isNew };
}

/** True when this email already has a club row — returning users skip consent. */
export async function emailAccountExists(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalized)
      .limit(1);
    if (error) {
      logLoginFatal(error);
      throw new Error(error.message || 'Не удалось проверить почту');
    }
    return Boolean(data?.length);
  } catch (error) {
    logLoginFatal(error);
    throw error;
  }
}

async function lookupUserByEmail(email: string): Promise<MappedUser | null> {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) {
    logSupabaseError(error, 'users lookup');
    throw new Error(error.message || 'Не удалось проверить аккаунт');
  }
  const row = asUserRow(data);
  return row ? userFromRow(row) : null;
}

async function promoteAdmin(userId: string): Promise<MappedUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', userId)
      .select('*')
      .single();
    if (error || !data) {
      logLoginFatal(error);
      return null;
    }
    const row = asUserRow(data);
    return row ? userFromRow(row) : null;
  } catch (error) {
    logLoginFatal(error);
    return null;
  }
}

async function clubIsEmpty(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(2);
    if (error || !data) {
      logLoginFatal(error);
      return false;
    }
    return data.length <= 1;
  } catch (error) {
    logLoginFatal(error);
    return false;
  }
}

async function insertUser(email: string, agreementsAcceptedAt?: string): Promise<MappedUser> {
  const acceptedAt = agreementsAcceptedAt?.trim();
  if (!acceptedAt) {
    throw new Error('Примите соглашения, чтобы зарегистрироваться');
  }

  let makeAdmin = isSuperAdmin(email);
  if (!makeAdmin) {
    makeAdmin = await clubIsEmpty();
  }

  const { id: _ignored, ...insertRow } = userToRow({
    id: 'pending',
    email,
    nickname: generateNickname(),
    isAdmin: makeAdmin,
    coins: STARTING_COINS,
    agreementsAcceptedAt: acceptedAt,
    ownedItems: cosmeticsResetOwnedItems(),
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
    equippedAvatar: [avatarUrlForChar(DEFAULT_CHARACTER_ID), DEFAULT_CHARACTER_ID, DEFAULT_BG_ID],
  });

  const { data, error } = await supabase.from('users').insert(insertRow).select('*').single();
  if (error || !data) {
    logSupabaseError(error, 'insert user');
    const raced = await lookupUserByEmail(email);
    if (raced) return raced;
    throw new Error(error?.message || 'Не удалось создать пользователя');
  }
  const row = asUserRow(data);
  if (!row) throw new Error('Не удалось создать пользователя');
  return userFromRow(row);
}

export async function loginOrRegisterUser(
  email: string,
  agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Не указан email');

  try {
    const existing = await lookupUserByEmail(normalized);
    if (existing) {
      let next = existing;
      if (!next.isAdmin && isSuperAdmin(normalized)) {
        const promoted = await promoteAdmin(next.id);
        if (promoted) next = promoted;
      }
      return finishLogin(next, false);
    }

    const created = await insertUser(normalized, agreementsAcceptedAt);
    return finishLogin(created, true);
  } catch (error) {
    logLoginFatal(error);
    throw error;
  }
}
