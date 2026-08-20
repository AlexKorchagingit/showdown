import type { ActionLog } from '../types/auditLog';
import type { Transaction, TransactionStatus, TransactionType } from '../types/finance';
import type { Participant, Tournament, TournamentDealer, TournamentStaffMember } from '../types/tournament';
import type { PendingNotification, UserData } from './userStorage';
import { avatarUrlForChar, DEFAULT_BG_ID, DEFAULT_CHARACTER_ID } from '../data/shopItems';

/** Postgres `users` row. */
export type UserRow = {
  id: string;
  email: string;
  nickname: string;
  is_admin: boolean;
  ruby_balance: number;
  agreements_accepted_at: string | null;
  birth_date: string;
  slogan: string;
  owned_items: string[];
  equipped_char: string;
  equipped_bg: string;
  equipped_avatar: string[];
  pending_notifications: PendingNotification[];
};

/** Postgres `tournaments` row (participants live in their own table). */
export type TournamentRow = {
  id: string;
  title: string;
  image_url: string;
  address: string;
  start_date: string;
  start_time: string;
  total_seats: number;
  guarantee: number;
  about: string;
  features: string[];
  late_reg_until: string;
  blind_structure: string;
  blind_structure_id: string | null;
  stack_size: number;
  level_duration: string;
  is_closed: boolean;
  is_bounty: boolean;
  results_entered: boolean;
  rubies_distributed: boolean;
  admin_secret_comment: string | null;
  staff: TournamentStaffMember[];
  dealers: TournamentDealer[];
};

/** Postgres `participants` row. */
export type ParticipantRow = {
  id: string;
  tournament_id: string;
  user_id: string | null;
  nickname: string;
  rating: number;
  place: number | null;
  knockouts: number;
  rubies_awarded: number | null;
  comment: string | null;
};

/** Postgres `transactions` row. */
export type TransactionRow = {
  id: string;
  date: string;
  tournament_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  comment: string;
  is_dealer: boolean;
  dealer_hours: number;
  updated_at: string | null;
};

/** Postgres `logs` row. */
export type LogRow = {
  id: string;
  timestamp: string;
  admin_id: string | null;
  admin_email: string;
  admin_name: string;
  action_type: string;
  target_user_id: string | null;
  target_user_email: string | null;
  target_user_name: string | null;
  target_tournament_id: string | null;
  target_tournament_name: string | null;
  details: string | null;
};

/** Club account as the UI already expects it (camelCase + UserData fields). */
export type MappedUser = UserData & {
  id: string;
  email: string;
  isAdmin: boolean;
  rubyBalance: number;
  equippedAvatar: string;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asIso(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

function asNotifications(value: unknown): PendingNotification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<PendingNotification>;
    const amount = Number(row.amount);
    if (typeof row.id !== 'string' || typeof row.message !== 'string') return [];
    if (!Number.isFinite(amount) || amount === 0) return [];
    return [{ id: row.id, message: row.message, amount }];
  });
}

export function equippedAvatarFromRow(row: Pick<UserRow, 'equipped_char' | 'equipped_avatar'>): string {
  const first = row.equipped_avatar?.[0];
  if (first && (first.startsWith('http') || first.startsWith('/') || first.includes('/avatars/'))) {
    return first;
  }
  return avatarUrlForChar(row.equipped_char || first || DEFAULT_CHARACTER_ID);
}

export function userToRow(user: {
  id: string;
  email: string;
  nickname: string;
  isAdmin?: boolean;
  coins?: number;
  rubyBalance?: number;
  agreementsAcceptedAt?: string;
  birthDate?: string;
  slogan?: string;
  ownedItems?: string[];
  equippedChar?: string;
  equippedBg?: string;
  equippedAvatar?: string | string[];
  pendingNotifications?: PendingNotification[];
}): UserRow {
  const equippedChar = user.equippedChar || DEFAULT_CHARACTER_ID;
  const equippedBg = user.equippedBg || DEFAULT_BG_ID;
  const avatarList = Array.isArray(user.equippedAvatar)
    ? user.equippedAvatar
    : [user.equippedAvatar || avatarUrlForChar(equippedChar), equippedChar, equippedBg].filter(
        (item): item is string => Boolean(item),
      );

  return {
    id: user.id,
    email: user.email.trim().toLowerCase(),
    nickname: user.nickname,
    is_admin: user.isAdmin === true,
    ruby_balance: Math.max(0, Math.trunc(user.rubyBalance ?? user.coins ?? 1500)),
    agreements_accepted_at: asIso(user.agreementsAcceptedAt) ?? null,
    birth_date: user.birthDate ?? '',
    slogan: user.slogan ?? '',
    owned_items: user.ownedItems?.length ? [...user.ownedItems] : [DEFAULT_CHARACTER_ID, DEFAULT_BG_ID],
    equipped_char: equippedChar,
    equipped_bg: equippedBg,
    equipped_avatar: avatarList,
    pending_notifications: user.pendingNotifications ?? [],
  };
}

