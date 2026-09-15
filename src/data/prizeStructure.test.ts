import { describe, expect, it } from 'vitest';
import { calculatePayouts, itmPlaceCount, ratingPointsForPlace } from './prizeStructure';

const GUARANTEES = [500, 1000, 3000, 12000, 25000, 100000];

describe('ITM points ladder', () => {
  it('pays the Tuesday freeroll strictly by place', () => {
    // 22 players in the cashier, 12 000 guaranteed points, 8 paid places.
    const payouts = calculatePayouts(22, 12000);

    expect(payouts.map((row) => row.points)).toEqual([
      3360, 2280, 1560, 1200, 1080, 960, 840, 720,
    ]);
    expect(payouts.reduce((total, row) => total + row.points, 0)).toBe(12000);
  });

  it('keeps every place apart on a club-sized field', () => {
    for (let players = 2; players <= 34; players += 1) {
      const points = calculatePayouts(players, 12000).map((row) => row.points);
      for (let index = 1; index < points.length; index += 1) {
        expect(points[index], `${players} игроков: место ${index + 1}`).toBeLessThan(
          points[index - 1],
        );
      }
    }
  });

  it('never pays a later bust-out more than an earlier one', () => {
    for (const guarantee of GUARANTEES) {
      for (let players = 1; players <= 60; players += 1) {
        const points = calculatePayouts(players, guarantee).map((row) => row.points);
        for (let index = 1; index < points.length; index += 1) {
          expect(
            points[index],
            `${players} игроков, гарантия ${guarantee}: место ${index + 1} против ${index}`,
          ).toBeLessThanOrEqual(points[index - 1]);
        }
      }
    }
  });

  it('keeps the whole guarantee inside the paid places', () => {
    for (const guarantee of GUARANTEES) {
      for (let players = 1; players <= 60; players += 1) {
        const payouts = calculatePayouts(players, guarantee);
        expect(payouts).toHaveLength(itmPlaceCount(players));
        expect(payouts.reduce((total, row) => total + row.points, 0)).toBe(guarantee);
        expect(payouts.every((row) => row.points > 0)).toBe(true);
      }
    }
  });

  it('pays nothing outside the money and nothing without a guarantee', () => {
    expect(ratingPointsForPlace(9, 12000, 22)).toBe(0);
    expect(ratingPointsForPlace(1, 0, 22)).toBe(0);
    expect(ratingPointsForPlace(0, 12000, 22)).toBe(0);
    expect(calculatePayouts(0, 12000)).toEqual([]);
  });

  it('awards the same points that the prize grid shows', () => {
    const payouts = calculatePayouts(22, 12000);

    for (const row of payouts) {
      expect(ratingPointsForPlace(row.place, 12000, 22)).toBe(row.points);
    }
  });
});
