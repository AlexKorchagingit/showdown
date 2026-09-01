import { describe, expect, it } from 'vitest';
import {
  breakComment,
  formatBlinds,
  formatNextBlinds,
  inferLevelListChange,
  insertBreakAfter,
  insertPlayingLevelAfter,
  isBreakLevel,
  parseBlindLevel,
  upcomingBreakLevel,
  withAnteFromBigBlind,
  type BlindLevel,
} from './blindStructures';

function playing(level: number): BlindLevel {
  return {
    level,
    smallBlind: 100 * level,
    bigBlind: 200 * level,
    ante: 200 * level,
    durationMinutes: 20,
  };
}

function pause(comment?: string): BlindLevel {
  return {
    level: 0,
    smallBlind: 200,
    bigBlind: 400,
    ante: 400,
    durationMinutes: 15,
    isBreak: true,
    ...(comment ? { comment } : {}),
  };
}

describe('break comments', () => {
  it('reads a trimmed note only on break rows', () => {
    expect(breakComment(pause('  Вывод 100 номинала  '))).toBe('Вывод 100 номинала');
    expect(breakComment(playing(3))).toBe('');
  });

  it('finds the next break after the current level', () => {
    const levels = [playing(1), playing(2), pause('Цвет-ап'), playing(3)];
    expect(upcomingBreakLevel(levels, 0)?.comment).toBe('Цвет-ап');
    expect(upcomingBreakLevel(levels, 2)).toBeUndefined();
  });

  it('keeps the break note for formatBlinds, not for the Next Blinds line', () => {
    expect(formatBlinds(pause('Вывод 100 номинала'))).toBe('Вывод 100 номинала');
    expect(formatBlinds(pause())).toBe('ПЕРЕРЫВ');
    expect(formatNextBlinds(pause('Вывод 100 номинала'))).toBe('Перерыв');
    expect(formatNextBlinds(pause())).toBe('Перерыв');
    expect(formatNextBlinds(playing(3))).toBe('300/600 (600)');
    expect(formatNextBlinds(undefined)).toBe('финальный уровень');
  });
});

describe('playing levels with a cleared small-blind', () => {
  it('does not treat an explicit playing row as a break when blinds are 0', () => {
    const cleared: BlindLevel = {
      level: 1,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      durationMinutes: 20,
      isBreak: false,
    };
    expect(isBreakLevel(cleared)).toBe(false);
    expect(formatBlinds(cleared)).toBe('0/0');
    expect(isBreakLevel({ ...cleared, isBreak: undefined, smallBlind: 0 })).toBe(true);
    expect(isBreakLevel({ ...cleared, isBreak: true, smallBlind: 200 })).toBe(true);
  });

  it('keeps isBreak: false through parse so a saved 0/0 level stays a level', () => {
    const parsed = parseBlindLevel({
      level: 1,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      durationMinutes: 20,
      isBreak: false,
    });
    expect(parsed?.isBreak).toBe(false);
    expect(isBreakLevel(parsed ?? undefined)).toBe(false);
  });

  it('still treats legacy 0 small-blind rows without isBreak as a break', () => {
    const parsed = parseBlindLevel({
      level: 0,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      durationMinutes: 15,
    });
    expect(parsed?.isBreak).toBe(true);
    expect(isBreakLevel(parsed ?? undefined)).toBe(true);
  });
});

describe('insert a level between existing rungs', () => {
  it('inserts a playing level after the chosen row and keeps later blinds', () => {
    const levels = [playing(1), playing(2), playing(3)];
    const next = insertPlayingLevelAfter(levels, 1);
    expect(next).toHaveLength(4);
    expect(next[1]?.smallBlind).toBe(200);
    expect(next[2]?.smallBlind).toBe(200);
    expect(next[3]?.smallBlind).toBe(300);
    expect(next[2]?.isBreak).toBe(false);
    expect(next.filter((level) => !isBreakLevel(level)).map((level) => level.level)).toEqual([1, 2, 3, 4]);
    expect(next[2]?.ante).toBe(next[2]?.bigBlind);
  });

  it('inserts a break after the chosen row without rewriting later blinds', () => {
    const levels = [playing(1), playing(2), playing(3)];
    const next = insertBreakAfter(levels, 0);
    expect(isBreakLevel(next[1])).toBe(true);
    expect(next[2]?.smallBlind).toBe(200);
    expect(next[2]?.level).toBe(2);
    expect(next[1]?.ante).toBe(next[1]?.bigBlind);
  });

  it('detects a single inserted or removed row', () => {
    const prev = [playing(1), playing(2), playing(3)];
    const inserted = insertPlayingLevelAfter(prev, 1);
    expect(inferLevelListChange(prev, inserted)).toEqual({ insertedAt: 1 });
    expect(inferLevelListChange(inserted, prev)).toEqual({ removedAt: 2 });
  });
});

describe('ante follows the big blind', () => {
  it('overwrites a stored ante when parsing a level', () => {
    const parsed = parseBlindLevel({
      level: 2,
      smallBlind: 200,
      bigBlind: 400,
      ante: 50,
      durationMinutes: 20,
      isBreak: false,
    });
    expect(parsed?.ante).toBe(400);
    expect(withAnteFromBigBlind({ bigBlind: 800, ante: 1 }).ante).toBe(800);
  });

  it('keeps ante equal to BB on a copied playing row even if the template had a mismatch', () => {
    const levels = [
      { ...playing(1), ante: 1 },
      { ...playing(2), ante: 9 },
    ];
    const next = insertPlayingLevelAfter(levels, 0);
    expect(next.every((level) => level.ante === level.bigBlind)).toBe(true);
  });
});
