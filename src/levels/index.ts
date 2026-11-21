import levelData from '../../data/levels.json';
import type { Command } from '../engine/types';
import { parseLevel, type Level } from './parse';

/** A shipped level: board, start, the solver's shortest length and one witness solution. */
export interface GameLevel extends Level {
  /** Length of the shortest solution under the default rules. */
  readonly par: number;
  /** A stored command list that wins the level; replayed by the tests. */
  readonly witness: readonly Command[];
}

/**
 * Levels in play order, authored in data/levels.json and checked in
 * tests/unit/levels.test.ts (witness wins, par is the true shortest solution).
 */
export const LEVELS: readonly GameLevel[] = levelData.map((def) => ({
  ...parseLevel(def),
  par: def.par,
  witness: def.witness as Command[],
}));
