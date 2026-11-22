import type { Board, Color, Dir, Exit, GameState, Robot } from '../engine/types';

/**
 * A level as authored. `grid` is one string per row, cells separated by spaces:
 *   `..` floor   `##` wall   `EX` exit   `@@` turn tile (floor that turns whoever steps onto it)
 *   `PP` pressure plate   `GG` gate (floor that can be entered only while a robot stands on a plate)
 *   `ER EB EY` exit that takes only red, blue or yellow robots (plain floor to the others)
 *   `r^ r> rv r<` red robot facing up/right/down/left (also `b`, `y`).
 */
export interface LevelDef {
  readonly id: string;
  readonly name: string;
  readonly grid: readonly string[];
}

/** A level ready to play. */
export interface Level {
  readonly id: string;
  readonly name: string;
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
  const turnTiles: boolean[] = new Array(width * height).fill(false);
  const plates: boolean[] = new Array(width * height).fill(false);
  const gates: boolean[] = new Array(width * height).fill(false);
  const robots: Robot[] = [];
  const exits: Exit[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id}: row ${y} has ${row.length} cells, expected ${width}`);
    row.forEach((cell, x) => {
      if (cell === '..') return;
      if (cell === '##') walls[y * width + x] = true;
      else if (cell === '@@') turnTiles[y * width + x] = true;
      else if (cell === 'PP') plates[y * width + x] = true;
      else if (cell === 'GG') gates[y * width + x] = true;
      else if (cell === 'EX') exits.push({ x, y, color: null });
      else if (cell.length === 2 && cell[0] === 'E' && COLORS[cell[1].toLowerCase()] && cell[1] !== cell[1].toLowerCase()) exits.push({ x, y, color: COLORS[cell[1].toLowerCase()] });
      else if (cell.length === 2 && COLORS[cell[0]] && DIRS[cell[1]] !== undefined) {
        robots.push({ id: robots.length, color: COLORS[cell[0]], x, y, dir: DIRS[cell[1]], collected: false });
      } else throw new Error(`${def.id}: unknown cell "${cell}" at ${x},${y}`);
    });
  });
  if (exits.length === 0) throw new Error(`${def.id}: no exit`);
  if (robots.length === 0) throw new Error(`${def.id}: no robots`);
  for (const r of robots) {
    if (!exits.some((e) => e.color === null || e.color === r.color)) throw new Error(`${def.id}: no exit takes the ${r.color} robots`);
  }
  if (gates.some(Boolean) && !plates.some(Boolean)) throw new Error(`${def.id}: a gate but no plate to open it`);
  // The one plain exit keeps the board as it always was; anything else lists its exits.
  const plain = exits.length === 1 && exits[0].color === null;
  const board: Board = {
    width,
    height,
    walls,
    exitX: exits[0].x,
    exitY: exits[0].y,
    ...(plain ? {} : { exits }),
    ...(turnTiles.some(Boolean) ? { turnTiles } : {}),
    ...(plates.some(Boolean) ? { plates } : {}),
    ...(gates.some(Boolean) ? { gates } : {}),
  };
  return { id: def.id, name: def.name, board, start: { robots, movesUsed: 0 } };
}
