import { describe, expect, it } from 'vitest';
import { insertLineBreak } from './textInput';

describe('insertLineBreak', () => {
  it('puts a newline at the caret', () => {
    expect(insertLineBreak('hello', 5, 5)).toEqual({ value: 'hello\n', caret: 6 });
    expect(insertLineBreak('ab', 1, 1)).toEqual({ value: 'a\nb', caret: 2 });
  });

  it('replaces the selected range', () => {
    expect(insertLineBreak('abcdef', 2, 5)).toEqual({ value: 'ab\nf', caret: 3 });
  });
});
