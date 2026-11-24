// Screenshots of every place that shows a coin amount, for each tuning of the economy (finding B12),
// taken from the built game at phone size: the top bar with the balance and the price tags, the win
// pop-up, the out-of-moves offer, the test shop and the test lab's choice.
// Usage: npm run build:single && node tools/economy/screenshots.mjs
// Pictures go to production/qa/evidence/economy-tighten/. Fails if an amount on screen is not the one in data/config.json.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = 'production/qa/evidence/economy-tighten';
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const levels = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const own = { ...config.economy.tuning, coins: config.coins, packs: config.shop.packs };
const tunings = config.economy.order.map((id) => (id === own.id ? own : config.economy.alternatives.find((t) => t.id === id)));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
mkdirSync(OUT, { recursive: true });

// The same browser the Playwright checks use (playwright.config.ts): the one page-shot.sh finds.
const which = existsSync('.claude/scripts/page-shot.sh') ? spawnSync('bash', ['.claude/scripts/page-shot.sh', '--which'], { encoding: 'utf8' }).stdout.trim() : '';
const executablePath = process.env.PAGE_SHOT_BROWSER || which || undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const failures = [];
const check = (what, actual, expected) => {
  const ok = String(actual).replace(/\s+/g, '').trim() === String(expected).replace(/\s+/g, '');
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

for (const t of tunings) {
  const c = t.coins;
  const lab = { economy: t.id };
  const fresh = { version: 7, economy: 3, best: {}, coins: c.start, paid: {}, settings: { music: false }, lab };
  const afterOne = { ...fresh, coins: c.start + c.win + c.perfect, best: { [levels[0].id]: levels[0].par }, paid: { [levels[0].id]: c.win + c.perfect } };
  const name = (n) => `${OUT}/${t.id}-${n}.png`;
  console.log(`\n== ${t.label} ==`);

  // A new player wins level 1 by its shortest solution: the opening balance, then the win pop-up.
  {
    const page = await start(fresh);
    check('opening balance on the level screen', await page.textContent('#mapCoins .tf-coin-amount'), c.start);
    await page.click('#node-1');
    await page.waitForTimeout(800);
    for (const command of levels[0].witness) await press(page, command);
    await page.waitForSelector('#card .tf-coin-sum', { timeout: 30000 });
    check('three stars pay', await page.textContent('#card .tf-coin-sum'), `+${c.win + c.perfect}`);
    await page.waitForTimeout(2600); // stars, coin flight and count-up have landed
    await page.screenshot({ path: name('02-win-popup') });
    check('wallet after three stars', (await snap(page)).coins, c.start + c.win + c.perfect);
    await page.context().close();
  }

  // Level 2 after one move: the top bar with the balance, and the price tags on Undo and Hint.
  {
    const page = await start(afterOne);
    await page.click('#node-2');
    await page.waitForTimeout(800);
    await press(page, 'forward');
    check('Undo price tag', await page.textContent('#undo .tf-coin-price'), c.undoCost);
    check('Hint price tag', await page.textContent('#scan .tf-coin-price'), c.hintCost);
    check('balance in the top bar', await page.textContent('#levelCoins .tf-coin-amount'), afterOne.coins);
    await page.screenshot({ path: name('01-top-bar-and-price-tags') });
    // Run out of moves at the wall: the solver proves three moves are enough, so "+3 moves" is offered at its price.
    for (let i = 1; i < levels[1].par + config.moveSlack; i++) await press(page, 'forward');
    await page.waitForSelector('#end-offer', { timeout: 30000 });
    const can = afterOne.coins >= c.extraMovesCost;
    check('+3 moves price', await page.getAttribute('#end-offer', 'aria-label'), `+${config.extraMoves} moves, ${c.extraMovesCost} coins${can ? '' : ', you do not have enough coins'}`);
    check('Retry is there and free', await page.locator('#end-retry').count(), 1);
    await page.waitForTimeout(900);
    await page.screenshot({ path: name('03-out-of-moves-offer') });
    await page.context().close();
  }

  // The test shop: this tuning's packs at their example prices.
  {
    const page = await start(fresh);
    await page.click('#mapCoins button');
    await page.waitForSelector('.tf-shop-pack');
    const packs = await page.locator('.tf-shop-pack').allTextContents();
    t.packs.forEach((p, i) => check(`pack ${i + 1}`, packs[i].includes(`€${Math.floor(p.examplePriceCents / 100)}.${String(p.examplePriceCents % 100).padStart(2, '0')}`) && packs[i].replace(/\s/g, '').includes(`${p.coins}coins`) ? p.coins : packs[i], p.coins));
    await page.waitForTimeout(500);
    await page.screenshot({ path: name('04-shop') });
    await page.context().close();
  }
}

// The choice in the test lab, as it stands for a new player.
{
  const page = await start({ version: 7, economy: 3, best: {}, coins: own.coins.start, paid: {}, settings: { music: false }, lab: {} });
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  const row = page.locator('[data-key=economy]');
  await row.scrollIntoViewIfNeeded();
  check('the lab starts on the game\'s own tuning', await row.locator('[role=radio][aria-checked=true]').textContent(), own.label);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/lab-coin-tuning.png` });
  await page.context().close();
}

await browser.close();
if (failures.length > 0) {
  console.error(`${failures.length} amount(s) on screen differ from data/config.json`);
  process.exit(1);
}
