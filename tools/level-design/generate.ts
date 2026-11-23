/**
 * Candidate generator: makes random boards for one idea and size, solves each with the
 * game's solver, measures the survivors and throws away what is unsolvable, trivial,
 * too loose or beyond the search budget. It proposes; a person picks, tidies and names.
 *
 * Usage: npm run generate -- <idea> [key=value ...]
 *   idea        a key of tools/level-design/ideas.json
 *   size=6x5    board size (default: the idea's own)
 *   seed=1      seed of the random generator (same seed, same candidates)
 *   tries=4000  boards to try
 *   keep=8      candidates to print
 *   out=file    also write the candidates as JSON (id -> grid rows, readable by `npm run solve`)
 * Any other key=value overrides a field of the idea's recipe (for example red=3 par=6..9).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { COMMANDS, type Command } from '../../src/engine/types';
import { parseLevel, type Level } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';
import { fastSolve, fastStep, prepare } from './fast';
import { difficulty, measure, replayMeasures, seeded, type Metrics } from './measure';

/** A recipe: what to place and what the solver must say about the result. */
export interface Recipe {
  /** One sentence: what a level of this idea shows. */
  readonly teaches: string;
  readonly size: string;
  /** Robots per colour: a number or a range "2..4". */
  readonly red: number | string;
  readonly blue?: number | string;
  readonly yellow?: number | string;
  /** Walls: a number or a range. */
  readonly walls?: number | string;
  /** Pressure plates and gates: a number or a range each. A gate is placed only when there is a plate. */
  readonly plates?: number | string;
  readonly gates?: number | string;
  /**
   * A wall across the board, from edge to edge, with the gates as its only openings (at least one).
   * Without it gates land anywhere and are easy to walk around.
   */
  readonly barrier?: boolean;
  /** Turn tiles: a number or a range. */
  readonly tiles?: number | string;
  /** One exit per colour in play, each taking only that colour, instead of the one exit for everyone. */
  readonly colourExits?: boolean;
  /** Set by the generator itself: the colours that get an exit (those actually placed). */
  readonly exitColours?: readonly ('red' | 'blue' | 'yellow')[];
  /** Where the exit goes: corner, edge, inside or any. */
  readonly exit?: 'corner' | 'edge' | 'inside' | 'any';
  /** Headings: `any`, or `same` (every robot of a colour starts with the same heading). */
  readonly headings?: 'any' | 'same';
  /** Walls mirrored left to right. */
  readonly mirror?: boolean;
  /**
   * Colour commands in the intended solution, as a range. When set, the generator works backwards:
   * it first draws an intended command list of the wanted length with this many turns, then looks for
   * robots that all get home under it. Boards made this way walk more and spin less.
   */
  readonly planTurns?: number | string;
  /** Shortest solution length wanted, as a range. */
  readonly par: string;
  /** Most shortest solutions accepted (above this the level is too loose). */
  readonly maxSolutions?: number;
  /** Search limit for one candidate, in visited positions. */
  readonly cap?: number;
  /**
   * For big boards: skip the full measurement while generating (it can take a minute per board).
   * Candidates then carry only what the sieve and one replay give; the numbers that need the whole
   * graph are filled with neutral values and the score is an estimate. `npm run measure` measures
   * the chosen level in full afterwards.
   */
  readonly light?: boolean;
  /** Lower and upper bounds on measured numbers, e.g. { "bumpSteps": "1..", "tally.blocked-robot": "2.." }. */
  readonly require?: Record<string, string | number>;
}

type Range = [number, number];
const range = (v: number | string | undefined, fallback: Range): Range => {
  if (v === undefined) return fallback;
  if (typeof v === 'number') return [v, v];
  const [lo, hi] = v.split('..');
  return [lo === '' ? -Infinity : Number(lo), hi === undefined ? Number(lo) : hi === '' ? Infinity : Number(hi)];
};

/** Read a measured number by name; `tally.blocked-robot` reaches into the tally. */
export function metricValue(m: Metrics, name: string): number {
  if (name.startsWith('tally.')) return (m.tally as Record<string, number>)[name.slice(6)] ?? 0;
  const v = (m as unknown as Record<string, unknown>)[name];
  if (typeof v !== 'number') throw new Error(`unknown measure "${name}"`);
  return v;
}

/** True when every bound of the recipe holds. */
export function meets(m: Metrics, require: Record<string, string | number> = {}): boolean {
  return Object.entries(require).every(([name, bound]) => {
    const [lo, hi] = range(bound, [-Infinity, Infinity]);
    const v = metricValue(m, name);
    return v >= lo && v <= hi;
  });
}

