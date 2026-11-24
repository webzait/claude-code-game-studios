import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { extraMovesPrice, hintPrice, NO_HELP, payout, rewardFor, settlePaid, undoPrice, undoQuote, type CoinRules } from '../../src/game/coins';
import { applyLab, DEFAULT_LAB, levelScreenView, rulesFor, usesCertifiedRules, type LabSettings } from '../../src/game/lab';
import { isUnlocked, mainAction, resumeIndex, solvedCount, starsFor, starsOfBest } from '../../src/game/progress';
import { defaultSave, ECONOMY_VERSION, LEGACY_KEY, loadSave, migrate, resetProgress, SAVE_KEY, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { solve } from '../../src/solver/bfs';
import { improvableLevels, pathSteps, pathSway } from '../../src/ui/levelPath';

const ids = LEVELS.map((l) => l.id);
const memory = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
};

describe('unlocks and resume', () => {
  it('opens the first level, then each level after the one before is solved', () => {
    expect(isUnlocked(ids, {}, 0)).toBe(true);
    expect(isUnlocked(ids, {}, 1)).toBe(false);
    expect(isUnlocked(ids, { [ids[0]]: 7 }, 1)).toBe(true);
    expect(isUnlocked(ids, { [ids[0]]: 7 }, 2)).toBe(false);
  });

  it('the lab switch opens everything', () => {
    expect(isUnlocked(ids, {}, 9, true)).toBe(true);
  });

  it('PLAY resumes at the first unsolved level, or the last when all are solved', () => {
    expect(resumeIndex(ids, {})).toBe(0);
    expect(resumeIndex(ids, { [ids[0]]: 7, [ids[1]]: 8 })).toBe(2);
    expect(resumeIndex(ids, Object.fromEntries(ids.map((id) => [id, 1])))).toBe(ids.length - 1);
    expect(solvedCount(ids, { [ids[0]]: 7, [ids[1]]: 8 })).toBe(2);
  });
});

describe('stars', () => {
  it('three at par, two within two moves, one beyond', () => {
    expect(starsFor(7, 7, false)).toBe(3);
    expect(starsFor(9, 7, false)).toBe(2);
    expect(starsFor(10, 7, false)).toBe(1);
  });
  it('a win with extra moves earns one star', () => {
    expect(starsFor(7, 7, true)).toBe(1);
  });
});

