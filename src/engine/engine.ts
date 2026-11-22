import {
  DIR_DX,
  DIR_DY,
  type Board,
  type Color,
  type Exit,
  type Command,
  type Dir,
  type GameState,
  type Outcome,
  type Robot,
  type RobotEvent,
  type Rules,
  type StepResult,
} from './types';
import { CONFIG } from '../config';

/** Default rules used by the game and the solver. */
export const DEFAULT_RULES: Rules = CONFIG.rules;

/** True when the cell is outside the board or a wall. */
export function isSolid(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return true;
  return board.walls[y * board.width + x];
}

/** The exits of a board as a list, whether it has the one plain exit or several. */
export function exitsOf(board: Board): readonly Exit[] {
  return board.exits ?? [{ x: board.exitX, y: board.exitY, color: null }];
}

/** True when the cell holds an exit that takes a robot of this colour. */
export function exitTakes(board: Board, x: number, y: number, color: Color): boolean {
  for (const e of exitsOf(board)) if (e.x === x && e.y === y && (e.color === null || e.color === color)) return true;
  return false;
}

/** True when the board's gates are open in this state: some robot that is still on the board stands on a plate. */
export function gatesOpen(board: Board, state: GameState): boolean {
  if (!board.plates) return false;
  for (const r of state.robots) if (!r.collected && board.plates[r.y * board.width + r.x]) return true;
  return false;
}

/** True when every robot has been collected. */
export function isWon(state: GameState): boolean {
  return state.robots.every((r) => r.collected);
}

/** Number of robots collected so far. */
export function collectedCount(state: GameState): number {
  let n = 0;
  for (const r of state.robots) if (r.collected) n++;
  return n;
}

/**
 * Apply one command. Pure and deterministic: the same state and command always
 * give the same result. Order of resolution:
 *  1. robots of the commanded colour turn 90 degrees clockwise;
 *  2. every robot picks the cell in front of it;
 *     A closed gate blocks like a wall; gates are open while, before the step, a robot stands on a plate;
 *  3. walls block; two robots wanting the same cell block each other;
 *  4. a robot may enter an occupied cell only if its occupant really leaves;
 *  5. swaps and closed cycles do not move;
 *  6. robots that enter the exit are collected;
 *  7. a robot that arrived on a turn tile turns 90 degrees clockwise there. One that was already
 *     standing on the tile and stayed (blocked) does not turn again.
 */
export function step(
  board: Board,
  state: GameState,
  command: Command,
  rules: Rules = DEFAULT_RULES,
): StepResult {
  const n = state.robots.length;
  const cells = board.width * board.height;
  // Per robot: the cells where it would be collected (an exit of its colour, or one for everyone).
  const exits = exitsOf(board);
  const takes = (i: number, cell: number): boolean => {
    for (const e of exits) {
      if (e.y * board.width + e.x === cell && (e.color === null || e.color === state.robots[i].color)) return true;
    }
    return false;
  };

  // 1. Turn.
  const dirs: Dir[] = new Array(n);
  const turned: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = state.robots[i];
    const turns = !r.collected && command !== 'forward' && r.color === command;
    turned[i] = turns;
    dirs[i] = (turns ? (r.dir + 1) % 4 : r.dir) as Dir;
  }

  // Gates follow the position before the step: open while a robot stands on a plate.
  const open = gatesOpen(board, state);

  // 2. Intentions. target[i] = cell index, or -1 when not trying / walled.
  const occupant = new Int32Array(cells).fill(-1);
  for (let i = 0; i < n; i++) {
    const r = state.robots[i];
    if (!r.collected) occupant[r.y * board.width + r.x] = i;
  }
  const target = new Int32Array(n).fill(-1);
  const outcome: (Outcome | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const r = state.robots[i];
    if (r.collected) continue;
    const tx = r.x + DIR_DX[dirs[i]];
    const ty = r.y + DIR_DY[dirs[i]];
    if (isSolid(board, tx, ty)) outcome[i] = 'blocked-wall';
    else if (!open && board.gates?.[ty * board.width + tx]) outcome[i] = 'blocked-gate';
    else target[i] = ty * board.width + tx;
  }

  // 3. Same-target conflicts (robots entering an exit that takes them are exempt when it accepts many).
  const claims = new Int32Array(cells);
  for (let i = 0; i < n; i++) if (target[i] >= 0) claims[target[i]]++;
  for (let i = 0; i < n; i++) {
    const t = target[i];
    if (t < 0 || claims[t] < 2) continue;
    // Robots the exit takes do not get in each other's way; one it does not take is on plain floor there.
    if (rules.exitAcceptsMany && takes(i, t)) continue;
    outcome[i] = 'blocked-conflict';
  }

  // 4. Blocked by a robot that stays: repeat until nothing changes.
  const blockStayers = (): void => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (outcome[i] !== null || target[i] < 0) continue;
        const o = occupant[target[i]];
        if (o >= 0 && outcome[o] !== null) {
          outcome[i] = 'blocked-robot';
          changed = true;
        }
      }
    }
  };
  blockStayers();

  // 5. Remaining movers form chains or closed cycles. Cycles (incl. swaps) stay.
  for (let i = 0; i < n; i++) {
    if (outcome[i] !== null || target[i] < 0) continue;
    let j = i;
    let steps = 0;
    while (steps <= n) {
      const o = occupant[target[j]];
      if (o < 0 || outcome[o] !== null) break;
      j = o;
      steps++;
      if (j === i) {
        let k = i;
        do {
          outcome[k] = 'blocked-cycle';
          k = occupant[target[k]];
        } while (k !== i);
        break;
      }
    }
  }
  blockStayers();

  // 6. Commit.
  const robots: Robot[] = new Array(n);
  const events: RobotEvent[] = [];
  for (let i = 0; i < n; i++) {
    const r = state.robots[i];
    if (r.collected) {
      robots[i] = r;
      continue;
    }
    let x = r.x;
    let y = r.y;
    let collected = false;
    let result: Outcome;
    if (outcome[i] === null) {
      x = target[i] % board.width;
      y = (target[i] - x) / board.width;
      collected = takes(i, target[i]);
      result = collected ? 'exited' : 'moved';
    } else {
      result = outcome[i] as Outcome;
    }
    // 7. Turn tile: only on arrival.
    const tileTurned = result === 'moved' && board.turnTiles?.[y * board.width + x] === true;
    robots[i] = { id: r.id, color: r.color, x, y, dir: tileTurned ? (((dirs[i] + 1) % 4) as Dir) : dirs[i], collected };
    events.push({
      id: r.id,
      turned: turned[i],
      fromX: r.x,
      fromY: r.y,
      toX: x,
      toY: y,
      dir: dirs[i],
      outcome: result,
      tileTurned,
    });
  }
  return { state: { robots, movesUsed: state.movesUsed + 1 }, events };
}

/** Compact, order-stable key for a state (ignores move count). Used by the solver. */
export function stateKey(state: GameState, width: number): string {
  let key = '';
  for (const r of state.robots) {
    // A robot on the board is 48 or higher, so "!" (33) can only ever mean "collected".
    key += r.collected ? '!' : String.fromCharCode(48 + (r.y * width + r.x) * 4 + r.dir);
  }
  return key;
}
