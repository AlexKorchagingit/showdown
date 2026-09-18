import type { Participant } from '../types/tournament';

/** Extra season rating awarded per knockout in a bounty tournament. */
export const KNOCKOUT_BOUNTY_POINTS = 100;

export function knockoutBountyPoints(knockouts?: number, isBounty = true): number {
  if (!isBounty) return 0;
  const count = Math.floor(Number(knockouts) || 0);
  return count > 0 ? count * KNOCKOUT_BOUNTY_POINTS : 0;
}

/** Parse the cashier knockout prompt; invalid input becomes 0. */
export function parseKnockoutCount(raw: string): number {
  const count = Math.floor(Number(String(raw).trim().replace(',', '.')));
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export type CalculatedPayout = {
  place: number;
  points: number;
};

/** Share of the field that is in the money, rounded up. */
export const ITM_FIELD_SHARE = 0.35;

export function itmSharePercent(): number {
  return Math.round(ITM_FIELD_SHARE * 100);
}

/** ITM = 35% of the field, rounded up. */
export function itmPlaceCount(totalPlayers: number): number {
  if (totalPlayers <= 0) return 0;
  return Math.ceil(totalPlayers * ITM_FIELD_SHARE);
}

/**
 * Every table must decrease from first place to the last paid one: a later
 * bust-out may never be worth more than an earlier one. Each row sums to 1.
 * Keep these in step with `club_private.tournament_place_points` in Postgres,
 * which awards the same points when a tournament is closed.
 */
const PAYOUT_TEMPLATES: Record<number, number[]> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
  4: [0.42, 0.28, 0.18, 0.12],
  5: [0.38, 0.25, 0.17, 0.12, 0.08],
  6: [0.34, 0.22, 0.15, 0.12, 0.09, 0.08],
  7: [0.32, 0.2, 0.14, 0.11, 0.09, 0.08, 0.06],
  8: [0.29, 0.18, 0.13, 0.1, 0.09, 0.08, 0.07, 0.06],
  9: [0.28, 0.19, 0.13, 0.1, 0.08, 0.07, 0.06, 0.05, 0.04],
  10: [0.27, 0.18, 0.125, 0.095, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03],
  11: [0.26, 0.175, 0.12, 0.095, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02],
  12: [0.25, 0.17, 0.115, 0.09, 0.075, 0.065, 0.055, 0.05, 0.04, 0.035, 0.03, 0.025],
};

/** Fields deep enough for a thirteenth paid place extend the last row. */
const DEEPEST_TEMPLATE = PAYOUT_TEMPLATES[12];
/** Each place past the deepest row keeps this much of the previous share. */
const TAIL_NUMERATOR = 85;
const TAIL_DENOMINATOR = 100;
/** Shares are kept in millionths, the scale Postgres rounds the tail to. */
const SHARE_UNIT = 1_000_000;

/** Half away from zero on an exact ratio, the way `round()` works on numeric. */
function divRound(numerator: number, denominator: number): number {
  const whole = Math.floor(numerator / denominator);
  const remainder = numerator - whole * denominator;
  return remainder * 2 >= denominator ? whole + 1 : whole;
}

function sharesForPlaces(placeCount: number): number[] {
  if (placeCount <= 0) return [];
  const template = PAYOUT_TEMPLATES[placeCount] ?? DEEPEST_TEMPLATE;
  const shares = template.map((share) => Math.round(share * SHARE_UNIT));

  while (shares.length < placeCount) {
    shares.push(divRound(shares[shares.length - 1] * TAIL_NUMERATOR, TAIL_DENOMINATOR));
  }
  return shares;
}

/**
 * 35% ITM points table. Shares are normalised to the guarantee and rounded to
 * whole points; first place absorbs the leftover so the pool is conserved.
 */
export function calculatePayouts(totalPlayers: number, guarantee: number): CalculatedPayout[] {
  const places = itmPlaceCount(totalPlayers);
  const pool = Math.round(guarantee);
  if (places === 0 || pool <= 0) return [];

  const shares = sharesForPlaces(places);
  const shareSum = shares.reduce((total, share) => total + share, 0);
  if (shareSum <= 0) return [];

  const rows = shares.map((share, index) => ({
    place: index + 1,
    points: divRound(pool * share, shareSum),
  }));

  const diff = pool - rows.reduce((total, row) => total + row.points, 0);
  if (diff !== 0) {
    rows[0] = { ...rows[0], points: Math.max(0, rows[0].points + diff) };
  }
  return rows;
}

/** Rating points awarded for a finishing place from the 35% ITM table. */
export function ratingPointsForPlace(
  place: number,
  guarantee: number,
  totalPlayers: number,
): number {
  if (place < 1 || guarantee <= 0 || totalPlayers <= 0) return 0;
  return calculatePayouts(totalPlayers, guarantee).find((row) => row.place === place)?.points ?? 0;
}

/** Assign or clear a finishing place and keep season rating in sync with the prize grid. */
export function applyPlaceToParticipant(
  participant: Participant,
  newPlace: number | undefined,
  guarantee: number,
  totalPlayers: number,
): Participant {
  const oldPts =
    typeof participant.place === 'number'
      ? ratingPointsForPlace(participant.place, guarantee, totalPlayers)
      : 0;
  const newPts =
    typeof newPlace === 'number' ? ratingPointsForPlace(newPlace, guarantee, totalPlayers) : 0;
  return {
    ...participant,
    place: newPlace,
    rating: participant.rating - oldPts + newPts,
    arrived: typeof newPlace === 'number' && newPlace >= 1 ? true : participant.arrived,
  };
}

export function swapParticipantPlaces(
  participants: Participant[],
  idA: string,
  idB: string,
  guarantee: number,
  syncRating = false,
): Participant[] {
  const a = participants.find((p) => p.id === idA);
  const b = participants.find((p) => p.id === idB);
  if (!a || !b) return participants;
  const placeA = a.place;
  const placeB = b.place;
  const totalPlayers = participants.length;
  return participants.map((p) => {
    if (p.id === idA) {
      return syncRating
        ? applyPlaceToParticipant(p, placeB, guarantee, totalPlayers)
        : { ...p, place: placeB };
    }
    if (p.id === idB) {
      return syncRating
        ? applyPlaceToParticipant(p, placeA, guarantee, totalPlayers)
        : { ...p, place: placeA };
    }
    return p;
  });
}

/** Add calculated ITM points (and bounty knockouts) onto season ratings. */
export function awardCalculatedPayouts(
  participants: Participant[],
  guarantee: number,
  isBounty = false,
): Participant[] {
  const totalPlayers = participants.length;
  return participants.map((participant) => {
    if (typeof participant.place !== 'number') return participant;
    const points = ratingPointsForPlace(participant.place, guarantee, totalPlayers);
    const bounty = knockoutBountyPoints(participant.knockouts, isBounty);
    if (points === 0 && bounty === 0) return participant;
    return { ...participant, rating: participant.rating + points + bounty };
  });
}

/** Remaining player becomes 1st, then ITM + knockout points are awarded. */
export function closeTournamentWithPayouts(
  participants: Participant[],
  guarantee: number,
  isBounty = false,
): Participant[] {
  const leftover = participants.filter((p) => typeof p.place !== 'number');
  const withWinner =
    leftover.length === 1
      ? participants.map((p) => (p.id === leftover[0].id ? { ...p, place: 1 } : p))
      : participants;
  return awardCalculatedPayouts(withWinner, guarantee, isBounty);
}
