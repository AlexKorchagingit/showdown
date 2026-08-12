import type { Participant } from '../types/tournament';
import { DEFAULT_PAYOUTS } from './blindStructures';

/** Rating points awarded for a finishing place, scaled to the tournament guarantee. */
export function ratingPointsForPlace(place: number, guarantee: number): number {
  const payout = DEFAULT_PAYOUTS.find((p) => p.place === place);
  if (!payout || guarantee <= 0) return 0;
  return Math.round((guarantee * payout.share) / 100);
}

export function payoutShareForPlace(place: number): number | null {
  return DEFAULT_PAYOUTS.find((p) => p.place === place)?.share ?? null;
}

/** Assign or clear a finishing place and keep season rating in sync with the prize grid. */
export function applyPlaceToParticipant(
  participant: Participant,
  newPlace: number | undefined,
  guarantee: number,
): Participant {
  const oldPts =
    typeof participant.place === 'number' ? ratingPointsForPlace(participant.place, guarantee) : 0;
  const newPts = typeof newPlace === 'number' ? ratingPointsForPlace(newPlace, guarantee) : 0;
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
): Participant[] {
  const a = participants.find((p) => p.id === idA);
  const b = participants.find((p) => p.id === idB);
  if (!a || !b) return participants;
  const placeA = a.place;
  const placeB = b.place;
  return participants.map((p) => {
    if (p.id === idA) return applyPlaceToParticipant(p, placeB, guarantee);
    if (p.id === idB) return applyPlaceToParticipant(p, placeA, guarantee);
    return p;
  });
}
