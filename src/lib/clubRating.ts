import type { Participant, Tournament } from '../types/tournament';
import type { RatingPlayer } from '../types/player';
import type { MappedUser } from './supabaseMap';
import { sanitizeParticipantUserId } from './supabaseMap';
import { collectPlayerGameHistory } from './playerAnalytics';

export function clubUserIdSet(users: { id: string }[]): Set<string> {
  return new Set(users.map((user) => user.id).filter(Boolean));
}

/** Seat belongs to someone who exists in `users` (admin → Пользователи). */
export function isRegisteredClubSeat(player: Participant, knownIds: Set<string>): boolean {
  const uid = sanitizeParticipantUserId(player.userId ?? player.id);
  return Boolean(uid && knownIds.has(uid));
}

/** Club accounts seated in this event — skips leftover guests / copied mock seats. */
export function registeredClubSeats(
  participants: Participant[],
  knownIds: Set<string>,
): Participant[] {
  return participants.filter((player) => isRegisteredClubSeat(player, knownIds));
}

export function countRegisteredClubSeats(
  participants: Participant[],
  knownIds: Set<string>,
): number {
  return registeredClubSeats(participants, knownIds).length;
}

function initialFrom(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : '?';
}

export function ratingPlayerFromUser(
  user: MappedUser,
  tournaments: Tournament[],
  month?: number,
): RatingPlayer {
  let history = collectPlayerGameHistory(tournaments, [user.id], user.nickname);
  if (month != null) {
    history = history.filter((row) => {
      const day = new Date(`${row.startDate}T12:00:00`);
      return !Number.isNaN(day.getTime()) && day.getMonth() === month;
    });
  }
  return {
    id: user.id,
    nickname: user.nickname,
    initial: initialFrom(user.nickname),
    points: history.reduce((sum, row) => sum + row.ratingAwarded, 0),
    played: history.length,
    won: history.filter((row) => row.place === 1).length,
    knockouts: history.reduce((sum, row) => sum + row.knockouts, 0),
  };
}

/** Same people as admin Users, ranked by results in closed events. */
export function clubRatingPlayers(
  users: MappedUser[],
  tournaments: Tournament[],
  month?: number,
): RatingPlayer[] {
  return users
    .map((user) => ratingPlayerFromUser(user, tournaments, month))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.played - a.played ||
        a.nickname.localeCompare(b.nickname, 'ru'),
    );
}

/** Season totals from closed events, keyed by `users.id`. */
export function seasonPointsByUserId(
  users: MappedUser[],
  tournaments: Tournament[],
): Map<string, number> {
  return new Map(clubRatingPlayers(users, tournaments).map((row) => [row.id, row.points]));
}

/** Replace a seat's stored snapshot with live club season points when the player is a club user. */
export function withClubSeasonRating(
  player: Participant,
  pointsById: Map<string, number>,
): Participant {
  const uid = sanitizeParticipantUserId(player.userId ?? player.id);
  if (!uid) return player;
  const points = pointsById.get(uid);
  if (points == null || points === player.rating) return player;
  return { ...player, rating: points };
}
