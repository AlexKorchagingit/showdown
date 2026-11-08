import type { Participant } from '../types/tournament';

/** Finals that draw a random seat on 3 tables when a player is marked arrived. */
export const FINAL_DRAW_EVENT_IDS = [
  't-21b2bdbf-3744-4db7-810c-dca678462101', // FINAL OF SEPTEMBER, 17 Oct 2026
  't-6835c66f-eb54-4a7d-8c0a-25eb44ebae21', // FINAL OF OCTOBER, 8 Nov 2026
] as const;

export const FINAL_DRAW_EVENT_ID = FINAL_DRAW_EVENT_IDS[0];

export const FINAL_DRAW_TABLES = 3;
export const FINAL_DRAW_SEATS_PER_TABLE = 9;
export const FINAL_DRAW_BOXES = FINAL_DRAW_TABLES * FINAL_DRAW_SEATS_PER_TABLE;

export function isFinalDrawEvent(tournament: { id?: string } | null | undefined): boolean {
  return Boolean(tournament?.id && (FINAL_DRAW_EVENT_IDS as readonly string[]).includes(tournament.id));
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

function hasBustOutPlace(place: number | undefined): boolean {
  return typeof place === 'number' && place >= 1;
}

/** Still in the cashier: checked in, and not marked out. */
export function isStillInFinalDraw(player: { arrived?: boolean; place?: number }): boolean {
  return player.arrived === true && !hasBustOutPlace(player.place);
}

/**
 * A fresh random seat for cashier players who are still in.
 * Players already marked out keep their seats. At most the free boxes are used.
 */
export function shuffleFinalDrawBoxes<T extends { id: string; arrived?: boolean; place?: number; drawBox?: number }>(
  players: readonly T[],
  random: () => number = Math.random,
): Map<string, number> {
  const held = new Set(
    players.flatMap((player) => (
      player.arrived === true && hasBustOutPlace(player.place) && typeof player.drawBox === 'number'
        ? [player.drawBox]
        : []
    )),
  );
  const seated = players.filter((player) => isStillInFinalDraw(player));
  const boxes = Array.from({ length: FINAL_DRAW_BOXES }, (_, index) => index + 1)
    .filter((box) => !held.has(box));
  for (let index = boxes.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = boxes[index]!;
    boxes[index] = boxes[swapWith]!;
    boxes[swapWith] = current;
  }
  return new Map(seated.slice(0, boxes.length).map((player, index) => [player.id, boxes[index]!]));
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
