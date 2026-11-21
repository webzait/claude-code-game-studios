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
const press = (page: Page, command: string): Promise<void> => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
async function playWitness(page: Page, index: number): Promise<void> {
  for (const command of levels[index].witness) await press(page, command);
}

test('boots to the level selection, and level 1 opens with a drawn board and no errors @boot', async ({ page }) => {
  const errors = await open(page);
  expect((await snap(page)).screen).toBe('map');
  await expect(page.locator('.node')).toHaveCount(levels.length);
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
  await expect(page.locator('#cardPrimary')).toHaveText('Next', { timeout: 15000 });
  await page.click('#cardPrimary');
  await expect(page.locator('#levelName')).toHaveText(levels[1].name);
  await page.click('#levelBack');
  await expect(page.locator('#node-1')).toHaveClass(/done/);
  await expect(page.locator('#node-2')).toBeEnabled();
  await expect(page.locator('#node-3')).toBeDisabled();
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  const perfect = config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect;
  expect(await snap(page)).toMatchObject({ best: { [levels[0].id]: levels[0].par }, coins: config.coins.start + perfect });
  await expect(page.locator('#coins')).toHaveText(String(config.coins.start + perfect));
  await expect(page.locator('#mapCount')).toHaveText(`1/${levels.length}`);
  expect(errors).toEqual([]);
});

test('every level can be played to a win in order, ending back at the level selection', async ({ page }) => {
  test.setTimeout(240_000); // ten levels of real animation
  const errors = await open(page);
  await page.click('#node-1');
  for (let index = 0; index < levels.length; index++) {
    await playWitness(page, index);
    expect((await snap(page)).status).toBe('won');
    await expect(page.locator('#card')).toBeVisible({ timeout: 30000 });
    await page.click('#cardPrimary');
  }
  expect((await snap(page)).screen).toBe('map');
  await expect(page.locator('.node.done')).toHaveCount(levels.length);
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
  await expect(page.locator('#cardTitle')).toHaveText('Out of moves', { timeout: 15000 });
  await expect(page.locator('#cardPrimary')).toHaveText('Retry');
  await expect(page.locator('#cardExtra')).toHaveText('Hint');
  await expect(page.locator('#cardNote')).toContainText('not offered');
  await page.click('#cardExtra');
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
  await expect(page.locator('#cardExtra')).toHaveText(`+${config.extraMoves} moves · ${config.coins.extraMovesCost} coins`, { timeout: 15000 });
  await page.click('#cardExtra');
  expect(await snap(page)).toMatchObject({ status: 'playing', movesLeft: config.extraMoves, coins: config.coins.start - config.coins.extraMovesCost });
  for (let i = 0; i < config.extraMoves && (await snap(page)).status === 'playing'; i++) await press(page, 'forward');
  expect((await snap(page)).status).toBe('won');
  await expect(page.locator('#cardText')).toContainText('extra moves', { timeout: 15000 });
  // A helped win pays the base amount only.
  expect((await snap(page)).coins).toBe(config.coins.start - config.coins.extraMovesCost + config.coins.win);
});

test('Hint: the status is free, the next move costs coins, and without coins it is refused', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  await press(page, 'red'); // leave the witness so the solver has to search
  await page.click('#undo');
  await press(page, 'forward');
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
  await page.click('#toSettings');
  await page.click('#freeHelp-on');
  await page.click('#settingsBack');
  await page.click('#node-1');
  for (let i = 0; i < budget(0) && (await snap(page)).status === 'playing'; i++) {
    await page.click('#scan');
    await page.click('#scan');
    await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  }
  expect(await snap(page)).toMatchObject({ status: 'won' });
});

test('settings: test lab switches change the next level, and reset needs two taps', async ({ page }) => {
  await open(page);
  await page.click('#toSettings');
  await page.click('#yellowEarly-on');
  await page.click('#slack-3');
  await page.click('#unlockAll-on');
  await page.click('#settingsBack');
  await page.click('#node-2');
  expect((await snap(page)).movesLeft).toBe(levels[1].par + 3);
  await expect(page.locator('.cmd[data-cmd=yellow]')).toBeVisible();
  await expect(page.locator('.cmd[data-cmd=blue]')).toBeHidden();
  await playWitness(page, 1).catch(() => undefined);
  await page.click('#levelBack');
  await page.click('#toSettings');
  await page.click('#exitRule-single');
  await page.click('#settingsBack');
  await page.click('#node-5');
  await expect(page.locator('#hint')).toContainText('Test rule', { timeout: 20000 });
  expect((await snap(page)).budget).toBe(9 + 3); // single-file par for Queue Up is 9
  await page.click('#levelBack');
  await page.click('#toSettings');
  await page.click('#resetProgress');
  await page.click('#resetProgress');
  expect((await snap(page)).best).toEqual({});
});
