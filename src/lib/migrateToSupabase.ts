import { ALL_PARTICIPANTS } from '../data/participants';
import { mockUsers } from '../data/mockUsers';
import type { Participant, Tournament } from '../types/tournament';
import { supabase } from './supabase';
import {
  participantToRow,
  tournamentToRow,
  userToRow,
  type ParticipantRow,
  type TournamentRow,
  type UserRow,
} from './supabaseMap';
import { loadUserData, listStoredUsers, STARTING_COINS } from './userStorage';

const CHUNK = 80;
const CURRENT_PLAYER_ID = 'me';

export type MigrationReport = {
  users: number;
  tournaments: number;
  participants: number;
  error?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function syntheticEmail(playerId: string): string {
  return `player-${playerId}@showdown.local`;
}

function userIdForEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const mock = mockUsers.find((user) => normalizeEmail(user.email) === normalized);
  return mock?.id ?? `u-${normalized}`;
}

type DraftUser = {
  id: string;
  email: string;
  nickname: string;
  isAdmin?: boolean;
  coins?: number;
  agreementsAcceptedAt?: string;
  birthDate?: string;
  slogan?: string;
  ownedItems?: string[];
  equippedChar?: string;
  equippedBg?: string;
};

function mergeUser(into: DraftUser, patch: DraftUser): DraftUser {
  return {
    ...into,
    ...patch,
    id: into.id,
    email: into.email,
    nickname: patch.nickname || into.nickname,
    isAdmin: patch.isAdmin ?? into.isAdmin,
    coins: patch.coins ?? into.coins,
    agreementsAcceptedAt: patch.agreementsAcceptedAt || into.agreementsAcceptedAt,
    ownedItems: patch.ownedItems?.length ? patch.ownedItems : into.ownedItems,
  };
}

function collectUsers(tournaments: Tournament[], currentEmail: string): DraftUser[] {
  const byId = new Map<string, DraftUser>();
  const emailToId = new Map<string, string>();

  const add = (draft: DraftUser) => {
    const email = normalizeEmail(draft.email);
    const existingId = emailToId.get(email);
    const id = existingId ?? draft.id;
    emailToId.set(email, id);
    const next = { ...draft, id, email };
    const prev = byId.get(id);
    byId.set(id, prev ? mergeUser(prev, next) : next);
  };

  for (const user of mockUsers) {
    const saved = loadUserData(user.email);
    add({
      id: user.id,
      email: user.email,
      nickname: saved.nickname || user.nickname,
      isAdmin: user.isAdmin,
      coins: saved.coins ?? user.coins ?? STARTING_COINS,
      agreementsAcceptedAt: saved.agreementsAcceptedAt,
      birthDate: saved.birthDate,
      slogan: saved.slogan,
      ownedItems: saved.ownedItems,
      equippedChar: saved.equippedChar,
      equippedBg: saved.equippedBg,
    });
  }

  for (const { email, data } of listStoredUsers()) {
    add({
      id: userIdForEmail(email),
      email,
      nickname: data.nickname,
      coins: data.coins,
      agreementsAcceptedAt: data.agreementsAcceptedAt,
      birthDate: data.birthDate,
      slogan: data.slogan,
      ownedItems: data.ownedItems,
      equippedChar: data.equippedChar,
      equippedBg: data.equippedBg,
    });
  }

  if (currentEmail.trim()) {
    const saved = loadUserData(currentEmail);
    add({
      id: userIdForEmail(currentEmail),
      email: currentEmail,
      nickname: saved.nickname,
      coins: saved.coins,
      agreementsAcceptedAt: saved.agreementsAcceptedAt,
      birthDate: saved.birthDate,
      slogan: saved.slogan,
      ownedItems: saved.ownedItems,
      equippedChar: saved.equippedChar,
      equippedBg: saved.equippedBg,
    });
  }

  for (const player of ALL_PARTICIPANTS) {
    if (byId.has(player.id)) continue;
    add({
      id: player.id,
      email: syntheticEmail(player.id),
      nickname: player.nickname,
      coins: STARTING_COINS,
    });
  }

  for (const tournament of tournaments) {
    for (const player of tournament.participants) {
      if (player.id === CURRENT_PLAYER_ID) continue;
      if (byId.has(player.id) || emailToId.has(normalizeEmail(syntheticEmail(player.id)))) continue;
      add({
        id: player.id,
        email: syntheticEmail(player.id),
        nickname: player.nickname,
        coins: STARTING_COINS,
      });
    }
  }

  return [...byId.values()];
}

function resolvePlayerUserId(
  player: Participant,
  currentUserId: string | null,
  userIds: Set<string>,
): string | null {
  if (player.id === CURRENT_PLAYER_ID) return currentUserId;
  if (userIds.has(player.id)) return player.id;
  return null;
}

async function upsertChunk(
  table: 'users' | 'tournaments' | 'participants',
  rows: object[],
  onConflict: string,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
    }
  }
}

/** Push mock + localStorage club data into Supabase. Safe to run more than once (upsert). */
export async function migrateClubDataToSupabase(options: {
  tournaments: Tournament[];
  currentEmail: string;
}): Promise<MigrationReport> {
  try {
    const drafts = collectUsers(options.tournaments, options.currentEmail);
    const currentUserId = options.currentEmail.trim()
      ? userIdForEmail(options.currentEmail)
      : null;
    const userIds = new Set(drafts.map((user) => user.id));

    const userRows: UserRow[] = drafts.map((user) => userToRow(user));
    const tournamentRows: TournamentRow[] = options.tournaments.map(tournamentToRow);
    const participantRows: ParticipantRow[] = [];

    for (const tournament of options.tournaments) {
      const seenUsers = new Set<string>();
      for (const player of tournament.participants) {
        const userId = resolvePlayerUserId(player, currentUserId, userIds);
        if (userId && seenUsers.has(userId)) continue;
        if (userId) seenUsers.add(userId);
        participantRows.push(participantToRow(tournament.id, player, userId));
      }
    }

    await upsertChunk('users', userRows, 'id');
    await upsertChunk('tournaments', tournamentRows, 'id');
    await upsertChunk('participants', participantRows, 'id');

    return {
      users: userRows.length,
      tournaments: tournamentRows.length,
      participants: participantRows.length,
    };
  } catch (error) {
    return {
      users: 0,
      tournaments: 0,
      participants: 0,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка миграции',
    };
  }
}
