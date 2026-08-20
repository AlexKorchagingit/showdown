import { supabase } from './supabase';
import {
  participantFromJoinedRow,
  participantRowId,
  participantToRow,
  tournamentFromRow,
  tournamentToRow,
  type JoinedParticipantRow,
  type ParticipantRow,
  type TournamentRow,
} from './supabaseMap';
import type { Participant, Tournament } from '../types/tournament';

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

export async function insertParticipantRow(row: ParticipantRow): Promise<void> {
  const { error } = await supabase.from('participants').insert(row);
  if (error) throw new Error(error.message);
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

export async function syncParticipantRows(
  tournamentId: string,
  previous: Participant[],
  next: Participant[],
  resolveUserId: (player: Participant) => string | null,
): Promise<Participant[]> {
  const nextRows = next.map((player) => participantToRow(tournamentId, player, resolveUserId(player)));
  const nextIds = new Set(nextRows.map((row) => row.id));
  const previousIds = previous.map((player) =>
    participantRowId(tournamentId, resolveUserId(player) || player.id),
  );
  const toDelete = previousIds.filter((id) => !nextIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase.from('participants').delete().in('id', toDelete);
    if (error) throw new Error(error.message);
  }
  if (nextRows.length > 0) {
    const { error } = await supabase.from('participants').upsert(nextRows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  }

  return fetchParticipants(tournamentId);
}
