// PROTOTYPE - NOT FOR PRODUCTION
// Proves every level: solvable, and its minimum number of moves. Run: node tools/verify.js
globalThis.window = globalThis;
const Logic = require('../logic.js');
const LEVELS = require('../levels.js');
let bad = 0;
LEVELS.forEach((lv, i) => {
  const r = Logic.solve(lv);
  if (r.solvable !== true) bad++;
  const noPad = lv.berthCap > 0 ? Logic.solve(Object.assign({}, lv, { berthCap: 0 })) : null;
  console.log(`level ${i + 1}\t${r.solvable === true ? 'solvable' : r.solvable === false ? 'UNSOLVABLE' : 'NOT ASSESSED (search limit)'}\tmin ${r.min}\tlimit ${r.min + lv.margin}\tstates ${r.seen}` +
    (noPad ? `\twithout the berth pad: ${noPad.solvable ? 'min ' + noPad.min : 'unsolvable'}` : '') +
    `\n\t${(r.path || []).map(m => m.join('>')).join(' ')}`);
});
process.exit(bad ? 1 : 0);
