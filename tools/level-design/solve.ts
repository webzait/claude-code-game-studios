/**
 * Prints the shortest solution of every level (or of grids in a JSON file).
 * Usage: tsx tools/level-design/solve.ts            -> all shipped levels
 *        tsx tools/level-design/solve.ts file.json  -> { "name": ["row", ...], ... }
 */
import { existsSync, readFileSync } from 'node:fs';
import { step } from '../../src/engine/engine';
import type { Outcome } from '../../src/engine/types';
import { parseLevel, type LevelDef } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';

let defs: LevelDef[];
const file = process.argv[2];
if (file && existsSync(file)) {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
  defs = Object.entries(raw).map(([id, grid]) => ({ id, name: id, grid }));
} else {
  defs = JSON.parse(readFileSync("data/levels.json", "utf8")) as LevelDef[];
}
for (const def of defs) {
  const level = parseLevel(def);
  const t0 = Date.now();
  const res = solve(level.board, level.start, Number(process.env.MAXM ?? 16), undefined, true, Number(process.env.CAP ?? 3_000_000));
  const tally: Partial<Record<Outcome, number>> = {};
  let st = level.start;
  for (const c of res.solution ?? []) {
    const r = step(level.board, st, c);
    for (const e of r.events) tally[e.outcome] = (tally[e.outcome] ?? 0) + 1;
    st = r.state;
  }
  console.log(
    `${def.id}: robots=${level.start.robots.length} optimum=${res.solution?.length ?? 'NONE'} ` +
      `optimal-solutions=${res.optimalCount} visited=${res.visited} ${Date.now() - t0}ms\n   ${res.solution?.join(' ')}\n   ${JSON.stringify(tally)}`,
  );
}
