// Takes the evidence screenshots of the level selection and of chosen levels, and plays
// levels through with their stored witness in the running game.
// Usage: npm run build:single && node tools/level-design/screenshots.mjs [level numbers to play…]
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'production/qa/evidence/levels';
const levels = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const play = process.argv.slice(2).map(Number);
const numbers = play.length > 0 ? play : [1, 5, 13, 17, 23, 24, 28, 29, 35, 40];
mkdirSync(OUT, { recursive: true });

// The same browser the Playwright checks use (playwright.config.ts): the one page-shot.sh finds.
const which = existsSync('.claude/scripts/page-shot.sh') ? spawnSync('bash', ['.claude/scripts/page-shot.sh', '--which'], { encoding: 'utf8' }).stdout.trim() : '';
const executablePath = process.env.PAGE_SHOT_BROWSER || which || undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
// Open every level: the save is plain data in localStorage.
await context.addInitScript(() => {
  if (!localStorage.getItem('turnflock.save')) {
    localStorage.setItem('turnflock.save', JSON.stringify({ version: 4, best: {}, coins: 0, paid: {}, settings: { mute: true }, lab: { unlockAll: true } }));
  }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(resolve('dist-single/index.html')).href);
await page.waitForFunction(() => typeof window.turnflock?.snapshot === 'function');
await page.waitForFunction(() => window.turnflock.snapshot().kitReady, null, { timeout: 60000 });
const snap = () => page.evaluate(() => window.turnflock.snapshot());
const settle = (ms) => page.waitForTimeout(ms);

await settle(800);
await page.screenshot({ path: `${OUT}/select-page-1.png` });
await page.click('#pageNext');
await settle(500);
await page.screenshot({ path: `${OUT}/select-page-2.png` });
await page.click('#pagePrev');

const results = [];
for (const number of numbers) {
  const level = levels[number - 1];
  const wantPage = Math.floor((number - 1) / config.levelsPerPage);
  for (let i = 0; i < wantPage; i++) await page.click('#pageNext');
  await page.click(`#node-${number}`);
  await page.waitForFunction((n) => window.turnflock.snapshot().screen === 'level' && window.turnflock.snapshot().level === n, number - 1);
  await settle(1500);
  const tag = `${String(number).padStart(2, '0')}-${level.id}`;
  await page.screenshot({ path: `${OUT}/level-${tag}.png` });
  for (const command of level.witness) await page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
  const after = await snap();
  results.push({ number, id: level.id, par: level.par, status: after.status, moves: after.commands.length, collected: `${after.collected}/${after.total}` });
  await page.locator('#card .tf-end-card').waitFor({ state: 'visible', timeout: 60000 });
  await settle(600);
  await page.screenshot({ path: `${OUT}/level-${tag}-won.png` });
  await page.click('#end-levels');
  await page.waitForFunction(() => window.turnflock.snapshot().screen === 'map');
  // Back on the first page for the next pick.
  while (!(await page.locator('#pagePrev').isDisabled())) await page.click('#pagePrev');
}
console.table(results);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
if (errors.length || results.some((r) => r.status !== 'won')) process.exit(1);
