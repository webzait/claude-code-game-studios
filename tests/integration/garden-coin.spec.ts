// The garden theme's star coin (design/themes/garden-coin.md): every coin place in the game shows
// the star coin in the garden build and the robot coin in the robot build. Every coin is an
// <i class="tf-coin-ico"> whose picture comes from the style sheet, so the check reads the picture
// each one really draws (its computed background) and compares it with the file on disk.
//
// Evidence: COIN_SHOTS=<dir> also saves a screenshot of every place; COIN_SIZES=320x568,390x844 sets
// the phone sizes (default 390x844 only); COIN_BUILDS=robot,garden picks the builds; COIN_BUILD_DIR
// points the robot build at another checkout and COIN_CHECK=0 skips the comparisons there (the
// robot "before" shots of a build from before this change).
import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface LevelData {
  id: string;
  par: number;
  witness: string[];
}
const levels: LevelData[] = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const budget = (index: number): number => levels[index].par + config.moveSlack;
const ARROW = levels.findIndex((l) => l.id === 'follow-the-arrow');

const base64 = (file: string): string => readFileSync(file).toString('base64');
const PICTURES = {
  robot: { coin: base64('assets/turnflock/ui/coin.webp'), small: base64('assets/turnflock/ui/coin.webp') },
  garden: { coin: base64('assets/turnflock/garden/coin/star-coin.webp'), small: base64('assets/turnflock/garden/coin/star-coin-small.webp') },
} as const;
type Theme = keyof typeof PICTURES;
const BUILDS: Record<Theme, string> = {
  robot: resolve(process.env.COIN_BUILD_DIR ?? '.', 'dist-single/index.html'),
  garden: resolve('dist-single-garden/index.html'),
};
const SHOTS = process.env.COIN_SHOTS;
const CHECK = process.env.COIN_CHECK !== '0';
const SIZES = (process.env.COIN_SIZES ?? '390x844').split(',').map((s) => s.split('x').map(Number) as [number, number]);
const THEMES = (process.env.COIN_BUILDS ?? 'robot,garden').split(',') as Theme[];

/** Open a build with a save of our own; collects page and console errors. */
async function open(page: Page, theme: Theme, save: { coins: number; best?: Record<string, number>; lab?: Record<string, unknown>; reduceMotion?: boolean }): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ([json]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', json);
    },
    [JSON.stringify({ version: 4, best: save.best ?? {}, coins: save.coins, paid: {}, settings: { mute: true, music: false, reduceMotion: save.reduceMotion ?? false }, lab: save.lab ?? {} })],
  );
  await page.goto(pathToFileURL(BUILDS[theme]).href);
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  return errors;
}
const snap = (page: Page) => page.evaluate(() => window.turnflock.snapshot());
const press = (page: Page, command: string): Promise<void> => page.dispatchEvent(`.cmd[data-cmd=${command}]`, 'pointerdown');
const solvedBefore = (index: number): Record<string, number> => Object.fromEntries(levels.slice(0, index).map((l) => [l.id, l.par]));

/** Each coin in the page: where it is, whether it is on screen, which picture it draws. */
async function coins(page: Page): Promise<{ where: string; shown: boolean; picture: string; priceOnTool: boolean }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.tf-coin-ico')].map((c) => {
      const owner = c.closest<HTMLElement>('[id]');
      const r = c.getBoundingClientRect();
      return {
        where: `${owner?.id ?? '?'} ${c.parentElement?.className ?? ''}`.trim(),
        shown: r.width > 0 && r.height > 0,
        picture: getComputedStyle(c).backgroundImage,
        priceOnTool: c.closest('.tf-paid .tf-coin-price') !== null,
      };
    }),
  );
}

/**
 * The check: `places` (selectors of coins that must be on screen here) are shown, and every coin in the
 * page draws the theme's picture (the small cut on the Undo and Hint price tags). Then the screenshot.
 */
