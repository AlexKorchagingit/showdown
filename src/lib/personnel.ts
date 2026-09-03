import { supabase } from './supabase';
import { createOperationRequests, type RequestPersistence } from './operationRequests';
import type { Tournament, TournamentDealer, TournamentStaffMember } from '../types/tournament';

export type PersonnelData = TournamentDealer & { role?: string };
export type PersonnelEntry = {
  id: string;
  kind: 'dealer' | 'staff';
  data: PersonnelData;
  archivedAt?: string;
  archiveReason?: string;
};
export type PersonnelRoster = { tournamentId: string; revision: number; entries: PersonnelEntry[] };
type PersonnelAction =
  | { action: 'add_dealer'; entryId?: never; values: { name: string; minutes: number } }
  | { action: 'add_staff'; entryId?: never; values: { name: string; minutes: number; role: string } }
  | { action: 'adjust'; entryId: string; values: { delta: number } }
  | { action: 'comment'; entryId: string; values: { comment: string; revision: number } }
  | { action: 'archive'; entryId: string; values: { reason: string } };
export type PersonnelIntent = PersonnelAction & { tournamentId: string };
const CONFIRMATION_ERROR = 'Сервер не подтвердил данные персонала. Обновите список.';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const timestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function parsePersonnelRoster(value: unknown): PersonnelRoster {
  if (!record(value) || typeof value.tournament_id !== 'string' || !value.tournament_id
    || !integer(value.revision) || !Array.isArray(value.entries)) throw new Error(CONFIRMATION_ERROR);
  const ids = new Set<string>();
  const entries = value.entries.map((entry): PersonnelEntry => {
    if (!record(entry) || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)
      || !['dealer','staff'].includes(String(entry.kind)) || !record(entry.data)) throw new Error(CONFIRMATION_ERROR);
    ids.add(entry.id);
    const data = entry.data;
    if (typeof data.name !== 'string' || !integer(data.hours) || !integer(data.minutes)
      || data.hours * 60 + data.minutes > 600000
      || (entry.kind === 'staff' && typeof data.role !== 'string')
      || (data.comment != null && typeof data.comment !== 'string')
      || (data.loggedAt != null && !timestamp(data.loggedAt))
      || (entry.archived_at != null && !timestamp(entry.archived_at))
      || (entry.archive_reason != null && typeof entry.archive_reason !== 'string')) throw new Error(CONFIRMATION_ERROR);
    return { id: entry.id, kind: entry.kind as PersonnelEntry['kind'], data: {
      name: data.name, hours: data.hours, minutes: data.minutes,
      role: typeof data.role === 'string' ? data.role : undefined,
      comment: typeof data.comment === 'string' ? data.comment : undefined,
      loggedAt: typeof data.loggedAt === 'string' ? data.loggedAt : undefined,
    }, archivedAt: typeof entry.archived_at === 'string' ? entry.archived_at : undefined,
    archiveReason: typeof entry.archive_reason === 'string' ? entry.archive_reason : undefined };
  });
  return { tournamentId: value.tournament_id, revision: value.revision, entries };
}

export async function fetchPersonnel(): Promise<PersonnelRoster[]> {
  const { data, error } = await supabase.rpc('club_personnel_snapshot');
  if (error || !Array.isArray(data)) throw new Error('Не удалось загрузить персонал. Повторите загрузку перед изменениями.');
  const rows = data.map(parsePersonnelRoster);
  if (new Set(rows.map((row) => row.tournamentId)).size !== rows.length) throw new Error(CONFIRMATION_ERROR);
  return rows;
}

export async function sendPersonnelCommand(input: PersonnelIntent & { requestId: string }): Promise<PersonnelRoster> {
  const { data, error } = await supabase.rpc('club_personnel_command', {
    p_request_id: input.requestId, p_tournament_id: input.tournamentId, p_action: input.action,
    p_entry_id: input.entryId ?? null, p_values: input.values,
  });
  if (error?.code === 'PT409') throw new Error('Список уже изменён другим администратором. Обновите его и проверьте комментарий.');
  if (error) throw new Error('Не удалось подтвердить изменение персонала. Повторите ту же операцию или обновите список.');
  const roster = parsePersonnelRoster(data);
  if (roster.tournamentId !== input.tournamentId) throw new Error(CONFIRMATION_ERROR);
  return roster;
}

export function createPersonnelRequests(
  send: typeof sendPersonnelCommand = sendPersonnelCommand,
  createId?: () => string,
  persistence?: RequestPersistence,
) {
  return createOperationRequests<PersonnelIntent, PersonnelRoster>(send, (intent) => ({
    tournamentId: intent.tournamentId, action: intent.action, entryId: intent.entryId,
    values: Object.fromEntries(Object.entries(intent.values).sort(([a],[b]) => a.localeCompare(b))
      .map(([key,value]) => [key, typeof value === 'string' ? value.trim() : value])),
  }) as PersonnelIntent, 'showdown.personnel.v1', createId, persistence);
}

export function mergePersonnel(previous: Record<string, PersonnelRoster>, incoming: PersonnelRoster[], snapshot = false) {
  const next = snapshot ? {} as Record<string, PersonnelRoster> : { ...previous };
  for (const roster of incoming) {
    const known = previous[roster.tournamentId];
    next[roster.tournamentId] = known && known.revision > roster.revision ? known : roster;
  }
  return next;
}

/** Only the protected roster can supply personnel; never use stale public JSON as a fallback. */
export function withPersonnel(tournament: Tournament, roster?: PersonnelRoster): Tournament {
  const active = roster?.entries.filter((row) => !row.archivedAt) ?? [];
  return { ...tournament,
    dealers: active.filter((row) => row.kind === 'dealer').map((row) => row.data),
    staff: active.filter((row) => row.kind === 'staff').map((row) => row.data as TournamentStaffMember),
  };
}
