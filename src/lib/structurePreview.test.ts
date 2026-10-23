import { describe, expect, it } from 'vitest';
import { lateRegEndClock, structurePreviewRows } from './structurePreview';

describe('structure preview', () => {
  it('lists blinds, minutes, breaks and the late-registration mark', () => {
    const rows = structurePreviewRows({
      levels: [
        { level: 1, smallBlind: 500, bigBlind: 1000, ante: 1000, durationMinutes: 25 },
        {
          level: 0,
          smallBlind: 2000,
          bigBlind: 4000,
          ante: 4000,
          durationMinutes: 15,
          isBreak: true,
          isLateRegEnd: true,
          comment: 'Еда',
        },
      ],
    });
    const n = (value: number) => value.toLocaleString('ru-RU');
    expect(rows.map((row) => [row.label, row.detail, row.minutes, row.lateRegEnd])).toEqual([
      ['1', `${n(500)}/${n(1000)} (${n(1000)})`, '25 мин', false],
      ['Перерыв', 'Конец поздней регистрации', '15 мин', true],
    ]);
    expect(lateRegEndClock('16:30', [
      { level: 1, smallBlind: 500, bigBlind: 1000, ante: 1000, durationMinutes: 25 },
      { level: 0, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 15, isBreak: true, isLateRegEnd: true, comment: 'Еда' },
    ])).toBe('16:55');
    expect(lateRegEndClock('19:00', [])).toBeNull();
  });

  it('keeps the ante next to the blinds', () => {
    const rows = structurePreviewRows({
      levels: [{ level: 2, smallBlind: 1000, bigBlind: 2000, ante: 2000, durationMinutes: 20 }],
    });
    const n = (value: number) => value.toLocaleString('ru-RU');
    expect(rows[0]?.detail).toBe(`${n(1000)}/${n(2000)} (${n(2000)})`);
  });
});
