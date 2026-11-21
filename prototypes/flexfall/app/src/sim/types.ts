// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Level data and tuning: plain data, shared by the simulation, the solver, the tests and the view.

/** One tuning value per key of config.js (only the numbers the simulation and rules read). */
export interface Tuning {
  gravity: number; roll_friction: number; rest_slope: number; rest_speed: number; drag: number;
  max_speed: number; marble_radius: number; marble_bounce: number; marble_grip: number; wall_bounce: number;
  bounce_min_speed: number; anchor_stiffness: number; anchor_damping: number; anchor_radius: number; floor_kick: number;
  catch_depth: number; catch_reach: number; settle_time: number; settle_move: number;
  settle_timeout: number;
}

/** A clamp: tapping it moves it to the next entry of heights (wrapping). */
export interface AnchorData { x: number; z: number; r: number; heights: number[]; start?: number }
/** A permanent hill (h > 0) or dip (h < 0) in the floor, same shape as a clamp's. */
export interface BumpData { x: number; z: number; r: number; h: number }
export interface CatcherData { x: number; z: number; r: number }
/** A wall: a segment with rounded ends, t is its half thickness. */
export interface WallData { x1: number; z1: number; x2: number; z2: number; t: number }
export interface PegData { x: number; z: number; r: number }
/** A group of marbles packed in a hexagonal cluster around (x, z). */
export interface MarbleGroupData { x: number; z: number; count: number; spacing?: number }

export interface LevelData {
  id: string;
  name: string;
  /** Taps allowed. */
  moves: number;
  /** Taps a good clear uses: at or under par is three stars. */
  par: number;
  /** Marbles that must be caught. */
  target: number;
  tray?: { w: number; d: number };
  /** Resting floor shape: h = tiltX*x + tiltZ*z + bowlX*x^2 + bowlZ*z^2. */
  base?: { tiltX?: number; tiltZ?: number; bowlX?: number; bowlZ?: number };
  bumps?: BumpData[];
  anchors: AnchorData[];
  catchers: CatcherData[];
  walls?: WallData[];
  pegs?: PegData[];
  marbles: MarbleGroupData[];
  /** A recorded clear: anchor indexes in tap order. Replayed by the tests. */
  solution: number[];
  /** A one-line hint shown under the level name. */
  hint?: string;
}

export const DEFAULT_TRAY = { w: 8, d: 11 };
/** The simulation's fixed step in seconds. Never tied to the frame rate. */
export const SUBSTEP = 1 / 120;
