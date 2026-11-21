import levelData from '../../data/levels.json';
import testBoardData from '../../data/test-boards.json';
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

/**
 * Boards for looking at how the board scales (5×5, 6×6, 8×8, 4×7). They are not levels: they are
 * not in the level list, are not checked for a solution and never touch progress.
 */
export const TEST_BOARDS: readonly Level[] = testBoardData.map((def) => parseLevel(def));