export function userFromRow(row: UserRow): MappedUser {
  const coins = asNumber(row.ruby_balance, 1500);
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    isAdmin: asBoolean(row.is_admin),
    rubyBalance: coins,
    coins,
    birthDate: asString(row.birth_date),
    slogan: asString(row.slogan),
    ownedItems: asStringArray(row.owned_items),
    equippedChar: asString(row.equipped_char, DEFAULT_CHARACTER_ID),
    equippedBg: asString(row.equipped_bg, DEFAULT_BG_ID),
    equippedAvatar: equippedAvatarFromRow(row),
    pendingNotifications: asNotifications(row.pending_notifications),
    agreementsAcceptedAt: asIso(row.agreements_accepted_at),
  };
}

export function tournamentToRow(tournament: Tournament): TournamentRow {
  return {
    id: tournament.id,
    title: tournament.title,
    image_url: tournament.imageUrl,
    address: tournament.address,
    start_date: tournament.startDate.slice(0, 10),
    start_time: tournament.startTime,
    total_seats: tournament.totalSeats,
    guarantee: tournament.guarantee,
    about: tournament.about,
    features: [...tournament.features],
    late_reg_until: tournament.lateRegUntil,
    blind_structure: tournament.blindStructure,
    blind_structure_id: tournament.blindStructureId ?? null,
    stack_size: tournament.stackSize,
    level_duration: tournament.levelDuration,
    is_closed: tournament.isClosed === true,
    is_bounty: tournament.isBounty === true,
    results_entered: tournament.resultsEntered === true,
    rubies_distributed: tournament.rubiesDistributed === true,
    admin_secret_comment: tournament.adminSecretComment ?? null,
    staff: tournament.staff ?? [],
    dealers: tournament.dealers ?? [],
  };
}

export function tournamentFromRow(row: TournamentRow, participants: Participant[] = []): Tournament {
  return {
    id: row.id,
    title: row.title,
    imageUrl: asString(row.image_url),
    address: asString(row.address),
    startDate: asString(row.start_date),
    startTime: asString(row.start_time, '19:00'),
    totalSeats: asNumber(row.total_seats, 27),
    guarantee: asNumber(row.guarantee),
    about: asString(row.about),
    features: asStringArray(row.features),
    participants,
    lateRegUntil: asString(row.late_reg_until),
    blindStructure: asString(row.blind_structure),
    blindStructureId: row.blind_structure_id || undefined,
    stackSize: asNumber(row.stack_size, 30000),
    levelDuration: asString(row.level_duration),
    isClosed: asBoolean(row.is_closed),
    isBounty: asBoolean(row.is_bounty) || undefined,
    resultsEntered: asBoolean(row.results_entered) || undefined,
    rubiesDistributed: asBoolean(row.rubies_distributed) || undefined,
    adminSecretComment: row.admin_secret_comment || undefined,
    staff: Array.isArray(row.staff) ? row.staff : undefined,
    dealers: Array.isArray(row.dealers) ? row.dealers : undefined,
  };
}

/** Stable PK: one seated player per event (player ids repeat across tournaments). */
export function participantRowId(tournamentId: string, playerId: string): string {
  return `${tournamentId}:${playerId}`;
}

export function participantToRow(
  tournamentId: string,
  participant: Participant,
  userId: string | null = participant.id,
): ParticipantRow {
  const resolvedUserId = userId && userId !== 'me' ? userId : null;
  return {
    id: participantRowId(tournamentId, resolvedUserId || participant.id),
    tournament_id: tournamentId,
    user_id: resolvedUserId,
    nickname: participant.nickname,
    rating: participant.rating,
    place: typeof participant.place === 'number' ? participant.place : null,
    knockouts: participant.knockouts ?? 0,
    rubies_awarded: typeof participant.rubiesAwarded === 'number' ? participant.rubiesAwarded : null,
    comment: participant.comment ?? null,
  };
}

