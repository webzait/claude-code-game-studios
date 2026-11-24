// The theme setting (design/themes.md): switching in the settings changes the page and the
// board without a reload, is kept, and the garden build opens in the garden theme.
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const build = pathToFileURL(resolve('dist-single/index.html')).href;
const gardenFile = resolve('dist-single-garden/index.html');

async function open(page: Page, url: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}
const theme = (page: Page) => page.evaluate(() => window.turnflock.snapshot().theme);

test('theme: robot by default; Garden in the settings switches page and board at once, and is kept @boot', async ({ page }) => {
  const errors = await open(page, build);
  expect(await theme(page)).toEqual({ setting: 'robot', page: 'robot' });
  // Into level 1 and back, so a board is built before the switch.
  await page.click('#continue');
  await expect.poll(async () => (await page.evaluate(() => window.turnflock.snapshot().screen))).toBe('level');
  await page.click('#levelBack');
  await page.click('#toSettings');
  const row = page.locator('#settings [data-key="theme"]');
  await expect(row.getByRole('radio', { name: 'Robots' })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'Garden' }).click();
  expect(await theme(page)).toEqual({ setting: 'garden', page: 'garden' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tf-theme-sky').trim())).not.toBe('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('turnflock.save')!).settings.theme)).toBe('garden');
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect(await theme(page)).toEqual({ setting: 'garden', page: 'garden' });
  // Back to robots: the garden colours are gone again.
  await page.click('#toSettings');
  await page.locator('#settings [data-key="theme"]').getByRole('radio', { name: 'Robots' }).click();
  expect(await theme(page)).toEqual({ setting: 'robot', page: 'robot' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tf-theme-sky').trim())).toBe('');
  expect(errors).toEqual([]);
});

test('theme: the garden build opens a new player in the garden, and a level plays there', async ({ page }) => {
  test.skip(!existsSync(gardenFile), 'run npm run build:single:garden first');
  const errors = await open(page, pathToFileURL(gardenFile).href);
  expect(await theme(page)).toEqual({ setting: 'garden', page: 'garden' });
  await page.click('#continue');
  await expect.poll(async () => (await page.evaluate(() => window.turnflock.snapshot().screen))).toBe('level');
  await page.dispatchEvent('.cmd[data-cmd=forward]', 'pointerdown');
  await expect.poll(async () => (await page.evaluate(() => window.turnflock.snapshot().commands.length))).toBe(1);
  expect(errors).toEqual([]);
});