/** Why a solved candidate is not a level, or null when it is one. */
export function rejectReason(m: Metrics, recipe: Pick<Recipe, 'par' | 'maxSolutions' | 'require'>): string | null {
  if (m.capped) return 'beyond the search budget';
  if (m.par === null) return 'unsolvable';
  const [lo, hi] = range(recipe.par, [1, Infinity]);
  if (m.par < lo || m.par > hi) return 'length outside the wanted range';
  if (m.commandsUsed < 2) return 'trivial: one repeated command';
  if (m.orderFreedom >= CONFIG.levelDesign.reject.orderFreedom) return 'trivial: winnable in almost any order';
  if (m.optimalSolutions > (recipe.maxSolutions ?? CONFIG.levelDesign.reject.maxSolutions)) return 'too loose: too many shortest solutions';
  if (!meets(m, recipe.require)) return 'does not show the idea';
  return null;
}

const HEADINGS = ['^', '>', 'v', '<'];

/** One random board for a recipe, as grid rows; null when the pieces did not fit. */
export function randomGrid(recipe: Recipe, rnd: () => number): string[] | null {
  const [width, height] = recipe.size.split('x').map(Number);
  const cells: string[][] = Array.from({ length: height }, () => new Array<string>(width).fill('..'));
  const pick = (n: number): number => Math.floor(rnd() * n);
  const between = ([lo, hi]: Range): number => lo + pick(hi - lo + 1);
  const free = (x: number, y: number): boolean => cells[y][x] === '..';

  const corners: [number, number][] = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const where = recipe.exit ?? 'corner';
  const placeExit = (code: string): boolean => {
    for (let guard = 0; guard < 100; guard++) {
      let ex: number;
      let ey: number;
      if (where === 'corner') [ex, ey] = corners[pick(4)];
      else {
        ex = pick(width);
        ey = pick(height);
        const onEdge = ex === 0 || ey === 0 || ex === width - 1 || ey === height - 1;
        const isCorner = corners.some(([cx, cy]) => cx === ex && cy === ey);
        if (where === 'edge' && (!onEdge || isCorner)) continue;
        if (where === 'inside' && onEdge) continue;
      }
      if (!free(ex, ey)) continue;
      cells[ey][ex] = code;
      return true;
    }
    return false;
  };
  if (recipe.colourExits) {
    // One exit per colour in play, each taking that colour only.
    const inPlay = recipe.exitColours ?? (['red', 'blue', 'yellow'] as const).filter((c) => range(recipe[c], [0, 0])[1] > 0);
    for (const colour of inPlay) if (!placeExit(`E${colour[0].toUpperCase()}`)) return null;
  } else if (!placeExit('EX')) return null;

  let walls = between(range(recipe.walls, [0, 0]));
  for (let guard = 0; walls > 0 && guard < 200; guard++) {
    const x = pick(width);
    const y = pick(height);
    if (!free(x, y)) continue;
    cells[y][x] = '##';
    walls--;
    const mx = width - 1 - x;
    if (recipe.mirror && walls > 0 && free(mx, y)) {
      cells[y][mx] = '##';
      walls--;
    }
  }

  const plateCount = between(range(recipe.plates, [0, 0]));
  let gateCount = plateCount > 0 ? between(range(recipe.gates, [0, 0])) : 0;
  if (recipe.barrier && plateCount > 0) {
    // A line of walls right across, not on the outer rows or columns, with the gates as openings.
    const across = pick(2) === 0;
    const line = 1 + pick((across ? height : width) - 2);
    const length = across ? width : height;
    const openings = new Set<number>();
    for (let guard = 0; openings.size < Math.max(1, gateCount) && guard < 50; guard++) openings.add(pick(length));
    for (let k = 0; k < length; k++) {
      const x = across ? k : line;
      const y = across ? line : k;
      if (!free(x, y)) continue;
      cells[y][x] = openings.has(k) ? 'GG' : '##';
    }
    gateCount = 0;
  }
  for (let guard = 0; gateCount > 0 && guard < 200; guard++) {
    const x = pick(width);
    const y = pick(height);
    if (!free(x, y)) continue;
    cells[y][x] = 'GG';
    gateCount--;
  }
  let plates = plateCount;
  for (let guard = 0; plates > 0 && guard < 200; guard++) {
    const x = pick(width);
    const y = pick(height);
    if (!free(x, y)) continue;
    cells[y][x] = 'PP';
    plates--;
  }
  if (plates > 0) return null;

  let tiles = between(range(recipe.tiles, [0, 0]));
  for (let guard = 0; tiles > 0 && guard < 200; guard++) {
    const x = pick(width);
    const y = pick(height);
    if (!free(x, y)) continue;
    cells[y][x] = '@@';
    tiles--;
  }

  for (const colour of ['red', 'blue', 'yellow'] as const) {
    let count = between(range(recipe[colour], [0, 0]));
    const shared = HEADINGS[pick(4)];
    for (let guard = 0; count > 0 && guard < 400; guard++) {
      const x = pick(width);
      const y = pick(height);
      if (!free(x, y)) continue;
      cells[y][x] = colour[0] + (recipe.headings === 'same' ? shared : HEADINGS[pick(4)]);
      count--;
    }
    if (count > 0) return null;
  }
  return cells.map((row) => row.join(' '));
}

