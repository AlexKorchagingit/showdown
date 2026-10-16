/**
 * The timer is drawn once at laptop size and then scaled to the screen, so a phone
 * shows the same screen as the laptop instead of its top-left corner.
 */
export const TIMER_STAGE_WIDTH = 1280;
export const TIMER_STAGE_MIN_HEIGHT = 640;
export const TIMER_STAGE_MAX_HEIGHT = 800;

export type TimerStage =
  | { scaled: false }
  | {
      scaled: true;
      width: number;
      height: number;
      scale: number;
      /** A portrait screen shows the landscape timer turned 90° clockwise. */
      rotate: boolean;
    };

/**
 * Below the stage width the side columns squeeze the circle to nothing,
 * so a narrower box gets the scaled stage. A wide box keeps the live layout.
 */
export function timerStageFor(boxWidth: number, boxHeight: number): TimerStage {
  if (!(boxWidth > 0) || !(boxHeight > 0)) return { scaled: false };
  if (boxWidth >= TIMER_STAGE_WIDTH) return { scaled: false };
  const portrait = boxHeight > boxWidth;
  const longSide = portrait ? boxHeight : boxWidth;
  const shortSide = portrait ? boxWidth : boxHeight;

  const height = Math.min(
    TIMER_STAGE_MAX_HEIGHT,
    Math.max(TIMER_STAGE_MIN_HEIGHT, Math.round((TIMER_STAGE_WIDTH * shortSide) / longSide)),
  );
  const scale = Math.min(longSide / TIMER_STAGE_WIDTH, shortSide / height);
  return { scaled: true, width: TIMER_STAGE_WIDTH, height, scale, rotate: portrait };
}

export function timerStageTransform(stage: Extract<TimerStage, { scaled: true }>): string {
  return `translate(-50%, -50%) ${stage.rotate ? 'rotate(90deg) ' : ''}scale(${stage.scale})`;
}
