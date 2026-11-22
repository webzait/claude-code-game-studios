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
  await expect(page.locator('#end-next')).toHaveAttribute('aria-label', 'Next', { timeout: 15000 });
  await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '3 of 3 stars');
  // The pop-up says one thing: one line, the one amount really earned, one main button; no breakdown, no balance (B5).
  const perfectWin = config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect;
  await expect(page.locator('#end-title')).toHaveText(`${levels[0].par} moves · the shortest solution`);
  await expect(page.locator('#card .tf-coin-total')).toHaveCount(1);
  await expect(page.locator('#card .tf-coin-sum')).toHaveText(`+${perfectWin}`);
  await expect(page.locator('#card .tf-coin-line, #card .tf-coin-balance')).toHaveCount(0);
  await expect(page.locator('#end-retry')).toHaveAttribute('aria-label', 'Retry');
  await expect(page.locator('#end-levels')).toHaveAttribute('aria-label', 'Levels');
  // The coins fly to the counter, which ends on the saved balance (B6); Next never waits for them.
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfectWin), { timeout: 15000 });
  await expect(page.locator('.tf-coin-fly')).toHaveCount(0);
  await page.click('#end-next');
  await expect(page.locator('#levelName')).toHaveText(levels[1].name);
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfectWin));
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

const undoCost: number = config.coins.undoCost;
/** Start a fresh player with a given wallet. */
async function withCoins(page: Page, coins: number): Promise<void> {
  await page.addInitScript(
    ([save]) => {
      if (!localStorage.getItem('turnflock.save')) localStorage.setItem('turnflock.save', save);
    },
    [JSON.stringify({ version: 4, best: {}, coins, paid: {}, settings: {}, lab: {} })],
  );
}

test('the win coins: Next on the first frame ends the count at once, and a replayed level shows no made-up reward', async ({ page }) => {
  const errors = await open(page);
  // The grid test view, because the path no longer shows a level that is solved (finding B2) and this check plays one twice.
  await page.evaluate((coins) => localStorage.setItem('turnflock.save', JSON.stringify({ version: 5, best: {}, coins, paid: {}, settings: {}, lab: { unlockAll: true } })), config.coins.start);
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  const perfect = config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect;
  await page.locator('.tf-levels-tile').first().click();
  await playWitness(page, 0);
  // The balance is saved before anything is shown; the counter still holds the old amount until the pop-up's coins arrive.
  await expect.poll(async () => (await snap(page)).coins, { timeout: 15000 }).toBe(config.coins.start + perfect);
  await page.click('#end-next', { timeout: 15000 });
  expect((await snap(page)).level).toBe(1);
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfect));
  await expect(page.locator('.tf-coin-fly')).toHaveCount(0);
  // The same level again pays nothing: no coin plate, a plain line, and the counter does not move.
  await page.click('#levelBack');
  await expect(page.locator('#mapCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfect));
  await page.locator('.tf-levels-tile').first().click();
  await playWitness(page, 0);
  await expect(page.locator('#end-result')).toHaveText('Best reward already paid', { timeout: 15000 });
  await expect(page.locator('#card .tf-coin-total')).toHaveCount(0);
  expect((await snap(page)).coins).toBe(config.coins.start + perfect);
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(config.coins.start + perfect));
  // Retry on the pop-up starts the same level again at once, to improve the result; nothing is lost or paid twice.
  await page.click('#end-retry');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: 0, status: 'playing', movesLeft: budget(0), collected: 0 });
  await expect(page.locator('#card')).toBeHidden();
  await playWitness(page, 0);
  await expect(page.locator('#end-result')).toHaveText('Best reward already paid', { timeout: 15000 });
  expect(await snap(page)).toMatchObject({ coins: config.coins.start + perfect, best: { [levels[0].id]: levels[0].par } });
  // Leaving through Levels works from the pop-up too.
  await page.click('#end-levels');
  expect((await snap(page)).screen).toBe('map');
  expect(errors).toEqual([]);
});

test('a save from the first economy keeps its coins: a level paid 26 for three stars pays no leftover when won again', async ({ page }) => {
  const errors = await open(page);
  // Put in place once and loaded with a reload (see the colour shapes check for why not an init script).
  await page.evaluate(
    ([id, par]) => localStorage.setItem('turnflock.save', JSON.stringify({ version: 5, best: { [id]: par }, coins: 73, paid: { [id]: 26 }, settings: {}, lab: { unlockAll: true } })),
    [levels[0].id, levels[0].par] as const,
  );
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect((await snap(page)).coins).toBe(73);
  await page.locator('.tf-levels-tile').first().click();
  await playWitness(page, 0);
  await expect(page.locator('#end-result')).toHaveText('Best reward already paid', { timeout: 15000 });
  expect((await snap(page)).coins).toBe(73);
  expect(errors).toEqual([]);
});

