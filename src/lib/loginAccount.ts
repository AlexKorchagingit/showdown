import { writeSession } from './session';
import { upsertClubDirectory } from './clubDirectory';
import { supabase } from './supabase';
import { userFromRow, type MappedUser, type UserRow } from './supabaseMap';
import { isClubRole } from './roles';

export class ConsentRequiredError extends Error {
  constructor() { super('Для регистрации необходимо принять соглашения'); }
}

/** Identity, profile creation and role resolution happen on the server only. */
export async function loginOrRegisterUser(
  email: string, agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const { data, error } = await supabase.rpc('club_open_session', {
    p_accept_agreements: Boolean(agreementsAcceptedAt?.trim()),
  });
  if (error || !data) throw new Error('Не удалось открыть профиль. Попробуйте ещё раз.');
  if (data.status === 'consent_required') throw new ConsentRequiredError();
  const row = data.user as UserRow | undefined;
  if (data.status !== 'ready' || !row || typeof row.id !== 'string' || !isClubRole(row.role) ||
      typeof row.email !== 'string' || row.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Не удалось подтвердить профиль. Войдите заново.');
  }
  const user = userFromRow(row);
  writeSession(user.email, user.id); // Display cache, never proof of authentication.
  upsertClubDirectory(user);
  return { user, isNew: data.is_new === true };
}
