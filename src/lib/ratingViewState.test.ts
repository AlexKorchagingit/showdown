import { afterEach, describe, expect, it } from 'vitest';
import { readRatingView, resetRatingView, writeRatingView } from './ratingViewState';

describe('ratingViewState', () => {
  afterEach(() => {
    resetRatingView();
  });

  it('starts on the general tab at the top of the list', () => {
    const view = readRatingView();
    expect(view.tab).toBe('general');
    expect(view.column).toBe('tournaments');
    expect(view.scrollTop).toBe(0);
  });

  it('keeps a saved scroll offset and tab after a write', () => {
    writeRatingView({ tab: 'seasonal', month: 7, column: 'knockouts', scrollTop: 640 });
    expect(readRatingView()).toEqual({
      tab: 'seasonal',
      month: 7,
      column: 'knockouts',
      scrollTop: 640,
    });
  });

  it('ignores invalid stored values', () => {
    writeRatingView({
      tab: 'seasonal',
      month: 99,
      column: 'knockouts',
      scrollTop: -12,
    });
    const view = readRatingView();
    expect(view.month).toBeGreaterThanOrEqual(0);
    expect(view.month).toBeLessThanOrEqual(11);
    expect(view.scrollTop).toBe(0);
  });
});
