import districtData from '../../data/districts.json';
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

/** A point at which a district's landmark visibly recovers. */
export interface Milestone {
  readonly id: string;
  /** Number of the district's levels that must be solved. */
  readonly afterLevels: number;
  readonly title: string;
  readonly text: string;
}

/** One district of Prismport. A district without levels is not built yet. */
export interface District {
  readonly id: string;
  readonly name: string;
  readonly lore: string;
  readonly theme: string;
  readonly landmark: string;
  readonly accent: string;
  readonly levels: readonly string[];
  readonly milestones: readonly Milestone[];
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

/** The six districts, from data/districts.json. */
export const DISTRICTS: readonly District[] = districtData;
