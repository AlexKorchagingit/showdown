import { describe, expect, it } from 'vitest';
import {
  breakComment,
  formatBlinds,
  upcomingBreakLevel,
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

  it('uses the break note as the Next Blinds label', () => {
    expect(formatBlinds(pause('Вывод 100 номинала'))).toBe('Вывод 100 номинала');
    expect(formatBlinds(pause())).toBe('ПЕРЕРЫВ');
  });
});
