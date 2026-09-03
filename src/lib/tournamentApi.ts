import { supabase, logSupabaseError } from './supabase';
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
import { replaceParticipants, type ParticipantCommandRow } from './participantCommands';

/** Nested user preview. Rating lives on `participants`, not `users`. */
const PARTICIPANT_SELECT_WITH_USER = '*, users (nickname, equipped_avatar, equipped_char)';

function asTournamentRow(data: unknown): TournamentRow | null {
  if (!data || typeof data !== 'object' || !('id' in data)) return null;
  return data as TournamentRow;
}

async function selectParticipants(tournamentId?: string): Promise<JoinedParticipantRow[]> {
  let query = supabase.from('participants').select(PARTICIPANT_SELECT_WITH_USER);
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (!error && data) return data as unknown as JoinedParticipantRow[];
  logSupabaseError(error, 'participants embed users');

  let fallback = supabase.from('participants').select('*');
  if (tournamentId) fallback = fallback.eq('tournament_id', tournamentId);
  const retry = await fallback;
  if (retry.error || !retry.data) {
    logSupabaseError(retry.error, 'participants');
    throw new Error(retry.error?.message || error?.message || 'Не удалось загрузить участников');
  }
  return retry.data as unknown as JoinedParticipantRow[];
}

async function selectParticipantsSafe(tournamentId?: string): Promise<JoinedParticipantRow[]> {
  try {
    return await selectParticipants(tournamentId);
  } catch (error) {
    logSupabaseError(error instanceof Error ? error : { message: String(error) }, 'participants');
    return [];
  }
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
  const [{ data, error }, participantRows] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    selectParticipantsSafe(),
  ]);

  if (error || !data) {
    logSupabaseError(error, 'tournaments');
    throw new Error(error?.message || 'Не удалось загрузить турниры');
  }

  const grouped = groupParticipants(participantRows);
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
  if ((tournament.dealers?.length ?? 0) || (tournament.staff?.length ?? 0)) {
    throw new Error('Сначала создайте турнир, затем добавьте персонал серверной командой');
  }
  const { data, error } = await supabase
    .from('tournaments')
    .insert(tournamentWriteRow(tournament))
    .select('*')
    .single();
  if (error || !data) {
    logSupabaseError(error, 'insert tournament');
    throw new Error(error?.message || 'Не удалось создать турнир');
  }
  const parsed = asTournamentRow(data);
  return parsed ? tournamentFromRow(parsed, []) : { ...tournament, participants: [] };
}

export async function updateTournamentRow(tournament: Tournament): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update(tournamentWriteRow(tournament))
    .eq('id', tournament.id);
  if (error) {
    logSupabaseError(error, 'update tournament');
    throw new Error(error.message);
  }
}

/** Protected personnel is not part of generic tournament writes, including stale editor saves. */
export function tournamentWriteRow(tournament: Tournament) {
  const { staff: _staff, dealers: _dealers, ...row } = tournamentToRow(tournament);
  return row;
}

export async function deleteTournamentRow(tournamentId: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId);
  if (error) {
    logSupabaseError(error, 'delete tournament');
    throw new Error(error.message);
  }
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
  logSupabaseError(error, 'insert participant');
  if (payload.user_id && isFkError(error)) {
    const retry: ParticipantRow = { ...payload, user_id: null };
    const second = await supabase.from('participants').insert(retry);
    if (!second.error || isUniqueError(second.error)) return;
    logSupabaseError(second.error, 'insert participant retry');
    throw new Error(second.error.message);
  }
  throw new Error(error.message);
}

async function fetchKnownUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('users').select('id');
  if (error) {
    logSupabaseError(error, 'users id list');
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
  logSupabaseError(error, 'upsert participant');
  if (isFkError(error) && payload.user_id) {
    const retry: ParticipantRow = { ...payload, user_id: null };
    const second = await supabase.from('participants').upsert(retry, { onConflict: 'id' });
    if (!second.error) return;
    logSupabaseError(second.error, 'upsert participant retry');
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

export async function removeParticipantSeat(
  tournamentId: string,
  player: Pick<Participant, 'id' | 'nickname'>,
): Promise<void> {
  const userId = sanitizeParticipantUserId(player.id);
  const ids = [...new Set([player.id, participantRowId(tournamentId, player.id)].filter(Boolean))];

  const byId = await supabase.from('participants').delete().in('id', ids);
  if (byId.error) {
    logSupabaseError(byId.error, 'delete participant by id');
    throw new Error(byId.error.message);
  }

  if (userId) {
    const byUser = await supabase
      .from('participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);
    if (byUser.error) {
      logSupabaseError(byUser.error, 'delete participant by user');
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
    logSupabaseError(bySeat.error ?? byId.error, 'clear participant place');
    throw new Error(bySeat.error?.message || byId.error?.message || 'Не удалось сбросить место');
  }
}

export async function deleteParticipantSeat(tournamentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId);
  if (error) {
    logSupabaseError(error, 'delete participant seat');
    throw new Error(error.message);
  }
  await supabase.from('participants').delete().eq('id', participantRowId(tournamentId, userId));
  await supabase.from('participants').delete().eq('id', participantRowId(tournamentId, 'me'));
}

function sameSeat(left: Participant, right: Participant): boolean {
  return (
    left.id === right.id &&
    (left.userId ?? '') === (right.userId ?? '') &&
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
  actorId: string,
): Promise<Participant[]> {
  let baseline = previous;
  try {
    baseline = await fetchParticipants(tournamentId);
  } catch (error) {
    logSupabaseError(error instanceof Error ? error : { message: String(error) }, 'sync participants fetch');
  }

  const realIds = await fetchKnownUserIds();
  const desired=rowsForSeats(tournamentId,next,resolveUserId,realIds);
  const previousById=new Map(baseline.map((player)=>[player.id,player]));
  const removed=baseline.filter((player)=>!next.some((candidate)=>candidate.id===player.id));
  const added=next.filter((player)=>!previousById.has(player.id));
  const rows:ParticipantCommandRow[]=desired.map((row,index)=>{
    const player=next[index];
    let source=previousById.get(player.id);
    if(!source&&added.length===1&&removed.length===1&&!removed[0].userId&&Boolean(player.userId)
      &&sameSeat(removed[0],{...player,id:removed[0].id,
      userId:removed[0].userId,nickname:removed[0].nickname}))source=removed[0];
    return {source_id:source?participantRowId(tournamentId,source.id):null,seat_id:row.id,user_id:row.user_id,
      nickname:row.nickname,place:row.place,knockouts:row.knockouts,comment:row.comment};
  });
  await replaceParticipants(actorId,tournamentId,rows);

  return fetchParticipants(tournamentId);
}
