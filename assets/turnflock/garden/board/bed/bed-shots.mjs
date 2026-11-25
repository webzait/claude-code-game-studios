// Evidence shots of the grass bed (design/themes/garden-board-bed.md): the real game, levels by
// index (level 1 = 0), at 390x844 with deviceScaleFactor 3, as PNGs in the folder given.
// Usage: npm run build:single && node assets/turnflock/garden/board/bed/bed-shots.mjs <dir> [0,6,10]
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const OUT = process.argv[2];
const levels = (process.argv[3] ?? '0,6,10').split(',').map(Number);
const browser = await chromium.launch({ executablePath: process.env.PAGE_SHOT_BROWSER || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('turnflock.save', JSON.stringify({ version: 4, best: {}, coins: 0, paid: {}, settings: { mute: true, music: false }, lab: { unlockAll: true } }));
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(pathToFileURL(resolve('dist-single/index.html')).href);
await page.waitForFunction(() => window.turnflock?.snapshot, null, { timeout: 120000 });
await page.waitForFunction(() => window.turnflock.snapshot().kitReady, null, { timeout: 120000 }).catch(() => {});
for (const i of levels) {
  await page.evaluate((i) => window.turnflock.startLevel(i), i);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/level${String(i + 1).padStart(2, '0')}.png` });
}
await browser.close();
