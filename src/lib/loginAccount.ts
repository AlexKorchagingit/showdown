import { isSuperAdmin } from './admin';
import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  avatarUrlForChar,
  cosmeticsResetOwnedItems,
} from '../data/shopItems';
import { writeSession } from './session';
import { upsertClubDirectory } from './clubDirectory';
import { userFromRow, userToRow, type MappedUser, type UserRow } from './supabaseMap';
import { STARTING_COINS, generateNickname } from './userStorage';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Stall abort only. HTTP/RLS errors reject as soon as the response arrives. */
const LOGIN_STALL_MS = 8_000;

function logLoginFatal(error: unknown): void {
  console.error('LOGIN FATAL ERROR:', error);
}

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

function failLogin(error: unknown, fallback: string): never {
  const wrapped = asError(error, fallback);
  logLoginFatal(wrapped);
  throw wrapped;
}

function asUserRow(data: unknown): UserRow | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Partial<UserRow>;
  if (typeof row.id !== 'string' || typeof row.email !== 'string') return null;
  return row as UserRow;
}

function rlsBlockedMessage(status: number): string {
  return (
    `Нет доступа к таблице users (HTTP ${status}). ` +
    'RLS или GRANT для роли anon блокирует вход без сессии Auth.'
  );
}

function postgrestMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const row = body as { message?: unknown };
    const message = typeof row.message === 'string' ? row.message.trim() : '';
    if (message) return message;
  }
  return `Ошибка базы (HTTP ${status})`;
}

async function parseBody(response: Response): Promise<unknown> {
  let text = '';
  try {
    text = await response.text();
  } catch (error) {
    failLogin(error, 'Не удалось прочитать ответ сервера');
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    failLogin(error, 'Сервер вернул некорректный ответ');
  }
}

async function loginFetch(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    failLogin(new Error('Missing Supabase environment variables'), 'Нет настроек подключения');
  }

  const controller = new AbortController();
  const stall = globalThis.setTimeout(() => controller.abort(), LOGIN_STALL_MS);
  const parent = init.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const headers = new Headers(init.headers);
  headers.set('apikey', supabaseAnonKey);
  headers.set('Authorization', `Bearer ${supabaseAnonKey}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}${path}`, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      headers,
    });
  } catch (error) {
    const aborted =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError');
    failLogin(error, aborted ? 'Нет ответа от базы при входе' : 'Обрыв связи при входе');
  } finally {
    globalThis.clearTimeout(stall);
  }

  let body: unknown;
  try {
    body = await parseBody(response);
  } catch (error) {
    failLogin(error, 'Не удалось прочитать ответ сервера');
  }

  if (response.status === 401 || response.status === 403) {
    failLogin(body, rlsBlockedMessage(response.status));
  }
  return { status: response.status, body };
}

function mapUser(data: unknown): MappedUser {
  const row = asUserRow(Array.isArray(data) ? data[0] : data);
  if (!row) failLogin(data, 'Некорректная запись пользователя');
  return userFromRow(row);
}

function finishLogin(user: MappedUser, isNew: boolean): { user: MappedUser; isNew: boolean } {
  writeSession(user.email, user.id);
  upsertClubDirectory(user);
  return { user, isNew };
}

async function lookupUserByEmailRest(email: string): Promise<MappedUser | null> {
  let result: { status: number; body: unknown };
  try {
    result = await loginFetch(
      `/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`,
      { method: 'GET' },
    );
  } catch (error) {
    failLogin(error, 'Не удалось проверить аккаунт');
  }

  if (result.status < 200 || result.status >= 300) {
    failLogin(result.body, postgrestMessage(result.body, result.status));
  }
  if (!Array.isArray(result.body) || result.body.length === 0) return null;

  try {
    return mapUser(result.body);
  } catch (error) {
    failLogin(error, 'Некорректная запись пользователя');
  }
}

