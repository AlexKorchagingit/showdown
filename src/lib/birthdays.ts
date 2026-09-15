export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export const MONTH_OF = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

/** Weeks start on Monday here, like every Russian calendar. */
export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export type Birthday = {
  /** 1–12. */
  month: number;
  /** 1–31. */
  day: number;
  /** Null when only the day and month are known. */
  year: number | null;
};

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** Settings store `YYYY-MM-DD`; older profiles were typed as `DD.MM.YYYY`. */
export function parseBirthday(raw: string): Birthday | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : dotted
      ? { year: Number(dotted[3]), month: Number(dotted[2]), day: Number(dotted[1]) }
      : null;
  if (!parts) return null;
  // A leap-day birthday must survive being checked against a common year.
  if (!isRealDate(2000, parts.month, parts.day)) return null;
  const known = parts.year >= 1900 && isRealDate(parts.year, parts.month, parts.day);
  return { month: parts.month, day: parts.day, year: known ? parts.year : null };
}

export function formatBirthday(birthday: Birthday): string {
  const date = `${birthday.day} ${MONTH_OF[birthday.month - 1]}`;
  return birthday.year === null ? date : `${date} ${birthday.year}`;
}

/** Age reached on this year's birthday. Null without a birth year. */
export function ageTurning(birthday: Birthday, inYear: number): number | null {
  if (birthday.year === null) return null;
  const age = inYear - birthday.year;
  return age >= 0 && age < 130 ? age : null;
}

export type BirthdayPerson = { nickname: string; birthDate: string };

export type BirthdayEntry<T extends BirthdayPerson> = {
  person: T;
  birthday: Birthday;
};

/** Everyone born in `month`, earliest day first, then alphabetically. */
export function birthdaysInMonth<T extends BirthdayPerson>(
  people: T[],
  month: number,
): BirthdayEntry<T>[] {
  const entries: BirthdayEntry<T>[] = [];
  for (const person of people) {
    const birthday = parseBirthday(person.birthDate);
    if (birthday && birthday.month === month) entries.push({ person, birthday });
  }
  return entries.sort(
    (a, b) =>
      a.birthday.day - b.birthday.day ||
      a.person.nickname.localeCompare(b.person.nickname, 'ru'),
  );
}

/**
 * Day cells for one month, padded with nulls so every row is a full week
 * starting on Monday.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}
