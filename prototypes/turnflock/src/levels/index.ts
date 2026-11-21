// PROTOTYPE - NOT FOR PRODUCTION
import { parseLevel, type Level, type LevelDef } from './parse';

/**
 * The five hand-authored levels. Every level is checked by the solver in
 * tests/levels.test.ts: solvable, and `par` equals the true shortest solution.
 */
export const LEVEL_DEFS: readonly (LevelDef & { par: number })[] = [
  {
    id: 'follow-the-arrow',
    name: 'Follow the Arrow',
    par: 7,
    moveBudget: 9,
    grid: [
      '.. .. .. .. EX',
      'r^ .. .. .. ..',
      '.. .. r^ .. ..',
      '.. r^ .. .. ..',
    ],
  },
  {
    id: 'one-color-turns',
    name: 'One Color Turns',
    par: 7,
    moveBudget: 9,
    grid: [
      '.. .. .. .. EX',
      'r^ .. .. .. ..',
      '.. .. r^ .. ..',
      '.. .. .. .. ..',
      '.. b< .. b< ..',
    ],
  },
  {
    id: 'use-the-wall',
    name: 'Use the Wall',
    par: 8,
    moveBudget: 10,
    grid: [
      '.. .. .. .. .. EX',
      '.. .. .. .. .. ..',
      '.. .. b^ .. ## r<',
      '.. .. .. .. .. ..',
      '.. r< .. .. ## b<',
    ],
  },
  {
    id: 'traffic-jam',
    name: 'Traffic Jam',
    par: 8,
    moveBudget: 10,
    grid: [
      '.. .. .. .. .. EX',
      'y^ .. .. .. .. ..',
      'r^ .. .. .. ## b<',
      'b^ .. .. .. ## r<',
      '.. .. .. .. ## y<',
      '.. .. .. .. .. ..',
    ],
  },
  {
    id: 'one-command-many-consequences',
    name: 'One Command, Many Consequences',
    par: 10,
    moveBudget: 12,
    grid: [
      '.. r^ y^ b> b> EX',
      '.. ## r^ ## .. y^',
      '.. .. .. .. r^ ..',
      'y< .. .. .. ## ..',
      '## .. b^ y< r< b^',
      '.. .. ## .. .. ..',
    ],
  },
];

/** Parsed levels in play order. */
export const LEVELS: readonly (Level & { par: number })[] = LEVEL_DEFS.map((def) => ({
  ...parseLevel(def),
  par: def.par,
}));
