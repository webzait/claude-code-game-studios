// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// npx vite-node tools/dump.ts -- <level-id> <taps, e.g. 1,0>: an ASCII top view after the taps.
import { LEVELS } from '../app/src/levels/index';
import { playTaps } from '../app/src/game/session';
import { loadTuning } from './config';

const [id, tapsArg] = process.argv.slice(2).filter(a => a !== '--');
const level = LEVELS.find(l => l.id.startsWith(id))!;
const taps = tapsArg ? tapsArg.split(',').map(Number) : [];
const s = playTaps({ ...level, moves: 99 }, loadTuning(), taps);
const w = s.world, W = 40, D = 55;
const g = Array.from({ length: D }, () => Array(W).fill('.'));
const put = (x: number, z: number, c: string): void => {
  const i = Math.floor((x + w.halfW) / (2 * w.halfW) * W), j = Math.floor((z + w.halfD) / (2 * w.halfD) * D);
  if (i >= 0 && j >= 0 && i < W && j < D) g[j][i] = c;
};
for (const wl of level.walls ?? []) for (let u = 0; u <= 1; u += 0.02) put(wl.x1 + (wl.x2 - wl.x1) * u, wl.z1 + (wl.z2 - wl.z1) * u, '#');
for (const p of level.pegs ?? []) put(p.x, p.z, '+');
for (const c of level.catchers) put(c.x, c.z, 'O');
level.anchors.forEach((a, i) => put(a.x, a.z, String(i)));
for (let i = 0; i < w.n; i++) if (w.alive[i]) put(w.px[i], w.pz[i], 'o');
console.log(g.map(r => r.join('')).join('\n'));
console.log(`taps [${taps}] caught ${s.collected}/${w.n} phase ${s.phase} steps ${w.steps}`);
