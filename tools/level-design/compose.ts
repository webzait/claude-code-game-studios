/**
 * Level design aid: given a hand-drawn board and an intended command list,
 * finds robot sets that all exit under that list, then asks the solver for the
 * true optimum. A designer picks and edits the result.
 * Usage: tsx tools/level-design/compose.ts <spec.json>
 */
import { readFileSync } from 'node:fs';
import { isWon, step } from '../../src/engine/engine';
import type { Color, Command, GameState, Outcome } from '../../src/engine/types';
import { parseLevel, type Level } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';

interface Spec {
  grid: string[];
  sequence: Command[];
  counts: Record<Color, number>;
  tries: number;
  seed: number;
  want: number;
  minOptimum: number;
  cap?: number;
  minLow?: number;
  minLeft?: number;
}
const spec: Spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let s = spec.seed >>> 0;
const rnd = (): number => {
  s = (s + 0x6d2b79f5) >>> 0;
  let x = Math.imul(s ^ (s >>> 15), 1 | s);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const run = (level: Level): { won: boolean; tally: Partial<Record<Outcome, number>>; at: number } => {
  let st: GameState = level.start;
  const tally: Partial<Record<Outcome, number>> = {};
  let at = -1;
  spec.sequence.forEach((c, i) => {
    if (isWon(st)) return;
    const r = step(level.board, st, c);
    for (const e of r.events) tally[e.outcome] = (tally[e.outcome] ?? 0) + 1;
    st = r.state;
    if (isWon(st)) at = i + 1;
  });
  return { won: isWon(st), tally, at };
};
const base = spec.grid.map((r) => r.trim().split(/\s+/));
const withRobots = (cells: [number, number, string][]): string[] => {
  const rows = base.map((r) => r.slice());
  for (const [x, y, c] of cells) rows[y][x] = c;
  return rows.map((r) => r.join(' '));
};
// Pool: every single robot that exits on its own under the sequence.
const pool: Record<string, [number, number, string][]> = { r: [], b: [], y: [] };
base.forEach((row, y) =>
  row.forEach((cell, x) => {
    if (cell !== '..') return;
    for (const col of 'rby') for (const d of '^>v<') {
      const lvl = parseLevel({ id: 'p', name: 'p', grid: withRobots([[x, y, col + d]]) });
      if (run(lvl).won) pool[col].push([x, y, col + d]);
    }
  }),
);
console.log(`pool sizes r=${pool.r.length} b=${pool.b.length} y=${pool.y.length}`);
let found = 0;
let joint = 0;
for (let i = 0; i < spec.tries && found < spec.want; i++) {
  // Grow the set one robot at a time, keeping only additions that still win together.
  const used = new Set<number>();
  const cells: [number, number, string][] = [];
  let ok = true;
  const order = Object.entries(spec.counts).flatMap(([color, count]) => new Array(count).fill(color[0]) as string[]);
  order.sort(() => rnd() - 0.5);
  for (const col of order) {
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const pick = pool[col][Math.floor(rnd() * pool[col].length)];
      if (used.has(pick[1] * 100 + pick[0])) continue;
      const trial = parseLevel({ id: 't', name: 't', grid: withRobots([...cells, pick]) });
      if (!run(trial).won) continue;
      used.add(pick[1] * 100 + pick[0]);
      cells.push(pick);
      placed = true;
    }
    if (!placed) { ok = false; break; }
  }
  if (!ok) continue;
  const low = cells.filter(([, y]) => y >= base.length / 2).length;
  const left = cells.filter(([x]) => x < base[0].length / 2).length;
  if (low < (spec.minLow ?? 0) || left < (spec.minLeft ?? 0)) continue;
  const grid = withRobots(cells);
  const level = parseLevel({ id: 'c', name: 'c', grid });
  const r = run(level);
  if (!r.won) continue;
  joint++;
  if (r.at < spec.sequence.length - 1) continue;
  const jam = (r.tally['blocked-robot'] ?? 0) + (r.tally['blocked-conflict'] ?? 0);
  if (jam < 2) continue;
  console.log(`# joint-valid so far ${joint} at try ${i}, solving...`);
  const res = solve(level.board, level.start, spec.sequence.length, undefined, true, spec.cap ?? 1_500_000);
  if (!res.solution || res.solution.length < spec.minOptimum) continue;
  found++;
  console.log(`\n# try ${i} optimum=${res.solution.length} optimal-solutions=${res.optimalCount} visited=${res.visited}`);
  console.log(`# ${res.solution.join(' ')}\n# ${JSON.stringify(r.tally)}`);
  console.log(grid.map((g) => `      '${g}',`).join('\n'));
}
