const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockText(value: string): boolean {
  return CLOCK.test(value.trim());
}

export function normalizeClock(hour: string, minute: string): string | undefined {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `19:10:00` from Postgres and `1:45` from a comment both become `HH:MM`. */
export function clockFromStored(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  return normalizeClock(match[1], match[2]);
}

/**
 * Start and finish written in the tournament comment.
 * Dealer shifts («с 19 до 22:30») are ignored. Only the tournament lines count.
 */
export function parseCommentClocks(comment: string): { start?: string; end?: string } {
  const text = comment.toLowerCase().replace(/ё/g, 'е');
  let start: string | undefined;
  let end: string | undefined;

  const started = text.match(/начал\w*[^0-9]{0,18}(\d{1,2})[:.](\d{2})/);
  if (started) {
    const hour = Number(started[1]);
    if (hour >= 12 && hour <= 23) start = normalizeClock(started[1], started[2]);
  }

  const range = text.match(/турнир[:\s]*(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  if (range) {
    const rangeStart = normalizeClock(range[1], range[2]);
    const rangeEnd = normalizeClock(range[3], range[4]);
    if (rangeStart && Number(range[1]) >= 12) start = start ?? rangeStart;
    if (rangeEnd) end = rangeEnd;
  }

  if (!end) {
    const finished = text.match(/закончил\w*[^0-9]{0,16}(\d{1,2})[:.](\d{2})/)
      ?? text.match(/конец[:\s]+(\d{1,2})[:.](\d{2})/)
      ?? text.match(/(\d{1,2})[:.](\d{2})\s*конец/);
    if (finished) end = normalizeClock(finished[1], finished[2]);
  }

  return { start, end };
}

/** Minutes from midnight. A finish before the start is the next day. */
export function clockToMinutes(clock: string, startMinutes?: number): number {
  const match = clock.match(CLOCK);
  if (!match) return 0;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (startMinutes == null) return minutes;
  if (minutes + 6 * 60 < startMinutes) return minutes + 24 * 60;
  return minutes;
}

export function formatClockMinutes(totalMinutes: number): string {
  const day = 24 * 60;
  const minutes = ((Math.round(totalMinutes) % day) + day) % day;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
