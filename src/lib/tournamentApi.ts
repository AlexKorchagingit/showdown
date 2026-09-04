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
import {
  createTournamentCommand,
  updateTournamentCommand,
  type TournamentChanges,
  type TournamentValues,
} from './tournamentCommands';

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
    supabase.rpc('club_tournament_snapshot'),
    selectParticipantsSafe(),
  ]);

  if (error || !Array.isArray(data)) {
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

function tournamentValues(tournament: Tournament): TournamentValues {
  const row=tournamentToRow(tournament);
  return {title:row.title,image_url:row.image_url,address:row.address,start_date:row.start_date,
    start_time:row.start_time,total_seats:row.total_seats,guarantee:row.guarantee,about:row.about,
    features:row.features,late_reg_until:row.late_reg_until,blind_structure:row.blind_structure,
    blind_structure_id:row.blind_structure_id,stack_size:row.stack_size,level_duration:row.level_duration,
    is_bounty:row.is_bounty,admin_secret_comment:row.admin_secret_comment};
}

function tournamentChanges(patch: Partial<Tournament>): TournamentChanges {
  const changes:TournamentChanges={};
  if('title' in patch)changes.title=patch.title!;
  if('imageUrl' in patch)changes.image_url=patch.imageUrl!;
  if('address' in patch)changes.address=patch.address!;
  if('startDate' in patch)changes.start_date=patch.startDate!.slice(0,10);
  if('startTime' in patch)changes.start_time=patch.startTime!;
  if('totalSeats' in patch)changes.total_seats=patch.totalSeats!;
  if('guarantee' in patch)changes.guarantee=patch.guarantee!;
  if('about' in patch)changes.about=patch.about!;
  if('features' in patch)changes.features=[...(patch.features??[])];
  if('lateRegUntil' in patch)changes.late_reg_until=patch.lateRegUntil!;
  if('blindStructure' in patch)changes.blind_structure=patch.blindStructure!;
  if('blindStructureId' in patch)changes.blind_structure_id=patch.blindStructureId??null;
  if('stackSize' in patch)changes.stack_size=patch.stackSize!;
  if('levelDuration' in patch)changes.level_duration=patch.levelDuration!;
  if('isBounty' in patch)changes.is_bounty=patch.isBounty===true;
  if('adminSecretComment' in patch)changes.admin_secret_comment=patch.adminSecretComment??null;
  return changes;
}

export async function insertTournament(tournament: Tournament,actorId:string): Promise<Tournament> {
  if ((tournament.dealers?.length ?? 0) || (tournament.staff?.length ?? 0)) {
    throw new Error('Сначала создайте турнир, затем добавьте персонал серверной командой');
  }
  const saved=await createTournamentCommand(actorId,tournamentValues(tournament));
  return tournamentFromRow(saved.tournament,[]);
}

export async function updateTournamentRow(tournamentId:string,patch:Partial<Tournament>,actorId:string): Promise<Tournament> {
  const saved=await updateTournamentCommand(actorId,tournamentId,tournamentChanges(patch));
  return tournamentFromRow(saved.tournament,[]);
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