async function patchAgreements(userId: string, acceptedAt: string): Promise<void> {
  let result: { status: number; body: unknown };
  try {
    result = await loginFetch(`/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ agreements_accepted_at: acceptedAt }),
    });
  } catch (error) {
    logLoginFatal(error);
    return;
  }
  if (result.status < 200 || result.status >= 300) {
    logLoginFatal({ stage: 'agreements update', status: result.status, body: result.body });
  }
}

async function promoteAdmin(userId: string): Promise<MappedUser | null> {
  let result: { status: number; body: unknown };
  try {
    result = await loginFetch(`/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ is_admin: true }),
    });
  } catch (error) {
    logLoginFatal(error);
    return null;
  }
  if (result.status < 200 || result.status >= 300) {
    logLoginFatal({ stage: 'admin promote', status: result.status, body: result.body });
    return null;
  }
  try {
    return mapUser(result.body);
  } catch (error) {
    logLoginFatal(error);
    return null;
  }
}

async function clubIsEmpty(): Promise<boolean> {
  let result: { status: number; body: unknown };
  try {
    result = await loginFetch('/rest/v1/users?select=id&limit=2', { method: 'GET' });
  } catch (error) {
    logLoginFatal(error);
    return false;
  }
  if (result.status < 200 || result.status >= 300) {
    logLoginFatal({ stage: 'users count', status: result.status, body: result.body });
    return false;
  }
  return Array.isArray(result.body) && result.body.length <= 1;
}

async function insertUser(email: string, agreementsAcceptedAt?: string): Promise<MappedUser> {
  let makeAdmin = isSuperAdmin(email);
  if (!makeAdmin) {
    try {
      makeAdmin = await clubIsEmpty();
    } catch (error) {
      logLoginFatal(error);
      makeAdmin = false;
    }
  }

  const { id: _ignored, ...insertRow } = userToRow({
    id: 'pending',
    email,
    nickname: generateNickname(),
    isAdmin: makeAdmin,
    coins: STARTING_COINS,
    agreementsAcceptedAt,
    ownedItems: cosmeticsResetOwnedItems(),
    equippedChar: DEFAULT_CHARACTER_ID,
    equippedBg: DEFAULT_BG_ID,
    equippedAvatar: [avatarUrlForChar(DEFAULT_CHARACTER_ID), DEFAULT_CHARACTER_ID, DEFAULT_BG_ID],
  });

  let result: { status: number; body: unknown };
  try {
    result = await loginFetch('/rest/v1/users?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(insertRow),
    });
  } catch (error) {
    failLogin(error, 'Не удалось создать пользователя');
  }

  if (result.status === 409) {
    let raced: MappedUser | null = null;
    try {
      raced = await lookupUserByEmailRest(email);
    } catch (error) {
      failLogin(error, 'Не удалось создать пользователя');
    }
    if (raced) return raced;
    failLogin(
      result.body,
      'Пользователь есть в базе, но SELECT его не возвращает. Проверьте RLS для anon.',
    );
  }

  if (result.status < 200 || result.status >= 300) {
    failLogin(result.body, postgrestMessage(result.body, result.status));
  }

  try {
    return mapUser(result.body);
  } catch (error) {
    failLogin(error, 'Не удалось создать пользователя');
  }
}

/**
 * Email OTP is verified locally. Club account load/create goes through
 * PostgREST with the anon key — never supabase-js Auth or getSession().
 */
export async function loginOrRegisterUser(
  email: string,
  agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) failLogin(new Error('Не указан email'), 'Не указан email');

  try {
    let existing: MappedUser | null;
    try {
      existing = await lookupUserByEmailRest(normalized);
    } catch (error) {
      failLogin(error, 'Не удалось проверить аккаунт');
    }

    if (existing) {
      let next = existing;
      const isNew = Boolean(agreementsAcceptedAt && !existing.agreementsAcceptedAt);
      if (isNew && agreementsAcceptedAt) {
        try {
          await patchAgreements(existing.id, agreementsAcceptedAt);
          next = { ...existing, agreementsAcceptedAt };
        } catch (error) {
          logLoginFatal(error);
        }
      }
      if (!next.isAdmin && isSuperAdmin(normalized)) {
        try {
          const promoted = await promoteAdmin(next.id);
          if (promoted) next = promoted;
        } catch (error) {
          logLoginFatal(error);
        }
      }
      return finishLogin(next, isNew);
    }

    let created: MappedUser;
    try {
      created = await insertUser(normalized, agreementsAcceptedAt);
    } catch (error) {
      failLogin(error, 'Не удалось создать пользователя');
    }
    return finishLogin(created, true);
  } catch (error) {
    failLogin(error, 'Не удалось войти');
  }
}