describe('coins', () => {
  const c = CONFIG.coins;
  // Par 7 and a budget of 9: 7 moves is three stars, 8 or 9 two, and a win with extra moves one.
  it('the reward follows the stars: 10, 20 and 30 coins for one, two and three stars', () => {
    expect(rewardFor(7, 7, 9, NO_HELP)).toMatchObject({ stars: 3, total: 30 });
    expect(rewardFor(8, 7, 9, NO_HELP)).toMatchObject({ stars: 2, total: 20 });
    expect(rewardFor(9, 7, 9, NO_HELP)).toMatchObject({ stars: 2, total: 20 });
    expect(rewardFor(10, 7, 9, { hint: false, extraMoves: true })).toMatchObject({ stars: 1, total: 10 });
  });
  it('the amounts are the config: base, the two-star bonus and the three-star bonus', () => {
    expect(rewardFor(7, 7, 9, NO_HELP)).toEqual({ stars: 3, base: c.win, starBonus: c.perfect, spareMoves: 2 * c.perSpareMove, total: c.win + c.perfect + 2 * c.perSpareMove });
    expect(rewardFor(9, 7, 9, NO_HELP)).toEqual({ stars: 2, base: c.win, starBonus: c.twoStars, spareMoves: 0, total: c.win + c.twoStars });
  });
  it('a win with extra moves is a one-star win and pays the base amount, however few moves it took', () => {
    expect(rewardFor(7, 7, 9, { hint: false, extraMoves: true })).toMatchObject({ stars: 1, total: c.win });
  });
  it('a win with a paid hint pays by its stars', () => {
    expect(c.hintedWinPays).toBe('stars');
    expect(rewardFor(7, 7, 9, { hint: true, extraMoves: false }).total).toBe(rewardFor(7, 7, 9, NO_HELP).total);
  });
  it('a hint never earns more than it costs: it can lift a win by one star step at most', () => {
    expect(c.hintCost).toBeGreaterThanOrEqual(rewardFor(7, 7, 9, NO_HELP).total - rewardFor(9, 7, 9, NO_HELP).total);
  });
  it('other amounts run through the same formula: the first economy paid 26, 13 and 10', () => {
    const first: CoinRules = { ...c, win: 10, twoStars: 0, perfect: 10, perSpareMove: 3, hintedWinPays: 'base' };
    expect(rewardFor(7, 7, 9, NO_HELP, first).total).toBe(26);
    expect(rewardFor(8, 7, 9, NO_HELP, first).total).toBe(13);
    expect(rewardFor(9, 7, 9, NO_HELP, first).total).toBe(10);
    expect(rewardFor(7, 7, 9, { hint: true, extraMoves: false }, first).total).toBe(10);
    expect(hintPrice(false, { ...c, hintCost: 15 })).toBe(15);
    expect(extraMovesPrice(false, { ...c, extraMovesCost: 35 })).toBe(35);
    expect(undoPrice(false, 1, { ...c, undoCost: 10, freeUndosPerLevel: 1 })).toBe(10);
    expect(undoQuote(9, false, 0, { ...c, undoCost: 10, freeUndosPerLevel: 0 })).toEqual({ cost: 10, state: 'short' });
  });
  it('the prices stand in one scale with the rewards: Undo below a hint, a hint below the extra moves, the start buys one of each', () => {
    expect(c.undoCost).toBeLessThan(c.hintCost);
    expect(c.hintCost).toBeLessThan(c.extraMovesCost);
    expect(c.start).toBeGreaterThanOrEqual(c.undoCost + c.hintCost);
    for (const amount of [c.start, c.win, c.twoStars, c.perfect, c.hintCost, c.extraMovesCost, c.undoCost]) expect(amount % 5).toBe(0);
  });
  it('a level pays its best reward once; a replay pays only the improvement', () => {
    expect(payout(20, undefined)).toBe(20);
    expect(payout(26, 20)).toBe(6);
    expect(payout(20, 26)).toBe(0);
  });
  it('the test lab can make help free', () => {
    expect(hintPrice(false)).toBe(c.hintCost);
    expect(hintPrice(true)).toBe(0);
    expect(extraMovesPrice(false)).toBe(c.extraMovesCost);
    expect(extraMovesPrice(true)).toBe(0);
  });
  it('one perfect level pays for at least one hint, and extra moves cost more than a hint', () => {
    expect(rewardFor(7, 7, 9, NO_HELP).total).toBeGreaterThanOrEqual(c.hintCost);
    expect(c.extraMovesCost).toBeGreaterThan(c.hintCost);
  });
});

