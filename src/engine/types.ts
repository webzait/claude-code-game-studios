/** Robot colours available in the prototype. */
export type Color = 'red' | 'blue' | 'yellow';

/** A player command: turn one colour then step, or just step. */
export type Command = Color | 'forward';

/** Facing direction: 0 = north (up), 1 = east, 2 = south, 3 = west. Clockwise order. */
export type Dir = 0 | 1 | 2 | 3;

/** All commands in a fixed order (used by UI and solver). */
export const COMMANDS: readonly Command[] = ['red', 'blue', 'yellow', 'forward'];

/** Grid deltas per direction; y grows downwards. */
export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DY: readonly number[] = [-1, 0, 1, 0];

/** Immutable robot description inside a state. */
export interface Robot {
  readonly id: number;
  readonly color: Color;
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
  /** True once the robot has reached the exit; it no longer occupies a cell. */
  readonly collected: boolean;
}

/** Static board: never changes during a level. */
export interface Board {
  readonly width: number;
  readonly height: number;
  /** Row-major wall flags, length width * height. */
  readonly walls: readonly boolean[];
  readonly exitX: number;
  readonly exitY: number;
}

/** Rule switches. Kept as data so variants can be tried without touching the engine. */
export interface Rules {
  /** When true, any number of robots may enter the exit in the same turn. */
  readonly exitAcceptsMany: boolean;
}

/** Complete logical state of a level in play. */
export interface GameState {
  readonly robots: readonly Robot[];
  readonly movesUsed: number;
}

/** Why a robot did or did not move this turn. */
export type Outcome =
  | 'moved'
  | 'exited'
  | 'blocked-wall'
  | 'blocked-robot'
  | 'blocked-conflict'
  | 'blocked-cycle';

/** Per-robot record of one turn; the renderer animates from these. */
export interface RobotEvent {
  readonly id: number;
  readonly turned: boolean;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly dir: Dir;
  readonly outcome: Outcome;
}

/** Result of applying one command. */
export interface StepResult {
  readonly state: GameState;
  readonly events: readonly RobotEvent[];
}
