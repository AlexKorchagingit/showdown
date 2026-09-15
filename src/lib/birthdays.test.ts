import { describe, expect, it } from 'vitest';
import {
  ageTurning,
  birthdaysInMonth,
  formatBirthday,
  monthGrid,
  parseBirthday,
} from './birthdays';

describe('reading a birth date from a profile', () => {
  it('accepts what settings store and what older profiles typed', () => {
    expect(parseBirthday('1990-09-12')).toEqual({ year: 1990, month: 9, day: 12 });
    expect(parseBirthday(' 12.09.1990 ')).toEqual({ year: 1990, month: 9, day: 12 });
    expect(parseBirthday('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
  });

  it('keeps the day and month when the year is missing or absurd', () => {
    expect(parseBirthday('0001-09-12')).toEqual({ year: null, month: 9, day: 12 });
  });

  it('refuses dates that do not exist', () => {
    expect(parseBirthday('')).toBeNull();
    expect(parseBirthday('не знаю')).toBeNull();
    expect(parseBirthday('1990-02-31')).toBeNull();
    expect(parseBirthday('1990-13-01')).toBeNull();
  });

  it('spells the date the way an invitation would', () => {
    expect(formatBirthday({ year: 1990, month: 9, day: 12 })).toBe('12 сентября 1990');
    expect(formatBirthday({ year: null, month: 5, day: 1 })).toBe('1 мая');
  });

  it('gives the age reached this year, and nothing without a year', () => {
    expect(ageTurning({ year: 1990, month: 9, day: 12 }, 2026)).toBe(36);
    expect(ageTurning({ year: null, month: 9, day: 12 }, 2026)).toBeNull();
  });
});

describe('birthdays of one month', () => {
  const people = [
    { nickname: 'Яна', birthDate: '1991-09-03' },
    { nickname: 'Артём', birthDate: '1988-09-03' },
    { nickname: 'Борис', birthDate: '1995-09-01' },
    { nickname: 'Не указал', birthDate: '' },
    { nickname: 'Октябрьский', birthDate: '1990-10-01' },
  ];

  it('lists the month by day, then alphabetically', () => {
    expect(birthdaysInMonth(people, 9).map((entry) => entry.person.nickname)).toEqual([
      'Борис',
      'Артём',
      'Яна',
    ]);
  });

  it('skips profiles without a usable date', () => {
    expect(birthdaysInMonth(people, 12)).toEqual([]);
  });
});

describe('calendar grid', () => {
  it('pads full weeks that start on Monday', () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.flat().filter((day) => day !== null)).toHaveLength(30);
  });

  it('handles a leap February', () => {
    expect(monthGrid(2024, 2).flat().filter((day) => day !== null)).toHaveLength(29);
  });
});
