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

/** One exit: where it is and which robots it takes (`null`: every colour). */
export interface Exit {
  readonly x: number;
  readonly y: number;
  readonly color: Color | null;
}

/** Static board: never changes during a level. */
export interface Board {
  readonly width: number;
  readonly height: number;
  /** Row-major wall flags, length width * height. */
  readonly walls: readonly boolean[];
  readonly exitX: number;
  readonly exitY: number;
  /**
   * Every exit of a board that has more than the one plain exit: several exits, or exits that take one
   * colour only. Absent on a board with a single exit for everyone at (`exitX`, `exitY`), which stays the
   * first exit in this list when it is present. An exit that does not take a robot's colour is plain floor
   * to that robot: it can stand on it and is not collected.
   */
  readonly exits?: readonly Exit[];
  /**
   * Row-major turn-tile flags, length width * height; absent on a board without turn tiles.
   * A robot that steps onto a turn tile turns 90 degrees clockwise there, whatever its colour.
   */
  readonly turnTiles?: readonly boolean[];
  /**
   * Row-major pressure-plate flags; absent on a board without plates. While any robot stands on a plate,
   * every gate of the board is open.
   */
  readonly plates?: readonly boolean[];
  /**
   * Row-major gate flags; absent on a board without gates. A gate is floor a robot may step onto only
   * when, before the step, a robot stood on a plate. A robot already in a gate is never trapped: it may
   * stay and may leave, open or closed.
   */
  readonly gates?: readonly boolean[];
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
  | 'blocked-gate'
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
  /** Heading during the step (after a colour turn, before any turn tile). */
  readonly dir: Dir;
  readonly outcome: Outcome;
  /** True when the robot arrived on a turn tile this step and was turned once more; its heading is then `dir` + 1. */
  readonly tileTurned: boolean;
}

/** Result of applying one command. */
export interface StepResult {
  readonly state: GameState;
  readonly events: readonly RobotEvent[];
}
