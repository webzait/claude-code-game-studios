import type { RobotEvent } from '../engine/types';

/** One robot being turned by a turn tile at the end of a step: which robot, on which cell. */
export interface TileBeat {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The turn-tile beats of a step: one for every robot the engine reports as turned by a tile
 * (`tileTurned`), at the cell it arrived on. The view plays them after the walk, as a beat of
 * their own. Robots that stood on a tile, bumped, or left through the exit give none.
 */
export function tileBeats(events: readonly RobotEvent[]): TileBeat[] {
  return events.filter((e) => e.tileTurned).map((e) => ({ id: e.id, x: e.toX, y: e.toY }));
}

/**
 * How many clockwise quarter turns the view shows a robot making during one step: one for the
 * colour command, one more for a turn tile it arrived on. The engine's heading after the step is
 * the heading before it plus this, so a view that turns by this stays in step with the state.
 */
export function quarterTurns(event: RobotEvent): number {
  return (event.turned ? 1 : 0) + (event.tileTurned ? 1 : 0);
}
