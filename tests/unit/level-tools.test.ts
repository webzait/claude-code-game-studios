import { describe, expect, it } from 'vitest';
import { isWon, stateKey, step } from '../../src/engine/engine';
import { COMMANDS, type Command, type GameState } from '../../src/engine/types';
import { solve } from '../../src/solver/bfs';
import { fastSolve, fastStep, prepare } from '../../tools/level-design/fast';
import { dropIdleWalls, generate, meets, randomGrid, rejectReason, type Recipe } from '../../tools/level-design/generate';
import { buildGraph, UNREACHABLE, WIN, walk } from '../../tools/level-design/graph';
import { exitDistances, measure, seeded } from '../../tools/level-design/measure';
import { board, run } from './helpers';

// Small boards whose numbers can be counted by hand; the counts are in the comments.
const ONE_STEP = ['r> EX'];
const CORRIDOR = ['r> .. EX'];
const SPIN = ['EX r^', '.. ..'];
const TWO_WAYS = ['r^ b^ EX', '.. .. ..'];
const SEALED = ['r> ## EX'];

describe('state graph', () => {
  it('counts the positions of a one-step board and which of them are lost', () => {
    // Budget 3. Start faces east. RED turns it south against the edge, and again west, and again north:
    // four positions (E, S, W, N), all on cell 0. Only the start can still win within three moves.
    const level = board(ONE_STEP);
    const graph = buildGraph(level.board, level.start, 3);
    expect(graph.size).toBe(4);
    expect([...graph.depth]).toEqual([0, 1, 2, 3]);
    expect(graph.toWin[0]).toBe(1);
    // Facing south it would take three more presses (west, north, then RED turns east and steps out):
    // the last of them falls outside the three moves, so inside this graph that position cannot win.
    expect(graph.toWin[1]).toBe(UNREACHABLE);
    expect(buildGraph(level.board, level.start, 5).toWin[1]).toBe(3);
    expect(graph.children[0 * 4 + COMMANDS.indexOf('forward')]).toBe(WIN);
    expect(graph.capped).toBe(false);
  });

  it('marks a sealed exit as unreachable from everywhere', () => {
    const level = board(SEALED);
    const graph = buildGraph(level.board, level.start, 6);
    expect([...graph.toWin].every((d) => d === UNREACHABLE)).toBe(true);
  });

  it('rebuilds the game state of a node and follows a command list', () => {
    const level = board(CORRIDOR);
    const graph = buildGraph(level.board, level.start, 4);
    const path = walk(graph, ['forward', 'forward'])!;
    expect(path[1]).toBe(WIN);
    expect(graph.stateOf(path[0]).robots[0]).toMatchObject({ x: 1, y: 0, dir: 1, collected: false });
  });

  it('reports a capped search instead of pretending it finished', () => {
    const level = board(['r> .. .. ..', 'b^ .. .. ..', '.. .. .. EX']);
    expect(buildGraph(level.board, level.start, 12, undefined, 50).capped).toBe(true);
  });
});

