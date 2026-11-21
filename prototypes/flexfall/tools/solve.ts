// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// npm run solve [level-id] [--all]: prove each level solvable and print what every tap
// sequence catches. Use it when authoring a level: paste the shortest clear into "solution".
import { LEVELS } from '../app/src/levels/index';
import { Session } from '../app/src/game/session';
import { loadTuning } from './config';
import { searchLevel } from './solver';

const tuning = loadTuning();
const only = process.argv.slice(2).filter(a => !a.startsWith('--'))[0];
const all = process.argv.includes('--all');
let bad = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const pre = new Session(level, tuning);
  const res = searchLevel(level, tuning);
  const wins = res.filter(o => o.won);
  const total = pre.world.n;
  console.log(`\n${level.id} "${level.name}"  marbles ${total}  target ${level.target}  taps ${level.moves}  par ${level.par}  caught before first tap: ${pre.collected}`);
  if (!wins.length) { bad++; console.log('  NOT SOLVABLE within its taps'); }
  else console.log(`  shortest clear: [${wins[0].taps}] (${wins[0].taps.length} taps, ${wins[0].collected} caught) · winning sequences: ${wins.length} of ${res.length}`);
  if (JSON.stringify(level.solution) !== JSON.stringify(wins[0]?.taps) && !wins.some(w => JSON.stringify(w.taps) === JSON.stringify(level.solution))) { bad++; console.log(`  recorded solution [${level.solution}] does NOT win`); }
  for (const o of res) if (all || o.taps.length <= 2) console.log(`    [${o.taps}] -> ${o.collected}${o.won ? ' WIN' : ''}`);
}
process.exit(bad ? 1 : 0);
