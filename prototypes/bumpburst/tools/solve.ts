// PROTOTYPE - NOT FOR PRODUCTION
/**
 * Brute-force check of every level against the real simulation:
 * plays every pulse order up to the budget and prints what each collects.
 * Usage: npm run solve [-- <levelId> [map]]
 */
import type { ColorId } from '../src/config';
import { Game, playSequence } from '../src/game/game';
import { LEVELS } from '../src/levels/levels';
import type { LevelDef } from '../src/levels/types';

function sequences(colors: ColorId[], n: number): ColorId[][] {
  if (n === 0) return [[]];
  return sequences(colors, n - 1).flatMap((s) => colors.map((c) => [...s, c]));
}

function map(level: LevelDef, g: Game): string {
  const N = 40;
  const rows: string[][] = Array.from({ length: N / 2 }, () => Array.from({ length: N }, () => '.'));
  const put = (x: number, y: number, ch: string) => {
    const c = Math.floor((x / level.size.w) * N);
    const r = Math.floor((y / level.size.h) * (N / 2));
    if (r >= 0 && r < N / 2 && c >= 0 && c < N) rows[r][c] = ch;
  };
  for (let y = 0.125; y < level.size.h; y += 0.25)
    for (let x = 0.125; x < level.size.w; x += 0.25) {
      if (level.catchers.some((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h)) put(x, y, '_');
      if (level.obstacles.some((k) => x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h)) put(x, y, '#');
      for (const b of level.bumpers) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) put(x, y, b.color[0].toUpperCase());
    }
  for (const m of g.world.marbles) if (m.alive) put(m.x, m.y, 'o');
  return rows.map((r) => r.join('')).join('\n');
}

const only = process.argv[2] ? Number(process.argv[2]) : 0;
const showMap = process.argv[3];
let ok = true;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  const g0 = new Game(level);
  console.log(`\n== ${level.id} ${level.name}: target ${level.target}/${g0.total}, pulses ${level.pulses}`);
  if (showMap === 'map') console.log(map(level, g0));
  const sol = playSequence(level, level.solution);
  const solOk = sol.phase === 'won';
  if (!solOk) ok = false;
  console.log(`solution ${level.solution.join(',')}: ${sol.collected} -> ${sol.phase}${solOk ? '' : '  <-- NOT SOLVED'}`);
  let wins = 0;
  let all = 0;
  for (let n = 1; n <= level.pulses; n++) {
    for (const s of sequences(g0.colors, n)) {
      const g = playSequence(level, s);
      // Count only full-length orders, or shorter ones that already win.
      if (n < level.pulses && g.phase !== 'won') continue;
      if (n === level.pulses) all++;
      if (g.phase === 'won') wins++;
      console.log(`  ${s.map((c) => c[0].toUpperCase()).join('')}: ${g.collected} ${g.phase} (${(g.world.ticks / 60).toFixed(1)}s)`);
      if (showMap === s.map((c) => c[0].toUpperCase()).join('')) console.log(map(level, g));
    }
  }
  console.log(`  winning orders: ${wins} (of ${all} full-length)`);
}
process.exit(ok ? 0 : 1);