describe('measures on known boards', () => {
  it('one step: half of the presses are fatal, three of four positions are dead', () => {
    const m = measure(board(ONE_STEP));
    expect(m).toMatchObject({ par: 1, budget: 3, optimalSolutions: 1, states: 4, deadShare: 0.75, fatalShare: 0.5, forcedPar: 1, forcedBudget: 1 });
    expect(m.solution).toEqual(['forward']);
  });

  it('a straight corridor is one repeated command that works in any order', () => {
    const m = measure(board(CORRIDOR));
    expect(m).toMatchObject({ par: 2, turns: 0, commandsUsed: 1, orderFreedom: 1, awaySteps: 0, bumpSteps: 0 });
    expect(rejectReason(m, { par: '1..' })).toBe('trivial: one repeated command');
  });

  it('sees a move that looks wrong: bumping on purpose and stepping away from the exit', () => {
    // The robot is next to the exit but faces north. Clockwise only: RED east (bump), RED south (steps away),
    // RED west (walks back under the exit), RED north (in). No shorter way, and no way without those two moves.
    const m = measure(board(SPIN));
    expect(m.solution).toEqual(['red', 'red', 'red', 'red']);
    expect(m).toMatchObject({ par: 4, optimalSolutions: 1, awaySteps: 1, bumpSteps: 1, turns: 4 });
  });

  it('counts every shortest solution, as the solver does', () => {
    const level = board(TWO_WAYS);
    const m = measure(level);
    const solved = solve(level.board, level.start, 8, undefined, true);
    expect(m.par).toBe(solved.solution!.length);
    expect(m.optimalSolutions).toBe(solved.optimalCount);
  });

  it('counts sides of the exit and robots entering together', () => {
    const m = measure(board(['r> EX b<', '.. y^ ..']));
    expect(m).toMatchObject({ par: 1, exitSides: 3, maxExitsAtOnce: 3, robots: 3, colours: 3 });
  });

  it('gives an unsolvable board no length and no score', () => {
    const m = measure(board(SEALED), { maxPar: 6 });
    expect(m).toMatchObject({ par: null, score: 0, optimalSolutions: 0 });
    expect(rejectReason(m, { par: '1..' })).toBe('unsolvable');
  });

  it('measures walking distance around walls', () => {
    const dist = exitDistances(board(['EX ## r^', '.. .. ..']).board);
    expect([...dist]).toEqual([0, -1, 4, 1, 2, 3]);
  });

  it('scores a longer, narrower board above a short one', () => {
    expect(measure(board(SPIN)).score).toBeGreaterThan(measure(board(ONE_STEP)).score);
  });
});

describe('generator', () => {
  const recipe: Recipe = { teaches: 'test', size: '4x4', red: 2, blue: 1, walls: '0..2', par: '4..7', maxSolutions: 2, cap: 20000 };

  it('places exactly what the recipe asks for', () => {
    const grid = randomGrid({ ...recipe, walls: 2, exit: 'inside' }, seeded(3))!;
    const cells = grid.join(' ').split(' ');
    expect(cells.length).toBe(16);
    expect(cells.filter((c) => c[0] === 'r').length).toBe(2);
    expect(cells.filter((c) => c[0] === 'b').length).toBe(1);
    expect(cells.filter((c) => c === '##').length).toBe(2);
    const exit = cells.indexOf('EX');
    expect([5, 6, 9, 10]).toContain(exit);
  });

  it('gives the same candidates for the same seed, and every one passes its own recipe', () => {
    const a = generate(recipe, 7, 150, 4);
    const b = generate(recipe, 7, 150, 4);
    expect(a.candidates.map((c) => c.grid)).toEqual(b.candidates.map((c) => c.grid));
    expect(a.candidates.length).toBeGreaterThan(0);
    for (const c of a.candidates) {
      expect(rejectReason(c.metrics, recipe)).toBeNull();
      // The proposed solution really wins on the real engine.
      const level = board(c.grid);
      expect(isWon(run(level, c.metrics.solution!))).toBe(true);
      expect(solve(level.board, level.start, c.metrics.par!).solution?.length).toBe(c.metrics.par);
    }
    expect(Object.values(a.rejected).reduce((x, y) => x + y, 0)).toBeGreaterThan(0);
  });

  it('rejects a board that is too loose or does not show its idea', () => {
    const m = measure(board(TWO_WAYS));
    expect(rejectReason(m, { par: '1..', maxSolutions: 0 })).toBe('too loose: too many shortest solutions');
    expect(rejectReason(m, { par: '9..' })).toBe('length outside the wanted range');
    expect(meets(m, { 'tally.blocked-conflict': '1..' })).toBe(false);
    expect(meets(m, { par: `${m.par}`, 'tally.exited': 2 })).toBe(true);
  });

  it('removes a wall the puzzle does not need and keeps one it does', () => {
    // The wall above the nearer robot makes it wait in the exit row until the other one arrives.
    // The far robot arrives exactly on time, so the wall above it changes nothing; nor does the one in the corner.
    const tidy = dropIdleWalls(['.. .. .. .. ..', '## .. ## .. ..', '.. .. .. .. EX', '.. .. r^ .. ..', 'r^ .. .. .. ##']);
    expect(tidy.grid).toEqual(['.. .. .. .. ..', '.. .. ## .. ..', '.. .. .. .. EX', '.. .. r^ .. ..', 'r^ .. .. .. ..']);
  });
});

