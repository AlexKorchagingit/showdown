import { supabase } from './supabase';
import {
  participantFromJoinedRow,
  participantRowId,
  participantToRow,
  sanitizeParticipantUserId,
  tournamentFromRow,
  tournamentToRow,
  unwrapParticipantSeatKey,
  type JoinedParticipantRow,
  type ParticipantRow,
  type TournamentRow,
} from './supabaseMap';
import type { Participant, Tournament } from '../types/tournament';
import { getClubDirectory } from './clubDirectory';

/** Nested user preview: rating lives on `participants`, but the lobby asks for it on `users`. */
const PARTICIPANT_SELECTS = [
  '*, users(nickname, rating, equipped_avatar)',
  '*, users(nickname, equipped_avatar)',
  '*',
] as const;

function asTournamentRow(data: unknown): TournamentRow | null {
  if (!data || typeof data !== 'object' || !('id' in data)) return null;
  return data as TournamentRow;
}

async function selectParticipants(tournamentId?: string): Promise<JoinedParticipantRow[]> {
  let lastError: string | undefined;
  for (const select of PARTICIPANT_SELECTS) {
    let query = supabase.from('participants').select(select as '*');
    if (tournamentId) query = query.eq('tournament_id', tournamentId);
    const { data, error } = await query;
    if (!error && data) return data as unknown as JoinedParticipantRow[];
    lastError = error?.message;
  }
  throw new Error(lastError || 'Не удалось загрузить участников');
}

function groupParticipants(rows: JoinedParticipantRow[]): Map<string, Participant[]> {
  const grouped = new Map<string, Participant[]>();
  for (const row of rows) {
    const list = grouped.get(row.tournament_id) ?? [];
    list.push(participantFromJoinedRow(row));
    grouped.set(row.tournament_id, list);
  }
  return grouped;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });

  if (error || !data) {
    throw new Error(error?.message || 'Не удалось загрузить турниры');
  }

  const grouped = groupParticipants(await selectParticipants());
  return data.flatMap((item) => {
    const row = asTournamentRow(item);
    if (!row) return [];
    return [tournamentFromRow(row, grouped.get(row.id) ?? [])];
  });
}

export async function fetchParticipants(tournamentId: string): Promise<Participant[]> {
  return (await selectParticipants(tournamentId)).map(participantFromJoinedRow);
}

export async function insertTournament(tournament: Tournament): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert(tournamentToRow(tournament))
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Не удалось создать турнир');
  const parsed = asTournamentRow(data);
  return parsed ? tournamentFromRow(parsed, []) : { ...tournament, participants: [] };
}

export async function updateTournamentRow(tournament: Tournament): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update(tournamentToRow(tournament))
    .eq('id', tournament.id);
  if (error) throw new Error(error.message);
}

export async function deleteTournamentRow(tournamentId: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
  if (error) throw new Error(error.message);
}

function isFkError(error: { code?: string; message?: string }): boolean {
  return error.code === '23503' || /foreign key|participants_user_id_fkey/i.test(error.message ?? '');
}

function isUniqueError(error: { code?: string; message?: string }): boolean {
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

export async function insertParticipantRow(row: ParticipantRow): Promise<void> {
  const payload: ParticipantRow = {
    ...row,
    user_id: sanitizeParticipantUserId(row.user_id),
    nickname: row.nickname.trim() || 'Игрок',
  };
  const { error } = await supabase.from('participants').insert(payload);
  if (!error) return;
  if (isUniqueError(error)) return;
  console.error('Participant Insert Error:', error, payload);
  if (payload.user_id && isFkError(error)) {
    const retry: ParticipantRow = { ...payload, user_id: null };
    const second = await supabase.from('participants').insert(retry);
    if (!second.error || isUniqueError(second.error)) return;
    console.error('Participant Insert Error:', second.error, retry);
    throw new Error(second.error.message);
  }
  throw new Error(error.message);
}

async function fetchKnownUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('users').select('id');
  if (error) {
    console.error('Participant Insert Error:', error);
    return new Set(getClubDirectory().map((user) => user.id));
  }
  return new Set(
    (data ?? []).flatMap((row) => (typeof row.id === 'string' && row.id.trim() ? [row.id] : [])),
  );
}

function bindKnownUserId(candidate: string | null | undefined, realIds: Set<string>): string | null {
  const sanitized = sanitizeParticipantUserId(candidate);
  if (!sanitized) return null;
  return realIds.has(sanitized) ? sanitized : null;
}

async function upsertOneParticipantRow(row: ParticipantRow): Promise<void> {
  const payload: ParticipantRow = {
    ...row,
    user_id: sanitizeParticipantUserId(row.user_id),
    nickname: row.nickname.trim() || 'Игрок',
  };
  const { error } = await supabase.from('participants').upsert(payload, { onConflict: 'id' });
  if (!error) return;
  console.error('Participant Insert Error:', error, payload);
  if (isFkError(error) && payload.user_id) {
    const retry: ParticipantRow = { ...payload, user_id: null };
    const second = await supabase.from('participants').upsert(retry, { onConflict: 'id' });
    if (!second.error) return;
    console.error('Participant Insert Error:', second.error, retry);
    throw new Error(second.error.message);
  }
  throw new Error(error.message);
}

