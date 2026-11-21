// PROTOTYPE - NOT FOR PRODUCTION
import {
  DIR_DX,
  DIR_DY,
  type Board,
  type Command,
  type Dir,
  type GameState,
  type Outcome,
  type Robot,
  type RobotEvent,
  type Rules,
  type StepResult,
} from './types';

/** Default rules used by the game and the solver. */
export const DEFAULT_RULES: Rules = { exitAcceptsMany: true };

/** True when the cell is outside the board or a wall. */
export function isSolid(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return true;
  return board.walls[y * board.width + x];
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
 *  3. walls block; two robots wanting the same cell block each other;
 *  4. a robot may enter an occupied cell only if its occupant really leaves;
 *  5. swaps and closed cycles do not move;
 *  6. robots that enter the exit are collected.
 */
export function step(
  board: Board,
  state: GameState,
  command: Command,
  rules: Rules = DEFAULT_RULES,
): StepResult {
  const n = state.robots.length;
  const cells = board.width * board.height;
  const exitCell = board.exitY * board.width + board.exitX;

  // 1. Turn.
  const dirs: Dir[] = new Array(n);
  const turned: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = state.robots[i];
    const turns = !r.collected && command !== 'forward' && r.color === command;
    turned[i] = turns;
    dirs[i] = (turns ? (r.dir + 1) % 4 : r.dir) as Dir;
  }

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
    else target[i] = ty * board.width + tx;
  }

  // 3. Same-target conflicts (the exit is exempt when it accepts many).
  const claims = new Int32Array(cells);
  for (let i = 0; i < n; i++) if (target[i] >= 0) claims[target[i]]++;
  for (let i = 0; i < n; i++) {
    const t = target[i];
    if (t < 0 || claims[t] < 2) continue;
    if (t === exitCell && rules.exitAcceptsMany) continue;
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
      collected = target[i] === exitCell;
      result = collected ? 'exited' : 'moved';
    } else {
      result = outcome[i] as Outcome;
    }
    robots[i] = { id: r.id, color: r.color, x, y, dir: dirs[i], collected };
    events.push({
      id: r.id,
      turned: turned[i],
      fromX: r.x,
      fromY: r.y,
      toX: x,
      toY: y,
      dir: dirs[i],
      outcome: result,
    });
  }
  return { state: { robots, movesUsed: state.movesUsed + 1 }, events };
}

/** Compact, order-stable key for a state (ignores move count). Used by the solver. */
export function stateKey(state: GameState, width: number): string {
  let key = '';
  for (const r of state.robots) {
    key += r.collected ? '~' : String.fromCharCode(48 + (r.y * width + r.x) * 4 + r.dir);
  }
  return key;
}
