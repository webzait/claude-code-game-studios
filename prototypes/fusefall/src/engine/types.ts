// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// Data types of the FUSEFALL puzzle engine. Nothing in src/engine imports the renderer.

/** Where balls go when they leave a platform: another platform's id, the catch bin, or lost. */
export type Target = string | 'bin' | 'void';

export const BIN = 'bin';
export const VOID = 'void';

/** A heat source the player can tap. Emits `strength` heat; a node at d hops receives strength - d. */
export interface SourceNode {
  id: string;
  kind: 'source';
  pos: [number, number];
  strength: number;
}

/** A plain joint between conductors. Passes heat on. */
export interface JunctionNode {
  id: string;
  kind: 'junction';
  pos: [number, number];
}

/**
 * A thermal latch. Absorbs heat (never passes it on), keeps its charge between pulses and
 * opens once charge >= threshold, releasing `releases` (a platform id).
 */
export interface LatchNode {
  id: string;
  kind: 'latch';
  pos: [number, number];
  threshold: number;
  releases: string;
}

export type NodeDef = SourceNode | JunctionNode | LatchNode;

/** A conductor between two nodes. `closed` = conducts heat. Platforms can switch it. */
export interface EdgeDef {
  id: string;
  a: string;
  b: string;
  closed: boolean;
}

/** A tilting metal platform holding balls. */
export interface PlatformDef {
  id: string;
  /** Centre of the platform in diorama units. */
  pos: [number, number];
  width: number;
  /** Which end goes down when it tilts. */
  low: 'left' | 'right';
  /** Balls resting on it at the start. */
  balls: number;
  /** Where its balls go once it has tilted. A tilted platform is a chute to this target. */
  dropsTo: Target;
  /** Tips by itself as soon as it holds this many balls (a balance, no latch needed). */
  tipsAtLoad?: number;
  /** Conductors this platform breaks when it tilts. */
  opens?: string[];
  /** Conductors this platform closes when it tilts. */
  closes?: string[];
}

export interface LevelDef {
  id: number;
  name: string;
  hint: string;
  /** Pulses the player may spend. */
  pulses: number;
  /** Balls needed in the bin to win. */
  goal: number;
  nodes: NodeDef[];
  edges: EdgeDef[];
  platforms: PlatformDef[];
  /** The intended solution: source ids in firing order. Checked by tests. */
  solution: string[];
}

export type Status = 'playing' | 'won' | 'lost';
export type LossReason = 'out-of-pulses' | 'unreachable';

/** The whole logical state. Plain data: cloneable, comparable, renderer-free. */
export interface GameState {
  pulsesLeft: number;
  bin: number;
  lost: number;
  /** Charge stored in each latch. */
  charge: Record<string, number>;
  /** Latches that have opened. */
  open: Record<string, boolean>;
  /** Conducting state of each edge. */
  closed: Record<string, boolean>;
  /** Balls resting on each platform. */
  balls: Record<string, number>;
  /** Platforms that have tilted. */
  tilted: Record<string, boolean>;
  status: Status;
  lossReason?: LossReason;
  /** Source ids fired so far. */
  history: string[];
}

/** Everything that happened in one pulse, in the exact order it was resolved. */
export type GameEvent =
  | { type: 'pulse'; source: string; strength: number }
  /** Heat crossed `edge` and arrived at `to` at hop `step` (1-based) carrying `heat`. */
  | { type: 'heat'; step: number; edge: string; from: string; to: string; heat: number }
  | { type: 'charge'; step: number; latch: string; added: number; charge: number; threshold: number }
  | { type: 'latchOpen'; latch: string; platform: string }
  | { type: 'tilt'; platform: string; cause: 'latch' | 'load'; latch?: string }
  | { type: 'edge'; edge: string; closed: boolean; platform: string }
  | { type: 'balls'; from: string; to: Target; count: number }
  | { type: 'settle'; status: Status; bin: number; lossReason?: LossReason };

export interface PulseResult {
  state: GameState;
  events: GameEvent[];
}
