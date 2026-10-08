import { isBreakLevel, type BlindLevel } from '../data/blindStructures';

/**
 * Big blind the players are playing with (or about to play with).
 * During a break the next playing level is used; a break at the very end falls back to the one before.
 */
export function effectiveBigBlind(levels: BlindLevel[] | undefined, index: number): number | null {
  if (!levels?.length) return null;
  const current = levels[index];
  if (!current) return null;
  if (!isBreakLevel(current)) return current.bigBlind > 0 ? current.bigBlind : null;
  const upcoming = levels.slice(index + 1).find((row) => !isBreakLevel(row) && row.bigBlind > 0);
  if (upcoming) return upcoming.bigBlind;
  const previous = levels
    .slice(0, index)
    .reverse()
    .find((row) => !isBreakLevel(row) && row.bigBlind > 0);
  return previous ? previous.bigBlind : null;
}

/** Average stack in big blinds, or null when either number is missing. */
export function stackInBigBlinds(stack: number, bigBlind: number | null): number | null {
  if (!Number.isFinite(stack) || stack <= 0) return null;
  if (bigBlind == null || !Number.isFinite(bigBlind) || bigBlind <= 0) return null;
  return stack / bigBlind;
}

/** `125 BB`, and one decimal below ten (`7,5 BB`) where the fraction matters. */
export function formatBigBlinds(count: number): string {
  if (count >= 10) return `${Math.round(count).toLocaleString('ru-RU')} BB`;
  return `${(Math.round(count * 10) / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} BB`;
}