/**
 * A board built backwards from an intended solution: walls and exit as in `randomGrid`, then a random
 * command list, then robots that each get home under that list and still do so together.
 * The solver decides afterwards whether the intended list is really the shortest.
 */
export function plannedGrid(recipe: Recipe, rnd: () => number): string[] | null {
  const pick = (n: number): number => Math.floor(rnd() * n);
  const counts = (['red', 'blue', 'yellow'] as const).map((c) => {
    const [lo, hi] = range(recipe[c], [0, 0]);
    return lo + pick(hi - lo + 1);
  });
  const exitColours = (['red', 'blue', 'yellow'] as const).filter((_, i) => counts[i] > 0);
  const base = randomGrid({ ...recipe, red: 0, blue: 0, yellow: 0, exitColours }, rnd);
  if (!base) return null;
  const colours = COMMANDS.filter((c, i) => c !== 'forward' && counts[i] > 0);
  const [parLo, parHi] = range(recipe.par, [4, 10]);
  const [turnLo, turnHi] = range(recipe.planTurns, [2, 4]);
  const length = parLo + pick(Math.min(parHi, CONFIG.levelDesign.maxPar) - parLo + 1);
  const turns = Math.min(length - 1, turnLo + pick(turnHi - turnLo + 1));
  const plan: Command[] = new Array<Command>(length).fill('forward');
  for (let placed = 0, guard = 0; placed < turns && guard < 200; guard++) {
    const at = pick(length - 1); // the last move is always a step into the exit
    if (plan[at] !== 'forward') continue;
    plan[at] = colours[pick(colours.length)];
    placed++;
  }
  const rows = base.map((r) => r.split(' '));
  // While robots are being collected one by one the gates count as open: a robot behind a gate cannot get
  // home alone. The finished set is checked once more under the real rule.
  const wins = (robots: [number, number, string][], gatesForcedOpen = true): boolean => {
    const trial = rows.map((r) => r.slice());
    for (const [x, y, cell] of robots) trial[y][x] = cell;
    const level = parseLevel({ id: 'plan', name: 'plan', grid: trial.map((r) => r.join(' ')) });
    const fast = prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany, gatesForcedOpen);
    const a = fast.start.slice();
    const b = new Uint8Array(a.length);
    for (const command of plan) {
      fastStep(fast, a, b, COMMANDS.indexOf(command));
      a.set(b);
    }
    return a.subarray(0, fast.n).every((cell) => cell === 255);
  };
  // Every single robot that gets home on its own under the plan.
  const pool: [number, number, string][][] = [[], [], []];
  rows.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== '..') return;
      for (let c = 0; c < 3; c++) {
        if (counts[c] === 0) continue;
        for (const h of HEADINGS) if (wins([[x, y, COMMANDS[c][0] + h]])) pool[c].push([x, y, COMMANDS[c][0] + h]);
      }
    }),
  );
  const order = counts.flatMap((n, c) => new Array<number>(n).fill(c));
  for (let i = order.length - 1; i > 0; i--) {
    const k = pick(i + 1);
    [order[i], order[k]] = [order[k], order[i]];
  }
  const chosen: [number, number, string][] = [];
  for (const c of order) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed && pool[c].length > 0; attempt++) {
      const robot = pool[c][pick(pool[c].length)];
      if (chosen.some(([x, y]) => x === robot[0] && y === robot[1])) continue;
      if (!wins([...chosen, robot])) continue;
      chosen.push(robot);
      placed = true;
    }
    if (!placed) return null;
  }
  if (!wins(chosen, false)) return null;
  for (const [x, y, cell] of chosen) rows[y][x] = cell;
  return rows.map((r) => r.join(' '));
}