async function place(page: Page, theme: Theme, size: string, name: string, places: string[]): Promise<void> {
  if (CHECK) {
    for (const selector of places) await expect(page.locator(selector).first(), `${name}: ${selector}`).toBeVisible();
    const all = await coins(page);
    expect(all.filter((c) => c.shown).length, `${name}: coins on screen`).toBeGreaterThan(0);
    for (const c of all) {
      const want = c.priceOnTool ? PICTURES[theme].small : PICTURES[theme].coin;
      expect(c.picture.includes(want), `${name}: the coin in ${c.where} draws the ${theme} ${c.priceOnTool ? 'small ' : ''}coin`).toBe(true);
    }
  }
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/${theme}-${name}-${size}.png` });
  }
}

for (const theme of THEMES) {
  for (const [width, height] of SIZES) {
    const size = `${width}x${height}`;
    test.describe(`${theme} build at ${size}`, () => {
      test.use({ viewport: { width, height }, deviceScaleFactor: SHOTS ? 2 : 1 });
      test.beforeEach(() => test.skip(!existsSync(BUILDS[theme]), `build ${BUILDS[theme]} first`));

      test(`${theme}: the level screen counter and the coin explainer show the ${theme} coin`, async ({ page }) => {
        // With the test shop off, the plus button explains coins instead of opening the shop.
        const errors = await open(page, theme, { coins: config.coins.start, lab: { shop: false } });
        await place(page, theme, size, 'level-screen', ['#mapCoins .tf-coin-ico']);
        await page.click('#mapCoins .tf-coin-plus');
        await expect(page.locator('#coinInfo')).toBeVisible();
        await place(page, theme, size, 'coin-explainer', ['#coinInfo .tf-coin-ico']);
        expect(errors).toEqual([]);
      });

      test(`${theme}: the top bar in a level and the price tags on Undo and Hint show the ${theme} coin`, async ({ page }) => {
        const errors = await open(page, theme, { coins: config.coins.start, best: solvedBefore(ARROW) });
        await page.click(`#node-${ARROW + 1}`);
        await press(page, 'forward');
        await expect(page.locator('#undo .tf-coin-price')).toBeVisible();
        await page.waitForTimeout(800);
        await place(page, theme, size, 'level-top-bar-price-tags', ['#levelCoins .tf-coin-ico', '#undo .tf-coin-price .tf-coin-ico', '#scan .tf-coin-price .tf-coin-ico']);
        expect(errors).toEqual([]);
      });

      test(`${theme}: the extra-moves offer and the Undo beside it show the ${theme} coin`, async ({ page }) => {
        const errors = await open(page, theme, { coins: config.coins.start, best: solvedBefore(ARROW) });
        await page.click(`#node-${ARROW + 1}`);
        // Two steps short of the exit when the moves run out (as in boot.spec.ts), so extra moves are offered.
        const spare = budget(ARROW) - levels[ARROW].par + 2;
        const line = [...Array(3 + spare).fill('forward'), 'red', ...Array(budget(ARROW) - 4 - spare).fill('forward')];
        for (const command of line) await press(page, command);
        await expect(page.locator('#end-offer')).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(800);
        await place(page, theme, size, 'extra-moves-offer', ['#end-offer .tf-coin-ico', '#end-undo .tf-coin-ico']);
        expect(errors).toEqual([]);
      });

      test(`${theme}: short of coins, the get-coins link and the test shop show the ${theme} coin`, async ({ page }) => {
        const errors = await open(page, theme, { coins: 0, best: solvedBefore(ARROW), lab: { shop: true } });
        await page.click(`#node-${ARROW + 1}`);
        const spare = budget(ARROW) - levels[ARROW].par + 2;
        const line = [...Array(3 + spare).fill('forward'), 'red', ...Array(budget(ARROW) - 4 - spare).fill('forward')];
        for (const command of line) await press(page, command);
        await expect(page.locator('#end-getcoins')).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(800);
        await place(page, theme, size, 'short-get-coins', ['#end-offer .tf-coin-ico', '#end-getcoins .tf-coin-ico']);
        await page.click('#end-getcoins');
        await expect(page.locator('.tf-shop-pack').first()).toBeVisible();
        await page.waitForTimeout(500);
        await place(page, theme, size, 'test-shop', ['.tf-shop-pack .tf-coin-ico']);
        expect(errors).toEqual([]);
      });

      test(`${theme}: the win pop-up's reward shows the ${theme} coin`, async ({ page }) => {
        // Reduced motion: the reward stays on the pop-up (no flight), so it can be seen as the player first sees it.
        const errors = await open(page, theme, { coins: config.coins.start, reduceMotion: true });
        await page.click('#node-1');
        for (const command of levels[0].witness) await press(page, command);
        expect((await snap(page)).status).toBe('won');
        await expect(page.locator('.tf-coin-total .tf-coin-ico')).toBeVisible({ timeout: 45000 });
        await page.waitForTimeout(800);
        await place(page, theme, size, 'win-reward', ['.tf-coin-total .tf-coin-ico']);
        expect(errors).toEqual([]);
      });

      test(`${theme}: the coins flying from the win pop-up to the counter show the ${theme} coin`, async ({ page }) => {
        const errors = await open(page, theme, { coins: config.coins.start });
        await page.click('#node-1');
        for (const command of levels[0].witness) await press(page, command);
        expect((await snap(page)).status).toBe('won');
        await expect(page.locator('.tf-coin-total .tf-coin-ico')).toBeVisible({ timeout: 45000 });
        // The flight lasts well under a second and its layer is removed by a timer, too soon for a software-drawn
        // screenshot. So, the moment three coins are in the air, a still copy of the flight layer is kept beside it,
        // each coin frozen part-way along its own path; the check below reads every coin, the real ones included.
        await page.evaluate(
          () =>
            new Promise<void>((done) => {
              const keep = (): boolean => {
                const layer = document.querySelector<HTMLElement>('.tf-coin-flight');
                if (!layer || layer.querySelectorAll('.tf-coin-fly').length < 3) return false;
                const still = layer.cloneNode(true) as HTMLElement;
                still.id = 'coin-flight-still';
                for (const el of still.querySelectorAll<HTMLElement>('.tf-coin-fly, .tf-coin-fly .tf-coin-ico')) {
                  el.style.animationDelay = 'calc(var(--ms) * -0.45 + var(--dl) * 0)';
                  el.style.animationPlayState = 'paused';
                }
                layer.after(still);
                return true;
              };
              if (keep()) return done();
              const watch = new MutationObserver(() => {
                if (keep()) {
                  watch.disconnect();
                  done();
                }
              });
              watch.observe(document.body, { childList: true, subtree: true });
            }),
        );
        await place(page, theme, size, 'coins-flying', ['.tf-coin-fly .tf-coin-ico']);
        expect(errors).toEqual([]);
      });
    });
  }
}

test('robot build: switching to Garden in the settings turns the counter into the star coin at once, and back', async ({ page }) => {
  test.skip(!CHECK || !THEMES.includes('robot') || !existsSync(BUILDS.robot), 'robot build with checks only');
  const errors = await open(page, 'robot', { coins: config.coins.start });
  const counter = (): Promise<string> => page.evaluate(() => getComputedStyle(document.querySelector('#mapCoins .tf-coin-ico')!).backgroundImage);
  expect(await counter()).toContain(PICTURES.robot.coin);
  await page.click('#toSettings');
  const row = page.locator('#settings [data-key="theme"]');
  await row.getByRole('radio', { name: 'Garden' }).click();
  expect(await counter()).toContain(PICTURES.garden.coin);
  await row.getByRole('radio', { name: 'Robots' }).click();
  expect(await counter()).toContain(PICTURES.robot.coin);
  expect(errors).toEqual([]);
});
