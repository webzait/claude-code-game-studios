// Button sounds (design/button-sounds.md) in the single-file build: the sets are offered in the test lab,
// a move's sounds start at the right moments, fast tapping stays within the loudness limit, and the Sound
// setting silences them. The listening page is opened as well. Screenshots go to production/qa/evidence/button-sounds/.
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const sets: Record<string, { name: string; timing: string; sounds: Record<string, unknown> }> = JSON.parse(readFileSync('data/sound-sets.json', 'utf8'));
const levels: { id: string; witness: string[] }[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
const listen = resolve('dist-sounds/sounds.html');
const evidence = 'production/qa/evidence/button-sounds';
const ids = Object.keys(sets);
const motionSets = ids.filter((id) => sets[id].timing === 'motion');

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
    [JSON.stringify({ version: 6, best: {}, coins: config.coins.start, paid: {}, economy: 2, settings: {}, lab })],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}
const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
const names = async (page: Page): Promise<string[]> => (await snap(page)).sounds.map((s) => s.name);

test('the test lab offers every sound set, and the choice is kept', async ({ page }) => {
  const errors = await open(page);
  expect((await snap(page)).lab.soundSet).toBe(config.audio.set);
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  const row = page.locator('[data-key=soundSet]');
  await row.scrollIntoViewIfNeeded();
  await expect(row.locator('[role=radio]')).toHaveCount(ids.length);
  for (const id of ids) await expect(row.locator(`[data-value=${id}]`)).toHaveText(sets[id].name);
  await expect(row.locator(`[data-value=${config.audio.set}]`)).toHaveAttribute('aria-checked', 'true');
  const other = motionSets[0];
  await row.locator(`[data-value=${other}]`).click();
  // The switch itself answers in the new set, so the change is heard at once.
  expect((await snap(page)).sounds.at(-1)).toMatchObject({ name: 'tap', set: other });
  await page.screenshot({ path: `${evidence}/lab-sound-set-390x844.png` });
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect((await snap(page)).lab.soundSet).toBe(other);
  expect(errors).toEqual([]);
});

for (const id of motionSets) {
  test(`${id}: the button sounds at the touch, the turn and the step when the robots make them`, async ({ page }) => {
    const errors = await open(page, { soundSet: id });
    await page.click('#node-1');
    await page.evaluate(() => {
      (window as unknown as { tapAt: number }).tapAt = 0;
      document.querySelector('.cmd[data-cmd=red]')!.addEventListener('pointerdown', () => ((window as unknown as { tapAt: number }).tapAt = performance.now()), { capture: true });
    });
    const before = (await snap(page)).sounds.length;
    await page.tap('.cmd[data-cmd=red]');
    await expect.poll(async () => (await names(page)).slice(before)).toEqual(['press-red', 'turn', 'step']);
    const s = await snap(page);
    const tapAt = await page.evaluate(() => (window as unknown as { tapAt: number }).tapAt);
    const [press, turn, step] = s.sounds.slice(before);
    expect(press.set).toBe(id);
    // Asked for within a few milliseconds of the touch, in the same task as the tap handler.
    expect(press.at - tapAt).toBeGreaterThanOrEqual(0);
    expect(press.at - tapAt).toBeLessThan(20);
    // The step sounds after the turn has played: at least most of the turn's length later.
    expect(step.at - turn.at).toBeGreaterThan(config.anim.turnTime * 1000 * 0.6);
    // The page's audio output is really running after the tap.
    expect(await page.evaluate(() => (window.turnflock as unknown as { sfx: { context: AudioContext } }).sfx.context.state)).toBe('running');
    await page.tap('.cmd[data-cmd=forward]');
    await expect.poll(async () => (await names(page)).slice(before + 3)).toEqual(['press-forward', 'step']);
    expect(errors).toEqual([]);
  });
}

test('classic: one sound per move at the touch, as before', async ({ page }) => {
  await open(page, { soundSet: 'classic' });
  await page.click('#node-1');
  const before = (await snap(page)).sounds.length;
  await page.tap('.cmd[data-cmd=red]');
  await page.waitForTimeout(700);
  expect((await names(page)).slice(before)).toEqual(['turn']);
});

