import levelData from '../../data/levels.json';
import { parseLevel, type Level, type LevelDef } from './parse';

/**
 * The levels, authored in data/levels.json. Each `grid` is one string per row
 * (see parseLevel for the cell format). Every level is checked by the solver in
 * tests/unit/levels.test.ts: solvable, and `par` equals the true shortest solution.
 */
export const LEVEL_DEFS: readonly (LevelDef & { par: number })[] = levelData;

/** Parsed levels in play order. */
export const LEVELS: readonly (Level & { par: number })[] = LEVEL_DEFS.map((def) => ({
  ...parseLevel(def),
  par: def.par,
}));
