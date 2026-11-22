// Playwright: the single-file build opened from disk at phone size.
// npm run smoke runs only the @boot test.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface LevelData {
  id: string;
  name: string;
  par: number;
  witness: string[];
}
const levels: LevelData[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
const budget = (index: number): number => levels[index].par + config.moveSlack;

/** Opens the build and collects every page error and console error. */
async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}

const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
/** From the level selection into the test lab: settings, then the entry at the bottom. */
async function openLab(page: Page): Promise<void> {
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
}
/** From the test lab back to the level selection. */
async function closeLab(page: Page): Promise<void> {
  await page.click('#lab .tf-set-top button');
  await page.click('#settings .tf-set-top button');
}
const press = (page: Page, command: string): Promise<void> => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
async function playWitness(page: Page, index: number): Promise<void> {
  for (const command of levels[index].witness) await press(page, command);
}

test('boots to the level selection, and level 1 opens with a drawn board and no errors @boot', async ({ page }) => {
  const errors = await open(page);
  expect((await snap(page)).screen).toBe('map');
  await expect(page.locator('.tf-levels-tile')).toHaveCount(levels.length);
  await expect(page.locator('#continue')).toHaveText('Play level 1');
  // The logo is the screen's heading: an image named "Turnflock" that has loaded, keeps its shape and never takes a tap.
  const logo = page.getByRole('heading', { level: 1, name: 'Turnflock' }).getByRole('img', { name: 'Turnflock' });
  await expect(logo).toBeVisible();
  const drawn = await logo.evaluate((img: HTMLImageElement) => {
    const box = img.getBoundingClientRect();
    return { loaded: img.complete && img.naturalWidth > 0, shape: box.width / box.height, source: img.naturalWidth / img.naturalHeight, tappable: getComputedStyle(img).pointerEvents !== 'none', inside: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 };
  });
  expect(drawn).toMatchObject({ loaded: true, tappable: false, inside: true });
  expect(Math.abs(drawn.shape - drawn.source)).toBeLessThan(0.02);
  // The asset kit's 3D models really loaded; the game is not quietly on its built-in shapes.
  await expect.poll(async () => (await snap(page)).kitReady, { timeout: 20000 }).toBe(true);
  await expect(page.locator('#node-1')).toBeEnabled();
  await expect(page.locator('#node-2')).toBeDisabled();
  await page.click('#node-1');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: 0, status: 'playing', movesLeft: budget(0), collected: 0 });
  await expect(page.locator('#levelName')).toHaveText(levels[0].name);
  const size = await page.locator('#board').boundingBox();
  expect(size && size.width > 300 && size.height > 300).toBe(true);
  // Level 1 has only red robots: blue and yellow buttons are not shown.
  await expect(page.locator('.cmd[data-cmd=red]')).toBeVisible();
  await expect(page.locator('.cmd[data-cmd=blue]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Levels, Level, Win, Next: no dead ends, and progress survives a reload', async ({ page }) => {
  const errors = await open(page);
  await page.click('#node-1');
  await playWitness(page, 0);
  expect((await snap(page)).status).toBe('won');
  await expect(page.locator('#end-next')).toHaveText('Next', { timeout: 15000 });
  await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
  await page.click('#end-next');
  await expect(page.locator('#levelName')).toHaveText(levels[1].name);
  await page.click('#levelBack');
  await expect(page.locator('#node-1')).toHaveClass(/\bs3\b/);
  await expect(page.locator('#node-2')).toHaveClass(/is-next/);
  await expect(page.locator('#node-2')).toBeEnabled();
  await expect(page.locator('#node-3')).toBeDisabled();
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  const perfect = config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect;
  expect(await snap(page)).toMatchObject({ best: { [levels[0].id]: levels[0].par }, coins: config.coins.start + perfect });
  await expect(page.locator('#mapCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfect));
  await expect(page.locator('#mapProgress')).toHaveAttribute('aria-label', `1 of ${levels.length} levels, 3 of ${levels.length * 3} stars`);
  await expect(page.locator('#continue')).toHaveText('Play level 2');
  expect(errors).toEqual([]);
});

test('every level can be played to a win in order, ending back at the level selection', async ({ page }) => {
  test.setTimeout(240_000); // ten levels of real animation
  const errors = await open(page);
  await page.click('#node-1');
  for (let index = 0; index < levels.length; index++) {
    await playWitness(page, index);
    expect((await snap(page)).status).toBe('won');
    await expect(page.locator('#card .tf-end-card')).toBeVisible({ timeout: 30000 });
    // The last level has no Next: Levels is its main action.
    await page.click(index === levels.length - 1 ? '#end-levels' : '#end-next');
  }
  expect((await snap(page)).screen).toBe('map');
  await expect(page.locator('.tf-levels-tile.s3')).toHaveCount(levels.length);
  await expect(page.locator('#continue')).toHaveText('Play again');
  expect(errors).toEqual([]);
});

test('undo and restart take moves back', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  await press(page, 'forward');
  await press(page, 'red');
  await page.click('#undo');
  expect((await snap(page)).commands).toEqual(['forward']);
  await page.click('#restart');
  expect((await snap(page)).movesLeft).toBe(budget(0));
});

test('out of moves in a hopeless position: free Retry, and no extra moves offered', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  for (let i = 0; i < budget(0); i++) await press(page, 'red');
  expect((await snap(page)).status).toBe('lost');
  await expect(page.locator('#end-title')).toHaveText('Out of moves', { timeout: 15000 });
  await expect(page.locator('#end-retry')).toHaveText('Retry');
  await expect(page.locator('#end-undo')).toHaveText('Undo');
  await expect(page.locator('#end-offer')).toHaveCount(0);
  await expect(page.locator('.tf-end-note')).toContainText('no offer');
  await page.click('#end-hint');
  await expect(page.locator('#hint')).toContainText('Undo', { timeout: 15000 });
  await page.click('#restart');
  expect((await snap(page)).movesLeft).toBe(budget(0));
});

test('out of moves two steps from home: extra moves are offered and really win', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  // Level 1's witness is three forwards, red, three forwards. Spend the spare
  // moves standing at the wall, so the budget ends two steps short of the exit.
  const spare = budget(0) - levels[0].par + 2;
  const line = [...Array(3 + spare).fill('forward'), 'red', ...Array(budget(0) - 4 - spare).fill('forward')];
  expect(line.length).toBe(budget(0));
  for (const command of line) await press(page, command);
  expect((await snap(page)).status).toBe('lost');
  // The price is on the button before it is tapped; Undo and Retry stay beside it.
  await expect(page.locator('#end-offer')).toHaveAttribute('aria-label', `+${config.extraMoves} moves, ${config.coins.extraMovesCost} coins`, { timeout: 15000 });
  await expect(page.locator('#end-offer')).toContainText(String(config.coins.extraMovesCost));
  await expect(page.locator('#end-retry')).toBeVisible();
  await page.click('#end-offer');
  expect(await snap(page)).toMatchObject({ status: 'playing', movesLeft: config.extraMoves, coins: config.coins.start - config.coins.extraMovesCost });
  for (let i = 0; i < config.extraMoves && (await snap(page)).status === 'playing'; i++) await press(page, 'forward');
  expect((await snap(page)).status).toBe('won');
  await expect(page.locator('#end-result')).toContainText('extra moves', { timeout: 15000 });
  await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '1 of 3 stars');
  // A helped win pays the base amount only.
  expect((await snap(page)).coins).toBe(config.coins.start - config.coins.extraMovesCost + config.coins.win);
});

