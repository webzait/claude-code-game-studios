// PROTOTYPE - NOT FOR PRODUCTION
import type { ColorId } from '../config';
import type { BoardDef } from '../physics/world';

/** One puzzle: a board, a goal, a pulse budget and a proven solution. */
export interface LevelDef extends BoardDef {
  id: number;
  name: string;
  /** One short line shown under the title. */
  hint: string;
  /** Marbles that must be collected to win. */
  target: number;
  /** Colour pulses the player may spend. */
  pulses: number;
  /** A pulse order that wins; checked against the real simulation in tests. */
  solution: ColorId[];
}
