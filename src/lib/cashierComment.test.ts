import { describe, expect, it } from 'vitest';
import { applyServerComment, type CashierCommentState } from './cashierComment';

const editing = (shown: string): CashierCommentState => ({
  shown,
  draft: shown,
  focused: true,
});

describe('cashier comment sync', () => {
  it('keeps a trailing space and a new line while the field is focused', () => {
    const typed = editing('Стол 3\n');
    const trimmedByServer = applyServerComment(typed, 'Стол 3', false);
    expect(trimmedByServer.shown).toBe('Стол 3\n');

    const spaced = editing('Игрок ');
    expect(applyServerComment(spaced, 'Игрок', false).shown).toBe('Игрок ');
  });

  it('accepts the trimmed server copy only after editing stops', () => {
    const blurred: CashierCommentState = { shown: 'Игрок ', draft: 'Игрок ', focused: false };
    expect(applyServerComment(blurred, 'Игрок', false)).toEqual({
      shown: 'Игрок',
      draft: null,
      focused: false,
    });
  });

  it('does not roll the draft back to an older server copy', () => {
    const blurred: CashierCommentState = { shown: 'Новая заметка', draft: 'Новая заметка', focused: false };
    expect(applyServerComment(blurred, 'Старая', false).shown).toBe('Новая заметка');
  });

  it('follows the server when this screen is not editing', () => {
    const idle: CashierCommentState = { shown: 'Старая', draft: null, focused: false };
    expect(applyServerComment(idle, 'С другого экрана', false).shown).toBe('С другого экрана');
  });

  it('replaces the draft when another tournament opens', () => {
    expect(applyServerComment(editing('Чужой текст'), 'Свой', true)).toEqual({
      shown: 'Свой',
      draft: null,
      focused: false,
    });
  });
});
