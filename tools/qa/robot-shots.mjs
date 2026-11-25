// Screenshots of the robot look in a single-file build: level screen, level 1, level 18
// (obstacles) and the win pop-up of level 1, at phone size.
// Usage: node tools/qa/robot-shots.mjs <build index.html> <out folder> [save JSON]
// Used to compare the robot look before and after the garden theme was removed (design/themes.md).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [buildPath, out, saveArg] = process.argv.slice(2);
if (!buildPath || !out) throw new Error('usage: robot-shots.mjs <index.html> <out> [save JSON]');
mkdirSync(out, { recursive: true });
const levels = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const url = pathToFileURL(resolve(buildPath)).href;
const browser = await chromium.launch({ executablePath: process.env.PAGE_SHOT_BROWSER || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });

/** A fresh page whose save has the first `solved` levels solved at par. */
async function open(solved) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const best = Object.fromEntries(levels.slice(0, solved).map((l) => [l.id, l.par]));
  const extra = saveArg ? JSON.parse(saveArg) : {};
  const save = { version: 4, best, coins: 100, paid: {}, settings: {}, lab: {}, ...extra };
  await page.addInitScript((s) => { if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', s); }, JSON.stringify(save));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.turnflock?.snapshot === 'function');
  await page.waitForTimeout(1500);
  return page;
}

let page = await open(0);
await page.screenshot({ path: `${out}/1-level-screen.png` });
await page.click('#continue');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/2-level-1.png` });
for (const c of levels[0].witness) await page.dispatchEvent(`.cmd[data-cmd=${c}]`, 'pointerdown');
await page.locator('#card .tf-end-card').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/4-win-popup.png` });
await page.close();

page = await open(17);
await page.click('#continue');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/3-level-18.png` });
await page.close();
await browser.close();