test('Hint: the status is free, the next move costs coins, and without coins it is refused', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  await press(page, 'red'); // leave the witness so the solver has to search
  await page.click('#undo');
  await press(page, 'forward');
  // The price is on the Hint button before it is tapped.
  await expect(page.locator('#scan')).toHaveAttribute('aria-label', `Hint, ${config.coins.hintCost} coins`);
  await page.click('#scan');
  await expect(page.locator('#hint')).toContainText('Solvable from here', { timeout: 30000 });
  expect((await snap(page)).coins).toBe(config.coins.start);
  await page.click('#scan');
  await expect(page.locator('#hint')).toContainText('Next:');
  await expect(page.locator('.cmd.nudge')).toHaveCount(1);
  expect((await snap(page)).coins).toBe(config.coins.start - config.coins.hintCost);
  // Spend the rest, one revealed move at a time, until the wallet cannot pay.
  const affordable = Math.floor(config.coins.start / config.coins.hintCost);
  for (let i = 1; i < affordable; i++) {
    await page.dispatchEvent('.cmd.nudge', 'pointerdown');
    await page.click('#scan');
    await page.click('#scan');
    await expect(page.locator('.cmd.nudge')).toHaveCount(1);
  }
  await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  await page.click('#scan');
  await page.click('#scan');
  await expect(page.locator('#hint')).toContainText('costs');
  await expect(page.locator('.cmd.nudge')).toHaveCount(0);
  expect((await snap(page)).coins).toBe(config.coins.start - affordable * config.coins.hintCost);
});

