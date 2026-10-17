import type { Participant } from '../types/tournament';

/** FINAL OF SEPTEMBER, 17 Oct 2026. Seating is not used by any other event. */
export const FINAL_DRAW_EVENT_ID = 't-21b2bdbf-3744-4db7-810c-dca678462101';

export const FINAL_DRAW_TABLES = 3;
export const FINAL_DRAW_SEATS_PER_TABLE = 9;
export const FINAL_DRAW_BOXES = FINAL_DRAW_TABLES * FINAL_DRAW_SEATS_PER_TABLE;

export function isFinalDrawEvent(tournament: { id?: string } | null | undefined): boolean {
  return tournament?.id === FINAL_DRAW_EVENT_ID;
}

/** Box 1–9 are table 1, 10–18 table 2, 19–27 table 3. Seats on a table are 1–9. */
export function finalDrawSeat(box: number | null | undefined): { table: number; seat: number } | null {
  if (typeof box !== 'number' || !Number.isInteger(box) || box < 1 || box > FINAL_DRAW_BOXES) return null;
  return {
    table: Math.floor((box - 1) / FINAL_DRAW_SEATS_PER_TABLE) + 1,
    seat: ((box - 1) % FINAL_DRAW_SEATS_PER_TABLE) + 1,
  };
}

export function finalDrawBox(table: number, seat: number): number | null {
  if (!Number.isInteger(table) || !Number.isInteger(seat)) return null;
  if (table < 1 || table > FINAL_DRAW_TABLES) return null;
  if (seat < 1 || seat > FINAL_DRAW_SEATS_PER_TABLE) return null;
  return (table - 1) * FINAL_DRAW_SEATS_PER_TABLE + seat;
}

export function finalDrawLabel(box: number | null | undefined): string {
  const place = finalDrawSeat(box);
  if (!place) return '';
  return `Стол ${place.table} · место ${place.seat}`;
}

export function drawBoxFromRow(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > FINAL_DRAW_BOXES) {
    return undefined;
  }
  return value;
}

/** Names already drawn, keyed by box. Unsigned and unseated players are skipped. */
export function finalDrawNames(players: readonly Pick<Participant, 'nickname' | 'drawBox' | 'arrived'>[]): Map<number, string> {
  const names = new Map<number, string>();
  for (const player of players) {
    if (player.arrived !== true) continue;
    const place = finalDrawSeat(player.drawBox);
    if (!place || player.drawBox == null) continue;
    names.set(player.drawBox, player.nickname);
  }
  return names;
}
