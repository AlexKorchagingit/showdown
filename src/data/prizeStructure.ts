import type { Participant } from '../types/tournament';

/** Extra season rating awarded per knockout in a bounty tournament. */
export const KNOCKOUT_BOUNTY_POINTS = 200;

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

/** ITM = 30% of the field, rounded up. */
export function itmPlaceCount(totalPlayers: number): number {
  if (totalPlayers <= 0) return 0;
  return Math.ceil(totalPlayers * 0.3);
}

const PAYOUT_TEMPLATES: Record<number, number[]> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
  4: [0.42, 0.28, 0.18, 0.12],
  5: [0.38, 0.25, 0.17, 0.12, 0.08],
  6: [0.34, 0.22, 0.15, 0.12, 0.09, 0.08],
  7: [0.32, 0.2, 0.14, 0.11, 0.09, 0.07, 0.07],
  8: [0.29, 0.18, 0.13, 0.1, 0.08, 0.07, 0.07, 0.08],
};

const NINE_PLUS_HEAD = [0.27, 0.17, 0.12, 0.1, 0.08, 0.07, 0.06, 0.05, 0.04];

function sharesForPlaces(placeCount: number): number[] {
  if (placeCount <= 0) return [];
  const exact = PAYOUT_TEMPLATES[placeCount];
  if (exact) return [...exact];

  const shares = [...NINE_PLUS_HEAD];
  for (let index = 9; index < placeCount; index += 1) {
    if (index === 9) shares.push(0.04);
    else if (index === 10) shares.push(0.03);
    else shares.push(0.02);
  }
  const sum = shares.reduce((total, share) => total + share, 0);
  if (sum <= 0) return shares;
  return shares.map((share) => share / sum);
}

/**
 * 30% ITM payout table. `points` are `Math.round(guarantee * share)`;
 * first place absorbs leftover rounding so the pool is conserved.
 */
export function calculatePayouts(totalPlayers: number, guarantee: number): CalculatedPayout[] {
  const places = itmPlaceCount(totalPlayers);
  if (places === 0 || guarantee <= 0) return [];

  const shares = sharesForPlaces(places);
  const rows = shares.map((percent, index) => ({
    place: index + 1,
    points: Math.round(guarantee * percent),
  }));

  const diff = Math.round(guarantee) - rows.reduce((total, row) => total + row.points, 0);
  if (rows.length > 0 && diff !== 0) {
    rows[0] = { ...rows[0], points: Math.max(0, rows[0].points + diff) };
  }
  return rows;
}

/** Rating points awarded for a finishing place from the 30% ITM table. */
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
