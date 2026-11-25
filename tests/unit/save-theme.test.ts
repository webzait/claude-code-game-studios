import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB } from '../../src/game/lab';
import { ECONOMY_VERSION, loadSave, migrate, SAVE_KEY, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { LEVELS } from '../../src/levels/index';

// The garden theme was removed on 2026-11-25 (design/themes.md). Saves from the builds that had it
// (versions 8 and 9) stored a theme; they must open in the robots with progress, coins and settings intact.

const ids = LEVELS.map((l) => l.id);

/** A plain key-value store holding `initial`. */
function memory(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  };
}

/** A save as the garden builds wrote it (format version 9): the garden picked in the settings. */
function gardenSave(theme: string, version = 9): Record<string, unknown> {
  return {
    version,
    best: { [ids[0]]: 3, [ids[1]]: 5, [ids[2]]: 4 },
    coins: 187,
    paid: { [ids[0]]: 30, [ids[1]]: 20, [ids[2]]: 30 },
    economy: ECONOMY_VERSION,
    settings: { mute: true, music: false, reduceMotion: true, colourShapes: true, theme, themeChosen: true },
    lab: { ...DEFAULT_LAB, celebration: 'garden', moveSlack: 3 },
    ledger: { entries: [], totals: {} },
  };
}

describe('a save from the builds with the garden theme', () => {
  it('opens a version 9 save with the garden picked, keeping progress, coins and settings', () => {
    const save = migrate(gardenSave('garden'), ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 3, [ids[1]]: 5, [ids[2]]: 4 });
    expect(save.coins).toBe(187);
    expect(save.paid).toEqual({ [ids[0]]: 30, [ids[1]]: 20, [ids[2]]: 30 });
    expect(save.economy).toBe(ECONOMY_VERSION);
    expect(save.settings).toEqual({ mute: true, music: false, reduceMotion: true, colourShapes: true });
    expect(save.lab.moveSlack).toBe(3);
  });

  it('drops the stored theme, so nothing of it is written back', () => {
    const store = memory({ [SAVE_KEY]: JSON.stringify(gardenSave('garden')) });
    const save = loadSave(store, ids);
    expect(writeSave(store, save)).toBe(true);
    const written = JSON.parse(store.data[SAVE_KEY]);
    expect(written.version).toBe(SAVE_VERSION);
    expect(written.settings).not.toHaveProperty('theme');
    expect(written.settings).not.toHaveProperty('themeChosen');
    expect(written.coins).toBe(187);
  });

  it('gives the garden celebration chosen in the test lab back to the default one', () => {
    expect(migrate(gardenSave('garden'), ids).lab.celebration).toBe(DEFAULT_LAB.celebration);
  });

  it('treats a version 9 robot save and a version 8 garden save the same way', () => {
    for (const raw of [gardenSave('robot'), gardenSave('garden', 8)]) {
      const save = migrate(raw, ids);
      expect(save.coins).toBe(187);
      expect(Object.keys(save.best)).toHaveLength(3);
      expect(save.settings).toEqual({ mute: true, music: false, reduceMotion: true, colourShapes: true });
    }
  });
});
