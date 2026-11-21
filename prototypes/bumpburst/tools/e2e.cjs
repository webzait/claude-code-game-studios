// PROTOTYPE - NOT FOR PRODUCTION
/**
 * Browser check: plays every level's solution through the real UI at several screen sizes,
 * asserts win and counters, and keeps screenshots in evidence/.
 * Usage: start `npm run preview` (or dev), then `npm run e2e [-- <baseUrl>]`.
 * Needs a global Playwright: NODE_PATH=$(npm root -g).
 */
const { chromium } = require('playwright');
const path = require('node:path');

const RED = '.burst[data-color="red"]';
const base = process.argv[2] || 'http://localhost:4173/';
const out = path.join(__dirname, '..', 'evidence');
const sizes = [
  { name: 'iphone-se', width: 375, height: 667, dpr: 2, touch: true },
  { name: 'iphone-15', width: 393, height: 852, dpr: 3, touch: true },
  { name: 'iphone-landscape', width: 852, height: 393, dpr: 2, touch: true },
  { name: 'desktop', width: 1280, height: 800, dpr: 2, touch: false },
];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failures = 0;
  const fail = (m) => { failures++; console.log('  FAIL ' + m); };
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.dpr, hasTouch: s.touch, isMobile: s.touch });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base);
    await page.waitForSelector('#btn-play');
    console.log(`${s.name} ${s.width}x${s.height}`);
    await page.screenshot({ path: path.join(out, `${s.name}-title.png`) });
    await page.click('#btn-play');
    const levels = await page.evaluate(() => window.bumpburst.levels.map((l) => ({ id: l.id, solution: l.solution, target: l.target })));
    for (const l of levels) {
      await page.waitForFunction((id) => window.bumpburst.game.level.id === id && window.bumpburst.game.phase === 'ready', l.id);
      await page.waitForTimeout(250);
      const box = await page.evaluate(() => {
        const r = document.getElementById('stage').getBoundingClientRect();
        const b = [...document.querySelectorAll('.burst')].map((e) => e.getBoundingClientRect());
        return { stageH: r.height, vw: innerWidth, vh: innerHeight, minBtn: Math.min(...b.map((x) => x.width)), inside: b.every((x) => x.left >= 0 && x.right <= innerWidth && x.bottom <= innerHeight), scroll: document.documentElement.scrollWidth > innerWidth };
      });
      if (!box.inside || box.scroll) fail(`L${l.id}: buttons outside the screen or page scrolls`);
      if (box.minBtn < 60) fail(`L${l.id}: colour button under 60 px (${box.minBtn})`);
      await page.screenshot({ path: path.join(out, `${s.name}-level${l.id}-start.png`) });
      for (let i = 0; i < l.solution.length; i++) {
        const sel = `.burst[data-color="${l.solution[i]}"]`;
        if (s.touch) await page.tap(sel, { force: true }); else await page.click(sel, { force: true });
        if (i === 0) {
          // A second tap while the pulse resolves must not spend a pulse.
          const before = await page.evaluate(() => window.bumpburst.game.pulsesLeft);
          await page.dispatchEvent(sel, 'pointerdown');
          const after = await page.evaluate(() => window.bumpburst.game.pulsesLeft);
          if (before !== after) fail(`L${l.id}: double input spent a pulse`);
          await page.waitForTimeout(140);
          await page.screenshot({ path: path.join(out, `${s.name}-level${l.id}-burst.png`) });
        }
        await page.waitForFunction(() => window.bumpburst.game.phase !== 'resolving', null, { timeout: 60000 });
        if (await page.evaluate(() => window.bumpburst.game.phase) === 'won') break;
      }
      const st = await page.evaluate(() => { const g = window.bumpburst.game; return { phase: g.phase, collected: g.collected, alive: g.world.marbles.filter((m) => m.alive).length, total: g.total, shown: document.getElementById('got').textContent }; });
      if (st.phase !== 'won') fail(`L${l.id}: solution ended ${st.phase} with ${st.collected}/${l.target}`);
      if (st.collected + st.alive !== st.total) fail(`L${l.id}: marbles not conserved`);
      if (String(st.collected) !== st.shown) fail(`L${l.id}: HUD shows ${st.shown}, game has ${st.collected}`);
      await page.waitForSelector('#result:not([hidden])');
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, `${s.name}-level${l.id}-won.png`) });
      console.log(`  L${l.id} ${st.phase} ${st.collected}/${st.total}`);
      if (l.id < levels.length) await page.click('#res-main');
    }
    // Loss path: level 2 with the wrong colour.
    await page.evaluate(() => window.bumpburst.startLevel(1));
    await page.waitForTimeout(200);
    if (s.touch) await page.tap(RED, { force: true }); else await page.click(RED, { force: true });
    await page.waitForSelector('#result:not([hidden])', { timeout: 60000 });
    const lost = await page.evaluate(() => window.bumpburst.game.phase);
    if (lost !== 'lost') fail(`loss path ended ${lost}`);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${s.name}-lost.png`) });
    if (errors.length) fail(`console errors: ${errors.join(' | ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