export async function upsertParticipantRows(rows: ParticipantRow[]): Promise<void> {
  for (const row of rows) {
    await upsertOneParticipantRow(row);
  }
}

function allocateSeatKey(
  tournamentId: string,
  player: Participant,
  boundUserId: string | null,
  used: Set<string>,
  index: number,
): string {
  const preferred = boundUserId || unwrapParticipantSeatKey(tournamentId, player.id);
  let key = preferred && !preferred.includes(':') && !used.has(preferred) ? preferred : '';
  if (!key) key = boundUserId && !used.has(boundUserId) ? boundUserId : `g-${index + 1}`;
  while (used.has(key)) key = `g-${index + 1}-${used.size}`;
  used.add(key);
  return key;
}

function rowsForSeats(
  tournamentId: string,
  players: Participant[],
  resolveUserId: (player: Participant) => string | null,
  realIds: Set<string>,
): ParticipantRow[] {
  const used = new Set<string>();
  return players.map((player, index) => {
    const bound = bindKnownUserId(resolveUserId(player), realIds);
    const key = allocateSeatKey(tournamentId, player, bound, used, index);
    return participantToRow(tournamentId, { ...player, id: key }, bound);
  });
}

async function insertSeatRows(
  tournamentId: string,
  players: Participant[],
  resolveUserId: (player: Participant) => string | null,
  realIds: Set<string>,
): Promise<void> {
  const rows = rowsForSeats(tournamentId, players, resolveUserId, realIds);
  let lastError: Error | null = null;
  let inserted = 0;
  for (const row of rows) {
    try {
      await insertParticipantRow(row);
      inserted += 1;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('Participant Insert Error:', lastError, row);
    }
  }
  if (inserted === 0 && rows.length > 0 && lastError) throw lastError;
}

export async function removeParticipantSeat(
  tournamentId: string,
  player: Pick<Participant, 'id' | 'nickname'>,
): Promise<void> {
  const userId = sanitizeParticipantUserId(player.id);
  const ids = [...new Set([player.id, participantRowId(tournamentId, player.id)].filter(Boolean))];

  const byId = await supabase.from('participants').delete().in('id', ids);
  if (byId.error) {
    console.error('Participant Delete Error:', byId.error, { tournamentId, player, ids });
    throw new Error(byId.error.message);
  }

  if (userId) {
    const byUser = await supabase
      .from('participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);
    if (byUser.error) {
      console.error('Participant Delete Error:', byUser.error, { tournamentId, userId });
      throw new Error(byUser.error.message);
    }
  }
}

export async function clearParticipantPlace(tournamentId: string, playerId: string): Promise<void> {
  const rowId = playerId.includes(':') ? playerId : participantRowId(tournamentId, playerId);
  const byId = await supabase
    .from('participants')
    .update({ place: null })
    .eq('id', rowId)
    .select('id');
  if (!byId.error && (byId.data?.length ?? 0) > 0) return;

  const bySeat = await supabase
    .from('participants')
    .update({ place: null })
    .eq('tournament_id', tournamentId)
    .eq('user_id', playerId)
    .select('id');
  if (bySeat.error || (bySeat.data?.length ?? 0) === 0) {
    throw new Error(bySeat.error?.message || byId.error?.message || 'Не удалось сбросить место');
  }
}

export async function deleteParticipantSeat(tournamentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  await supabase.from('participants').delete().eq('id', participantRowId(tournamentId, userId));
  await supabase.from('participants').delete().eq('id', participantRowId(tournamentId, 'me'));
}

function sameSeat(left: Participant, right: Participant): boolean {
  return (
    left.id === right.id &&
    left.nickname === right.nickname &&
    left.rating === right.rating &&
    left.place === right.place &&
    (left.knockouts ?? 0) === (right.knockouts ?? 0) &&
    left.rubiesAwarded === right.rubiesAwarded &&
    left.comment === right.comment
  );
}

export async function syncParticipantRows(
  tournamentId: string,
  previous: Participant[],
  next: Participant[],
  resolveUserId: (player: Participant) => string | null,
): Promise<Participant[]> {
  let baseline = previous;
  try {
    baseline = await fetchParticipants(tournamentId);
  } catch (error) {
    console.error(error);
  }

  const previousById = new Map(baseline.map((player) => [player.id, player]));
  const nextIds = new Set(next.map((player) => player.id));
  const removed = baseline.filter((player) => !nextIds.has(player.id));
  const added = next.filter((player) => !previousById.has(player.id));
  const changed = next.filter((player) => {
    const before = previousById.get(player.id);
    return Boolean(before && !sameSeat(before, player));
  });

  for (const player of removed) {
    await removeParticipantSeat(tournamentId, player);
  }

  const realIds = await fetchKnownUserIds();
  if (added.length > 0) {
    await insertSeatRows(tournamentId, added, resolveUserId, realIds);
  }
  if (changed.length > 0) {
    await upsertParticipantRows(
      changed.map((player) =>
        participantToRow(tournamentId, player, bindKnownUserId(resolveUserId(player), realIds)),
      ),
    );
  }

  return fetchParticipants(tournamentId);
}
