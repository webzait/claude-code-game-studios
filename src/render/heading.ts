import type { Dir } from '../engine/types';

/** A quarter turn in radians. */
export const QUARTER = Math.PI / 2;

/**
 * How a robot shows its heading.
 * `faceUp`: the whole robot turns and leans back along its own axis, so its face looks up at the camera in every heading.
 * `towardPlayer`: the whole robot turns inside a lean that always goes towards the player; facing away it shows its back.
 * `symbol`: the body keeps facing the player and only the symbol on top turns.
 */
export type HeadingStyle = 'faceUp' | 'towardPlayer' | 'symbol';

/** Every heading style, in the order the test lab offers them. */
export const HEADING_STYLES: readonly HeadingStyle[] = ['faceUp', 'towardPlayer', 'symbol'];

/**
 * The angle shown for a heading: the heading times a quarter turn, clockwise
 * seen from above (negative around the y axis). 0 = north (-z), 1 = east,
 * 2 = south (towards the player), 3 = west.
 */
export function headingAngle(dir: Dir): number {
  return -dir * QUARTER;
}

/**
 * The equivalent of `want` nearest to `from`, so a change of heading is shown
 * the short way round (an undo turns back instead of spinning on).
 */
export function nearestAngle(from: number, want: number): number {
  return want + Math.round((from - want) / (Math.PI * 2)) * Math.PI * 2;
}

/** The angle during a clockwise quarter turn that started at `from`; `progress` runs 0 to 1 and may overshoot. */
export function turnAngle(from: number, progress: number): number {
  return from - QUARTER * progress;
}

/**
 * Rotation around y of a model whose front is +z (the Flockbot part), so that
 * its front points along the shown angle: half a turn at north, none at south.
 */
export function bodyYaw(angle: number): number {
  return angle + Math.PI;
}

/** Unit step on the board for a shown angle: x to the east, z towards the player. */
export function travelAxis(angle: number): { x: number; z: number } {
  // Rounded, so a settled heading gives exact zeros and ones (and never a negative zero).
  const round = (v: number): number => Math.round(v * 1e9) / 1e9 + 0;
  return { x: round(-Math.sin(angle)), z: round(-Math.cos(angle)) };
}

/**
 * Scale of a robot squashed against what blocks it, in board axes: shorter
 * along the way it travels, wider across it and a little taller. `amount` 0 is
 * no squash.
 */
export function squashScale(angle: number, amount: number): { x: number; y: number; z: number } {
  const axis = travelAxis(angle);
  const along = 1 - amount;
  const across = 1 + amount * 0.6;
  const ax = Math.abs(axis.x);
  const az = Math.abs(axis.z);
  return { x: along * ax + across * (1 - ax), y: 1 + amount * 0.3, z: along * az + across * (1 - az) };
}
