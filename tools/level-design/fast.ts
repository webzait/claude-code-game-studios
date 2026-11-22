/**
 * A quick sieve for the generator: the same rules as src/engine/engine.ts written on
 * flat arrays, so thousands of candidate boards can be looked at per minute.
 *
 * It decides nothing about a shipped level. Whatever passes the sieve is measured again
 * with the real engine (measure.ts) and certified by the real solver in the unit tests;
 * tests/unit/level-tools.test.ts checks this copy against the engine move for move.
 */
import type { Board, Command, GameState } from '../../src/engine/types';
import { COMMANDS, DIR_DX, DIR_DY } from '../../src/engine/types';

const GONE = 255;

/** A board and start prepared for the sieve. */
export interface FastLevel {
  readonly width: number;
  readonly cells: number;
  readonly exit: number;
  readonly exitAcceptsMany: boolean;
  /** `next[cell * 4 + dir]`: the cell in front, or -1 for a wall or the edge. */
  readonly next: Int16Array;
  /** Colour of each robot as an index into COMMANDS (0 red, 1 blue, 2 yellow). */
  readonly colour: Uint8Array;
  /** Start: cell per robot, then heading per robot. */
  readonly start: Uint8Array;
  readonly n: number;
}

export function prepare(board: Board, start: GameState, exitAcceptsMany = true): FastLevel {
  const cells = board.width * board.height;
  const next = new Int16Array(cells * 4).fill(-1);
  for (let cell = 0; cell < cells; cell++) {
    const x = cell % board.width;
    const y = (cell - x) / board.width;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIR_DX[d];
      const ny = y + DIR_DY[d];
      if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height || board.walls[ny * board.width + nx]) continue;
      next[cell * 4 + d] = ny * board.width + nx;
    }
  }
  const n = start.robots.length;
  const state = new Uint8Array(n * 2);
  const colour = new Uint8Array(n);
  start.robots.forEach((r, i) => {
    state[i] = r.collected ? GONE : r.y * board.width + r.x;
    state[n + i] = r.dir;
    colour[i] = COMMANDS.indexOf(r.color);
  });
  return { width: board.width, cells, exit: board.exitY * board.width + board.exitX, exitAcceptsMany, next, colour, start: state, n };
}

/** Scratch arrays shared by every step on one level. */
function scratch(level: FastLevel): { occupant: Int16Array; claims: Uint8Array; target: Int16Array; blocked: Uint8Array } {
  return { occupant: new Int16Array(level.cells).fill(-1), claims: new Uint8Array(level.cells), target: new Int16Array(level.n), blocked: new Uint8Array(level.n) };
}

/**
 * One command: reads `from`, writes `to` (same layout as `FastLevel.start`).
 * `command` is an index into COMMANDS; 3 is FORWARD. Mirrors the six stages of the engine's `step`.
 */
export function fastStep(level: FastLevel, from: Uint8Array, to: Uint8Array, command: number, s = scratch(level)): void {
  const { n, next, colour, exit } = level;
  const { occupant, claims, target, blocked } = s;
  for (let i = 0; i < n; i++) {
    const cell = from[i];
    let dir = from[n + i];
    if (cell !== GONE && command !== 3 && colour[i] === command) dir = (dir + 1) & 3;
    to[n + i] = dir;
    target[i] = -1;
    blocked[i] = 0;
    if (cell === GONE) continue;
    occupant[cell] = i;
    const t = next[cell * 4 + dir];
    if (t < 0) blocked[i] = 1;
    else {
      target[i] = t;
      claims[t]++;
    }
  }
  for (let i = 0; i < n; i++) {
    const t = target[i];
    if (t >= 0 && claims[t] >= 2 && !(t === exit && level.exitAcceptsMany)) blocked[i] = 1;
  }
  const blockStayers = (): void => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (blocked[i] || target[i] < 0) continue;
        const o = occupant[target[i]];
        if (o >= 0 && blocked[o]) {
          blocked[i] = 1;
          changed = true;
        }
      }
    }
  };
  blockStayers();
  for (let i = 0; i < n; i++) {
    if (blocked[i] || target[i] < 0) continue;
    let j = i;
    for (let steps = 0; steps <= n; steps++) {
      const o = occupant[target[j]];
      if (o < 0 || blocked[o]) break;
      j = o;
      if (j === i) {
        let k = i;
        do {
          blocked[k] = 1;
          k = occupant[target[k]];
        } while (k !== i);
        break;
      }
    }
  }
  blockStayers();
  for (let i = 0; i < n; i++) {
    const cell = from[i];
    if (cell === GONE) {
      to[i] = GONE;
      continue;
    }
    occupant[cell] = -1;
    if (target[i] >= 0) claims[target[i]] = 0;
    to[i] = blocked[i] ? cell : target[i] === exit ? GONE : target[i];
  }
}

