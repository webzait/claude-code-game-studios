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

/** Everything the path draws: the steps of {@link pathSteps}, plus what a theme may add around them. */
export interface PathScene extends PathSteps {
  /** Completed levels drawn before the current one, oldest first (only within its chapter). */
  readonly behind: readonly number[];
  /**
   * What closes the path, when it is in sight: `end` = the last level of the game,
   * `chapter` = the last level of the current chapter. Null while the path runs on.
   */
  readonly finish: 'end' | 'chapter' | null;
  /** The chapter the current level is in, counted from 1; 0 without chapters. */
  readonly chapter: number;
  /**
   * A chapter just completed: its end is drawn, reached, below the first steps of the next
   * chapter (while the completed steps of the new chapter do not fill `behind` yet). Its number, or 0.
   */
  readonly reached: number;
}

/**
 * The path with optional chapters. With `chapter` > 0 the levels form chapters of
 * that many (the garden theme: one garden of 20, ending at a gazebo); the path then
 * stops at the end of the current chapter and that end is drawn as the finish.
 * `behind` adds up to that many completed levels before the current one, never
 * reaching back into an earlier chapter.
 *
 * With `chapter` and `behind` both 0 it is exactly the robot theme's path:
 * {@link pathSteps}, with a finish only once the last level is in sight.
 */
export function pathScene(total: number, current: number | null, ahead: number, chapter = 0, behind = 0): PathScene {
  const steps = pathSteps(total, current, ahead);
  if (steps.current === null) return { ...steps, behind: [], finish: null, chapter: 0, reached: 0 };
  const size = Math.max(0, Math.floor(chapter));
  const start = size > 0 ? Math.floor(steps.current / size) * size : 0;
  const end = size > 0 ? Math.min(total, start + size) - 1 : total - 1;
  const inChapter = steps.ahead.filter((index) => index <= end);
  const back = Math.max(0, Math.min(Math.floor(behind), steps.current - start));
  const reachesEnd = steps.current + Math.floor(ahead) >= end;
  // Without chapters the finish appears exactly when the old path showed it: fewer steps than asked for.
  const finish = size === 0 ? (steps.ahead.length < ahead ? 'end' : null) : reachesEnd ? (end === total - 1 ? 'end' : 'chapter') : null;
  return {
    current: steps.current,
    ahead: inChapter,
    behind: Array.from({ length: back }, (_, i) => steps.current! - back + i),
    finish,
    chapter: size > 0 ? start / size + 1 : 0,
    // Early in a chapter there is room below for the end of the one before it, reached.
    reached: size > 0 && start > 0 && Math.floor(behind) > 0 && steps.current - start < Math.floor(behind) ? start / size : 0,
  };
}

/**
 * The chapter that winning the level at `index` completes, counted from 1, or 0 when that
 * level is not the last of its chapter. The last level of the game ends the last chapter,
 * even when that chapter is shorter. Without chapters (`size` 0) it is always 0.
 */
export function chapterCompletedBy(index: number, total: number, size: number): number {
  const n = Math.floor(size);
  if (n <= 0 || index < 0 || index >= total) return 0;
  const last = (index + 1) % n === 0 || index === total - 1;
  return last ? Math.floor(index / n) + 1 : 0;
}