test('undo and restart take moves back; Undo costs coins per step and Restart is free', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  await press(page, 'forward');
  await press(page, 'red');
  // The price is on the Undo button before it is tapped.
  await expect(page.locator('#undo')).toHaveAttribute('aria-label', `Undo, ${undoCost} coins`);
  await expect(page.locator('#undo .tf-coin-price')).toHaveText(String(undoCost));
  await page.click('#undo');
  expect(await snap(page)).toMatchObject({ commands: ['forward'], coins: config.coins.start - undoCost });
  await page.click('#undo');
  expect(await snap(page)).toMatchObject({ commands: [], coins: config.coins.start - 2 * undoCost });
  await expect(page.locator('#levelCoins .tf-coin-amount')).toHaveText(String(config.coins.start - 2 * undoCost));
  const spent = (await snap(page)).events.filter((e) => e.type === 'coins_spent');
  expect(spent).toHaveLength(2);
  expect(spent[0]).toMatchObject({ on: 'undo', amount: undoCost });
  await press(page, 'forward');
  await page.click('#restart');
  expect(await snap(page)).toMatchObject({ movesLeft: budget(0), coins: config.coins.start - 2 * undoCost });
});

test('Undo without enough coins is refused in a few words that point at Restart, which still works', async ({ page }) => {
  await withCoins(page, undoCost - 1);
  await open(page);
  await page.click('#node-1');
  await press(page, 'forward');
  await expect(page.locator('#undo')).toHaveAttribute('aria-label', `Undo, ${undoCost} coins, you do not have enough coins`);
  await expect(page.locator('#undo')).toBeEnabled();
  await page.click('#undo');
  expect(await snap(page)).toMatchObject({ commands: ['forward'], coins: undoCost - 1 });
  await expect(page.locator('#hint')).toContainText('Restart is free');
  await expect(page.locator('#restart')).toHaveClass(/nudge/);
  await page.click('#restart');
  expect(await snap(page)).toMatchObject({ commands: [], movesLeft: budget(0), coins: undoCost - 1 });
});

test('with free help switched on in the test lab, Undo is free', async ({ page }) => {
  await withCoins(page, 0);
  await open(page);
  await openLab(page);
  await page.click('[data-key=freeHelp] [role=switch]');
  await closeLab(page);
  await page.click('#node-1');
  await press(page, 'forward');
  await expect(page.locator('#undo')).toHaveAttribute('aria-label', 'Undo, free');
  await page.click('#undo');
  expect(await snap(page)).toMatchObject({ commands: [], coins: 0 });
});

test('out of moves in a hopeless position: free Retry, a priced Undo, and no extra moves offered', async ({ page }) => {
  await open(page);
  await page.click('#node-1');
  for (let i = 0; i < budget(0); i++) await press(page, 'red');
  expect((await snap(page)).status).toBe('lost');
  await expect(page.locator('#end-title')).toHaveText('Out of moves', { timeout: 15000 });
  await expect(page.locator('#end-retry')).toHaveText('Retry');
  // The pop-up's Undo costs what the Undo button costs, and says so before the tap.
  await expect(page.locator('#end-undo')).toHaveAttribute('aria-label', `Undo, ${undoCost} coins`);
  await expect(page.locator('#end-undo')).toContainText('Undo');
  await expect(page.locator('.tf-end-note')).toContainText('Retry is free');
  await expect(page.locator('#end-offer')).toHaveCount(0);
  await expect(page.locator('.tf-end-note')).toContainText('no offer');
  await expect(page.locator('.tf-end-note')).toHaveCount(1);
  await page.click('#end-hint');
  await expect(page.locator('#hint')).toContainText('No win from here', { timeout: 15000 });
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
  await expect(page.locator('#end-title')).toContainText('extra moves', { timeout: 15000 });
  await expect(page.locator('#card .tf-coin-sum')).toHaveText(`+${config.coins.win}`);
  await expect(page.locator('.tf-end-stars')).toHaveAttribute('aria-label', '1 of 3 stars');
  // A win with extra moves is a one-star win: it pays the base amount only.
  expect((await snap(page)).coins).toBe(config.coins.start - config.coins.extraMovesCost + config.coins.win);
});