describe('sieve (fast.ts) against the real engine', () => {
  it('moves every robot exactly as the engine does, under both exit rules', () => {
    const rnd = seeded(5);
    let compared = 0;
    for (let i = 0; i < 120; i++) {
      const grid = randomGrid({ teaches: '', size: i % 2 ? '4x4' : '6x5', red: '2..4', blue: '1..3', yellow: '0..3', walls: '0..4', exit: 'any', par: '1..' }, rnd);
      if (!grid) continue;
      const level = board(grid);
      for (const many of [true, false]) {
        const fast = prepare(level.board, level.start, many);
        let state: GameState = level.start;
        const a = fast.start.slice();
        const b = new Uint8Array(a.length);
        for (let k = 0; k < 30; k++) {
          const c = Math.floor(rnd() * 4);
          state = step(level.board, state, COMMANDS[c], { exitAcceptsMany: many }).state;
          fastStep(fast, a, b, c);
          a.set(b);
          const engine = state.robots.map((r) => (r.collected ? 'gone' : `${r.y * level.board.width + r.x}:${r.dir}`));
          const sieve = state.robots.map((_, j) => (a[j] === 255 ? 'gone' : `${a[j]}:${a[fast.n + j]}`));
          expect(sieve).toEqual(engine);
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(5000);
  });

  it('finds the same shortest length and the same number of shortest solutions as the solver', () => {
    for (const grid of [ONE_STEP, CORRIDOR, SPIN, TWO_WAYS, ['.. .. .. EX', 'r^ .. b< ..', '.. r> .. ..']]) {
      const level = board(grid);
      const a = solve(level.board, level.start, 12, undefined, true);
      const b = fastSolve(prepare(level.board, level.start), 12);
      expect(b.solution?.length).toBe(a.solution?.length);
      expect(b.optimalCount).toBe(a.optimalCount);
      expect(isWon(run(level, b.solution as Command[]))).toBe(true);
    }
  });
});

/**
 * Regression tests for a defect found while measuring levels: `stateKey` wrote a collected robot as
 * "~" (character 126), which is also the code of a robot on cell 19 facing south (48 + 19 * 4 + 2).
 * The solver then took two different positions for the same one and could drop the route to the win.
 * Both tests were seen failing against that code before the key was changed.
 */
describe('state keys never collide between a collected robot and a robot on the board', () => {
  it('gives different positions different keys', () => {
    const level = board(['r> .. .. .. ..', '.. .. .. .. ..', '.. .. .. .. ..', '.. .. .. .. rv', '.. .. .. .. EX']);
    const [a, b] = level.start.robots;
    const gone: GameState = { movesUsed: 0, robots: [a, { ...b, collected: true }] };
    expect(b.y * level.board.width + b.x).toBe(19);
    expect(stateKey(level.start, level.board.width)).not.toBe(stateKey(gone, level.board.width));
  });

  it('the solver finds a nine-move win that exists', () => {
    const level = board(['EX .. .. .. ..', '.. .. .. r^ ..', '.. .. .. .. ..', '## b< .. .. ..']);
    const win: Command[] = ['blue', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'red', 'blue'];
    // The nine moves really win, on the real engine...
    expect(isWon(run(level, win))).toBe(true);
    // ...and the solver, given ten moves, finds it.
    expect(solve(level.board, level.start, 10).solution?.length).toBe(9);
  });
});
