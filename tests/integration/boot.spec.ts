// Playwright: the single-file build opened from disk at phone size.
// npm run smoke runs only the @boot test.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface LevelData {
  name: string;
  moveBudget: number;
  grid: string[];
}
const levels: LevelData[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
// Level 1's shortest solution, as the solver reports it (npm run solve).
const LEVEL_1_SOLUTION = ['forward', 'forward', 'forward', 'red', 'forward', 'forward', 'forward'];

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

const press = (page: Page, command: string): Promise<void> => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');

test('boots into level 1 with a drawn board and no errors @boot', async ({ page }) => {
  const errors = await open(page);
  const snap = await page.evaluate(() => window.turnflock.snapshot());
  expect(snap).toMatchObject({ level: 0, status: 'playing', movesLeft: levels[0].moveBudget, collected: 0 });
  await expect(page.locator('#levelName')).toHaveText(levels[0].name);
  const size = await page.locator('#board').boundingBox();
  expect(size && size.width > 300 && size.height > 300).toBe(true);
  // Level 1 has only red robots: blue and yellow buttons are not shown.
  await expect(page.locator('.cmd[data-cmd=red]')).toBeVisible();
  await expect(page.locator('.cmd[data-cmd=blue]')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the buttons play level 1 to a win, and Next level opens level 2', async ({ page }) => {
  const errors = await open(page);
  for (const command of LEVEL_1_SOLUTION) await press(page, command);
  const snap = await page.evaluate(() => window.turnflock.snapshot());
  expect(snap).toMatchObject({ status: 'won', collected: snap.total, commands: LEVEL_1_SOLUTION });
  await expect(page.locator('#card')).toBeVisible({ timeout: 15000 });
  await page.click('#cardPrimary');
  await expect(page.locator('#levelName')).toHaveText(levels[1].name);
  expect(errors).toEqual([]);
});

test('undo and restart take moves back; running out of moves ends the attempt', async ({ page }) => {
  await open(page);
  await press(page, 'forward');
  await press(page, 'red');
  await page.click('#undo');
  expect((await page.evaluate(() => window.turnflock.snapshot())).commands).toEqual(['forward']);
  await page.click('#restart');
  expect((await page.evaluate(() => window.turnflock.snapshot())).movesLeft).toBe(levels[0].moveBudget);
  for (let i = 0; i < levels[0].moveBudget; i++) await press(page, 'red');
  expect((await page.evaluate(() => window.turnflock.snapshot())).status).toBe('lost');
  await expect(page.locator('#cardTitle')).toHaveText('Out of moves', { timeout: 15000 });
});
