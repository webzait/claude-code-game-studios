// PROTOTYPE - NOT FOR PRODUCTION
/**
 * Level-design aid: draws marble paths for given pulse orders as an SVG.
 * Usage: npx tsx tools/trace.ts <levelId> <order> [<order> ...] > out.svg   (order like RB)
 */
import { COLORS, tune, type ColorId } from '../src/config';
import { Game } from '../src/game/game';
import { LEVELS } from '../src/levels/levels';

const level = LEVELS.find((l) => l.id === Number(process.argv[2]))!;
const orders = process.argv.slice(3);
const S = 44;
const key: Record<string, ColorId> = { R: 'red', B: 'blue', Y: 'yellow' };
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${orders.length * (level.size.w * S + 20)}" height="${level.size.h * S + 30}" font-family="sans-serif" font-size="14">`;
orders.forEach((order, oi) => {
  const g = new Game(level);
  const ox = oi * (level.size.w * S + 20);
  out += `<g transform="translate(${ox},0)"><rect width="${level.size.w * S}" height="${level.size.h * S}" fill="#f4f1ea" stroke="#999"/>`;
  for (const c of level.catchers) out += `<rect x="${c.x * S}" y="${c.y * S}" width="${c.w * S}" height="${c.h * S}" fill="#333"/>`;
  for (const o of level.obstacles) out += `<rect x="${o.x * S}" y="${o.y * S}" width="${o.w * S}" height="${o.h * S}" fill="#aab"/>`;
  for (const b of level.bumpers) out += `<circle cx="${b.x * S}" cy="${b.y * S}" r="${b.r * S}" fill="${COLORS[b.color]}"/><circle cx="${b.x * S}" cy="${b.y * S}" r="${b.r * (1 + tune.pulseExpand) * S}" fill="none" stroke="${COLORS[b.color]}" stroke-dasharray="3"/>`;
  for (const m of g.world.marbles) out += `<circle cx="${m.x * S}" cy="${m.y * S}" r="${tune.marbleRadius * S}" fill="none" stroke="#888"/>`;
  [...order].forEach((ch) => {
    const paths = g.world.marbles.map((m) => `M${(m.x * S).toFixed(1)},${(m.y * S).toFixed(1)}`);
    g.pulse(key[ch]);
    while (g.phase === 'resolving') {
      g.step();
      g.world.marbles.forEach((m, i) => (paths[i] += `L${(m.x * S).toFixed(1)},${(m.y * S).toFixed(1)}`));
    }
    for (const p of paths) out += `<path d="${p}" fill="none" stroke="${COLORS[key[ch]]}" stroke-width="1.5" opacity="0.8"/>`;
  });
  for (const m of g.world.marbles) if (m.alive) out += `<circle cx="${m.x * S}" cy="${m.y * S}" r="${tune.marbleRadius * S}" fill="#fff" stroke="#000"/><text x="${m.x * S - 4}" y="${m.y * S + 5}" font-size="10">${m.id}</text>`;
  out += `<text x="4" y="${level.size.h * S + 20}">L${level.id} ${order}: ${g.collected}/${level.target} ${g.phase}</text></g>`;
});
console.log(out + '</svg>');