test('Hint: the status is free, the next move costs coins and is drawn on the board, and without coins it is refused', async ({ page }) => {
  await solvedUpTo(page, ARROW);
  await open(page);
  await page.click(`#node-${ARROW + 1}`);
  await press(page, 'red'); // leave the witness so the solver has to search
  await page.click('#undo');
  const wallet = config.coins.start - undoCost; // that Undo was paid for
  await press(page, 'forward');
  // The price is on the Hint button before it is tapped.
  await expect(page.locator('#scan')).toHaveAttribute('aria-label', `Hint, ${config.coins.hintCost} coins`);
  await page.click('#scan');
  await expect(page.locator('#hint')).toContainText('You can still win', { timeout: 30000 });
  // The Hint button is ringed for the second tap; nothing is drawn or paid yet.
  await expect(page.locator('#scan')).toHaveClass(/nudge/);
  expect(await snap(page)).toMatchObject({ coins: wallet, hintPicture: [] });
  await page.click('#scan');
  await expect(page.locator('.cmd.nudge')).toHaveCount(1);
  // The hint is a picture on the board: one mark per robot still on it, and only a few words under it.
  const shown = await snap(page);
  expect(shown.coins).toBe(wallet - config.coins.hintCost);
  expect(shown.hintPicture).toHaveLength(shown.total - shown.collected);
  expect(shown.hint.length).toBeLessThan(30);
  // Following the hint clears the picture.
  await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  expect((await snap(page)).hintPicture).toEqual([]);
  // Spend the rest, one revealed move at a time, until the wallet cannot pay.
  const affordable = Math.floor(wallet / config.coins.hintCost);
  for (let i = 1; i < affordable; i++) {
    await page.click('#scan');
    await page.click('#scan');
    await expect(page.locator('.cmd.nudge')).toHaveCount(1);
    await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  }
  await page.click('#scan');
  await page.click('#scan');
  await expect(page.locator('#hint')).toContainText('Not enough coins');
  await expect(page.locator('.cmd.nudge')).toHaveCount(0);
  expect(await snap(page)).toMatchObject({ coins: wallet - affordable * config.coins.hintCost, hintPicture: [] });
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

test('settings: colour shapes is off at first, shows each colour\'s shape on its button at once and is kept; Vibration is gone', async ({ page }) => {
  const errors = await open(page);
  // A save from before: version 4, still holding the vibration setting the game no longer has. It is
  // put in place once and loaded with a reload: an init script would run again on the later reload,
  // where it sometimes finds the storage of a page opened from disk still empty and overwrites the save.
  await page.evaluate(() => localStorage.setItem('turnflock.save', JSON.stringify({ version: 4, best: {}, coins: 73, paid: {}, settings: { vibration: false }, lab: { unlockAll: true } })));
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  expect((await snap(page)).coins).toBe(73);
  await page.click('#toSettings');
  await expect(page.locator('#settings')).not.toContainText('Vibration');
  await expect(page.locator('#settings')).not.toContainText('Larger text');
  const shapes = page.locator('[data-key=colourShapes] [role=switch]');
  await expect(shapes).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('[data-key=colourShapes] .tf-set-shapes')).toHaveAttribute('aria-label', `Red ${config.colourShapes.red}, blue ${config.colourShapes.blue}, yellow ${config.colourShapes.yellow}`);
  await expect(page.locator('html')).not.toHaveClass(/colour-shapes/);
  await shapes.click();
  await expect(page.locator('html')).toHaveClass(/colour-shapes/);
  await page.click('#settings .tf-set-top button');
  await page.click(`#node-${TWO_COLOURS + 1}`);
  for (const colour of ['red', 'blue'] as const) {
    const badge = page.locator(`.cmd[data-cmd=${colour}] .tf-cmd-shape`);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-shape', config.colourShapes[colour]);
  }
  await expect(page.locator('.cmd[data-cmd=forward] .tf-cmd-shape')).toHaveCount(0);
  // Saved in the current format, without the dropped vibration value.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('turnflock.save')!).settings)).toEqual({ mute: false, reduceMotion: null, colourShapes: true });
  // Kept over a reload, and switched off again without one.
  await page.click('#levelBack');
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof window.turnflock?.snapshot)).toBe('function');
  await expect(page.locator('html')).toHaveClass(/colour-shapes/);
  await page.click('#toSettings');
  await expect(shapes).toHaveAttribute('aria-checked', 'true');
  await shapes.click();
  await expect(page.locator('html')).not.toHaveClass(/colour-shapes/);
  expect(errors).toEqual([]);
});

