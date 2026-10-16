import { describe, expect, it } from 'vitest';
import { timerStageFor, timerStageTransform } from './timerStage';

describe('timer stage for small screens', () => {
  it('keeps the live layout on a laptop and wider', () => {
    expect(timerStageFor(1366, 700)).toEqual({ scaled: false });
    expect(timerStageFor(1280, 720)).toEqual({ scaled: false });
    expect(timerStageFor(0, 0)).toEqual({ scaled: false });
  });

  it('turns a portrait phone clockwise and fits the laptop screen into it', () => {
    const stage = timerStageFor(390, 700);
    if (!stage.scaled) throw new Error('expected a scaled stage');
    expect(stage.rotate).toBe(true);
    expect(stage.width).toBe(1280);
    expect(stage.scale).toBeGreaterThan(0.5);
    expect(stage.scale * stage.width).toBeLessThanOrEqual(700 + 0.5);
    expect(stage.scale * stage.height).toBeLessThanOrEqual(390 + 0.5);
  });

  it('still turns a tall portrait box that is narrower than the laptop layout', () => {
    const stage = timerStageFor(700, 1400);
    if (!stage.scaled) throw new Error('expected a scaled stage');
    expect(stage.rotate).toBe(true);
    expect(stage.scale * stage.width).toBeLessThanOrEqual(1400 + 0.5);
    expect(stage.scale * stage.height).toBeLessThanOrEqual(700 + 0.5);
  });

  it('does not rotate a phone held sideways', () => {
    const stage = timerStageFor(844, 390);
    if (!stage.scaled) throw new Error('expected a scaled stage');
    expect(stage.rotate).toBe(false);
    expect(stage.scale * stage.width).toBeLessThanOrEqual(844 + 0.5);
    expect(stage.scale * stage.height).toBeLessThanOrEqual(390 + 0.5);
  });

  it('scales a narrow desktop window instead of squeezing the circle', () => {
    const stage = timerStageFor(1100, 800);
    if (!stage.scaled) throw new Error('expected a scaled stage');
    expect(stage.rotate).toBe(false);
    expect(stage.scale).toBeCloseTo(1100 / 1280, 2);
    expect(stage.height).toBeLessThanOrEqual(800);
  });

  it('writes the transform in the order translate, rotate, scale', () => {
    expect(timerStageTransform({ scaled: true, width: 1280, height: 700, scale: 0.5, rotate: true })).toBe(
      'translate(-50%, -50%) rotate(90deg) scale(0.5)',
    );
    expect(timerStageTransform({ scaled: true, width: 1280, height: 700, scale: 0.75, rotate: false })).toBe(
      'translate(-50%, -50%) scale(0.75)',
    );
  });
});
