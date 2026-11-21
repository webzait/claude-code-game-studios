import type { Board, Color, Dir, GameState, Robot } from '../engine/types';

/**
 * A level as authored. `grid` is one string per row, cells separated by spaces:
 *   `..` floor   `##` wall   `EX` exit
 *   `r^ r> rv r<` red robot facing up/right/down/left (also `b`, `y`).
 */
export interface LevelDef {
  readonly id: string;
  readonly name: string;
  readonly moveBudget: number;
  readonly grid: readonly string[];
}

/** A level ready to play. */
export interface Level {
  readonly id: string;
  readonly name: string;
  readonly moveBudget: number;
  readonly board: Board;
  readonly start: GameState;
}

const COLORS: Record<string, Color> = { r: 'red', b: 'blue', y: 'yellow' };
const DIRS: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };

/** Turn an authored level into a board and a start state. Throws on malformed input. */
export function parseLevel(def: LevelDef): Level {
  const rows = def.grid.map((row) => row.trim().split(/\s+/));
  const height = rows.length;
  const width = rows[0].length;
  const walls: boolean[] = new Array(width * height).fill(false);
  const robots: Robot[] = [];
  let exitX = -1;
  let exitY = -1;
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id}: row ${y} has ${row.length} cells, expected ${width}`);
    row.forEach((cell, x) => {
      if (cell === '..') return;
      if (cell === '##') walls[y * width + x] = true;
      else if (cell === 'EX') {
        if (exitX >= 0) throw new Error(`${def.id}: more than one exit`);
        exitX = x;
        exitY = y;
      } else if (cell.length === 2 && COLORS[cell[0]] && DIRS[cell[1]] !== undefined) {
        robots.push({ id: robots.length, color: COLORS[cell[0]], x, y, dir: DIRS[cell[1]], collected: false });
      } else throw new Error(`${def.id}: unknown cell "${cell}" at ${x},${y}`);
    });
  });
  if (exitX < 0) throw new Error(`${def.id}: no exit`);
  if (robots.length === 0) throw new Error(`${def.id}: no robots`);
  return {
    id: def.id,
    name: def.name,
    moveBudget: def.moveBudget,
    board: { width, height, walls, exitX, exitY },
    start: { robots, movesUsed: 0 },
  };
}
