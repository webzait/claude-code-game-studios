// Screenshots of the places that show coin amounts, taken from the built game at phone size:
// the win pop-up for three, two and one star, the price tags and the coin explainer.
// Usage: npm run build:single && node tools/economy/screenshots.mjs
// Pictures go to production/qa/evidence/economy/. Fails if an amount on screen is not the one in data/config.json.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'production/qa/evidence/economy';
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const levels = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const c = config.coins;
const build = pathToFileURL(resolve('dist-single/index.html')).href;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (what, actual, expected) => {
  const ok = String(actual).trim() === String(expected);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}: ${String(actual).trim()}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) failures.push(what);
};

/** A fresh page with the given save, on the level selection. */
async function start(save) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  await page.goto(build);
  await page.evaluate((s) => localStorage.setItem('turnflock.save', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => typeof window.turnflock?.snapshot === 'function');
  return page;
}
const snap = (page) => page.evaluate(() => window.turnflock.snapshot());
async function press(page, command) {
  const before = (await snap(page)).commands.length;
  await page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
  await page.waitForFunction((n) => { const s = window.turnflock.snapshot(); return s.commands.length > n && !s.busy; }, before, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(450);
}
const shot = async (page, name) => {
  await page.waitForTimeout(2600); // stars, coin flight and count-up have landed
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const fresh = { version: 5, economy: 2, best: {}, coins: c.start, paid: {}, settings: {}, lab: {} };
const afterOne = { ...fresh, best: { [levels[0].id]: levels[0].par }, paid: { [levels[0].id]: c.win + c.perfect } };

// Three stars: level 1 by its shortest solution.
{
  const page = await start(fresh);
  await page.click('#node-1');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-level-start-${c.start}-coins.png` });
  for (const command of levels[0].witness) await press(page, command);
  await page.waitForSelector('#card .tf-coin-sum', { timeout: 30000 });
  check('three stars pay', await page.textContent('#card .tf-coin-sum'), `+${c.win + c.perfect}`);
  check('three stars shown', await page.getAttribute('#card .tf-end-stars', 'aria-label'), '3 of 3 stars');
  await shot(page, '02-win-3-stars');
  check('wallet after three stars', (await snap(page)).coins, c.start + c.win + c.perfect);
  await page.context().close();
}

// Two stars: level 2 with one wasted step against the wall.
{
  const page = await start(afterOne);
  await page.click('#node-2');
  await page.waitForTimeout(800);
  for (const command of ['forward', 'forward', 'forward', 'forward']) await press(page, command);
  check('Undo price tag', await page.textContent('#undo .tf-coin-price'), c.undoCost);
  await page.click('#scan');
  await page.waitForTimeout(900);
  check('Hint price tag', await page.textContent('#scan .tf-coin-price'), c.hintCost);
  await page.screenshot({ path: `${OUT}/03-price-tags-undo-hint.png` });
  for (const command of ['red', 'forward', 'forward']) await press(page, command);
  await page.waitForSelector('#card .tf-coin-sum', { timeout: 30000 });
  check('two stars pay', await page.textContent('#card .tf-coin-sum'), `+${c.win + c.twoStars}`);
  check('two stars shown', await page.getAttribute('#card .tf-end-stars', 'aria-label'), '2 of 3 stars');
  await shot(page, '04-win-2-stars');
  await page.context().close();
}

// One star: level 2 run out of moves at the wall, "+3 moves" bought, then won.
{
  const page = await start(afterOne);
  await page.click('#node-2');
  await page.waitForTimeout(800);
  for (let i = 0; i < levels[1].par + config.moveSlack; i++) await press(page, 'forward');
  await page.waitForSelector('#end-offer', { timeout: 30000 });
  check('+3 moves price', await page.getAttribute('#end-offer', 'aria-label'), `+${config.extraMoves} moves, ${c.extraMovesCost} coins`);
  check('Undo price on the pop-up', await page.getAttribute('#end-undo', 'aria-label'), `Undo, ${c.undoCost} coins`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/05-out-of-moves-offer.png` });
  await page.click('#end-offer');
  await page.waitForTimeout(900);
  check('wallet after +3 moves', (await snap(page)).coins, c.start - c.extraMovesCost);
  for (const command of ['red', 'forward', 'forward']) await press(page, command);
  await page.waitForSelector('#card .tf-coin-sum', { timeout: 30000 });
  check('one star pays', await page.textContent('#card .tf-coin-sum'), `+${c.win}`);
  check('one star shown', await page.getAttribute('#card .tf-end-stars', 'aria-label'), '1 of 3 stars');
  await shot(page, '06-win-1-star');
  await page.context().close();
}

// The coin explainer behind the plus button lists every amount.
{
  const page = await start(fresh);
  await page.click('#mapCoins button');
  await page.waitForTimeout(500);
  const text = (await page.textContent('#coinInfoBody')).replace(/\s+/g, ' ');
  for (const [label, amount] of [['Level won', `+${c.win}`], ['Two stars', `+${c.win + c.twoStars}`], ['Three stars', `+${c.win + c.perfect}`], ['Hint: the next move', c.hintCost], [`+${config.extraMoves} moves`, c.extraMovesCost], ['Undo: one step back', c.undoCost]]) {
    check(`explainer: ${label}`, text.includes(`${label}${amount}`) ? amount : text, amount);
  }
  await page.screenshot({ path: `${OUT}/07-coin-explainer.png` });
  await page.context().close();
}

await browser.close();
if (failures.length > 0) {
  console.error(`${failures.length} amount(s) on screen differ from data/config.json`);
  process.exit(1);
}
