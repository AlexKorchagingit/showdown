import type { Tournament } from '../types/tournament';
import { guestSeatKey, isUnboundGuestSeat } from './guestPlayer';
import { sanitizeParticipantUserId } from './supabaseMap';

export type GuestNickAppearance = {
  tournamentId: string;
  title: string;
  startDate: string;
  place: number | null;
};

/** A player who was entered as a nickname only and has no account yet. */
export type GuestNick = {
  /** Stable `guest-…` key shared by every tournament this nick sat in. */
  key: string;
  nickname: string;
  /** Newest first. */
  appearances: GuestNickAppearance[];
  lastDate: string;
};

function dayOf(tournament: Pick<Tournament, 'startDate'>): string {
  return (tournament.startDate ?? '').slice(0, 10);
}

/** Every unbound nick across the tournaments that already have their roster loaded. */
export function collectGuestNicks(tournaments: Tournament[]): GuestNick[] {
  const byKey = new Map<string, GuestNick>();
  const ordered = [...tournaments].sort(
    (a, b) => dayOf(b).localeCompare(dayOf(a)) || b.startTime.localeCompare(a.startTime),
  );
  for (const tournament of ordered) {
    for (const player of tournament.participants) {
      if (!isUnboundGuestSeat(player)) continue;
      const key = guestSeatKey(player.id, tournament.id);
      if (!key) continue;
      const appearance: GuestNickAppearance = {
        tournamentId: tournament.id,
        title: tournament.title,
        startDate: dayOf(tournament),
        place: typeof player.place === 'number' && player.place >= 1 ? player.place : null,
      };
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.appearances.some((row) => row.tournamentId === tournament.id)) {
          existing.appearances.push(appearance);
        }
        continue;
      }
      byKey.set(key, {
        key,
        nickname: player.nickname.trim() || key,
        appearances: [appearance],
        lastDate: appearance.startDate,
      });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || a.nickname.localeCompare(b.nickname, 'ru'),
  );
}

/** Tournaments where this account already has its own seat next to the nick. Binding there would double the player. */
export function guestBindConflicts(
  guest: GuestNick,
  userId: string,
  tournaments: Tournament[],
): string[] {
  const wanted = new Set(guest.appearances.map((row) => row.tournamentId));
  const titles: string[] = [];
  for (const tournament of tournaments) {
    if (!wanted.has(tournament.id)) continue;
    const seated = tournament.participants.some(
      (player) => sanitizeParticipantUserId(player.userId ?? player.id) === userId,
    );
    if (seated) titles.push(`${tournament.title} · ${dayOf(tournament)}`);
  }
  return titles;
}
