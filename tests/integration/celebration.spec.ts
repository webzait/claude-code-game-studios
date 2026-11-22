// Playwright: the win celebration in the single-file build, at phone size.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface LevelData {
  id: string;
  par: number;
  witness: string[];
}
const levels: LevelData[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
const VARIANTS = ['confetti', 'wave', 'hop'] as const;

/** Opens the build with a fresh save that has `lab` set, and collects every page error and console error. */
async function open(page: Page, lab: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    [JSON.stringify({ version: 5, best: {}, coins: config.coins.start, paid: {}, settings: {}, lab })],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}

const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
async function winLevelOne(page: Page): Promise<void> {
  await page.click('#node-1');
  for (const command of levels[0].witness) await page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
  expect((await snap(page)).status).toBe('won');
}

for (const variant of VARIANTS) {
  test(`win celebration "${variant}": plays for a three-star win, the pop-up follows by itself, and Next works at once`, async ({ page }) => {
    const errors = await open(page, { celebration: variant });
    expect((await snap(page)).celebration).toBeNull();
    await winLevelOne(page);
    await expect.poll(async () => (await snap(page)).celebration, { timeout: 15000 }).toMatchObject({ variant, perfect: true, calm: false, cardDelay: config.celebration.perfectCardDelay, seconds: config.celebration[variant].perfectSeconds });
    // The pop-up is not waited for by the player: it comes by itself, unchanged, and Next starts the next level while the effect may still play.
    await expect(page.locator('#end-next')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
    await page.click('#end-next');
    expect(await snap(page)).toMatchObject({ level: 1, status: 'playing', celebration: { active: false } });
    await expect(page.locator('#card')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('win celebration: a tap skips it and the pop-up is there at once', async ({ page }) => {
  const errors = await open(page, { celebration: 'hop' });
  await winLevelOne(page);
  await expect.poll(async () => (await snap(page)).celebration?.active, { timeout: 15000 }).toBe(true);
  await page.dispatchEvent('#board', 'pointerdown');
  expect((await snap(page)).celebration).toMatchObject({ active: false, cardShown: true });
  await expect(page.locator('#end-next')).toBeVisible();
  // Skipping took nothing away: the win is saved and paid as always.
  expect(await snap(page)).toMatchObject({ best: { [levels[0].id]: levels[0].par }, coins: config.coins.start + config.coins.win + config.coins.perfect });
  // Retry from the pop-up starts clean, and a second win of the same level celebrates the same way.
  await page.click('#end-retry');
  expect((await snap(page)).celebration).toMatchObject({ active: false });
  for (const command of levels[0].witness) await page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
  await expect.poll(async () => (await snap(page)).celebration?.active, { timeout: 15000 }).toBe(true);
  expect((await snap(page)).celebration).toMatchObject({ variant: 'hop', perfect: true, calm: false });
  await expect(page.locator('#end-next')).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});

test('win celebration: leaving the level before the pop-up shows no pop-up later', async ({ page }) => {
  const errors = await open(page, { celebration: 'confetti' });
  await winLevelOne(page);
  await expect.poll(async () => (await snap(page)).celebration?.active, { timeout: 15000 }).toBe(true);
  await page.evaluate(() => (document.querySelector('#levelBack') as HTMLElement).click());
  expect(await snap(page)).toMatchObject({ screen: 'map', celebration: { active: false } });
  await page.waitForTimeout(config.celebration.confetti.perfectSeconds * 1000 + 300);
  await expect(page.locator('#card')).toBeHidden();
  expect(errors).toEqual([]);
});

test('win celebration: with reduced motion on the device every variant is the calm one', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await open(page, { celebration: 'confetti' });
  await winLevelOne(page);
  await expect.poll(async () => (await snap(page)).celebration, { timeout: 15000 }).toMatchObject({ calm: true, seconds: config.celebration.calm.seconds, cardDelay: config.celebration.calm.cardDelay });
  await expect(page.locator('#end-next')).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});

test('win celebration: with sound effects off it plans no sound', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('turnflock.save')!);
    save.settings.mute = true;
    localStorage.setItem('turnflock.save', JSON.stringify(save));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  await winLevelOne(page);
  await expect.poll(async () => (await snap(page)).celebration, { timeout: 15000 }).toMatchObject({ sound: null });
  expect(errors).toEqual([]);
});

test('test lab: "Win celebration" offers the three variants by name and the choice is kept', async ({ page }) => {
  const errors = await open(page);
  expect((await snap(page)).lab.celebration).toBe(config.celebration.variant);
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  await expect(page.locator('[data-key=celebration] [role=radio]')).toHaveText(['Confetti', 'Light wave', 'Victory hop']);
  await page.click('[data-key=celebration] [data-value=hop]');
  expect((await snap(page)).lab.celebration).toBe('hop');
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect((await snap(page)).lab.celebration).toBe('hop');
  expect(errors).toEqual([]);
});
