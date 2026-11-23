// Playwright: where the end-of-level pop-up rests (finding B10, production/findings.md).
// The pop-up must stay clear of the command buttons and the helper buttons on every phone size, in every form, and a
// tap meant as a move must not press anything on it. Measured from the rectangles on the page, not judged by eye.
// POPUP_SHOTS=1 also writes a screenshot and the measurements per size to production/qa/evidence/popup-position/.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const EVIDENCE = 'production/qa/evidence/popup-position';
const SHOTS = !!process.env.POPUP_SHOTS;

/** Phone sizes the pop-up is measured at, smallest first. */
const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;
const ARROW = levels.findIndex((l) => l.id === 'follow-the-arrow');
const LAST = levels.length - 1;
const budget = (index: number): number => levels[index].par + config.moveSlack;
/** The wall and edge the card's shadow draws under its box (tf-end.css): they count as the card. */
const CARD_WALL = 9;

type Form = 'win' | 'win-last' | 'win-calm' | 'lost-offer' | 'lost-no-offer';
const FORMS: Form[] = ['win', 'win-last', 'win-calm', 'lost-offer', 'lost-no-offer'];

interface Box {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface Measured {
  card: Box;
  /** The card with everything that rides above its top edge (the stars). */
  cardTop: number;
  popupButtons: Box[];
  commands: Box[];
  tools: Box[];
  height: number;
}

const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
const press = (page: Page, command: string) => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Opens the build on level `index` (every level before it solved) and collects page errors. */
async function openLevel(page: Page, index: number): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const best = Object.fromEntries(levels.slice(0, index).map((l) => [l.id, l.par]));
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    [JSON.stringify({ version: 5, best, coins: config.coins.start, paid: {}, settings: {}, lab: {} })],
  );
  await page.goto(build);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  await page.click(`#node-${index + 1}`);
  return errors;
}

/** Plays into the pop-up of `form` and waits until it is on screen. */
async function reach(page: Page, form: Form): Promise<string[]> {
  let errors: string[];
  if (form === 'win-calm') await page.emulateMedia({ reducedMotion: 'reduce' });
  if (form === 'lost-offer') {
    // Two steps short of the exit when the moves run out: the checked "+N moves" offer is on the pop-up.
    errors = await openLevel(page, ARROW);
    const spare = budget(ARROW) - levels[ARROW].par + 2;
    for (const command of [...Array(3 + spare).fill('forward'), 'red', ...Array(budget(ARROW) - 4 - spare).fill('forward')]) await press(page, command);
    await expect(page.locator('#end-offer')).toBeVisible({ timeout: 30_000 });
  } else if (form === 'lost-no-offer') {
    errors = await openLevel(page, 0);
    for (let i = 0; i < budget(0); i++) await press(page, 'red');
    await expect(page.locator('#end-hint')).toBeVisible({ timeout: 30_000 });
  } else {
    const index = form === 'win-last' ? LAST : 0;
    errors = await openLevel(page, index);
    for (const command of levels[index].witness) await press(page, command);
    expect((await snap(page)).status).toBe('won');
    await expect(page.locator('#card .tf-end-card')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('#end-next')).toHaveCount(form === 'win-last' ? 0 : 1);
  }
  return errors;
}

/** The rectangles that matter, once the pop-up has stopped moving. */
async function measure(page: Page): Promise<Measured> {
  // The entrance moves the card (it rises into place); measure where it rests.
  await page.evaluate(() => Promise.all(document.querySelector('#card')!.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))));
  return page.evaluate(() => {
    const box = (node: Element, name: string) => {
      const r = node.getBoundingClientRect();
      return { name, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const all = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].filter((n) => n.getClientRects().length > 0).map((n) => box(n, n.id || n.dataset.cmd || selector));
    const card = box(document.querySelector('#card .tf-end-card')!, 'card');
    const stars = document.querySelector('#card .tf-end-stars');
    return {
      card,
      cardTop: Math.min(card.top, stars ? stars.getBoundingClientRect().top : card.top),
      popupButtons: all('#card button'),
      commands: all('#commands .cmd'),
      tools: all('#tools > button'),
      height: window.innerHeight,
    };
  });
}

const round = (n: number): number => Math.round(n * 10) / 10;
const rows: string[] = [];

