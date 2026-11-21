// @ts-nocheck
// Dev helper: node scripts/explore.ts <level> "<t,hold,x> ..."  (t in seconds) prints what a run does.
import './setup-config.ts';
const { LEVELS } = await import('../src/sim/levels.ts');
const { replay, HELD } = await import('../src/sim/sim.ts');
const lv = LEVELS[Number(process.argv[2]) - 1];
const inputs = process.argv[3].trim().split(/\s+/).map((s) => { const [t, h, x] = s.split(','); return { t: Math.round(Number(t) * 120), hold: h === '1', x: Number(x) }; });
const sim = replay(lv, inputs, 120 * 60, (s) => {
  for (const e of s.events) if (e.type === 'launch') console.log(`t=${(s.tick / 120).toFixed(2)} launch n=${e.count} v=${e.speed.toFixed(1)} power=${e.power.toFixed(2)} scoredBefore=${s.scored}`);
  if (s.tick % 60 === 0 && process.argv[4]) console.log((s.tick / 120).toFixed(1), 'held', s.held, 'apex', s.predictedApex().toFixed(1), 'scored', s.scored);
  s.events.length = 0;
});
console.log(`end t=${(sim.tick / 120).toFixed(2)} status=${sim.status} scored=${sim.scored}/${lv.target} goals=${sim.goalCount} launches=${sim.launchesUsed} held=${sim.count(HELD)}`);
