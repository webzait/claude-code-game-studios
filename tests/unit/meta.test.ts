import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { extraMovesPrice, hintPrice, payout, rewardFor } from '../../src/game/coins';
import { applyLab, DEFAULT_LAB, rulesFor, usesCertifiedRules, type LabSettings } from '../../src/game/lab';
import { isUnlocked, mainAction, resumeIndex, solvedCount, starsFor, starsOfBest } from '../../src/game/progress';
import { defaultSave, LEGACY_KEY, loadSave, migrate, resetProgress, SAVE_KEY, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { solve } from '../../src/solver/bfs';

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
  it('a perfect win pays base, every spare move and the perfect bonus', () => {
    const r = rewardFor(7, 7, 9, false);
    expect(r).toEqual({ base: c.win, spareMoves: 2 * c.perSpareMove, perfect: c.perfect, total: c.win + 2 * c.perSpareMove + c.perfect });
  });
  it('a win on the last move pays the base amount only', () => {
    expect(rewardFor(9, 7, 9, false).total).toBe(c.win);
  });
  it('a win with paid help pays the base amount only', () => {
    expect(rewardFor(7, 7, 9, true).total).toBe(c.win);
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
    expect(rewardFor(7, 7, 9, false).total).toBeGreaterThanOrEqual(c.hintCost);
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
    expect(save.settings).toEqual({ mute: true, reduceMotion: true, colourShapes: false });
    expect(save.lab.moveSlack).toBe(3);
    expect(save.lab.unlockAll).toBe(true);
  });

  it('loads a save that still holds the dropped vibration setting, and leaves it out', () => {
    const save = migrate({ version: 4, best: { [ids[0]]: 7 }, coins: 73, settings: { mute: true, reduceMotion: false, vibration: false }, lab: { unlockAll: true } }, ids);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.settings).toEqual({ mute: true, reduceMotion: false, colourShapes: false });
    expect(save.lab.unlockAll).toBe(true);
  });

  it('migrates version 4 (no colour shapes): everything is kept and the shapes start switched off', () => {
    const save = migrate({ version: 4, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, settings: { mute: true, reduceMotion: true }, lab: { moveSlack: 3 } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ [ids[0]]: 26 });
    expect(save.settings).toEqual({ mute: true, reduceMotion: true, colourShapes: false });
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
