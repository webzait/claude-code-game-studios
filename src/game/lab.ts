import { CONFIG } from '../config';
import type { Color, Command, Rules } from '../engine/types';
import type { GameLevel } from '../levels/index';
import type { HeadingStyle } from '../render/heading';

/**
 * Test-phase switches. They let open design questions be tried on a phone
 * without a new build; none of them is a shipped player setting.
 */
export interface LabSettings {
  /** `many`: several robots may enter the exit per turn. `single`: one at a time. */
  exitRule: 'many' | 'single';
  /** Show yellow already in the tutorial by recolouring an early level. */
  yellowEarly: boolean;
  /** Moves allowed over the shortest solution. */
  moveSlack: number;
  /** Animation speed multiplier. */
  speed: number;
  /** Open every level regardless of progress. */
  unlockAll: boolean;
  /** Harbour backdrop and bushes behind the game. */
  decor: boolean;
  /** Robots from the asset kit (`kit`) or the built-in ones (`builtin`). */
  robots: 'kit' | 'builtin';
  /**
   * How a robot shows its heading. `faceUp`: the whole robot turns and its face looks up at the camera.
   * `towardPlayer`: it turns but always leans towards the player. `symbol`: only the symbol turns.
   */
  heading: HeadingStyle;
  /** Board pieces from the asset kit (`kit`) or the built-in ones (`builtin`). */
  boardPieces: 'kit' | 'builtin';
  /** Hints and extra moves cost no coins. */
  freeHelp: boolean;
  /** Board framing: `roomy` (steeper camera, thin frame, against the top) or `classic`. */
  board: 'roomy' | 'classic';
}

/** The lab as it ships: the certified default game. */
export const DEFAULT_LAB: LabSettings = {
  exitRule: CONFIG.rules.exitAcceptsMany ? 'many' : 'single',
  yellowEarly: false,
  moveSlack: CONFIG.moveSlack,
  speed: 1,
  unlockAll: false,
  board: 'roomy',
  freeHelp: false,
  decor: true,
  robots: 'kit',
  heading: 'faceUp',
  boardPieces: 'kit',
};

/** Rules the lab asks for. */
export function rulesFor(lab: LabSettings): Rules {
  return { exitAcceptsMany: lab.exitRule === 'many' };
}

/** True when the lab rules are the ones the shipped pars and witnesses were certified under. */
export function usesCertifiedRules(lab: LabSettings): boolean {
  return rulesFor(lab).exitAcceptsMany === CONFIG.rules.exitAcceptsMany;
}

/**
 * The level as the lab wants it played. "Yellow early" recolours blue to
 * yellow in the configured tutorial levels; the puzzle is identical, so par
 * stays and the witness is recoloured with it.
 */
export function applyLab(level: GameLevel, lab: LabSettings): GameLevel {
  if (!lab.yellowEarly || !CONFIG.lab.yellowEarlyLevels.includes(level.id)) return level;
  const swap = (c: Color): Color => (c === 'blue' ? 'yellow' : c);
  return {
    ...level,
    start: { ...level.start, robots: level.start.robots.map((r) => ({ ...r, color: swap(r.color) })) },
    witness: level.witness.map((c): Command => (c === 'forward' ? c : swap(c))),
  };
}
