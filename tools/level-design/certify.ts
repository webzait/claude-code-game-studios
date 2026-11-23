/**
 * Turns hand-picked boards into level entries: for each `{ id, name, grid }` it asks the game's solver
 * for the shortest solution, checks it against the independent search (fast.ts), removes nothing, and
 * prints the measured numbers. With an output file it writes the entries with `par` and `witness`,
 * ready to paste into data/levels.json.
 *
 * Usage: npm run certify -- boards.json [out.json] [--keep-walls]
 *   boards.json: [{ "id": "...", "name": "...", "grid": ["row", ...] }, ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { parseLevel, type LevelDef } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';
import { fastSolve, prepare } from './fast';
import { dropIdleWalls, summary } from './generate';

// --keep-walls: the tidy check leaves walls alone (for boards whose walls form a barrier around a gate).
const keepWalls = process.argv.includes('--keep-walls');
const [boardsFile, outFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!boardsFile) {
  console.log('Usage: npm run certify -- boards.json [out.json]');
  process.exit(1);
}
const boards = JSON.parse(readFileSync(boardsFile, 'utf8')) as LevelDef[];
const out: (LevelDef & { par: number; witness: string[] })[] = [];
let failed = 0;
for (const def of boards) {
  const level = parseLevel(def);
  const solved = solve(level.board, level.start, CONFIG.levelDesign.maxPar);
  const checked = fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany), CONFIG.levelDesign.maxPar);
  if (!solved.solution || solved.solution.length !== checked.solution?.length) {
    console.log(`${def.id}: NOT CERTIFIED (solver ${solved.solution?.length ?? 'none'}, independent search ${checked.solution?.length ?? 'none'})`);
    failed++;
    continue;
  }
  // Measured after a tidy pass, to show whether any wall or turn tile is idle; the board itself is kept as given.
  const tidy = dropIdleWalls([...def.grid], CONFIG.levelDesign.maxStates, keepWalls ? ['##'] : []);
  const idle = tidy.grid.join('|') === def.grid.join('|') ? '' : `\n   idle pieces, tidy board: ${tidy.grid.join(' / ')}`;
  console.log(`${def.id}: ${summary(tidy.metrics)}${tidy.metrics.capped ? ' (measurement capped)' : ''}\n   ${solved.solution.join(' ')}${idle}`);
  out.push({ id: def.id, name: def.name, par: solved.solution.length, witness: solved.solution, grid: def.grid });
}
if (outFile) {
  const text =
    '[\n' +
    out
      .map(
        (l) =>
          `  {\n    "id": ${JSON.stringify(l.id)},\n    "name": ${JSON.stringify(l.name)},\n    "par": ${l.par},\n    "witness": ${JSON.stringify(l.witness)},\n    "grid": [\n${l.grid.map((g) => `      ${JSON.stringify(g)}`).join(',\n')}\n    ]\n  }`,
      )
      .join(',\n') +
    '\n]\n';
  writeFileSync(outFile, text);
  console.log(`${outFile} written: ${out.length} levels`);
}
if (failed > 0) process.exit(1);