describe('save', () => {
  it('round-trips through storage', () => {
    const store = memory();
    const save = defaultSave();
    save.best[ids[0]] = 7;
    save.coins = 73;
    save.paid[ids[0]] = 26;
    save.settings.mute = true;
    save.lab.exitRule = 'single';
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store, ids)).toEqual(save);
  });

  it('migrates the first prototype format (positions) to level ids', () => {
    const store = memory({ [LEGACY_KEY]: JSON.stringify({ solved: [0, 1], level: 2 }) });
    const save = loadSave(store, ids);
    expect(save.version).toBe(SAVE_VERSION);
    // Positions are those of the first prototype's order, not of today's.
    expect(Object.keys(save.best)).toEqual(['follow-the-arrow', 'one-color-turns']);
  });

  it('prefers the current format over the old one', () => {
    const current = defaultSave();
    current.best[ids[3]] = 9;
    const store = memory({ [SAVE_KEY]: JSON.stringify(current), [LEGACY_KEY]: JSON.stringify({ solved: [0] }) });
    expect(Object.keys(loadSave(store, ids).best)).toEqual([ids[3]]);
  });

  it('migrates version 2 (no coins): progress is kept and the wallet starts at the opening balance', () => {
    const save = migrate({ version: 2, best: { [ids[0]]: 7 }, settings: { mute: true }, lab: { moveSlack: 3 } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(CONFIG.coins.start);
    expect(save.paid).toEqual({});
    expect(save.settings.mute).toBe(true);
    expect(save.lab.moveSlack).toBe(3);
  });

  it('migrates version 3: progress, coins, settings and lab are kept', () => {
    const save = migrate({ version: 3, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, settings: { mute: true, reduceMotion: true }, lab: { moveSlack: 3, unlockAll: true } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ [ids[0]]: 26 });
    expect(save.settings).toEqual({ mute: true, music: true, reduceMotion: true, colourShapes: false, theme: 'garden', themeChosen: false });
    expect(save.lab.moveSlack).toBe(3);
    expect(save.lab.unlockAll).toBe(true);
  });

  it('level screen switch: a save from before it gets the path, a stored choice is kept, a damaged one is ignored', () => {
    expect(DEFAULT_LAB.levelScreen).toBe('path');
    expect(migrate({ version: SAVE_VERSION, lab: { unlockAll: true } }, ids).lab.levelScreen).toBe('path');
    expect(migrate({ version: 3, lab: {} }, ids).lab.levelScreen).toBe('path');
    expect(migrate({ version: SAVE_VERSION, lab: { levelScreen: 'grid' } }, ids).lab.levelScreen).toBe('grid');
    expect(migrate({ version: SAVE_VERSION, lab: { levelScreen: 'map' } }, ids).lab.levelScreen).toBe('path');
  });

  it('the level selection is the path, unless a test switch asks for the grid', () => {
    expect(levelScreenView(DEFAULT_LAB)).toBe('path');
    expect(levelScreenView({ levelScreen: 'grid', unlockAll: false })).toBe('grid');
    // "Unlock all" must let a tester open any level, which the path cannot.
    expect(levelScreenView({ levelScreen: 'path', unlockAll: true })).toBe('grid');
  });

  it('loads a save that still holds the dropped vibration setting, and leaves it out', () => {
    const save = migrate({ version: 4, best: { [ids[0]]: 7 }, coins: 73, settings: { mute: true, reduceMotion: false, vibration: false }, lab: { unlockAll: true } }, ids);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.settings).toEqual({ mute: true, music: true, reduceMotion: false, colourShapes: false, theme: 'garden', themeChosen: false });
    expect(save.lab.unlockAll).toBe(true);
  });

  it('migrates version 4 (no colour shapes): everything is kept and the shapes start switched off', () => {
    const save = migrate({ version: 4, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, settings: { mute: true, reduceMotion: true }, lab: { moveSlack: 3 } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ [ids[0]]: 26 });
    expect(save.settings).toEqual({ mute: true, music: true, reduceMotion: true, colourShapes: false, theme: 'garden', themeChosen: false });
    expect(save.lab.moveSlack).toBe(3);
    expect(defaultSave().settings.colourShapes).toBe(false);
  });

  it('keeps a stored colour shapes choice and reads a damaged one as off', () => {
    expect(migrate({ version: SAVE_VERSION, settings: { colourShapes: true } }, ids).settings.colourShapes).toBe(true);
    expect(migrate({ version: SAVE_VERSION, settings: { colourShapes: 'yes' } }, ids).settings.colourShapes).toBe(false);
  });

  it('damaged, unknown or future data gives a fresh save, never an error', () => {
    expect(loadSave(memory({ [SAVE_KEY]: '{not json' }), ids)).toEqual(defaultSave());
    expect(migrate(42, ids)).toEqual(defaultSave());
    expect(migrate({ version: 99, best: { [ids[0]]: 3 } }, ids)).toEqual(defaultSave());
  });

  it('drops levels that no longer exist and values of the wrong type', () => {
    const save = migrate({ version: SAVE_VERSION, best: { gone: 3, [ids[0]]: 'x', [ids[1]]: 8 }, lab: { exitRule: 'sideways', moveSlack: 3 } }, ids);
    expect(save.best).toEqual({ [ids[1]]: 8 });
    expect(save.lab.exitRule).toBe(DEFAULT_LAB.exitRule);
    expect(save.lab.moveSlack).toBe(3);
  });

  it('storage that throws does not break loading or saving', () => {
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => undefined,
    };
    expect(loadSave(broken, ids)).toEqual(defaultSave());
    expect(writeSave(broken, defaultSave())).toBe(false);
  });

  it('reset clears progress and coins but keeps settings and lab switches', () => {
    const save = defaultSave();
    save.best[ids[0]] = 7;
    save.coins = 500;
    save.paid[ids[0]] = 26;
    save.settings.mute = true;
    save.lab.yellowEarly = true;
    const reset = resetProgress(save);
    expect(reset.best).toEqual({});
    expect(reset.coins).toBe(CONFIG.coins.start);
    expect(reset.paid).toEqual({});
    expect(reset.settings.mute).toBe(true);
    expect(reset.lab.yellowEarly).toBe(true);
  });
});

