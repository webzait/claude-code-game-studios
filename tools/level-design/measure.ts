/**
 * Measures a level with the solver's rules: how long, how narrow, how unforgiving,
 * and whether the solution asks for a move that looks wrong. All numbers come from
 * the state graph (graph.ts); none is typed in by hand.
 */
import { step } from '../../src/engine/engine';
import { COMMANDS, DIR_DX, DIR_DY, type Board, type Command, type Outcome, type Rules } from '../../src/engine/types';
import { CONFIG } from '../../src/config';
import type { Level } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';
import { buildGraph, NONE, UNREACHABLE, WIN, walk, type StateGraph } from './graph';

/** Everything the tools know about one level. */
export interface Metrics {
  readonly width: number;
  readonly height: number;
  readonly walls: number;
  /** Turn tiles on the board. */
  readonly tiles: number;
  readonly robots: number;
  readonly colours: number;
  /** Length of the shortest solution; null when the level cannot be won within the explored budget. */
  readonly par: number | null;
  /** Move budget used for the measurement (par + slack). */
  readonly budget: number;
  /** One shortest solution. */
  readonly solution: Command[] | null;
  /** Number of different shortest command lists. */
  readonly optimalSolutions: number;
  /** States a breadth-first search visits before it finds the shortest solution. */
  readonly searchStates: number;
  /** States reachable within the budget. */
  readonly states: number;
  /** Share of those states from which the level can no longer be won within the budget. */
  readonly deadShare: number;
  /** Share of presses, taken from a still-winnable position, that make the level unwinnable within the budget. */
  readonly fatalShare: number;
  /** Commands of the solution where every other command leaves the shortest route. */
  readonly forcedPar: number;
  /** Commands of the solution where every other command loses the level (budget included). */
  readonly forcedBudget: number;
  /** Fewest moves, over all shortest solutions, in which some robot steps away from the exit. */
  readonly awaySteps: number;
  /** Fewest moves, over all shortest solutions, in which some robot is blocked while the flock goes on. */
  readonly bumpSteps: number;
  /** Share of the reorderings of the solution's commands that also win (1 = any order works). */
  readonly orderFreedom: number;
  /** Colour commands in the solution (the rest are FORWARD). */
  readonly turns: number;
  /** Sides from which robots enter the exit along the solution (1 to 4). */
  readonly exitSides: number;
  /** Different commands the solution uses. */
  readonly commandsUsed: number;
  /** What happened to the robots along the solution. */
  readonly tally: Partial<Record<Outcome, number>>;
  /** Most robots entering the exit in a single move. */
  readonly maxExitsAtOnce: number;
  /** Times a turn tile turned a robot along the solution. */
  readonly tileTurns: number;
  /** True when the search stopped at its state limit: the numbers are then lower bounds, not facts. */
  readonly capped: boolean;
  /** Difficulty on a 0–10 scale, and what it is made of. */
  readonly score: number;
  readonly scoreParts: Record<string, number>;
}

export interface MeasureOptions {
  readonly slack?: number;
  readonly rules?: Rules;
  /** Give up on the full graph above this many states. */
  readonly maxStates?: number;
  /** Longest solution looked for when par is unknown. */
  readonly maxPar?: number;
  /** Known shortest length: skips the search for it. */
  readonly par?: number;
}

/** Steps from every cell to the exit around the walls, ignoring robots (-1: walled off). */
export function exitDistances(board: Board): Int16Array {
  const dist = new Int16Array(board.width * board.height).fill(-1);
  const exit = board.exitY * board.width + board.exitX;
  dist[exit] = 0;
  let queue = [exit];
  while (queue.length > 0) {
    const next: number[] = [];
    for (const cell of queue) {
      const x = cell % board.width;
      const y = (cell - x) / board.width;
      for (let d = 0; d < 4; d++) {
        const nx = x + DIR_DX[d];
        const ny = y + DIR_DY[d];
        if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height) continue;
        const n = ny * board.width + nx;
        if (board.walls[n] || dist[n] >= 0) continue;
        dist[n] = dist[cell] + 1;
        next.push(n);
      }
    }
    queue = next;
  }
  return dist;
}

/** Number of different orderings of a command list. */
function arrangements(commands: readonly Command[]): number {
  const counts = new Map<Command, number>();
  let total = 1;
  let n = 0;
  for (const c of commands) {
    const k = (counts.get(c) ?? 0) + 1;
    counts.set(c, k);
    n++;
    total = (total * n) / k;
  }
  return Math.round(total);
}

