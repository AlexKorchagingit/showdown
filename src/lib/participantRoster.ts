import type { Participant } from '../types/tournament';
import { sanitizeParticipantUserId, unwrapParticipantSeatKey } from './supabaseMap';

/** Stable identity for a seat across `users.id` vs `guest-…` vs prefixed PKs. */
export function rosterSeatKey(
  player: Pick<Participant, 'id' | 'userId'>,
  tournamentId = '',
): string {
  const bound =
    sanitizeParticipantUserId(player.userId ?? '') ?? sanitizeParticipantUserId(player.id);
  if (bound) return `u:${bound}`;
  return `s:${unwrapParticipantSeatKey(tournamentId, player.id)}`;
}

function hasPlace(player: Participant): boolean {
  return typeof player.place === 'number' && player.place >= 1;
}

function indexByKey(players: readonly Participant[], tournamentId: string): Map<string, Participant> {
  const map = new Map<string, Participant>();
  for (const player of players) {
    const key = rosterSeatKey(player, tournamentId);
    if (!map.has(key)) map.set(key, player);
  }
  return map;
}

function withoutPlace(player: Participant): Participant {
  const next = { ...player };
  delete next.place;
  return next;
}

/**
 * Apply a UI roster edit on top of the live server list.
 *
 * The cashier replaces the whole field in one RPC. If the screen is stale,
 * sending `next` as-is deletes players another tab added, clears arrivals, and
 * wipes bust-out places. Rebase keeps server seats the UI did not touch.
 */
export function rebaseParticipantRoster(
  tournamentId: string,
  previous: readonly Participant[],
  next: readonly Participant[],
  baseline: readonly Participant[],
): Participant[] {
  const prevByKey = indexByKey(previous, tournamentId);
  const nextByKey = indexByKey(next, tournamentId);
  const prevKeys = new Set(prevByKey.keys());
  const nextKeys = new Set(nextByKey.keys());

  const kept = baseline.filter((player) => {
    const key = rosterSeatKey(player, tournamentId);
    if (!prevKeys.has(key)) return true;
    return nextKeys.has(key);
  });
  const keptKeys = new Set(kept.map((player) => rosterSeatKey(player, tournamentId)));

  const lostPlaceKeys: string[] = [];
  const gainedPlaceKeys: string[] = [];
  const swappedPlaceKeys: string[] = [];
  for (const [key, edited] of nextByKey) {
    const prior = prevByKey.get(key);
    if (!prior) continue;
    const wasPlaced = hasPlace(prior);
    const nowPlaced = hasPlace(edited);
    if (wasPlaced && !nowPlaced) lostPlaceKeys.push(key);
    else if (!wasPlaced && nowPlaced) gainedPlaceKeys.push(key);
    else if ((prior.place ?? null) !== (edited.place ?? null)) swappedPlaceKeys.push(key);
  }
  const applySwap =
    lostPlaceKeys.length === 0 && gainedPlaceKeys.length === 0 && swappedPlaceKeys.length === 2;

  const merged = kept.map((serverPlayer) => {
    const key = rosterSeatKey(serverPlayer, tournamentId);
    const edited = nextByKey.get(key);
    const prior = prevByKey.get(key);
    if (!edited || !prior) return serverPlayer;

    let row: Participant = { ...serverPlayer };
    if (edited.nickname !== prior.nickname) row = { ...row, nickname: edited.nickname };
    if ((edited.comment ?? '') !== (prior.comment ?? '')) row = { ...row, comment: edited.comment };
    if ((edited.knockouts ?? 0) !== (prior.knockouts ?? 0)) {
      row = { ...row, knockouts: edited.knockouts };
    }
    if ((edited.arrived === true) !== (prior.arrived === true)) {
      row = { ...row, arrived: edited.arrived };
    }
    if ((edited.teamPartnerId ?? '') !== (prior.teamPartnerId ?? '')) {
      row = { ...row, teamPartnerId: edited.teamPartnerId };
    }
    if ((edited.userId ?? '') !== (prior.userId ?? '')) {
      row = { ...row, userId: edited.userId, id: edited.id };
    } else if (edited.id !== prior.id) {
      row = { ...row, id: edited.id };
    }

    if (lostPlaceKeys.includes(key)) return withoutPlace(row);
    if (gainedPlaceKeys.includes(key)) {
      return {
        ...row,
        place: edited.place,
        knockouts: edited.knockouts ?? row.knockouts,
        arrived: true,
      };
    }
    if (applySwap && swappedPlaceKeys.includes(key)) return { ...row, place: edited.place };
    return row;
  });

  const added = next.filter((player) => {
    const key = rosterSeatKey(player, tournamentId);
    return !prevKeys.has(key) && !keptKeys.has(key);
  });

  return [...merged, ...added];
}

export function findRosterSeat(
  players: readonly Participant[],
  player: Pick<Participant, 'id' | 'userId'>,
  tournamentId = '',
): Participant | undefined {
  const key = rosterSeatKey(player, tournamentId);
  return players.find((candidate) => rosterSeatKey(candidate, tournamentId) === key);
}