describe('a save from before the reward followed the stars (design/economy.md)', () => {
  const levels = [
    { id: 'a', par: 7 },
    { id: 'b', par: 7 },
    { id: 'c', par: 7 },
    { id: 'd', par: 7 },
    { id: 'e', par: 7 },
  ];
  const c = CONFIG.coins;
  const three = c.win + c.perfect + CONFIG.moveSlack * c.perSpareMove;
  const two = c.win + c.twoStars;

  it('an older save is marked as the first economy and keeps its coins and paid amounts; a new one is current', () => {
    const old = migrate({ version: 5, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, settings: {}, lab: {} }, ids);
    expect(old).toMatchObject({ economy: 1, coins: 73, paid: { [ids[0]]: 26 } });
    expect(defaultSave().economy).toBe(ECONOMY_VERSION);
    expect(migrate({ ...defaultSave() }, ids).economy).toBe(ECONOMY_VERSION);
    expect(resetProgress(old).economy).toBe(ECONOMY_VERSION);
  });

  it('a paid level counts as paid for the result it has, so the same result pays no leftover', () => {
    // a: three stars paid 26; b: two stars paid 13; c: three stars with a hint, paid 10; d: with extra moves, paid 10.
    const paid = settlePaid({ a: 26, b: 13, c: 10, d: 10 }, { a: 7, b: 8, c: 7, d: 11 }, levels);
    expect(paid).toEqual({ a: Math.max(26, three), b: Math.max(13, two), c: Math.max(10, three), d: c.win });
    expect(payout(rewardFor(7, 7, 9, NO_HELP).total, paid.a)).toBe(0);
    expect(payout(rewardFor(8, 7, 9, NO_HELP).total, paid.b)).toBe(0);
  });

  it('a better result pays the step between today\'s amounts', () => {
    const paid = settlePaid({ b: 13 }, { b: 8 }, levels);
    expect(payout(rewardFor(7, 7, 9, NO_HELP).total, paid.b)).toBe(three - two);
  });

  it('never lowers what a level paid, and leaves unpaid and unsolved levels alone', () => {
    const paid = settlePaid({ a: 500, e: 10 }, { a: 7, b: 7 }, levels);
    expect(paid).toEqual({ a: 500, e: 10 });
  });

  it('a win carried over from the first prototype (no move count) is a one-star win', () => {
    expect(settlePaid({ a: 10 }, { a: 0 }, levels)).toEqual({ a: c.win });
  });
});

describe('test lab', () => {
  const lab = (over: Partial<LabSettings>): LabSettings => ({ ...DEFAULT_LAB, ...over });

  it('the default lab is the certified game', () => {
    expect(usesCertifiedRules(DEFAULT_LAB)).toBe(true);
    expect(applyLab(LEVELS[1], DEFAULT_LAB)).toBe(LEVELS[1]);
  });

  it('"yellow early" recolours the tutorial level and its witness still wins', () => {
    const level = applyLab(LEVELS.find((l) => l.id === 'one-color-turns')!, lab({ yellowEarly: true }));
    expect([...new Set(level.start.robots.map((r) => r.color))].sort()).toEqual(['red', 'yellow']);
    const session = new Session(level, { budget: level.par });
    for (const c of level.witness) session.apply(c);
    expect(session.status).toBe('won');
  });

  it('"yellow early" leaves other levels alone', () => {
    expect(applyLab(LEVELS[0], lab({ yellowEarly: true }))).toBe(LEVELS[0]);
  });

  it('the single-file exit rule is flagged as not certified', () => {
    expect(usesCertifiedRules(lab({ exitRule: 'single' }))).toBe(false);
    expect(rulesFor(lab({ exitRule: 'single' }))).toEqual({ exitAcceptsMany: false });
  });

  it('under the single-file exit rule each level is either proven solvable or reported as not assessed', () => {
    const rules = rulesFor(lab({ exitRule: 'single' }));
    let proven = 0;
    for (const level of LEVELS) {
      const result = solve(level.board, level.start, level.par + 6, rules, false, CONFIG.lab.certifyMaxVisited);
      // Never "unsolvable" by silence: a null answer must come with the capped flag.
      if (result.solution) proven++;
      else expect(result.capped, level.id).toBe(true);
    }
    expect(proven).toBeGreaterThanOrEqual(8);
  });
});