/** Small seeded generator, so sampled measures are the same on every run. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function orderFreedom(graph: StateGraph, solution: readonly Command[], samples: number): number {
  const total = arrangements(solution);
  const wins = (order: readonly Command[]): boolean => {
    const path = walk(graph, order);
    return path !== null && path[path.length - 1] === WIN;
  };
  if (total <= samples) {
    // Every distinct ordering, by recursion over the remaining counts.
    const counts = new Map<Command, number>();
    for (const c of solution) counts.set(c, (counts.get(c) ?? 0) + 1);
    let won = 0;
    const current: Command[] = [];
    const visit = (): void => {
      if (current.length === solution.length) {
        if (wins(current)) won++;
        return;
      }
      for (const [c, k] of counts) {
        if (k === 0) continue;
        counts.set(c, k - 1);
        current.push(c);
        visit();
        current.pop();
        counts.set(c, k);
      }
    };
    visit();
    return won / total;
  }
  const rnd = seeded(solution.length * 7919 + total);
  let won = 0;
  for (let i = 0; i < samples; i++) {
    const order = solution.slice();
    for (let j = order.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1));
      [order[j], order[k]] = [order[k], order[j]];
    }
    if (wins(order)) won++;
  }
  return won / samples;
}

/** The measures that need only one solution replayed on the engine (cheap; the generator checks these first). */
export function replayMeasures(
  level: Level,
  solution: readonly Command[],
  rules?: Rules,
): { tally: Partial<Record<Outcome, number>>; maxExitsAtOnce: number; tileTurns: number; exitSides: number; turns: number; commandsUsed: number; walls: number; tiles: number; robots: number; colours: number } {
  const tally: Partial<Record<Outcome, number>> = {};
  const sides = new Set<number>();
  let maxExitsAtOnce = 0;
  let tileTurns = 0;
  let state = level.start;
  for (const command of solution) {
    const result = step(level.board, state, command, rules);
    let exits = 0;
    for (const e of result.events) {
      tally[e.outcome] = (tally[e.outcome] ?? 0) + 1;
      if (e.tileTurned) tileTurns++;
      if (e.outcome === 'exited') {
        exits++;
        sides.add(e.dir);
      }
    }
    maxExitsAtOnce = Math.max(maxExitsAtOnce, exits);
    state = result.state;
  }
  return {
    tally,
    maxExitsAtOnce,
    tileTurns,
    exitSides: sides.size,
    turns: solution.filter((c) => c !== 'forward').length,
    commandsUsed: new Set(solution).size,
    walls: level.board.walls.filter(Boolean).length,
    tiles: level.board.turnTiles?.filter(Boolean).length ?? 0,
    robots: level.start.robots.length,
    colours: new Set(level.start.robots.map((r) => r.color)).size,
  };
}

const round = (v: number, digits = 3): number => Number(v.toFixed(digits));

/** The difficulty score from the measured numbers. Weights: `levelDesign.score` in data/config.json. */
export function difficulty(m: Omit<Metrics, 'score' | 'scoreParts'>): { score: number; parts: Record<string, number> } {
  const w = CONFIG.levelDesign.score;
  if (m.par === null) return { score: 0, parts: {} };
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  const parts: Record<string, number> = {
    // How much there is to search: positions a breadth-first search visits before the first win.
    search: w.search * clamp((Math.log2(m.searchStates) - w.searchFrom) / (w.searchTo - w.searchFrom)),
    // How many times a colour has to be turned: walking on is easy, deciding to turn is the thinking.
    turns: w.turns * clamp(m.turns / w.turnsTo),
    // How much there is to keep an eye on.
    robots: w.robots * clamp(Math.log2(m.robots) / Math.log2(w.robotsTo)),
    // How much of the solution allows no alternative and no other order.
    narrow: w.narrow * clamp((m.forcedPar / m.par) * (1 - m.orderFreedom)),
    // How quickly a wrong press loses the level.
    unforgiving: w.unforgiving * clamp((m.fatalShare - w.fatalFrom) / (w.fatalTo - w.fatalFrom)),
    // Moves that look wrong: walking away from the exit, bumping on purpose.
    wrongLooking: w.wrongLooking * clamp((m.awaySteps + m.bumpSteps) / m.par),
  };
  for (const key of Object.keys(parts)) parts[key] = round(parts[key], 2);
  const score = round(Object.values(parts).reduce((a, b) => a + b, 0), 1);
  return { score, parts };
}

