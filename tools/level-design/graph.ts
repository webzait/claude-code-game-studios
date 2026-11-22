/**
 * Full state graph of a level up to a move budget, built with the game's own
 * `step` function. The solver answers "what is the shortest solution"; this
 * answers the questions around it: from which positions is the level still
 * winnable, how many shortest solutions exist, which presses are fatal.
 */
import { DEFAULT_RULES, isWon, step } from '../../src/engine/engine';
import { COMMANDS, type Board, type Command, type GameState, type Rules } from '../../src/engine/types';

/** Key of a state: a collected robot is code 0, a robot on the board is 1 + cell * 4 + dir. Independent of the engine's `stateKey` on purpose. */
function keyOf(state: GameState, width: number): string {
  let key = '';
  for (const r of state.robots) key += r.collected ? '\0' : String.fromCharCode(1 + (r.y * width + r.x) * 4 + r.dir);
  return key;
}

/** Child index meaning "this command wins the level". */
export const WIN = -2;
/** Child index meaning "command not available" (colour with no robots left) or "not expanded". */
export const NONE = -1;
/** Distance value meaning "cannot be won from here inside the explored graph". */
export const UNREACHABLE = 255;

/** The explored graph. State 0 is the start. */
export interface StateGraph {
  /** Number of distinct states (the won state is not one of them). */
  readonly size: number;
  /** Fewest moves from the start to each state. */
  readonly depth: Uint8Array;
  /** `children[s * 4 + c]`: state reached from `s` by `COMMANDS[c]`, or WIN / NONE. */
  readonly children: Int32Array;
  /** Fewest moves from each state to a win, or UNREACHABLE. */
  readonly toWin: Uint8Array;
  /** The move budget the graph was explored to. */
  readonly budget: number;
  /** True when exploration stopped at `maxStates`; every number is then a lower bound, not a fact. */
  readonly capped: boolean;
  /** Rebuild the game state of a node (for replaying a step and reading its events). */
  stateOf(index: number): GameState;
}

/**
 * Explore every state reachable from `start` in at most `budget` moves.
 * States at depth `budget` are recorded but not expanded: nothing can be done from them.
 */
export function buildGraph(
  board: Board,
  start: GameState,
  budget: number,
  rules: Rules = DEFAULT_RULES,
  maxStates = Infinity,
): StateGraph {
  const index = new Map<string, number>();
  const keys: string[] = [];
  let depth = new Uint8Array(1024);
  let children = new Int32Array(4096).fill(NONE);
  const grow = (): void => {
    const d = new Uint8Array(depth.length * 2);
    d.set(depth);
    depth = d;
    const c = new Int32Array(children.length * 2).fill(NONE);
    c.set(children);
    children = c;
  };
  const add = (state: GameState, d: number): number => {
    const key = keyOf(state, board.width);
    const known = index.get(key);
    if (known !== undefined) return known;
    const id = keys.length;
    if (id >= depth.length) grow();
    index.set(key, id);
    keys.push(key);
    depth[id] = d;
    return id;
  };
  let capped = false;
  if (!isWon(start)) {
    add(start, 0);
    let frontier: [number, GameState][] = [[0, start]];
    for (let d = 0; d < budget && frontier.length > 0 && !capped; d++) {
      const next: [number, GameState][] = [];
      for (const [id, state] of frontier) {
        const active = new Set<string>();
        for (const r of state.robots) if (!r.collected) active.add(r.color);
        for (let c = 0; c < COMMANDS.length; c++) {
          const command = COMMANDS[c];
          // A colour with no robots left behaves exactly like "forward" (the solver skips it too).
          if (command !== 'forward' && !active.has(command)) continue;
          const result = step(board, state, command, rules).state;
          if (isWon(result)) {
            children[id * 4 + c] = WIN;
            continue;
          }
          const before = keys.length;
          const child = add(result, d + 1);
          children[id * 4 + c] = child;
          if (child === before) next.push([child, result]);
        }
        if (keys.length > maxStates) {
          capped = true;
          break;
        }
      }
      frontier = next;
    }
  }
  const size = keys.length;

  // Distance to a win: breadth-first search backwards from the win over reversed edges.
  const toWin = new Uint8Array(size).fill(UNREACHABLE);
  const inCount = new Int32Array(size + 1);
  for (let e = 0; e < size * 4; e++) if (children[e] >= 0) inCount[children[e] + 1]++;
  for (let i = 0; i < size; i++) inCount[i + 1] += inCount[i];
  const fill = inCount.slice(0, size);
  const parents = new Int32Array(inCount[size]);
  let queue: number[] = [];
  for (let s = 0; s < size; s++) {
    for (let c = 0; c < 4; c++) {
      const child = children[s * 4 + c];
      if (child >= 0) parents[fill[child]++] = s;
      else if (child === WIN && toWin[s] === UNREACHABLE) {
        toWin[s] = 1;
        queue.push(s);
      }
    }
  }
  for (let dist = 2; queue.length > 0; dist++) {
    const next: number[] = [];
    for (const s of queue) {
      for (let p = inCount[s]; p < inCount[s + 1]; p++) {
        const parent = parents[p];
        if (toWin[parent] === UNREACHABLE) {
          toWin[parent] = dist;
          next.push(parent);
        }
      }
    }
    queue = next;
  }

  const stateOf = (i: number): GameState => {
    const key = keys[i];
    return {
      movesUsed: depth[i],
      robots: start.robots.map((r, k) => {
        const ch = key.charCodeAt(k);
        if (ch === 0) return { ...r, collected: true };
        const v = ch - 1;
        const cell = v >> 2;
        return { ...r, x: cell % board.width, y: Math.floor(cell / board.width), dir: (v & 3) as 0 | 1 | 2 | 3, collected: false };
      }),
    };
  };
  return { size, depth: depth.subarray(0, size), children: children.subarray(0, size * 4), toWin, budget, capped, stateOf };
}

/** Follow a command list from the start; returns the node after each command (WIN once won), or null if it leaves the graph. */
export function walk(graph: StateGraph, commands: readonly Command[]): number[] | null {
  const path: number[] = [];
  let s = 0;
  for (const command of commands) {
    if (s === WIN) return null;
    const child = graph.children[s * 4 + COMMANDS.indexOf(command)];
    if (child === NONE) return null;
    path.push(child);
    s = child;
  }
  return path;
}