describe('level selection main action', () => {
  const levels = [
    { id: 'a', par: 5 },
    { id: 'b', par: 6 },
    { id: 'c', par: 7 },
  ];

  it('points_at_the_first_unsolved_level', () => {
    expect(mainAction(levels, {})).toEqual({ index: 0, kind: 'play' });
    expect(mainAction(levels, { a: 5 })).toEqual({ index: 1, kind: 'play' });
    expect(mainAction(levels, { a: 5, c: 7 })).toEqual({ index: 1, kind: 'play' });
  });

  it('with_everything_solved_points_at_the_first_level_without_three_stars', () => {
    const over = CONFIG.stars.three + 1;
    expect(mainAction(levels, { a: 5, b: 6 + over, c: 7 + over })).toEqual({ index: 1, kind: 'improve' });
  });

  it('with_three_stars_everywhere_starts_again_at_level_one', () => {
    expect(mainAction(levels, { a: 5, b: 6, c: 7 })).toEqual({ index: 0, kind: 'again' });
  });

  it('counts_stars_of_a_stored_best_and_one_star_for_a_prototype_win', () => {
    expect(starsOfBest(undefined, 5)).toBe(0);
    expect(starsOfBest(0, 5)).toBe(1);
    expect(starsOfBest(5, 5)).toBe(3);
    expect(starsOfBest(5 + CONFIG.stars.two, 5)).toBe(2);
    expect(starsOfBest(5 + CONFIG.stars.two + 1, 5)).toBe(1);
  });
});

describe('the price of Undo (finding B4)', () => {
  const c = CONFIG.coins;
  const paid = c.freeUndosPerLevel;
  it('an Undo costs coins.undoCost, and every further step costs it again', () => {
    expect(undoPrice(false, paid)).toBe(c.undoCost);
    expect(undoPrice(false, paid + 1)).toBe(c.undoCost);
    expect(undoQuote(c.undoCost, false, paid)).toEqual({ cost: c.undoCost, state: 'ok' });
  });
  it('the first coins.freeUndosPerLevel Undos of an attempt are free, the next one is not', () => {
    for (let taken = 0; taken < c.freeUndosPerLevel; taken++) expect(undoQuote(0, false, taken)).toEqual({ cost: 0, state: 'free' });
    expect(undoPrice(false, c.freeUndosPerLevel)).toBe(c.undoCost);
  });
  it('a wallet one coin short cannot afford it, and is told the price', () => {
    expect(undoQuote(c.undoCost - 1, false, paid)).toEqual({ cost: c.undoCost, state: 'short' });
    expect(undoQuote(0, false, paid)).toEqual({ cost: c.undoCost, state: 'short' });
  });
  it('the test lab switch "free help" makes Undo free, even with an empty wallet', () => {
    expect(undoPrice(true, paid)).toBe(0);
    expect(undoQuote(0, true, paid + 3)).toEqual({ cost: 0, state: 'free' });
  });
  it('the default price is real: Undo is not free out of the box', () => {
    expect(c.undoCost).toBeGreaterThan(0);
  });
});

describe('level path', () => {
  const TOTAL = 40;
  it('shows the current level and the configured number of levels after it', () => {
    expect(pathSteps(TOTAL, 0, CONFIG.levelsAhead)).toEqual({ current: 0, ahead: Array.from({ length: CONFIG.levelsAhead }, (_, i) => i + 1) });
    expect(pathSteps(TOTAL, 11, 5)).toEqual({ current: 11, ahead: [12, 13, 14, 15, 16] });
  });
  it('never shows a completed level or one past the end', () => {
    expect(pathSteps(TOTAL, 38, 5)).toEqual({ current: 38, ahead: [39] });
    expect(pathSteps(TOTAL, 39, 5)).toEqual({ current: 39, ahead: [] });
    expect(pathSteps(TOTAL, 5, 0).ahead).toEqual([]);
  });
  it('has no steps when every level is completed', () => {
    expect(pathSteps(TOTAL, null, 5)).toEqual({ current: null, ahead: [] });
    expect(pathSteps(TOTAL, TOTAL, 5)).toEqual({ current: null, ahead: [] });
  });
  it('keeps the current level in the middle and sways the rest within the screen', () => {
    expect(pathSway(0)).toBe(0);
    for (let step = 1; step <= 12; step++) expect(Math.abs(pathSway(step))).toBeLessThanOrEqual(1);
    expect(pathSway(1)).toBeGreaterThan(0);
    expect(pathSway(4)).toBeLessThan(0);
  });
  it('lists the completed levels with fewer than three stars as the ones to improve', () => {
    // Stars per level in play order; 0 is not completed yet.
    expect(improvableLevels([3, 2, 3, 1, 0, 0])).toEqual([1, 3]);
    expect(improvableLevels([3, 3, 0])).toEqual([]);
    expect(improvableLevels([])).toEqual([]);
  });
});