test('with free help switched on in the test lab, following the hint wins the level', async ({ page }) => {
  await open(page);
  await openLab(page);
  await page.click('[data-key=freeHelp] [role=switch]');
  await closeLab(page);
  await page.click('#node-1');
  await expect(page.locator('#scan')).toHaveAttribute('aria-label', 'Hint, free');
  for (let i = 0; i < budget(0) && (await snap(page)).status === 'playing'; i++) {
    await page.click('#scan');
    await page.click('#scan');
    await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  }
  expect(await snap(page)).toMatchObject({ status: 'won' });
});

test('settings: test lab switches change the next level, settings survive a reload, and reset needs two taps', async ({ page }) => {
  await open(page);
  await openLab(page);
  await page.click('[data-key=yellowEarly] [role=switch]');
  await page.click('[data-key=moveSlack] [data-value="3"]');
  await page.click('[data-key=unlockAll] [role=switch]');
  await closeLab(page);
  await page.click('#node-2');
  expect((await snap(page)).movesLeft).toBe(levels[1].par + 3);
  await expect(page.locator('.cmd[data-cmd=yellow]')).toBeVisible();
  await expect(page.locator('.cmd[data-cmd=blue]')).toBeHidden();
  await playWitness(page, 1).catch(() => undefined);
  await page.click('#levelBack');
  await openLab(page);
  await page.click('[data-key=exitRule] [data-value=single]');
  await closeLab(page);
  await page.click('#node-5');
  await expect(page.locator('#hint')).toContainText('Test rule', { timeout: 20000 });
  expect((await snap(page)).budget).toBe(9 + 3); // single-file par for Queue Up is 9
  await page.click('#levelBack');
  // Player settings and lab switches are still there after a reload.
  await page.click('#toSettings');
  await page.click('[data-key=sound] [role=switch]');
  await page.click('[data-key=reduceMotion] [data-value=true]');
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect((await snap(page)).lab).toMatchObject({ exitRule: 'single', moveSlack: 3, yellowEarly: true, unlockAll: true });
  await page.click('#toSettings');
  await expect(page.locator('[data-key=sound] [role=switch]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('[data-key=reduceMotion] [data-value=true]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.tf-set-entry')).toContainText('4 changed');
  // Reset: the first tap only opens the confirmation; nothing is erased until Erase.
  const before = await snap(page);
  await page.click('.tf-set-danger');
  await expect(page.locator('.tf-set-confirm')).toContainText('You keep: your settings.');
  expect((await snap(page)).coins).toBe(before.coins);
  await page.click('.tf-set-erase');
  expect(await snap(page)).toMatchObject({ best: {}, coins: config.coins.start });
  expect((await snap(page)).lab.unlockAll).toBe(true);
});

test('the plus button explains coins and sells nothing', async ({ page }) => {
  await open(page);
  await page.click('#mapCoins button');
  await expect(page.locator('#coinInfo')).toBeVisible();
  await expect(page.locator('#coinInfo')).toContainText('Undo and Restart are always free');
  await page.click('#coinInfoClose');
  await expect(page.locator('#coinInfo')).toBeHidden();
});
