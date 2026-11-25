// Playwright: the test shop's buying loop in the single-file build, opened from disk at phone size.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
const undoCost: number = config.coins.undoCost;
const pack: { id: string; name: string; coins: number; examplePriceCents: number } = config.shop.packs[0];
const price = `€${Math.floor(pack.examplePriceCents / 100)}.${String(pack.examplePriceCents % 100).padStart(2, '0')}`;

/** Open the build with a stored wallet and lab switches; collects page errors, console errors and every request that leaves the file. */
async function open(page: Page, coins: number, lab: Record<string, unknown> = {}): Promise<{ errors: string[]; requests: string[] }> {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    // The shop and its buttons are the same in every theme; the robot theme is picked because its board
    // draws much faster in the software-rendered test browser (design/themes.md).
    [JSON.stringify({ version: 9, best: {}, coins, paid: {}, economy: 2, settings: { theme: 'robot', themeChosen: true }, lab })],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return { errors, requests };
}
const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
const press = (page: Page, command: string): Promise<void> => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
/** Tap a pack and confirm it. */
async function buy(page: Page): Promise<void> {
  await page.click(`.tf-shop-pack[data-pack=${pack.id}]`);
  await expect(page.locator('.tf-shop-confirm')).toContainText('This is a test. Nothing is charged.');
  await page.click('#shopConfirm');
}