test('with the test shop switched off, the plus button explains coins and sells nothing', async ({ page }) => {
  await solvedUpTo(page, 0, { shop: false });
  await open(page);
  await page.click('#mapCoins button');
  await expect(page.locator('#coinInfo')).toBeVisible();
  await expect(page.locator('#coinInfo')).toContainText('Restart is always free');
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

// Page 3: the turn tile. A robot that arrives on it is turned a quarter clockwise by the board.
const TURNTABLE = at('turntable');

test('level 41 teaches the turn tile: only FORWARD is needed, the tile turns the robot, and the level is won', async ({ page }) => {
  await solvedUpTo(page, TURNTABLE);
  const errors = await open(page);
  await expect(page.locator('#pathWhere')).toHaveText(`Level ${TURNTABLE + 1} of ${levels.length}`);
  await expect(page.locator('#continue')).toHaveText(`Play level ${TURNTABLE + 1}`);
  await page.click(`#node-${TURNTABLE + 1}`);
  await expect(page.locator('#levelName')).toHaveText('Turntable');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: TURNTABLE, status: 'playing', movesLeft: budget(TURNTABLE), certified: true });
  // One red robot facing east, two cells before the tile.
  expect((await snap(page)).robots).toEqual([{ id: 0, x: 0, y: 0, dir: 1, collected: false }]);
  await press(page, 'forward');
  expect((await snap(page)).robots[0]).toMatchObject({ x: 1, y: 0, dir: 1 });
  // It steps onto the tile and the tile turns it to face south: no colour button was pressed.
  await press(page, 'forward');
  expect((await snap(page)).robots[0]).toMatchObject({ x: 2, y: 0, dir: 2 });
  // Undo takes the step and the tile's turn back together; doing it again turns it again.
  await page.click('#undo');
  expect((await snap(page)).robots[0]).toMatchObject({ x: 1, y: 0, dir: 1 });
  await press(page, 'forward');
  expect((await snap(page)).robots[0]).toMatchObject({ x: 2, y: 0, dir: 2 });
  for (let i = 0; i < 3; i++) await press(page, 'forward');
  expect(await snap(page)).toMatchObject({ status: 'won', collected: 1 });
  await expect(page.locator('#card .tf-end-card')).toBeVisible({ timeout: 30000 });
  await page.click('#end-next');
  expect(await snap(page)).toMatchObject({ screen: 'level', level: TURNTABLE + 1, status: 'playing' });
  expect(errors).toEqual([]);
});

test('on a turn-tile level the hint shows the tile\'s extra turn, and following the hint wins', async ({ page }) => {
  await solvedUpTo(page, TURNTABLE, { freeHelp: true });
  await open(page);
  await page.click(`#node-${TURNTABLE + 1}`);
  await press(page, 'forward');
  await page.click('#scan');
  await page.click('#scan');
  await expect(page.locator('.cmd.nudge')).toHaveCount(1);
  // The picture is the engine's own next step: onto the tile, and turned there.
  expect((await snap(page)).hintPicture).toEqual([{ id: 0, turned: false, outcome: 'moved', toX: 2, toY: 0, tileTurned: true }]);
  await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  for (let i = 0; i < budget(TURNTABLE) && (await snap(page)).status === 'playing'; i++) {
    await page.click('#scan');
    await page.click('#scan');
    await page.dispatchEvent('.cmd.nudge', 'pointerdown');
  }
  expect(await snap(page)).toMatchObject({ status: 'won' });
});

test('on a turn-tile level, out of moves one step from home: extra moves are offered and really win', async ({ page }) => {
  await solvedUpTo(page, TURNTABLE);
  await open(page);
  await page.click(`#node-${TURNTABLE + 1}`);
  // Four reds walk the robot round the corner and back to the top row, one cell on; then the
  // tile turns it and the budget ends one step above the exit.
  const line = ['red', 'red', 'red', 'red', 'forward', 'forward', 'forward'];
  expect(line.length).toBe(budget(TURNTABLE));
  for (const command of line) await press(page, command);
  expect(await snap(page)).toMatchObject({ status: 'lost' });
  expect((await snap(page)).robots[0]).toMatchObject({ x: 2, y: 2, dir: 2 });
  await expect(page.locator('#end-offer')).toHaveAttribute('aria-label', `+${config.extraMoves} moves, ${config.coins.extraMovesCost} coins`, { timeout: 15000 });
  await page.click('#end-offer');
  expect(await snap(page)).toMatchObject({ status: 'playing', movesLeft: config.extraMoves });
  await press(page, 'forward');
  expect((await snap(page)).status).toBe('won');
  // A helped win pays the base amount only, on a tile level as on any other.
  expect((await snap(page)).coins).toBe(config.coins.start - config.coins.extraMovesCost + config.coins.win);
});