export interface Candidate {
  readonly grid: string[];
  readonly metrics: Metrics;
}

/**
 * `keep` lists cell codes to leave alone: a barrier's walls stay, or its gate would stand alone in open floor.
 */
/** Remove every wall, turn tile, gate and plate the puzzle does not need: without it the shortest solutions are exactly the same. */
export function dropIdleWalls(grid: string[], maxStates?: number, keep: readonly string[] = []): Candidate {
  const toLevel = (g: string[]): Level => parseLevel({ id: 'candidate', name: 'candidate', grid: g });
  const quick = (g: string[]): string => {
    let level: Level;
    try {
      level = toLevel(g);
    } catch {
      return 'not a level'; // for example a gate left without a plate
    }
    const r = fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany), CONFIG.levelDesign.maxPar, maxStates);
    return `${r.capped}/${r.optimalCount}/${r.solution?.join()}`;
  };
  let rows = grid.map((r) => r.split(' '));
  const wanted = quick(grid);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (!['##', '@@', 'GG', 'PP'].includes(rows[y][x]) || keep.includes(rows[y][x])) continue;
      const trial = rows.map((r) => r.slice());
      trial[y][x] = '..';
      if (quick(trial.map((r) => r.join(' '))) === wanted) rows = trial;
    }
  }
  const tidy = rows.map((r) => r.join(' '));
  return { grid: tidy, metrics: measure(toLevel(tidy), { maxStates }) };
}

/** Try `tries` random boards and return the ones that pass, hardest first. Also counts why the rest failed. */
export function generate(recipe: Recipe, seed: number, tries: number, keep: number): { candidates: Candidate[]; rejected: Record<string, number> } {
  const rnd = seeded(seed);
  const rejected: Record<string, number> = {};
  const no = (reason: string): void => {
    rejected[reason] = (rejected[reason] ?? 0) + 1;
  };
  const [lo, hi] = range(recipe.par, [1, CONFIG.levelDesign.maxPar]);
  const cap = recipe.cap ?? CONFIG.levelDesign.generateCap;
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (let i = 0; i < tries; i++) {
    const grid = recipe.planTurns === undefined ? randomGrid(recipe, rnd) : plannedGrid(recipe, rnd);
    if (!grid) {
      no('pieces did not fit');
      continue;
    }
    const level = parseLevel({ id: 'candidate', name: 'candidate', grid });
    // Cheap first look with the sieve (fast.ts); the full measurement, on the real engine, only for boards that pass it.
    const quick = fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany), Math.min(hi, CONFIG.levelDesign.maxPar), cap);
    if (quick.capped) {
      no('beyond the search budget');
      continue;
    }
    if (!quick.solution) {
      no('unsolvable or longer than wanted');
      continue;
    }
    if (quick.solution.length < lo) {
      no('length outside the wanted range');
      continue;
    }
    if (new Set<Command>(quick.solution).size < 2) {
      no('trivial: one repeated command');
      continue;
    }
    if (quick.optimalCount > (recipe.maxSolutions ?? CONFIG.levelDesign.reject.maxSolutions)) {
      no('too loose: too many shortest solutions');
      continue;
    }
    // A gate the puzzle does not need: with every gate held open the shortest solutions are the same.
    if (level.board.gates) {
      const open = fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany, true), quick.solution.length, cap);
      if (open.solution?.length === quick.solution.length && open.optimalCount === quick.optimalCount) {
        no('does not show the idea');
        continue;
      }
    }
    // What can be read from replaying the one solution is checked before the costly full measurement.
    const replay = replayMeasures(level, quick.solution);
    const early = Object.fromEntries(Object.entries(recipe.require ?? {}).filter(([name]) => name.startsWith('tally.') || name in replay));
    if (!meets(replay as unknown as Metrics, early)) {
      no('does not show the idea');
      continue;
    }
    if (recipe.light) {
      const final = parseLevel({ id: 'candidate', name: 'candidate', grid });
      if (solve(final.board, final.start, quick.solution.length).solution?.length !== quick.solution.length) {
        no('the solver does not confirm the length');
        continue;
      }
      const par = quick.solution.length;
      const neutral = { ...replay, width: level.board.width, height: level.board.height, par, budget: par + CONFIG.moveSlack, solution: quick.solution,
        optimalSolutions: quick.optimalCount, searchStates: quick.visited, states: 0, deadShare: 1, fatalShare: 0.55, forcedPar: par, forcedBudget: 0,
        awaySteps: 0, bumpSteps: 0, orderFreedom: 0, capped: false };
      const { score, parts } = difficulty(neutral);
      candidates.push({ grid, metrics: { ...neutral, score, scoreParts: parts } });
      if (candidates.length >= keep * CONFIG.levelDesign.poolPerKept) break;
      continue;
    }
    const first = measure(level, { par: quick.solution.length, maxStates: cap * 20 });
    const reason = rejectReason(first, recipe);
    if (reason) {
      no(reason);
      continue;
    }
    // Walls that change nothing go; a board that then no longer shows its idea goes too.
    const tidy = first.walls > 0 || grid.some((row) => /@@|GG|PP/.test(row)) ? dropIdleWalls(grid, cap * 20, recipe.barrier ? ['##'] : []) : { grid, metrics: first };
    const after = rejectReason(tidy.metrics, recipe);
    if (after) {
      no(after);
      continue;
    }
    const key = tidy.grid.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    // The game's own solver must reach the same length, or the unit tests could never certify the board.
    const final = parseLevel({ id: 'candidate', name: 'candidate', grid: tidy.grid });
    const certified = solve(final.board, final.start, tidy.metrics.par ?? 0);
    if (certified.solution?.length !== tidy.metrics.par) {
      no('the solver does not confirm the length');
      continue;
    }
    candidates.push(tidy);
    // Enough to choose from: more would only cost time.
    if (candidates.length >= keep * CONFIG.levelDesign.poolPerKept) break;
  }
  candidates.sort((a, b) => b.metrics.score - a.metrics.score);
  // Spread the kept ones over the difficulty range instead of taking only the hardest.
  const kept: Candidate[] = [];
  for (let k = 0; k < Math.min(keep, candidates.length); k++) {
    kept.push(candidates[Math.floor((k * candidates.length) / Math.min(keep, candidates.length))]);
  }
  return { candidates: kept, rejected };
}

