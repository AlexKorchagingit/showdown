import { describe, expect, it } from 'vitest';
import { clockToMinutes, parseCommentClocks } from './playedClock';

describe('comment clocks', () => {
  it('reads the tournament start and finish and skips dealer shifts', () => {
    expect(parseCommentClocks('Начали в 19:10\nЗакончили в 1:30\nКирилл с 19 до 22.30')).toEqual({
      start: '19:10',
      end: '01:30',
    });
    expect(parseCommentClocks('Турнир: 19:00 - 01:30\nАртём: 19:00 - 23:15')).toEqual({
      start: '19:00',
      end: '01:30',
    });
    expect(parseCommentClocks('Начало 17:20, конец 22:35.')).toEqual({
      start: '17:20',
      end: '22:35',
    });
  });

  it('puts a finish after midnight on the next day', () => {
    expect(clockToMinutes('01:30', 19 * 60)).toBe(25 * 60 + 30);
    expect(clockToMinutes('23:40', 17 * 60)).toBe(23 * 60 + 40);
  });
});
