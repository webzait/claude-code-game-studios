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
/** Position of a level in play order; the checks below name levels by id, so reordering never breaks them. */
const at = (id: string): number => {
  const index = levels.findIndex((l) => l.id === id);
  if (index < 0) throw new Error(`no level "${id}"`);
  return index;
};
const ARROW = at('follow-the-arrow');
const TWO_COLOURS = at('one-color-turns');
const QUEUE = at('queue-up');
const tilesOnPage = Math.min(levels.length, config.levelsPerPage);
/** The path shows the current level and this many locked ones after it. */
const ahead = Math.min(levels.length - 1, config.levelsAhead);

/** Start with every level before `index` already solved at par, so that level is open like for a real player. */
async function solvedUpTo(page: Page, index: number, lab: Record<string, unknown> = {}): Promise<void> {
  const best = Object.fromEntries(levels.slice(0, index).map((l) => [l.id, l.par]));
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    [JSON.stringify({ version: 4, best, coins: config.coins.start, paid: {}, settings: {}, lab })],
  );
}

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
  // The path: the current level and the next few, no grid of every level.
  await expect(page.locator('#steps .tf-levels-step')).toHaveCount(1 + ahead);
  await expect(page.locator('.tf-levels-tile')).toHaveCount(0);
  await expect(page.locator('#pathWhere')).toHaveText(`Level 1 of ${levels.length}`);
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
  await expect(page.getByRole('button', { name: `Play level 1, ${levels[0].name}` })).toHaveAttribute('aria-current', 'step');
  // A locked step is not a control: it is text that says it is locked.
  await expect(page.locator('#node-2')).toHaveClass(/is-locked/);
  await expect(page.locator('#node-2')).toContainText('Level 2, locked');
  await expect(page.locator('#steps button')).toHaveCount(1);
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
  // The completed level is gone from the path; the next one is the current step.
  await expect(page.locator('#node-1')).toHaveCount(0);
  await expect(page.locator('#node-2')).toHaveClass(/is-current/);
  await expect(page.locator('#node-2')).toBeEnabled();
  await expect(page.locator('#node-3')).toHaveClass(/is-locked/);
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  const perfect = config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect;
  expect(await snap(page)).toMatchObject({ best: { [levels[0].id]: levels[0].par }, coins: config.coins.start + perfect });
  await expect(page.locator('#mapCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfect));
  await expect(page.locator('#pathWhere')).toHaveText(`Level 2 of ${levels.length}`);
  // Three stars: nothing to improve, so the star total only tells the total.
  await expect(page.locator('#toImprove')).toHaveAttribute('aria-label', `3 of ${levels.length * 3} stars`);
  await expect(page.locator('#toImprove')).toBeDisabled();
  await expect(page.locator('#continue')).toHaveText('Play level 2');
  expect(errors).toEqual([]);
});

test('every level can be played to a win in order, ending back at the level selection', async ({ page }) => {
  test.setTimeout(levels.length * 30_000); // every level with its real animation
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
  // Nothing is left to play: the screen shows the completed state with every star, and no path.
  await expect(page.locator('#doneView')).toBeVisible();
  await expect(page.locator('#doneView')).toContainText('All levels completed');
  await expect(page.locator('#doneText')).toHaveText(`${levels.length * 3} of ${levels.length * 3} stars`);
  await expect(page.locator('#steps .tf-levels-step')).toHaveCount(0);
  // From here the player chooses any level to play again: every level, one page at a time, each with three stars.
  await expect(page.locator('#continue')).toHaveText('Choose a level');
  await page.click('#continue');
  await expect(page.locator('#gridNote')).toHaveText('Play a level again');
  await expect(page.locator('.tf-levels-tile.s3')).toHaveCount(tilesOnPage);
  await expect(page.locator('#continue')).toHaveText('Back');
  await page.click(`#node-${TWO_COLOURS + 1}`);
  expect(await snap(page)).toMatchObject({ screen: 'level', level: TWO_COLOURS });
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
  await solvedUpTo(page, ARROW);
  await open(page);
  await page.click(`#node-${ARROW + 1}`);
  // Follow the Arrow's witness is three forwards, red, three forwards. Spend the spare
  // moves standing at the wall, so the budget ends two steps short of the exit.
  const spare = budget(ARROW) - levels[ARROW].par + 2;
  const line = [...Array(3 + spare).fill('forward'), 'red', ...Array(budget(ARROW) - 4 - spare).fill('forward')];
  expect(line.length).toBe(budget(ARROW));
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
  await solvedUpTo(page, ARROW);
  await open(page);
  await page.click(`#node-${ARROW + 1}`);
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
  await page.click(`#node-${TWO_COLOURS + 1}`);
  expect((await snap(page)).movesLeft).toBe(levels[TWO_COLOURS].par + 3);
  await expect(page.locator('.cmd[data-cmd=yellow]')).toBeVisible();
  await expect(page.locator('.cmd[data-cmd=blue]')).toBeHidden();
  await playWitness(page, TWO_COLOURS).catch(() => undefined);
  await page.click('#levelBack');
  await openLab(page);
  await page.click('[data-key=exitRule] [data-value=single]');
  await closeLab(page);
  await page.click(`#node-${QUEUE + 1}`);
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

test('level selection: mid-way it shows the current level and the next few, near the end the path ends in a finish', async ({ page }) => {
  await solvedUpTo(page, 11);
  await open(page);
  await expect(page.locator('#pathWhere')).toHaveText(`Level 12 of ${levels.length}`);
  await expect(page.locator('#steps .tf-levels-step.is-current')).toHaveText(/12/);
  await expect(page.locator('#steps .tf-levels-step.is-locked')).toHaveCount(ahead);
  await expect(page.locator('#node-11')).toHaveCount(0);
  await expect(page.locator(`#node-${12 + ahead}`)).toHaveClass(/is-locked/);
  await expect(page.locator(`#node-${13 + ahead}`)).toHaveCount(0);
  // The current level is a real target: at least 44 by 44 CSS pixels, and Enter on it opens the level.
  const box = await page.locator('#node-12').boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  await page.locator('#node-12').focus();
  await page.keyboard.press('Enter');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: 11 });
});

