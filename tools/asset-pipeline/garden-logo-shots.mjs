// Evidence for the garden logo (design/themes/garden-logo.md): screenshots of the parts sheet's garden logo
// cards and measurements of the level screen at each size. Run after `npx vite build --mode parts`:
//   node tools/asset-pipeline/garden-logo-shots.mjs
// Writes to production/qa/evidence/garden-logo/.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = resolve('production/qa/evidence/garden-logo');
// A browser other than Playwright's own (e.g. /opt/pw-browsers/chromium) through PAGE_SHOT_BROWSER, as in tools/economy.
const browser = await chromium.launch({ executablePath: process.env.PAGE_SHOT_BROWSER || undefined });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 2 });
page.setDefaultTimeout(300000);
await page.goto('file://' + resolve('dist-parts/parts.html'), { timeout: 300000 });
await page.waitForTimeout(1500);

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('#garden-logo-screens .tf-levels-phone, #garden-logo-compare .tf-levels-phone')].map((ph) => {
    const o = ph.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left - o.left, top: r.top - o.top, right: r.right - o.left, bottom: r.bottom - o.top };
    };
    const path = [...ph.querySelectorAll('.tf-levels-steps > li, .tf-levels-tile')].map(box);
    const img = ph.querySelector('.tf-levels-logo');
    const logo = box(img);
    const head = [...ph.querySelectorAll('.tf-levels-head > :not(.tf-levels-brand)')].map(box);
    const star = box(ph.querySelector('.tf-levels-starbtn'));
    const play = box(ph.querySelector('.tf-levels-play'));
    const dock = box(ph.querySelector('.tf-levels-dock'));
    const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const pathTop = Math.min(...path.map((p) => p.top));
    const pathBottom = Math.max(...path.map((p) => p.bottom));
    return {
      screen: `${ph.offsetWidth}x${ph.offsetHeight}`,
      logo: img.getAttribute('width') === '560' ? 'garden' : 'robot',
      view: ph.querySelector('.tf-levels-path:not([hidden])') ? 'path' : 'grid',
      logoBox: `${Math.round(logo.right - logo.left)}x${Math.round(logo.bottom - logo.top)} at top ${Math.round(logo.top)}`,
      logoBottomToStarButtonTop: Math.round(star.top - logo.bottom),
      logoBottomToPathTop: Math.round(pathTop - logo.bottom),
      pathBottomToDockTop: Math.round(dock.top - pathBottom),
      playButton: `${Math.round(play.right - play.left)}x${Math.round(play.bottom - play.top)}`,
      logoOverlapsHeaderButton: head.some((h) => hit(logo, h)),
      logoOverlapsPath: path.some((p) => hit(logo, p)),
      logoOverlapsPlay: hit(logo, play),
      logoInsideScreen: logo.left >= 0 && logo.right <= ph.offsetWidth && logo.top >= 0,
    };
  }),
);
writeFileSync(resolve(OUT, 'measurements.json'), JSON.stringify(rows, null, 2) + '\n');
console.table(rows);

const cards = [
  ['#garden-logo', 'logo-on-backgrounds.png'],
  ['#garden-logo-screens', 'levels-all-sizes.png'],
  ['#garden-logo-compare', 'compare-robot-logo-and-grid.png'],
];
for (const [id, file] of cards) await (await page.$(id)).screenshot({ path: resolve(OUT, file) });
for (const ph of await page.$$('#garden-logo-screens .tf-levels-phone')) {
  const size = await ph.evaluate((e) => `${e.offsetWidth}x${e.offsetHeight}`);
  await ph.screenshot({ path: resolve(OUT, `levels-garden-${size}.png`) });
}
// The logo close up at pixel ratio 2, as it shows on a 390 wide phone.
await (await page.$$('#garden-logo-screens .tf-levels-logo'))[1].screenshot({ path: resolve(OUT, 'logo-sharpness-390-2x.png') });
await browser.close();
