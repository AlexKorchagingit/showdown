import type { Participant } from '../types/tournament';

/** `logs` row used when `participants.arrived` is missing in Postgres. */
export const PARTICIPANT_ARRIVALS_LOG_ID = 'participant-arrivals';
export const PARTICIPANT_ARRIVALS_LOG_ACTION = '__participant_arrivals__';

export type ArrivalSnapshot = {
  v: 1;
  byTournament: Record<string, Record<string, true>>;
};

export function parseArrivalSnapshot(raw: unknown): ArrivalSnapshot | null {
  let value = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as { v?: unknown; byTournament?: unknown };
  if (row.v !== 1 || !row.byTournament || typeof row.byTournament !== 'object') return null;
  const byTournament: Record<string, Record<string, true>> = {};
  for (const [tournamentId, seats] of Object.entries(row.byTournament as Record<string, unknown>)) {
    if (!tournamentId || !seats || typeof seats !== 'object') continue;
    const map: Record<string, true> = {};
    for (const [seatId, flagged] of Object.entries(seats as Record<string, unknown>)) {
      if (seatId && flagged === true) map[seatId] = true;
    }
    byTournament[tournamentId] = map;
  }
  return { v: 1, byTournament };
}

export function arrivalKeys(player: Pick<Participant, 'id' | 'userId'>): string[] {
  const keys = new Set<string>();
  if (player.id) keys.add(player.id);
  if (player.userId) keys.add(player.userId);
  return [...keys];
}

export function overlayHasArrival(
  overlay: ArrivalSnapshot | null | undefined,
  tournamentId: string,
  player: Pick<Participant, 'id' | 'userId'>,
): boolean {
  const checked = overlay?.byTournament[tournamentId];
  if (!checked) return false;
  return arrivalKeys(player).some((key) => checked[key] === true);
}

export function applyArrivalOverlay(
  tournamentId: string,
  players: Participant[],
  overlay: ArrivalSnapshot | null | undefined,
): Participant[] {
  return players.map((player) => ({
    ...player,
    arrived: player.arrived === true || overlayHasArrival(overlay, tournamentId, player),
  }));
}

export function upsertTournamentArrivals(
  overlay: ArrivalSnapshot | null | undefined,
  tournamentId: string,
  players: Array<Pick<Participant, 'id' | 'userId' | 'arrived'>>,
): ArrivalSnapshot {
  const byTournament = { ...overlay?.byTournament };
  const map: Record<string, true> = {};
  for (const player of players) {
    if (player.arrived !== true) continue;
    for (const key of arrivalKeys(player)) map[key] = true;
  }
  byTournament[tournamentId] = map;
  return { v: 1, byTournament };
}