test('level selection: on the last level only the finish is ahead', async ({ page }) => {
  await solvedUpTo(page, levels.length - 1);
  await open(page);
  await expect(page.locator('#steps .tf-levels-step.is-current')).toHaveText(new RegExp(String(levels.length)));
  await expect(page.locator('#steps .tf-levels-step.is-locked')).toHaveCount(0);
  await expect(page.locator('#steps .tf-levels-step.is-finish')).toContainText('End of the levels');
  await expect(page.locator('#continue')).toHaveText(`Play level ${levels.length}`);
});

test('test lab: "unlock all" and "Level screen: Grid" show the old grid as a test view; Path brings the path back', async ({ page }) => {
  await solvedUpTo(page, 3);
  await open(page);
  await openLab(page);
  await page.click('[data-key=unlockAll] [role=switch]');
  await closeLab(page);
  await expect(page.locator('.tf-levels-tile')).toHaveCount(tilesOnPage);
  await expect(page.locator('#gridNote')).toContainText('Test view');
  await expect(page.locator('#pathView')).toBeHidden();
  await expect(page.locator(`#node-${tilesOnPage}`)).toBeEnabled();
  await expect(page.locator('#mapProgress')).toHaveAttribute('aria-label', `3 of ${levels.length} levels, 9 of ${levels.length * 3} stars`);
  // A completed level can be opened here.
  await page.click('#node-1');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: 0 });
  await page.click('#levelBack');
  await openLab(page);
  await page.click('[data-key=unlockAll] [role=switch]');
  await page.click('[data-key=levelScreen] [data-value=grid]');
  await closeLab(page);
  // The grid without "unlock all": levels stay locked in order.
  await expect(page.locator('#node-5')).toBeDisabled();
  await expect(page.locator('#gridNote')).toContainText('Test view');
  await openLab(page);
  await page.click('[data-key=levelScreen] [data-value=path]');
  await closeLab(page);
  await expect(page.locator('.tf-levels-tile')).toHaveCount(0);
  await expect(page.locator('#steps .tf-levels-step.is-current')).toHaveText(/4/);
});

test('improving stars: the star total opens the completed levels under three stars, and a level that reaches three leaves the list', async ({ page }) => {
  // Levels 1 to 4 completed: level 2 with one star, level 4 with two, the others with three.
  const best = Object.fromEntries(levels.slice(0, 4).map((l, i) => [l.id, l.par + (i === 1 ? config.stars.two + 1 : i === 3 ? config.stars.two : 0)]));
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    [JSON.stringify({ version: 4, best, coins: config.coins.start, paid: {}, settings: {}, lab: {} })],
  );
  const errors = await open(page);
  // The path itself still shows no completed level.
  await expect(page.locator('#node-2')).toHaveCount(0);
  await expect(page.locator('#toImprove')).toHaveAttribute('aria-label', `9 of ${levels.length * 3} stars. Improve 2 levels`);
  const box = await page.locator('#toImprove').boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  await page.click('#toImprove');
  await expect(page.locator('#gridNote')).toHaveText('Improve your stars');
  await expect(page.locator('.tf-levels-tile')).toHaveCount(2);
  await expect(page.locator('#node-2')).toHaveClass(/\bs1\b/);
  await expect(page.locator('#node-4')).toHaveClass(/\bs2\b/);
  await expect(page.locator('#node-1')).toHaveCount(0);
  // The main action leads back to the path, and the star total opens the list again.
  await expect(page.locator('#continue')).toHaveText('Back to level 5');
  await page.click('#continue');
  await expect(page.locator('#steps .tf-levels-step.is-current')).toHaveText(/5/);
  await page.click('#toImprove');
  await page.click('#node-2');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: 1 });
  await playWitness(page, 1);
  await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '3 of 3 stars', { timeout: 15000 });
  await page.click('#end-levels');
  // Back in the list: level 2 has three stars now and is gone; level 4 is still there.
  await expect(page.locator('.tf-levels-tile')).toHaveCount(1);
  await expect(page.locator('#node-4')).toBeVisible();
  await expect(page.locator('#toImprove')).toHaveAttribute('aria-label', `11 of ${levels.length * 3} stars. Improve 1 level`);
  expect(errors).toEqual([]);
});