/** Measure one level. Explores the whole state graph up to the move budget. */
export function measure(level: Level, options: MeasureOptions = {}): Metrics {
  const slack = options.slack ?? CONFIG.moveSlack;
  const maxStates = options.maxStates ?? CONFIG.levelDesign.maxStates;
  const { board, start } = level;
  // The solver finds the length first (cheap); the graph is then explored to exactly the budget.
  const known = options.par ?? solve(board, start, options.maxPar ?? CONFIG.levelDesign.maxPar, options.rules, false, maxStates).solution?.length;
  const budget = (known ?? 0) + slack;
  const graph = buildGraph(board, start, known === undefined ? 0 : budget, options.rules, maxStates);
  const par = graph.size > 0 && graph.toWin[0] !== UNREACHABLE ? graph.toWin[0] : null;
  const colours = new Set(start.robots.map((r) => r.color)).size;
  const base = {
    width: board.width,
    height: board.height,
    walls: board.walls.filter(Boolean).length,
    tiles: board.turnTiles?.filter(Boolean).length ?? 0,
    robots: start.robots.length,
    colours,
    budget,
    states: graph.size,
    capped: graph.capped,
  };
  if (par === null) {
    return {
      ...base, par: null, solution: null, optimalSolutions: 0, searchStates: graph.size, deadShare: 1, fatalShare: 1,
      forcedPar: 0, forcedBudget: 0, awaySteps: 0, bumpSteps: 0, orderFreedom: 0, turns: 0, exitSides: 0, commandsUsed: 0, tally: {}, maxExitsAtOnce: 0, tileTurns: 0,
      score: 0, scoreParts: {},
    };
  }
  const { depth, children, toWin, size } = graph;
  const alive = (s: number): boolean => toWin[s] !== UNREACHABLE && depth[s] + toWin[s] <= budget;

  let dead = 0;
  let searchStates = 0;
  let presses = 0;
  let fatal = 0;
  for (let s = 0; s < size; s++) {
    if (depth[s] <= par) searchStates++;
    if (!alive(s)) {
      dead++;
      continue;
    }
    for (let c = 0; c < 4; c++) {
      const child = children[s * 4 + c];
      if (child === NONE) continue;
      presses++;
      // A press costs a move, so the child is judged at this state's depth + 1, not its own best depth.
      if (child !== WIN && (toWin[child] === UNREACHABLE || depth[s] + 1 + toWin[child] > budget)) fatal++;
    }
  }

  // Shortest solutions form a graph without loops: edges that bring the win one move closer.
  const onRoute = (s: number, c: number): boolean => {
    const child = children[s * 4 + c];
    return child === WIN ? toWin[s] === 1 : child >= 0 && toWin[child] === toWin[s] - 1;
  };
  const dist = exitDistances(board);
  const ways = new Map<number, number>();
  const least = new Map<number, [number, number]>();
  const visit = (s: number): void => {
    if (ways.has(s)) return;
    let count = 0;
    let away = Infinity;
    let bump = Infinity;
    const state = graph.stateOf(s);
    for (let c = 0; c < 4; c++) {
      if (!onRoute(s, c)) continue;
      const child = children[s * 4 + c];
      let stepAway = 0;
      let stepBump = 0;
      for (const e of step(board, state, COMMANDS[c], options.rules).events) {
        if (e.outcome.startsWith('blocked')) stepBump = 1;
        else if (dist[e.toY * board.width + e.toX] > dist[e.fromY * board.width + e.fromX]) stepAway = 1;
      }
      if (child === WIN) {
        count += 1;
        away = Math.min(away, stepAway);
        bump = Math.min(bump, stepBump);
      } else {
        visit(child);
        count += ways.get(child)!;
        const [a, b] = least.get(child)!;
        away = Math.min(away, stepAway + a);
        bump = Math.min(bump, stepBump + b);
      }
    }
    ways.set(s, count);
    least.set(s, [away, bump]);
  };
  visit(0);

  // One shortest solution, always taking the first command in the fixed order (same witness every run).
  const solution: Command[] = [];
  const tally: Partial<Record<Outcome, number>> = {};
  let forcedPar = 0;
  let forcedBudget = 0;
  let maxExitsAtOnce = 0;
  let tileTurns = 0;
  const sides = new Set<number>();
  for (let s = 0; s !== WIN; ) {
    let pick = -1;
    let routeChoices = 0;
    let liveChoices = 0;
    for (let c = 0; c < 4; c++) {
      const child = children[s * 4 + c];
      if (child === NONE) continue;
      if (onRoute(s, c)) {
        routeChoices++;
        if (pick < 0) pick = c;
      }
      if (child === WIN || (toWin[child] !== UNREACHABLE && depth[s] + 1 + toWin[child] <= budget)) liveChoices++;
    }
    if (routeChoices === 1) forcedPar++;
    if (liveChoices === 1) forcedBudget++;
    let exits = 0;
    for (const e of step(board, graph.stateOf(s), COMMANDS[pick], options.rules).events) {
      tally[e.outcome] = (tally[e.outcome] ?? 0) + 1;
      if (e.tileTurned) tileTurns++;
      if (e.outcome === 'exited') {
        exits++;
        sides.add(e.dir);
      }
    }
    maxExitsAtOnce = Math.max(maxExitsAtOnce, exits);
    solution.push(COMMANDS[pick]);
    s = children[s * 4 + pick];
  }

  const partial = {
    ...base,
    par,
    solution,
    optimalSolutions: ways.get(0)!,
    searchStates,
    deadShare: round(dead / size),
    fatalShare: round(presses === 0 ? 0 : fatal / presses),
    forcedPar,
    forcedBudget,
    awaySteps: least.get(0)![0],
    bumpSteps: least.get(0)![1],
    orderFreedom: round(orderFreedom(graph, solution, CONFIG.levelDesign.orderSamples)),
    turns: solution.filter((c) => c !== 'forward').length,
    exitSides: sides.size,
    commandsUsed: new Set(solution).size,
    tally,
    maxExitsAtOnce,
    tileTurns,
  };
  const { score, parts } = difficulty(partial);
  return { ...partial, score, scoreParts: parts };
}