for (const size of SIZES) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    for (const form of FORMS) {
      test(`pop-up "${form}" rests above the helper buttons and covers no button of the puzzle screen`, async ({ page }) => {
        test.setTimeout(240_000);
        const errors = await reach(page, form);
        const m = await measure(page);
        expect(m.commands.length).toBeGreaterThanOrEqual(2);
        expect(m.tools.map((t) => t.name)).toEqual(['undo', 'restart', 'scan']);
        expect(m.popupButtons.length).toBeGreaterThanOrEqual(2);

        const under = [...m.tools, ...m.commands];
        const controlsTop = Math.min(...under.map((b) => b.top));
        // The whole card, its bottom wall included, ends above the highest button under the board.
        expect(m.card.bottom + CARD_WALL).toBeLessThanOrEqual(controlsTop);
        for (const b of under) {
          expect(overlaps({ ...m.card, bottom: m.card.bottom + CARD_WALL }, b), `card over ${b.name}`).toBe(false);
          for (const p of m.popupButtons) expect(overlaps(p, b), `${p.name} over ${b.name}`).toBe(false);
        }
        // And it is whole: nothing of it, the stars included, leaves the top of the screen.
        expect(m.cardTop).toBeGreaterThanOrEqual(0);
        for (const p of m.popupButtons) {
          expect(p.top).toBeGreaterThanOrEqual(m.card.top);
          expect(p.bottom).toBeLessThanOrEqual(m.card.bottom + CARD_WALL);
        }

        // A tap where a move or a helper button is does nothing while the pop-up is up.
        const before = await snap(page);
        for (const b of under) await page.touchscreen.tap((b.left + b.right) / 2, (b.top + b.bottom) / 2);
        const after = await snap(page);
        expect(after).toMatchObject({ status: before.status, commands: before.commands, coins: before.coins, screen: 'level', hint: before.hint });
        await expect(page.locator('#card .tf-end-card')).toBeVisible();
        expect(errors).toEqual([]);

        if (SHOTS) {
          mkdirSync(EVIDENCE, { recursive: true });
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${EVIDENCE}/after-${form}-${size.width}x${size.height}.png` });
          rows.push(
            `| ${size.width}×${size.height} | ${form} | ${round(m.cardTop)} | ${round(m.card.bottom + CARD_WALL)} | ${round(controlsTop)} | ${round(controlsTop - m.card.bottom - CARD_WALL)} | ${round(Math.max(...m.popupButtons.map((p) => p.bottom)))} | ${round(Math.min(...m.commands.map((c) => c.top)))} |`,
          );
        }
      });
    }
  });
}

test.afterAll(() => {
  if (!SHOTS || rows.length === 0) return;
  const head = [
    '# Pop-up position: measured rectangles (finding B10)',
    '',
    'Written by `POPUP_SHOTS=1 npx playwright test popup-position --workers=1`. All values in CSS px from the top of the screen.',
    '"Card bottom" includes the 9 px wall under the card. "Free space" is what lies between that wall and the top of the helper buttons.',
    '',
    '| Screen | Form | Card top (with stars) | Card bottom | Top of helper buttons | Free space | Lowest pop-up button ends at | Command buttons start at |',
    '|---|---|---|---|---|---|---|---|',
  ];
  writeFileSync(`${EVIDENCE}/measurements.md`, [...head, ...rows, ''].join('\n'));
});

test('a tap meant as a move cannot press the pop-up: its buttons wait a moment, then work', async ({ page }) => {
  const errors = await openLevel(page, 0);
  for (const command of levels[0].witness) await press(page, command);
  await expect.poll(async () => (await snap(page)).celebration?.active, { timeout: 15_000 }).toBe(true);
  // The tap that skips the celebration brings the pop-up at once. In that same moment Next is pressed, by a tap on its
  // place and by key or script: neither starts the next level.
  const early = await page.evaluate(() => {
    document.querySelector('#board')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const next = document.querySelector<HTMLButtonElement>('#end-next')!;
    const r = next.getBoundingClientRect();
    const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    next.click();
    return { shown: !document.querySelector<HTMLElement>('#card')!.hidden, arming: document.querySelector('#card')!.classList.contains('tf-end-arming'), tapLandsOnPopup: !!hit?.closest('.tf-end-card') };
  });
  expect(early).toEqual({ shown: true, arming: true, tapLandsOnPopup: false });
  expect(await snap(page)).toMatchObject({ level: 0, status: 'won' });
  // The wait is short and ends by itself.
  expect(config.endCard.armSeconds).toBeGreaterThan(0);
  expect(config.endCard.armSeconds).toBeLessThanOrEqual(0.5);
  await expect(page.locator('#card')).not.toHaveClass(/tf-end-arming/, { timeout: config.endCard.armSeconds * 1000 + 2000 });
  await page.click('#end-next');
  expect(await snap(page)).toMatchObject({ level: 1, status: 'playing' });
  expect(errors).toEqual([]);
});