export interface FastResult {
  readonly solution: Command[] | null;
  readonly optimalCount: number;
  readonly visited: number;
  readonly capped: boolean;
}

/** Breadth-first search for the shortest solution, as src/solver/bfs.ts does it, on the flat arrays. */
export function fastSolve(level: FastLevel, maxMoves: number, maxVisited = Infinity): FastResult {
  const { n } = level;
  const size = n * 2;
  const s = scratch(level);
  const keyOf = (buf: Uint8Array, at: number): string => {
    let key = '';
    for (let i = 0; i < n; i++) key += String.fromCharCode(buf[at + i] === GONE ? 0 : 1 + buf[at + i] * 4 + buf[at + n + i]);
    return key;
  };
  const won = (buf: Uint8Array): boolean => {
    for (let i = 0; i < n; i++) if (buf[i] !== GONE) return false;
    return true;
  };
  if (won(level.start)) return { solution: [], optimalCount: 1, visited: 1, capped: false };
  let store = new Uint8Array(size * 1024);
  let parent = new Int32Array(1024);
  let via = new Uint8Array(1024);
  let ways = new Float64Array(1024);
  let count = 1;
  store.set(level.start, 0);
  parent[0] = -1;
  const seen = new Map<string, number>([[keyOf(store, 0), 0]]);
  const scratchTo = new Uint8Array(size);
  const from = new Uint8Array(size);
  let layerStart = 0;
  for (let depth = 1; depth <= maxMoves && layerStart < count; depth++) {
    const layerEnd = count;
    let winner = -1;
    let winCommand = 0;
    let winWays = 0;
    for (let node = layerStart; node < layerEnd; node++) {
      from.set(store.subarray(node * size, node * size + size));
      let active = 0;
      for (let i = 0; i < n; i++) if (from[i] !== GONE) active |= 1 << level.colour[i];
      for (let c = 0; c < 4; c++) {
        if (c !== 3 && !(active & (1 << c))) continue;
        fastStep(level, from, scratchTo, c, s);
        if (won(scratchTo)) {
          winWays += ways[node] || 1;
          if (winner < 0) {
            winner = node;
            winCommand = c;
          }
          continue;
        }
        const key = keyOf(scratchTo, 0);
        const known = seen.get(key);
        if (known !== undefined) {
          if (known >= layerEnd) ways[known] += ways[node] || 1;
          continue;
        }
        if (count >= parent.length) {
          const grow = <T extends Uint8Array | Int32Array | Float64Array>(a: T, per: number): T => {
            const b = new (a.constructor as new (len: number) => T)(count * 2 * per);
            b.set(a as never);
            return b;
          };
          store = grow(store, size);
          parent = grow(parent, 1);
          via = grow(via, 1);
          ways = grow(ways, 1);
        }
        store.set(scratchTo, count * size);
        parent[count] = node;
        via[count] = c;
        ways[count] = ways[node] || 1;
        seen.set(key, count);
        count++;
      }
      if (count > maxVisited) return { solution: null, optimalCount: 0, visited: count, capped: true };
    }
    if (winner >= 0) {
      const solution: Command[] = [COMMANDS[winCommand]];
      for (let node = winner; parent[node] >= 0; node = parent[node]) solution.unshift(COMMANDS[via[node]]);
      return { solution, optimalCount: winWays, visited: count, capped: false };
    }
    layerStart = layerEnd;
  }
  return { solution: null, optimalCount: 0, visited: count, capped: false };
}
