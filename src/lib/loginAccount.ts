import { upsertClubDirectory } from './clubDirectory';
import { supabase } from './supabase';
import { withRequestDeadline } from './network';
import { userFromRow, type MappedUser, type UserRow } from './supabaseMap';
import { isClubRole } from './roles';
import { STARTUP_TIMEOUT_MS } from './startupState';

export class ConsentRequiredError extends Error {
  constructor() { super('Для регистрации необходимо принять соглашения'); }
}

/** Identity, profile creation and role resolution happen on the server only. */
export async function loginOrRegisterUser(
  email: string, agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const { data, error } = await withRequestDeadline(
    supabase.rpc('club_open_session', {
      p_accept_agreements: Boolean(agreementsAcceptedAt?.trim()),
    }),
    STARTUP_TIMEOUT_MS,
  );
  if (error || !data) throw new Error('Не удалось открыть профиль. Попробуйте ещё раз.');
  if (data.status === 'consent_required') throw new ConsentRequiredError();
  const row = data.user as UserRow | undefined;
  if (data.status !== 'ready' || !row || typeof row.id !== 'string' || !isClubRole(row.role) ||
      typeof row.email !== 'string' || row.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Не удалось подтвердить профиль. Войдите заново.');
  }
  const user = userFromRow(row);
  upsertClubDirectory(user);
  return { user, isNew: data.is_new === true };
}
