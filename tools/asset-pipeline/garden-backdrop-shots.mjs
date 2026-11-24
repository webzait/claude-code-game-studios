// Evidence for the garden backdrop (design/themes/garden-backdrop.md): the real game with the garden
// backdrop and edge decor switched on from outside, an empty board (robot-theme board pieces), on
// several phone sizes, plus the owner's picture beside it. Nothing in the game is changed: the
// garden stylesheet and pictures are injected into the built page.
// Usage: npm run build:single && node tools/asset-pipeline/garden-backdrop-shots.mjs
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'production/qa/evidence/garden-backdrop';
mkdirSync(OUT, { recursive: true });
const DIR = 'src/ui/themes/garden';
const dataUrl = (file) => `data:image/webp;base64,${readFileSync(`${DIR}/${file}`).toString('base64')}`;
const css = readFileSync(`${DIR}/garden-scene.css`, 'utf8').replace(/url\('\.\/([^']+)'\)/g, (_, f) => `url('${dataUrl(f)}')`);
// Same mapping as GARDEN_DECOR_ART in src/ui/themes/garden/gardenArt.ts.
const art = {
  'sprig-tl': 'garden-branch.webp', 'tuft-tr': 'garden-clump-birdhouse.webp', 'back-l': 'garden-clump-rocks-left.webp',
  'back-r': 'garden-clump-rocks-right.webp', 'front-l': 'garden-clump-birdhouse.webp', 'front-r': 'garden-bush-white.webp',
};
const decor = Object.fromEntries(Object.entries(art).map(([k, f]) => [k, dataUrl(f)]));
const SIZES = (process.env.SIZES ?? '390x844,320x568,430x932,768x1024').split(',').map((s) => s.split('x').map(Number));
const executablePath = process.env.PAGE_SHOT_BROWSER || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
for (const [width, height] of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('turnflock.save', JSON.stringify({ version: 4, best: {}, coins: 0, paid: {}, settings: { mute: true, music: false }, lab: { unlockAll: true } }));
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve('dist-single/index.html')).href);
  await page.waitForFunction(() => window.turnflock?.snapshot().kitReady, null, { timeout: 120000 });
  await page.addStyleTag({ content: css });
  await page.evaluate((decor) => {
    document.documentElement.dataset.theme = 'garden';
    for (const [place, src] of Object.entries(decor)) document.querySelector(`img.tf-decor-${place}`).src = src;
  }, decor);
  // The 6×6 size-test board with every robot and obstacle taken off: an empty board with only its exit.
  await page.evaluate(() => {
    const game = window.turnflock;
    game.startPreview(1);
    const level = game.level;
    game.begin({ ...level, board: { ...level.board, walls: level.board.walls.map(() => false) }, start: { ...level.start, robots: [] } }, 10, null, false);
    game.setHint('', false);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/game-empty-board-${width}x${height}.png` });
  await context.close();
}
await browser.close();
console.log('saved to', OUT);