/** One line of numbers for a candidate or a level. */
export function summary(m: Metrics): string {
  return (
    `score ${m.score} · par ${m.par} · ${m.optimalSolutions} shortest · turns ${m.turns} · search ${m.searchStates} · ` +
    `fatal ${m.fatalShare} · forced ${m.forcedPar}/${m.par} · away ${m.awaySteps} · bump ${m.bumpSteps} · ` +
    `order ${m.orderFreedom} · exits at once ${m.maxExitsAtOnce} · sides ${m.exitSides} · tile turns ${m.tileTurns} · wrong door ${m.wrongDoor} · ${JSON.stringify(m.tally)}`
  );
}

function main(): void {
  const ideas = JSON.parse(readFileSync(new URL('./ideas.json', import.meta.url), 'utf8')) as Record<string, Recipe>;
  const [idea, ...rest] = process.argv.slice(2);
  if (!idea || !ideas[idea]) {
    console.log(`Usage: npm run generate -- <idea> [size=6x5] [seed=1] [tries=4000] [keep=8] [out=file.json]\nIdeas:`);
    for (const [key, r] of Object.entries(ideas)) console.log(`  ${key.padEnd(18)} ${r.teaches}`);
    process.exit(idea ? 1 : 0);
  }
  const args: Record<string, string> = Object.fromEntries(rest.map((a) => a.split('=') as [string, string]));
  const { seed = '1', tries = '4000', keep = '8', out, ...overrides } = args;
  const recipe: Record<string, unknown> = { ...ideas[idea] };
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith('require.')) recipe.require = { ...(recipe.require as object), [key.slice(8)]: value };
    else recipe[key] = value === 'true' ? true : value === 'false' ? false : value;
  }
  const t0 = Date.now();
  const { candidates, rejected } = generate(recipe as unknown as Recipe, Number(seed), Number(tries), Number(keep));
  console.log(`# ${idea} ${JSON.stringify(recipe)} seed=${seed} tries=${tries} · ${Date.now() - t0} ms`);
  console.log(`# rejected: ${JSON.stringify(rejected)}`);
  const file: Record<string, string[]> = {};
  candidates.forEach((c, i) => {
    const id = `${idea}-${recipe.size}-s${seed}-${i + 1}`;
    file[id] = c.grid;
    console.log(`\n# ${id}: ${summary(c.metrics)}\n# ${c.metrics.solution!.join(' ')}`);
    console.log(c.grid.map((g) => `      "${g}"`).join(',\n'));
  });
  if (out) writeFileSync(out, JSON.stringify(file, null, 1));
}

if (process.argv[1]?.endsWith('generate.ts')) main();
