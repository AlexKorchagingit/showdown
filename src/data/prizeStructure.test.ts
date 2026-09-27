import { describe, expect, it } from 'vitest';
import { calculatePayouts, bubblePlace, finalTableSize, itmPlaceCount } from './prizeStructure';

describe('eight-place rating payouts', () => {
  it('keeps the pool intact and awards eighth place less than seventh', () => {
    const payouts = calculatePayouts(22, 12000);

    expect(payouts).toHaveLength(8);
    expect(payouts[6]?.points).toBe(840);
    expect(payouts[7]?.points).toBe(720);
    expect(payouts.reduce((sum, row) => sum + row.points, 0)).toBe(12000);
    expect(payouts.every((row, index) => index === 0 || row.points <= payouts[index - 1]!.points))
      .toBe(true);
  });
});

describe('closed lobby final table', () => {
  it('is everyone in the money plus the bubble', () => {
    expect(itmPlaceCount(22)).toBe(8);
    expect(bubblePlace(22)).toBe(9);
    expect(finalTableSize(22)).toBe(9);
    expect(itmPlaceCount(23)).toBe(9);
    expect(bubblePlace(23)).toBe(10);
    expect(finalTableSize(23)).toBe(10);
    expect(finalTableSize(0)).toBe(0);
  });

  it('never lists more than ten seats even when ITM plus bubble is larger', () => {
    expect(itmPlaceCount(28)).toBe(10);
    expect(bubblePlace(28)).toBe(11);
    expect(finalTableSize(28)).toBe(10);
    expect(itmPlaceCount(29)).toBe(11);
    expect(bubblePlace(29)).toBe(12);
    expect(finalTableSize(29)).toBe(10);
    expect(finalTableSize(40)).toBe(10);
  });
});
