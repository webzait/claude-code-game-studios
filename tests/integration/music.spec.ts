// Playwright: the background music in the single-file build, in a real browser.
// A probe on the way to the speakers measures what actually comes out, so "plays" and "stops"
// are checked on the sound itself and not only on the game's own word for it.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const build = pathToFileURL(resolve('dist-single/index.html')).href;
const evidence = 'production/qa/evidence/music';
/** Below this the output counts as silence (about -80 dB). */
const SILENCE = 0.0001;

declare global {
  interface Window {
    /** Loudness (rms) and highest sample of what reaches the speakers right now. */
    heard(): { rms: number; peak: number };
  }
}

/** Open the game with a probe between every sound and the speakers. `save` is merged into a stored save first. */
async function open(page: Page, settings: Record<string, unknown> = {}, lab: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
      const probes = new WeakMap<BaseAudioContext, AnalyserNode>();
      let latest: AnalyserNode | null = null;
      const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
      AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
        const target = args[0];
        if (target instanceof AudioDestinationNode) {
          let probe = probes.get(this.context);
          if (!probe) {
            probe = this.context.createAnalyser();
            // A short window (about 40 ms), so a reading taken after a stop holds none of the sound from before it.
            probe.fftSize = 2048;
            connect.call(probe, target);
            probes.set(this.context, probe);
            latest = probe;
          }
          return connect.call(this, probe);
        }
        return connect.apply(this, args);
      } as typeof AudioNode.prototype.connect;
      window.heard = () => {
        if (!latest) return { rms: 0, peak: 0 };
        const data = new Float32Array(latest.fftSize);
        latest.getFloatTimeDomainData(data);
        let sum = 0;
        let peak = 0;
        for (const v of data) {
          sum += v * v;
          peak = Math.max(peak, Math.abs(v));
        }
        return { rms: Math.sqrt(sum / data.length), peak };
      };
    },
    [JSON.stringify({ version: 7, best: {}, coins: config.coins.start, paid: {}, economy: 2, settings, lab })],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}

const music = (page: Page) => page.evaluate(() => window.turnflock.snapshot().music);
const heard = (page: Page) => page.evaluate(() => window.heard());
/** Pretend the tab went to the background or came back. */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
/** A touch that changes nothing in the game: the title band of the level screen. */
const touch = (page: Page) => page.mouse.click(195, 20);

test('music waits for the first touch, then plays and reaches the speakers', async ({ page }) => {
  const errors = await open(page);
  await page.waitForTimeout(600);
  expect(await music(page)).toEqual({ playing: null, sounding: false, context: 'none' });
  await touch(page);
  expect((await music(page)).playing).toBe(config.music.variant);
  await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await music(page)).context).toBe('running');
  await expect.poll(async () => (await heard(page)).rms, { timeout: 15_000 }).toBeGreaterThan(SILENCE * 20);
  expect(errors).toEqual([]);
});

test('music plays on the level screen and the puzzle screen, under the sound effects and never overdriven', async ({ page }) => {
  await open(page);
  await page.click('#continue');
  await expect.poll(async () => (await page.evaluate(() => window.turnflock.snapshot().screen))).toBe('level');
  await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
  // Let the fade-in finish, then listen while tapping commands, so effects sound on top of the music.
  await page.waitForTimeout(config.music.fadeIn * 1000 + 300);
  let peak = 0;
  let quietest = Infinity;
  for (let i = 0; i < 40; i++) {
    if (i % 8 === 2) await page.keyboard.press('ArrowUp');
    const now = await heard(page);
    peak = Math.max(peak, now.peak);
    quietest = Math.min(quietest, now.rms);
    await page.waitForTimeout(100);
  }
  expect((await music(page)).playing).toBe(config.music.variant);
  expect(quietest).toBeGreaterThan(SILENCE);
  expect(peak).toBeLessThan(1);
  test.info().annotations.push({ type: 'highest sample heard with effects on top', description: peak.toFixed(3) });
});

test('music goes silent in the background and comes back in front', async ({ page }) => {
  await open(page);
  await touch(page);
  await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await heard(page)).rms, { timeout: 30_000 }).toBeGreaterThan(SILENCE);
  await setHidden(page, true);
  expect(await music(page)).toMatchObject({ playing: null, sounding: false });
  await expect.poll(async () => (await music(page)).context).toBe('suspended');
  expect((await heard(page)).rms).toBeLessThan(SILENCE);
  await setHidden(page, false);
  expect((await music(page)).playing).toBe(config.music.variant);
  await expect.poll(async () => (await music(page)).context).toBe('running');
  await expect.poll(async () => (await heard(page)).rms, { timeout: 15_000 }).toBeGreaterThan(SILENCE);
});

test('the Music switch turns the music off and on, apart from Sound, and is remembered', async ({ page }) => {
  await open(page);
  await page.click('#toSettings');
  const musicSwitch = page.locator('#settings [data-key="music"] [role="switch"]');
  const soundSwitch = page.locator('[data-key="sound"] [role="switch"]');
  await expect(musicSwitch).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await heard(page)).rms, { timeout: 30_000 }).toBeGreaterThan(SILENCE);
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/settings-music-on.png` });

  // Sound off: the music plays on.
  await soundSwitch.click();
  await page.waitForTimeout(500);
  expect((await music(page)).playing).toBe(config.music.variant);
  expect((await heard(page)).rms).toBeGreaterThan(SILENCE);

  // Music off: silence after the fade, and Sound is left as it was.
  await musicSwitch.click();
  await expect(musicSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
  expect(await music(page)).toMatchObject({ playing: null, sounding: false });
  await expect.poll(async () => (await heard(page)).rms, { timeout: 5000 }).toBeLessThan(SILENCE);
  await page.screenshot({ path: `${evidence}/settings-music-off.png` });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('turnflock.save') ?? '{}').settings);
  expect(stored).toMatchObject({ music: false, mute: true });

  // After a reload it is still off, whatever is touched.
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  await page.click('#toSettings');
  await expect(page.locator('#settings [data-key="music"] [role="switch"]')).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(800);
  expect(await music(page)).toMatchObject({ playing: null, sounding: false });

  // Switched on again, it plays again.
  await page.locator('#settings [data-key="music"] [role="switch"]').click();
  expect((await music(page)).playing).toBe(config.music.variant);
  await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await heard(page)).rms, { timeout: 30_000 }).toBeGreaterThan(SILENCE);
});

test('the test lab switches between the music variants', async ({ page }) => {
  await open(page);
  await page.click('#toSettings');
  await page.click('.tf-set-entry');
  const row = page.locator('#lab [data-key="music"]');
  await row.scrollIntoViewIfNeeded();
  const options = row.locator('[role="radio"]');
  expect(await options.count()).toBeGreaterThanOrEqual(2);
  const names = Object.keys(config.music.tempo);
  for (const [index, name] of names.entries()) {
    await options.nth(index).click();
    expect((await music(page)).playing).toBe(name);
    await expect.poll(async () => (await music(page)).sounding, { timeout: 30_000 }).toBe(true);
    await expect.poll(async () => (await heard(page)).rms, { timeout: 15_000 }).toBeGreaterThan(SILENCE);
  }
  await page.screenshot({ path: `${evidence}/lab-music-variants.png` });
});
