import {
  AUTO_ACHIEVEMENT_ID_SET,
  type AchievementProgress,
} from '../data/achievements';
import { bubblePlace, finalTableSize } from '../data/prizeStructure';
import { guestUsersFromTournaments } from './guestPlayer';
import {
  collectPlayerGameHistory,
  type PlayerGameHistoryRow,
} from './playerAnalytics';
import { clubUserIdSet } from './clubRating';
import type { MappedUser } from './supabaseMap';
import type { Tournament } from '../types/tournament';
import type { AchievementProgressMap } from './achievementsApi';

function monthKey(startDate: string): string {
  const key = startDate.trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : '';
}

function closedMonthKeys(tournaments: Tournament[]): string[] {
  const keys = new Set<string>();
  for (const tournament of tournaments) {
    if (tournament.isClosed !== true) continue;
    const key = monthKey(tournament.startDate);
    if (key) keys.add(key);
  }
  return [...keys];
}

function rosterForAuto(
  tournaments: Tournament[],
  clubUsers: MappedUser[],
): MappedUser[] {
  const knownIds = clubUserIdSet(clubUsers);
  const guests = guestUsersFromTournaments(tournaments).filter((guest) => !knownIds.has(guest.id));
  return [...clubUsers, ...guests];
}

function historyInMonth(rows: PlayerGameHistoryRow[], ym: string): PlayerGameHistoryRow[] {
  return rows.filter((row) => monthKey(row.startDate) === ym);
}

type MonthStat = { points: number; knockouts: number; played: number };

function monthStat(rows: PlayerGameHistoryRow[]): MonthStat {
  return {
    points: rows.reduce((sum, row) => sum + row.ratingAwarded, 0),
    knockouts: rows.reduce((sum, row) => sum + row.knockouts, 0),
    played: rows.length,
  };
}

/**
 * Progress earned from closed tournaments for the auto-calculated badges.
 * Manual-only badges (ruby hands, Karen, friend, …) are omitted.
 */
export function computeAutoAchievementProgress(
  userId: string,
  tournaments: Tournament[],
  clubUsers: MappedUser[],
): AchievementProgressMap {
  const id = userId.trim();
  if (!id) return {};

  const history = collectPlayerGameHistory(tournaments, [id]);
  const games = history.length;
  const auto: AchievementProgressMap = {
    fish: { progress: Math.min(10, games) },
    crucian: { progress: Math.min(25, games) },
    shark: { progress: Math.min(50, games) },
    megalodon: { progress: Math.min(100, games) },
    welcome: { completed: games >= 1 },
    winner: { completed: history.some((row) => row.place === 1) },
    paparazzi: { completed: history.some((row) => row.place != null && row.place <= 3) },
    finalist: {
      completed: history.some(
        (row) => row.place != null && row.place <= finalTableSize(row.field),
      ),
    },
    bubble: {
      completed: history.some(
        (row) => row.place != null && row.field > 0 && row.place === bubblePlace(row.field),
      ),
    },
    headhunter: {
      progress: Math.min(10, history.reduce((best, row) => Math.max(best, row.knockouts), 0)),
    },
  };

  const months = closedMonthKeys(tournaments);
  const histories = new Map<string, PlayerGameHistoryRow[]>();
  for (const user of rosterForAuto(tournaments, clubUsers)) {
    histories.set(user.id, collectPlayerGameHistory(tournaments, [user.id]));
  }

  let best = false;
  let bountyKing = false;
  let resident = false;
  let maxMonthKnockouts = 0;

  for (const ym of months) {
    const stats = [...histories.entries()].map(([playerId, rows]) => ({
      id: playerId,
      ...monthStat(historyInMonth(rows, ym)),
    }));
    const self = stats.find((row) => row.id === id) ?? { id, points: 0, knockouts: 0, played: 0 };
    maxMonthKnockouts = Math.max(maxMonthKnockouts, self.knockouts);

    const maxPoints = Math.max(0, ...stats.map((row) => row.points));
    const maxKos = Math.max(0, ...stats.map((row) => row.knockouts));
    const maxPlayed = Math.max(0, ...stats.map((row) => row.played));
    if (maxPoints > 0 && self.points === maxPoints) best = true;
    if (maxKos > 0 && self.knockouts === maxKos) bountyKing = true;
    if (maxPlayed > 0 && self.played === maxPlayed) resident = true;
  }

  auto['the-best'] = { completed: best };
  auto['bounty-king'] = { completed: bountyKing };
  auto.resident = { completed: resident };
  auto.predator = { progress: Math.min(25, maxMonthKnockouts) };
  return auto;
}

/** Auto is a floor: a larger admin grant stays, a smaller one cannot hide earned progress. */
export function mergeAutoAndSavedProgress(
  saved: AchievementProgressMap,
  auto: AchievementProgressMap,
): AchievementProgressMap {
  const merged: AchievementProgressMap = { ...saved };
  for (const [id, earned] of Object.entries(auto)) {
    if (!AUTO_ACHIEVEMENT_ID_SET.has(id)) continue;
    const previous: AchievementProgress = saved[id] ?? {};
    if (earned.progress !== undefined) {
      merged[id] = { progress: Math.max(previous.progress ?? 0, earned.progress) };
      continue;
    }
    merged[id] = { completed: previous.completed === true || earned.completed === true };
  }
  return merged;
}
