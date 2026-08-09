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
