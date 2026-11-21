import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { applyLab, DEFAULT_LAB, rulesFor, usesCertifiedRules, type LabSettings } from '../../src/game/lab';
import { isUnlocked, reachedMilestones, resumeIndex, solvedIn, starsFor } from '../../src/game/progress';
import { defaultSave, LEGACY_KEY, loadSave, migrate, resetProgress, SAVE_KEY, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { Session } from '../../src/game/session';
import { DISTRICTS, LEVELS } from '../../src/levels/index';
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
  });
});

describe('stars', () => {
  it('three at par, two within two moves, one beyond', () => {
    expect(starsFor(7, 7, false)).toBe(3);
    expect(starsFor(9, 7, false)).toBe(2);
    expect(starsFor(10, 7, false)).toBe(1);
  });
  it('a win with Backup Signals earns one star', () => {
    expect(starsFor(7, 7, true)).toBe(1);
  });
});

describe('landmark milestones', () => {
  const bay = DISTRICTS[0];
  const solved = (n: number): Record<string, number> => Object.fromEntries(bay.levels.slice(0, n).map((id) => [id, 1]));
  it('are reached only by really solved levels', () => {
    expect(reachedMilestones(bay, solved(4)).length).toBe(0);
    expect(reachedMilestones(bay, solved(5)).map((m) => m.id)).toEqual(['beacon-bay-lamp']);
    expect(reachedMilestones(bay, solved(10)).length).toBe(2);
    expect(solvedIn(bay, solved(3))).toBe(3);
  });
});

describe('save', () => {
  it('round-trips through storage', () => {
    const store = memory();
    const save = defaultSave();
    save.best[ids[0]] = 7;
    save.settings.mute = true;
    save.lab.exitRule = 'single';
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store, ids)).toEqual(save);
  });

  it('migrates the first prototype format (positions) to level ids', () => {
    const store = memory({ [LEGACY_KEY]: JSON.stringify({ solved: [0, 1], level: 2 }) });
    const save = loadSave(store, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(Object.keys(save.best)).toEqual([ids[0], ids[1]]);
  });

  it('prefers the current format over the old one', () => {
    const current = defaultSave();
    current.best[ids[3]] = 9;
    const store = memory({ [SAVE_KEY]: JSON.stringify(current), [LEGACY_KEY]: JSON.stringify({ solved: [0] }) });
    expect(Object.keys(loadSave(store, ids).best)).toEqual([ids[3]]);
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

  it('reset clears progress and milestones but keeps settings and lab switches', () => {
    const save = defaultSave();
    save.best[ids[0]] = 7;
    save.milestonesSeen.push('beacon-bay-lamp');
    save.settings.mute = true;
    save.lab.yellowEarly = true;
    const reset = resetProgress(save);
    expect(reset.best).toEqual({});
    expect(reset.milestonesSeen).toEqual([]);
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
