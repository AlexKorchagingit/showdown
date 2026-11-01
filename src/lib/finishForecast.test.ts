import { describe, expect, it } from 'vitest';
import type { BlindLevel } from '../data/blindStructures';
import {
  forecastDurationMinutes,
  remainingAfterDurationChange,
  suggestLevelMinutes,
  typicalEndMinutes,
} from './finishForecast';

function level(minutes: number, isBreak = false): BlindLevel {
  return {
    level: isBreak ? 0 : 1,
    smallBlind: isBreak ? 0 : 100,
    bigBlind: isBreak ? 0 : 200,
    ante: isBreak ? 0 : 200,
    durationMinutes: minutes,
    isBreak,
  };
}

describe('finish forecast', () => {
  it('moves the finish later when the field and the rebuys are above the norm', () => {
    const late = { elapsedMinutes: 360 };
    const calm = forecastDurationMinutes({
      series: 'chill', field: 17, rebuys: 12, addons: 2, normPeople: 17, normRebuys: 12, normAddons: 2, ...late,
    });
    const busy = forecastDurationMinutes({
      series: 'chill', field: 33, rebuys: 29, addons: 4, normPeople: 17, normRebuys: 12, normAddons: 2, ...late,
    });
    expect(busy).toBeGreaterThan(calm);
  });

  it('keeps a young night near the usual length instead of reading zero rebuys as a short night', () => {
    const minutes = forecastDurationMinutes({
      series: 'deepstack',
      field: 7,
      rebuys: 0,
      addons: 0,
      normPeople: 20,
      normRebuys: 12,
      normAddons: 0,
      elapsedMinutes: 20,
      playersLeft: 7,
    });
    expect(minutes).toBeGreaterThanOrEqual(6.5 * 60);
    expect(minutes).toBeLessThanOrEqual(7 * 60);
  });

  it('does not turn a few early knockouts into a ten-hour night', () => {
    const minutes = forecastDurationMinutes({
      series: 'deepstack',
      field: 15,
      rebuys: 3,
      addons: 0,
      normPeople: 20,
      normRebuys: 12,
      normAddons: 0,
      elapsedMinutes: 180,
      playersLeft: 12,
    });
    expect(minutes).toBeGreaterThan(5.5 * 60);
    expect(minutes).toBeLessThan(8 * 60);
  });

  it('aims the pace grid at the usual series finish', () => {
    const start = 19 * 60;
    expect(typicalEndMinutes(start, 'bounty')).toBe(start + 408);
    expect(typicalEndMinutes(start, 'chill')).toBe(start + 378);
  });

  it('shortens only future playing levels and reports the earlier finish', () => {
    const levels = [level(20), level(15, true), level(20), level(20)];
    const next = suggestLevelMinutes({
      levels,
      currentIndex: 0,
      remainingForecastMinutes: 120,
      targetRemainingMinutes: 60,
    });
    expect(next[0]).toBe(20);
    expect(next[1]).toBe(15);
    expect(next[2]).toBeLessThan(20);
    expect(next[3]).toBeLessThan(20);
    const left = remainingAfterDurationChange({
      levels,
      currentIndex: 0,
      nextMinutes: next,
      remainingForecastMinutes: 120,
    });
    expect(left).toBeLessThan(120);
  });
});