test('the buying loop: short of coins, shop from the level, a test purchase, back in the same level, spend again', async ({ page }) => {
  const { errors, requests } = await open(page, undoCost);
  await page.click('#node-1');
  // Spend the wallet down to zero with one Undo, then ask for one more.
  await press(page, 'forward');
  await page.click('#undo');
  expect(await snap(page)).toMatchObject({ coins: 0, commands: [] });
  await press(page, 'forward');
  await expect(page.locator('#getCoins')).toHaveCount(0);
  await page.click('#undo');
  // Refused: the free way out is named first, and the shop is a quiet link beside it. Nothing popped up.
  await expect(page.locator('#hint')).toContainText('Restart is free');
  await expect(page.locator('#getCoins')).toBeVisible();
  await expect(page.locator('#shop')).toBeHidden();
  const before = await snap(page);
  expect(before).toMatchObject({ coins: 0, commands: ['forward'], shopOpen: false });

  await page.click('#getCoins');
  await expect(page.locator('#shop')).toBeVisible();
  await expect(page.locator('.tf-shop-head')).toContainText('Test shop');
  await expect(page.locator('#shopNote')).toContainText('Nothing is charged');
  await expect(page.locator('.tf-shop-pack')).toHaveCount(config.shop.packs.length);
  // The price is on the pack before the tap.
  await expect(page.locator(`.tf-shop-pack[data-pack=${pack.id}]`)).toContainText(price);
  await expect(page.locator(`.tf-shop-pack[data-pack=${pack.id}]`)).toContainText(`${pack.coins} coins`);
  // Keys do not play the level under the sheet.
  await page.keyboard.press('ArrowUp');
  expect((await snap(page)).commands).toEqual(['forward']);

  // The confirmation step names the pack, the coins and the example price, and carries the label.
  await page.click(`.tf-shop-pack[data-pack=${pack.id}]`);
  const confirm = page.locator('.tf-shop-confirm');
  await expect(confirm).toContainText(pack.name);
  await expect(confirm).toContainText(`+${pack.coins}`);
  await expect(confirm).toContainText(price);
  await expect(confirm).toContainText('Test shop');
  await expect(confirm).toContainText('This is a test. Nothing is charged.');
  expect((await snap(page)).coins).toBe(0);
  await page.click('#shopConfirm');
  await expect(page.locator('#shopReceipt')).toContainText(`+${pack.coins} coins`, { timeout: 15000 });
  await expect(page.locator('#shopReceipt')).toContainText('Nothing was charged');
  await expect(page.locator('#shopCoins .tf-coin-amount')).toHaveText(String(pack.coins), { timeout: 15000 });

  // Back exactly where the player was: same level, same move, and the link is gone.
  await page.click('#shopClose');
  await expect(page.locator('#shop')).toBeHidden();
  const after = await snap(page);
  expect(after).toMatchObject({ screen: 'level', level: before.level, commands: ['forward'], movesLeft: before.movesLeft, coins: pack.coins, shopOpen: false });
  await expect(page.locator('#getCoins')).toHaveCount(0);
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(pack.coins));

  // The bought coins pay for the Undo that was refused.
  await page.click('#undo');
  const spent = await snap(page);
  expect(spent).toMatchObject({ coins: pack.coins - undoCost, commands: [] });
  // The ledger has the spend, the purchase and the spend, each with the balance after it.
  expect(spent.ledger.map((e) => [e.kind, e.item, e.coins, e.balance])).toEqual([
    ['spent', 'undo', -undoCost, 0],
    ['bought', pack.id, pack.coins, pack.coins],
    ['spent', 'undo', -undoCost, pack.coins - undoCost],
  ]);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('turnflock.save')!)).ledger.totals).toMatchObject({ bought: pack.coins, purchases: 1, earned: 0, spentUndo: 2 * undoCost });
  // Nothing left the device, and nothing went wrong.
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const outcome of ['cancelled', 'failed'] as const) {
  test(`a ${outcome} test purchase leaves the balance alone and says so`, async ({ page }) => {
    const { errors, requests } = await open(page, config.coins.start, { purchaseOutcome: outcome });
    await page.click('#mapCoins button');
    await expect(page.locator('#shop')).toBeVisible();
    await buy(page);
    await expect(page.locator('#shopReceipt')).toContainText(outcome === 'cancelled' ? 'Purchase cancelled' : 'Purchase failed', { timeout: 15000 });
    await expect(page.locator('#shopReceipt')).toContainText(`your coins did not change: ${config.coins.start}`);
    await expect(page.locator('#shopReceipt')).toContainText('Nothing was charged');
    await page.click('#shopClose');
    expect(await snap(page)).toMatchObject({ screen: 'map', coins: config.coins.start, ledger: [] });
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('Cancel in the confirmation step buys nothing', async ({ page }) => {
  await open(page, config.coins.start);
  await page.click('#mapCoins button');
  await page.click(`.tf-shop-pack[data-pack=${pack.id}]`);
  await page.click('#shopCancel');
  await expect(page.locator('#shopReceipt')).toContainText('Purchase cancelled');
  await expect(page.locator('.tf-shop-pack')).toHaveCount(config.shop.packs.length);
  expect(await snap(page)).toMatchObject({ coins: config.coins.start, ledger: [] });
});

test('the test lab shows the ledger with totals, sets the balance and clears the ledger', async ({ page }) => {
  await open(page, config.coins.start);
  await page.click('#mapCoins button');
  await buy(page);
  await expect(page.locator('#shopReceipt')).toContainText('Nothing was charged', { timeout: 15000 });
  await page.click('#shopClose');
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  await expect(page.locator('[data-total=bought] dd')).toHaveText(String(pack.coins));
  await expect(page.locator('[data-total=earned] dd')).toHaveText('0');
  await expect(page.locator('[data-total=balance] dd')).toHaveText(String(config.coins.start + pack.coins));
  await expect(page.locator('.tf-led-list li')).toHaveCount(1);
  await expect(page.locator('.tf-led-list li')).toContainText(`Bought: ${pack.name}`);
  await page.fill('#ledgerBalance', '7');
  await page.click('#ledgerSet');
  expect((await snap(page)).coins).toBe(7);
  await expect(page.locator('[data-total=balance] dd')).toHaveText('7');
  // Setting the balance is a line, not a purchase.
  await expect(page.locator('[data-total=bought] dd')).toHaveText(String(pack.coins));
  await expect(page.locator('.tf-led-list li')).toHaveCount(2);
  await page.click('#ledgerClear');
  await expect(page.locator('.tf-led-list')).toHaveCount(0);
  await expect(page.locator('[data-total=bought] dd')).toHaveText('0');
  expect(await snap(page)).toMatchObject({ coins: 7, ledger: [] });
});

test('switching the shop off in the test lab brings the explainer back, and no "Get coins" link is offered', async ({ page }) => {
  await open(page, 0);
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  await page.click('[data-key=shop] [role=switch]');
  expect((await snap(page)).lab.shop).toBe(false);
  await page.click('#lab .tf-set-top button');
  await page.click('#settings .tf-set-top button');
  await page.click('#mapCoins button');
  await expect(page.locator('#coinInfo')).toBeVisible();
  await expect(page.locator('#coinInfo')).toContainText('there is nothing to buy');
  await expect(page.locator('#shop')).toBeHidden();
  await page.click('#coinInfoClose');
  await page.click('#node-1');
  await press(page, 'forward');
  await page.click('#undo');
  await expect(page.locator('#hint')).toContainText('Restart is free');
  await expect(page.locator('#getCoins')).toHaveCount(0);
});
