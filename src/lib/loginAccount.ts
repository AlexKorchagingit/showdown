import { upsertClubDirectory } from './clubDirectory';
import { supabase } from './supabase';
import { isUncertainNetworkError, withRequestDeadline } from './network';
import { userFromRow, type MappedUser, type UserRow } from './supabaseMap';
import { isClubRole } from './roles';
import { STARTUP_TIMEOUT_MS } from './startupState';

export class ConsentRequiredError extends Error {
  constructor() { super('Для регистрации необходимо принять соглашения'); }
}

export class SessionExpiredError extends Error {
  constructor() { super('Подтверждение почты больше не действует'); }
}

const SESSION_REJECTION_CODES = new Set(['401', '403', '42501', 'PGRST301', 'PGRST302']);

/** The server refuses club_open_session without a confirmed Auth session. */
function isSessionRejection(error: { code?: string | null; message?: string | null }): boolean {
  if (SESSION_REJECTION_CODES.has(String(error.code ?? ''))) return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('authentication required')
    || message.includes('verified account required')
    || message.includes('permission denied')
    || message.includes('jwt');
}

/** Email of the Auth session stored on this device, empty when there is none. */
export async function verifiedSessionEmail(): Promise<string> {
  try {
    const { data } = await withRequestDeadline(supabase.auth.getSession(), STARTUP_TIMEOUT_MS);
    return (data.session?.user?.email ?? '').trim().toLowerCase();
  } catch {
    return '';
  }
}

/** Identity, profile creation and role resolution happen on the server only. */
export async function loginOrRegisterUser(
  email: string, agreementsAcceptedAt?: string,
): Promise<{ user: MappedUser; isNew: boolean }> {
  const { data, error } = await withRequestDeadline((async () => {
    try {
      return await supabase.rpc('club_open_session', {
        p_accept_agreements: Boolean(agreementsAcceptedAt?.trim()),
      });
    } catch (openError) {
      if (!isUncertainNetworkError(openError)) throw openError;

      // The server may have committed the session/profile even though its
      // response was lost. Verify with a safe read instead of replaying the
      // mutation and potentially duplicating audit side effects.
      const recovered = await supabase.rpc('club_current_account');
      if (recovered.error || !recovered.data) throw openError;
      return {
        data: { status: 'ready', is_new: false, user: recovered.data },
        error: null,
      };
    }
  })(),
    STARTUP_TIMEOUT_MS,
  );
  if (error && isSessionRejection(error)) throw new SessionExpiredError();
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
