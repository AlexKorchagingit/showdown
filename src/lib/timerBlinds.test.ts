import { describe, expect, it } from 'vitest';
import type { BlindLevel } from '../data/blindStructures';
import { effectiveBigBlind, formatBigBlinds, stackInBigBlinds } from './timerBlinds';

function level(bigBlind: number, patch: Partial<BlindLevel> = {}): BlindLevel {
  return {
    level: 1,
    smallBlind: bigBlind / 2,
    bigBlind,
    ante: bigBlind,
    durationMinutes: 20,
    ...patch,
  };
}

describe('average stack in big blinds', () => {
  const levels = [
    level(200),
    level(400),
    level(400, { isBreak: true, level: 0 }),
    level(800),
  ];

  it('uses the big blind of the level being played', () => {
    expect(effectiveBigBlind(levels, 0)).toBe(200);
    expect(effectiveBigBlind(levels, 1)).toBe(400);
  });

  it('looks at the level after a break, not at the break row', () => {
    expect(effectiveBigBlind(levels, 2)).toBe(800);
  });

  it('falls back to the level before a closing break and to nothing without levels', () => {
    expect(effectiveBigBlind([level(300), level(300, { isBreak: true, level: 0 })], 1)).toBe(300);
    expect(effectiveBigBlind(undefined, 0)).toBeNull();
    expect(effectiveBigBlind(levels, 9)).toBeNull();
    expect(effectiveBigBlind([level(0)], 0)).toBeNull();
  });

  it('divides the stack by the big blind and hides impossible values', () => {
    expect(stackInBigBlinds(50_000, 400)).toBe(125);
    expect(stackInBigBlinds(0, 400)).toBeNull();
    expect(stackInBigBlinds(50_000, null)).toBeNull();
    expect(stackInBigBlinds(50_000, 0)).toBeNull();
  });

  it('prints whole numbers, and one decimal under ten', () => {
    expect(formatBigBlinds(125.4)).toBe('125 BB');
    expect(formatBigBlinds(1234.6)).toMatch(/^1\s?235 BB$/);
    expect(formatBigBlinds(7.46)).toBe('7,5 BB');
    expect(formatBigBlinds(9.96)).toBe('10 BB');
  });
});