export function participantFromRow(row: ParticipantRow): Participant {
  return {
    id: row.user_id || row.id,
    nickname: row.nickname,
    rating: asNumber(row.rating),
    place: row.place ?? undefined,
    knockouts: row.knockouts || undefined,
    rubiesAwarded: row.rubies_awarded ?? undefined,
    comment: row.comment || undefined,
  };
}

export function transactionToRow(tx: Transaction): TransactionRow {
  return {
    id: tx.id,
    date: tx.date,
    tournament_id: tx.tournamentId,
    user_id: tx.userId,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    comment: tx.comment,
    is_dealer: tx.isDealer,
    dealer_hours: tx.dealerHours,
    updated_at: tx.updatedAt ?? null,
  };
}

export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: asString(row.date),
    tournamentId: row.tournament_id,
    userId: row.user_id,
    type: row.type,
    amount: asNumber(row.amount),
    status: row.status,
    comment: asString(row.comment),
    isDealer: asBoolean(row.is_dealer),
    dealerHours: asNumber(row.dealer_hours),
    updatedAt: row.updated_at || undefined,
  };
}

function nullableFk(value?: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === 'me') return null;
  return trimmed;
}

export function logToRow(log: ActionLog): LogRow {
  return {
    id: log.id,
    timestamp: new Date(log.timestamp).toISOString(),
    admin_id: nullableFk(log.adminId),
    admin_email: log.adminEmail,
    admin_name: log.adminName,
    action_type: log.actionType,
    target_user_id: nullableFk(log.targetUserId),
    target_user_email: log.targetUserEmail ?? null,
    target_user_name: log.targetUserName ?? null,
    target_tournament_id: nullableFk(log.targetTournamentId),
    target_tournament_name: log.targetTournamentName ?? null,
    details: log.details ?? log.description ?? null,
  };
}

export function logFromRow(row: LogRow): ActionLog {
  const time = Date.parse(row.timestamp);
  return {
    id: row.id,
    timestamp: Number.isNaN(time) ? Date.now() : time,
    adminId: row.admin_id || '',
    adminEmail: row.admin_email,
    adminName: asString(row.admin_name),
    actionType: row.action_type,
    targetUserId: row.target_user_id || undefined,
    targetUserEmail: row.target_user_email || undefined,
    targetUserName: row.target_user_name || undefined,
    targetTournamentId: row.target_tournament_id || undefined,
    targetTournamentName: row.target_tournament_name || undefined,
    details: row.details || undefined,
  };
}

/** Nested `users(...)` payload from a participants JOIN. */
export type JoinedUserPreview = {
  nickname?: string | null;
  rating?: number | null;
  equipped_avatar?: string[] | string | null;
  equipped_char?: string | null;
};

export type JoinedParticipantRow = ParticipantRow & {
  users?: JoinedUserPreview | JoinedUserPreview[] | null;
};

function unwrapJoinedUser(value: JoinedParticipantRow['users']): JoinedUserPreview | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function participantFromJoinedRow(row: JoinedParticipantRow): Participant {
  const base = participantFromRow(row);
  const joined = unwrapJoinedUser(row.users);
  if (!joined) return base;
  const avatarList = Array.isArray(joined.equipped_avatar)
    ? joined.equipped_avatar
    : typeof joined.equipped_avatar === 'string' && joined.equipped_avatar
      ? [joined.equipped_avatar]
      : [];
  const avatarFromJoin =
    avatarList.find(
      (item) => item.startsWith('http') || item.startsWith('/') || item.includes('/avatars/'),
    ) ?? (joined.equipped_char ? avatarUrlForChar(joined.equipped_char) : undefined);
  return {
    ...base,
    nickname: joined.nickname?.trim() || base.nickname,
    rating: typeof joined.rating === 'number' ? joined.rating : base.rating,
    equippedAvatar: avatarFromJoin || base.equippedAvatar,
  };
}

export type JoinedTournamentRow = TournamentRow & {
  participants?: JoinedParticipantRow[] | null;
};

export function tournamentFromJoinedRow(row: JoinedTournamentRow): Tournament {
  const seated = Array.isArray(row.participants) ? row.participants.map(participantFromJoinedRow) : [];
  return tournamentFromRow(row, seated);
}

