// One screen at a time, filling the window (finding B13): in every state of the level screen and
// through the moves between level screen, puzzle, settings, test lab and shop. Also with the rule the
// artifact version adds (#app padded for the notch) and a notch emulated on the phone, the case in
// which the level screen used to sit as an inset frame over the puzzle's backdrop.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const build = pathToFileURL(resolve('dist-single/index.html')).href;
const levels: { id: string; par: number }[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
/** Every level with three stars: the "all levels completed" state. */
const allDone = Object.fromEntries(levels.map((l) => [l.id, l.par]));
/** The first twelve completed, most of them with fewer than three stars: the path, and levels to improve. */
const someToImprove = Object.fromEntries(levels.slice(0, 12).map((l, i) => [l.id, l.par + (i % 3 ? 4 : 0)]));
/** The rule the artifact version adds around the game. */
const ARTIFACT_PADDING = '#app{padding-block:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-bottom));padding-inline:max(16px,env(safe-area-inset-left)) max(16px,env(safe-area-inset-right))}';
const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
type Host = 'plain' | 'artifact+notch';

/** Open the build with a save; `artifact+notch` adds the artifact's padding rule and a phone notch. */
async function open(page: Page, host: Host, best: Record<string, number>, lab: Record<string, unknown> = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (host === 'artifact+notch') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
  }
  await page.addInitScript(
    ([save, css]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
      if (css)
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = css;
          document.head.append(style);
        });
    },
    [JSON.stringify({ version: 10, best, coins: 50, paid: best, economy: 2, settings: { music: false }, lab }), host === 'plain' ? '' : ARTIFACT_PADDING],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}

/** The screens on show, each with its box, the window size, and whether the puzzle's backdrop is drawn. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const shown = [...document.querySelectorAll<HTMLElement>('#app > .screen')].filter((s) => !s.hidden && getComputedStyle(s).display !== 'none');
    return {
      screens: shown.map((s) => {
        const b = s.getBoundingClientRect();
        return { id: s.id, left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      }),
      width: innerWidth,
      height: innerHeight,
      backdropDrawn: getComputedStyle(document.getElementById('backdrop')!).visibility !== 'hidden',
    };
  });

/** Exactly one screen, `id`, covering the whole window. */
async function expectOneScreen(page: Page, id: string): Promise<void> {
  const l = await layout(page);
  expect(l.screens.map((s) => s.id), 'screens on show').toEqual([id]);
  const s = l.screens[0];
  // #level keeps a phone-wide column on wide windows; at phone width it spans the window too.
  expect([s.left, s.top, s.right, s.bottom].map(Math.round), `${id} fills the window`).toEqual([0, 0, l.width, l.height]);
}

/** The level screen's header controls are not covered by anything (the test tab, the grid, the logo). */
async function expectHeaderClear(page: Page): Promise<void> {
  const covered = await page.evaluate(() => {
    const out: string[] = [];
    const controls = [...document.querySelectorAll<HTMLElement>('#mapCoins button, #mapCoins .tf-coin-total, #mapProgress, #toImprove, #toSettings')].filter((e) => !e.closest('[hidden]') && e.getBoundingClientRect().width > 0);
    for (const c of controls) {
      const b = c.getBoundingClientRect();
      for (const [x, y] of [[b.left + b.width / 2, b.top + b.height / 2], [b.left + 3, b.bottom - 3], [b.right - 3, b.bottom - 3], [b.left + 3, b.top + 3], [b.right - 3, b.top + 3]]) {
        const hit = document.elementFromPoint(x, y);
        if (hit && !c.contains(hit) && !hit.contains(c)) out.push(`${c.id || c.className} covered by ${hit.className || hit.tagName} at ${Math.round(x)},${Math.round(y)}`);
      }
    }
    const note = document.getElementById('gridNote');
    if (note && !note.closest('[hidden]')) {
      const n = note.getBoundingClientRect();
      for (const c of controls) {
        const b = c.getBoundingClientRect();
        if (Math.min(n.right, b.right) - Math.max(n.left, b.left) > 0.5 && Math.min(n.bottom, b.bottom) - Math.max(n.top, b.top) > 0.5) out.push(`test tab over ${c.id || c.className}`);
      }
    }
    return out;
  });
  expect(covered).toEqual([]);
}

/** The game's backdrop is drawn behind every screen, the level screen included. */
async function expectOneBackground(page: Page, screen: string): Promise<void> {
  const { backdropDrawn } = await layout(page);
  expect(backdropDrawn, `${screen}: puzzle backdrop drawn`).toBe(true);
}

const STATES: { name: string; best: Record<string, number>; lab?: Record<string, unknown>; improve?: boolean }[] = [
  { name: 'path', best: someToImprove },
  { name: 'test grid, all levels unlocked', best: {}, lab: { unlockAll: true } },
  { name: 'all levels completed', best: allDone },
  { name: 'levels to improve', best: someToImprove, improve: true },
];

for (const host of ['plain', 'artifact+notch'] as const)
  for (const state of STATES)
      test(`screens (${host}, ${state.name}): the level screen fills the window alone, header clear, at every phone size`, async ({ browser }) => {
        for (const size of SIZES) {
          await test.step(`${size.width}×${size.height}`, async () => {
            // A fresh context per size: its own storage, so each state starts from its own save.
            const context = await browser.newContext({ viewport: size, hasTouch: true });
            const page = await context.newPage();
            const errors = await open(page, host, state.best, state.lab);
            if (state.improve) await page.click('#toImprove');
            await expect.poll(() => page.evaluate(() => document.getElementById('map')!.classList.contains('tf-levels-i'))).toBe(!!state.improve);
            await expectOneScreen(page, 'map');
            await expectOneBackground(page, 'map');
            await expectHeaderClear(page);
            expect(errors).toEqual([]);
            await context.close();
          });
        }
      });

for (const host of ['plain', 'artifact+notch'] as const)
    test(`screens (${host}): one screen through level screen, shop, puzzle, settings and test lab`, async ({ page }) => {
      const errors = await open(page, host, someToImprove);
      const screen = () => page.evaluate(() => window.turnflock.snapshot().screen);
      await expectOneScreen(page, 'map');
      // The shop lies over the level screen as a sheet; the level screen stays the one screen under it.
      await page.click('#mapCoins button');
      await expect.poll(() => page.evaluate(() => window.turnflock.snapshot().shopOpen)).toBe(true);
      await expectOneScreen(page, 'map');
      await page.click('#shopClose');
      await expect.poll(() => page.evaluate(() => window.turnflock.snapshot().shopOpen)).toBe(false);
      // Into the puzzle and back.
      await page.click('#continue');
      await expect.poll(screen).toBe('level');
      await expectOneScreen(page, 'level');
      await expectOneBackground(page, 'level');
      await page.click('#levelBack');
      await expect.poll(screen).toBe('map');
      await expectOneScreen(page, 'map');
      await expectOneBackground(page, 'map');
      // Settings, the test lab, and back to the level screen.
      await page.click('#toSettings');
      await expect.poll(screen).toBe('settings');
      await expectOneScreen(page, 'settings');
      await expectOneBackground(page, 'settings');
      await page.click('#settings .tf-set-entry');
      await expect.poll(screen).toBe('lab');
      await expectOneScreen(page, 'lab');
      await page.click('#lab .tf-set-top button');
      await expect.poll(screen).toBe('settings');
      await page.click('#settings .tf-set-top button');
      await expect.poll(screen).toBe('map');
      await expectOneScreen(page, 'map');
      await expectHeaderClear(page);
      expect(errors).toEqual([]);
    });