for (const id of ids) {
  test(`${id}: fast tapping stays tidy and below the loudness limit`, async ({ page }) => {
    await open(page, { soundSet: id });
    await page.click('#node-1');
    // Listen to what actually leaves the game while tapping far faster than the animation.
    await page.evaluate(() => {
      const w = window as unknown as { loudest: number };
      w.loudest = 0;
      const poll = (): void => {
        w.loudest = Math.max(w.loudest, window.turnflock.snapshot().soundPeak);
        requestAnimationFrame(poll);
      };
      poll();
    });
    const before = (await snap(page)).sounds.length;
    for (let i = 0; i < 6; i++) {
      await page.dispatchEvent(`.cmd[data-cmd=${i % 2 ? 'forward' : 'red'}]`, 'pointerdown');
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1200);
    const loudest = await page.evaluate(() => (window as unknown as { loudest: number }).loudest);
    // Sound really came out, and never above the limit for a busy moment.
    expect(loudest).toBeGreaterThan(0.01);
    expect(loudest).toBeLessThanOrEqual(config.audio.limits.busyPeak);
    const played = (await snap(page)).sounds.slice(before);
    // No sound was started twice within the minimum gap at full strength.
    for (let i = 1; i < played.length; i++) {
      const again = played.slice(0, i).findLast((p) => p.name === played[i].name && p.gain > 0);
      if (again && played[i].at - again.at < config.audio.rapid.minGap * 1000 * 0.5) expect(played[i].gain).toBe(0);
    }
  });
}

test('a command button that cannot be used answers with the refusal sound', async ({ page }) => {
  await open(page, { soundSet: motionSets[0] });
  await page.click('#node-1');
  for (const command of levels[0].witness) await page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
  expect((await snap(page)).status).toBe('won');
  await expect(page.locator('.cmd[data-cmd=red]')).toBeDisabled();
  const before = (await snap(page)).sounds.length;
  await page.dispatchEvent('.cmd[data-cmd=red]', 'pointerdown');
  expect((await names(page)).slice(before)).toContain('deny');
  expect((await snap(page)).commands.length).toBe(levels[0].witness.length);
});

test('the Sound setting silences every set and is kept', async ({ page }) => {
  await open(page, { soundSet: motionSets[0] });
  await page.click('#toSettings');
  await page.click('[data-key=sound] [role=switch]');
  await page.screenshot({ path: `${evidence}/settings-sound-off-390x844.png` });
  await page.click('#settings .tf-set-top button');
  await page.click('#node-1');
  const before = (await snap(page)).sounds.length;
  await page.tap('.cmd[data-cmd=red]');
  await page.waitForTimeout(700);
  expect((await snap(page)).sounds.length).toBe(before);
  expect((await snap(page)).soundPeak).toBe(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('turnflock.save')!).settings.mute)).toBe(true);
});

test('the listening page plays every sound of every set', async ({ page }) => {
  test.skip(!existsSync(listen), 'npm run build:sounds first');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(listen).href);
  await expect(page.locator('.set')).toHaveCount(ids.length);
  for (const id of ids) {
    const buttons = page.locator(`.set[data-set=${id}] .play[data-sound]:not(:disabled)`);
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(id === 'classic' ? 5 : 9);
    for (let i = 0; i < count; i++) {
      const name = await buttons.nth(i).getAttribute('data-sound');
      await buttons.nth(i).dispatchEvent('pointerdown');
      const last = await page.evaluate(() => window.turnflockSounds.played.at(-1));
      expect(last).toMatchObject({ name, set: id });
      await page.waitForTimeout(140);
    }
  }
  await page.locator(`.set[data-set=${motionSets[0]}] [data-move=red]`).click();
  await expect.poll(() => page.evaluate(() => window.turnflockSounds.played.slice(-3).map((p) => p.name))).toEqual(['press-red', 'turn', 'step']);
  await page.screenshot({ path: `${evidence}/listening-page-390x844.png`, fullPage: true });
  expect(errors).toEqual([]);
});
