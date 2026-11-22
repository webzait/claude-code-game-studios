/** Which levels the path of the level selection shows. Positions are indexes in play order. */
export interface PathSteps {
  /** The level to play now; null when every level is completed. */
  readonly current: number | null;
  /** The locked levels drawn after it, nearest first. */
  readonly ahead: readonly number[];
}

/**
 * The path shows the current level and at most `ahead` levels after it.
 * Completed levels are not part of it, and near the end fewer levels remain.
 */
export function pathSteps(total: number, current: number | null, ahead: number): PathSteps {
  if (current === null || current < 0 || current >= total) return { current: null, ahead: [] };
  const count = Math.max(0, Math.min(Math.floor(ahead), total - current - 1));
  return { current, ahead: Array.from({ length: count }, (_, i) => current + 1 + i) };
}

/**
 * Sideways place of a step on the winding path, from -1 (left) to 1 (right).
 * Step 0 is the current level, in the middle; the steps after it sway right,
 * then left, and return to the middle every `period` steps.
 */
export function pathSway(step: number, period = 5): number {
  return Math.round(Math.sin((step * 2 * Math.PI) / period) * 100) / 100;
}

/**
 * Positions of the levels that can still be improved: completed, but with
 * fewer than three stars. `stars` holds each level's stars in play order, 0
 * when it is not completed. A level with three stars is finished for good.
 */
export function improvableLevels(stars: readonly number[]): number[] {
  return stars.flatMap((s, index) => (s > 0 && s < 3 ? [index] : []));
}
