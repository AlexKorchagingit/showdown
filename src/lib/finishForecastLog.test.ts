import { describe, expect, it } from 'vitest';
import { parseFinishForecasts, shouldRecordForecast } from './finishForecastLog';
import { tournamentHasStarted } from './finishForecast';

describe('finish forecast log', () => {
  it('keeps only stamps with a clock and a time', () => {
    expect(parseFinishForecasts([
      { at: '2026-11-06T16:00:00Z', end: '00:40' },
      { at: 'nope', end: '00:40' },
      { at: '2026-11-06T18:00:00Z', end: '25:00' },
      null,
    ])).toEqual([{ at: '2026-11-06T16:00:00Z', end: '00:40' }]);
  });

  it('waits two hours between snapshots', () => {
    const marks = [{ at: '2026-11-06T16:00:00Z', end: '00:40' }];
    const written = Date.parse(marks[0]!.at);
    expect(shouldRecordForecast([], written)).toBe(true);
    expect(shouldRecordForecast(marks, written + 60 * 60 * 1000)).toBe(false);
    expect(shouldRecordForecast(marks, written + 2 * 60 * 60 * 1000)).toBe(true);
  });
});

describe('tournament start', () => {
  it('starts at the advertised Moscow clock and not the day before', () => {
    expect(tournamentHasStarted('2026-11-06', '19:00', new Date('2026-11-06T15:59:00Z'))).toBe(false);
    expect(tournamentHasStarted('2026-11-06', '19:00', new Date('2026-11-06T16:00:00Z'))).toBe(true);
    expect(tournamentHasStarted('2026-11-06', '19:00', new Date('2026-11-05T20:00:00Z'))).toBe(false);
  });
});
