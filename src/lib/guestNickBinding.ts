import { supabase } from './supabase';
import { requestErrorMessage, withRequestDeadline } from './network';

export type GuestBindResult = { tournaments: number; charges: number };

/** Gives every tournament seat and cashier charge of a nick-only player to a real club account. */
export async function bindGuestNick(guestKey: string, userId: string): Promise<GuestBindResult> {
  let response;
  try {
    response = await withRequestDeadline(
      supabase.rpc('club_bind_guest_nick', { p_guest_key: guestKey, p_user_id: userId }),
      20_000,
    );
  } catch (error) {
    throw new Error(requestErrorMessage(error, 'Не удалось привязать ник'));
  }
  const { data, error } = response;
  if (error) throw new Error(error.message || 'Не удалось привязать ник');
  const row = data as { tournaments?: unknown; charges?: unknown } | null;
  if (!row || typeof row.tournaments !== 'number' || typeof row.charges !== 'number') {
    throw new Error('Сервер не подтвердил привязку');
  }
  return { tournaments: row.tournaments, charges: row.charges };
}
