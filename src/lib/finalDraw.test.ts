import { describe, expect, it } from 'vitest';
import { participantFromRow } from './supabaseMap';
import {
  FINAL_DRAW_BOXES,
  FINAL_DRAW_EVENT_ID,
  FINAL_DRAW_SEATS_PER_TABLE,
  FINAL_DRAW_TABLES,
  drawBoxFromRow,
  finalDrawBox,
  finalDrawLabel,
  finalDrawNames,
  finalDrawSeat,
  isFinalDrawEvent,
} from './finalDraw';

describe('final draw seats', () => {
  it('recognises only today\'s final', () => {
    expect(isFinalDrawEvent({ id: FINAL_DRAW_EVENT_ID })).toBe(true);
    expect(isFinalDrawEvent({ id: 't-other' })).toBe(false);
    expect(isFinalDrawEvent(null)).toBe(false);
  });

  it('maps 27 boxes onto 3 tables of 9 without overlap', () => {
    const seen = new Set<string>();
    for (let box = 1; box <= FINAL_DRAW_BOXES; box += 1) {
      const place = finalDrawSeat(box);
      expect(place).not.toBeNull();
      expect(finalDrawBox(place!.table, place!.seat)).toBe(box);
      seen.add(`${place!.table}-${place!.seat}`);
    }
    expect(seen.size).toBe(FINAL_DRAW_TABLES * FINAL_DRAW_SEATS_PER_TABLE);
    expect(finalDrawSeat(1)).toEqual({ table: 1, seat: 1 });
    expect(finalDrawSeat(9)).toEqual({ table: 1, seat: 9 });
    expect(finalDrawSeat(10)).toEqual({ table: 2, seat: 1 });
    expect(finalDrawSeat(27)).toEqual({ table: 3, seat: 9 });
    expect(finalDrawSeat(0)).toBeNull();
    expect(finalDrawSeat(28)).toBeNull();
    expect(finalDrawLabel(10)).toBe('Стол 2 · место 1');
    expect(finalDrawLabel(undefined)).toBe('');
  });

  it('shows a drawn name only for an arrived player', () => {
    const names = finalDrawNames([
      { nickname: 'Аня', arrived: true, drawBox: 1 },
      { nickname: 'Боря', arrived: false, drawBox: 2 },
      { nickname: 'Вера', arrived: true, drawBox: 99 },
      { nickname: 'Глеб', arrived: true },
    ]);
    expect([...names.entries()]).toEqual([[1, 'Аня']]);
    expect(drawBoxFromRow(27)).toBe(27);
    expect(drawBoxFromRow(1.5)).toBeUndefined();
  });

  it('reads the server box and treats a new box as a roster change', () => {
    const player = participantFromRow({
      id: 't:user',
      tournament_id: 't',
      user_id: 'user',
      nickname: 'Аня',
      rating: 0,
      place: null,
      knockouts: 0,
      rubies_awarded: null,
      comment: null,
      arrived: true,
      draw_box: 10,
    });
    expect(player.drawBox).toBe(10);
  });
});
