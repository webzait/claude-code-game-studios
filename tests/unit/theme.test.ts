// The theme register (src/render/themes.ts), the theme setting in the save, and the
// fallback that keeps every theme playable. Contract: design/themes.md.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { DEFAULT_THEME, isThemeId, THEME_IDS } from '../../src/game/theme';
import { defaultSave, loadSave, migrate, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { LEVELS } from '../../src/levels/index';
import { resolveBuilders, resolveColours, resolveLight, resolveTheme, ROBOT_BUILDERS, ROBOT_LIGHT, slotStatus, THEME_SLOTS, themeSources, type ThemeSources } from '../../src/render/themes';

const ids = LEVELS.map((l) => l.id);
const memory = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
/** A made-up theme that supplies only a floor tile, a style sheet and part of its light. */
const fakeTile = (): never => {
  throw new Error('fake tile');
};
const partial: ThemeSources = {
  exports: { buildFloorTile: fakeTile, somethingElse: () => 1, buildObstacle: 'not a function' },
  styles: ['backdrop.css', 'base.css'],
  data: { 'light.json': { sun: 2.5, sky: '#ABCDEF', ambient: 'bright', unknown: 4 }, 'colours.json': { _note: 'x', sky: '#112233', size: 4 } },
};

describe('theme ids', () => {
  it('knows robot and garden, and the tests run the robot build', () => {
    expect(THEME_IDS).toEqual(['robot', 'garden']);
    expect(isThemeId('garden')).toBe(true);
    expect(isThemeId('space')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(DEFAULT_THEME).toBe('robot');
  });
});

describe('theme register', () => {
  it('the robot theme is the robot parts and the configured light, unchanged', () => {
    const robot = resolveTheme('robot');
    expect(robot.builders).toEqual(ROBOT_BUILDERS);
    expect(robot.light).toEqual({ ...CONFIG.light, sunColor: '#FFFFFF', shadowColor: '#1F3A7A' });
    expect(robot.colours).toEqual({});
    expect(Object.values(slotStatus(themeSources('robot'))).every((s) => s === 'robot')).toBe(true);
  });

  it('a theme part replaces only its own function; every other slot falls back to the robot part', () => {
    const builders = resolveBuilders(partial);
    expect(builders.buildFloorTile).toBe(fakeTile);
    for (const [name, fn] of Object.entries(ROBOT_BUILDERS)) if (name !== 'buildFloorTile') expect(builders[name as keyof typeof builders]).toBe(fn);
    expect('somethingElse' in builders).toBe(false);
  });

  it('a theme light overrides the keys it gives with the right type; the rest stays the robot light', () => {
    expect(resolveLight(partial)).toEqual({ ...ROBOT_LIGHT, sun: 2.5, sky: '#ABCDEF' });
  });

  it('theme colours become --tf-theme-* properties; notes and non-strings are left out', () => {
    expect(resolveColours(partial)).toEqual({ '--tf-theme-sky': '#112233' });
  });

  it('reports per slot whether the theme supplies it or shows the robot part', () => {
    const status = slotStatus(partial);
    expect(status.floorTile).toBe('own');
    expect(status.obstacle).toBe('robot');
    expect(status.backdrop).toBe('own');
    expect(status.light).toBe('own');
    expect(status.colours).toBe('own');
    expect(status.robot).toBe('robot');
    expect(Object.keys(status)).toEqual(THEME_SLOTS.map((s) => s.id));
  });

  it('every 3D slot names a function the robot theme has', () => {
    for (const slot of THEME_SLOTS.filter((s) => s.kind === '3d')) for (const name of slot.supplies) expect(typeof ROBOT_BUILDERS[name as keyof typeof ROBOT_BUILDERS]).toBe('function');
  });

  it('the garden theme is always complete: own light and colours, robot parts wherever it has none', () => {
    const garden = resolveTheme('garden');
    for (const name of Object.keys(ROBOT_BUILDERS)) expect(typeof garden.builders[name as keyof typeof garden.builders]).toBe('function');
    expect(garden.light.sun).toBeGreaterThan(0);
    expect(garden.light).not.toEqual(ROBOT_LIGHT);
    expect(garden.colours['--tf-theme-sky']).toMatch(/^#[0-9A-F]{6}$/i);
    const status = slotStatus(themeSources('garden'));
    expect(status.light).toBe('own');
    expect(status.colours).toBe('own');
  });
});

describe('theme in the save', () => {
  it('a fresh save starts in the build default', () => {
    expect(SAVE_VERSION).toBe(8);
    expect(defaultSave().settings.theme).toBe(DEFAULT_THEME);
  });

  it('a version 7 save keeps everything and gets the default theme', () => {
    const save = migrate({ version: 7, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, economy: 2, settings: { mute: true, music: false, reduceMotion: true, colourShapes: true }, lab: { unlockAll: true } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ [ids[0]]: 26 });
    expect(save.settings).toEqual({ mute: true, music: false, reduceMotion: true, colourShapes: true, theme: 'robot' });
    expect(save.lab.unlockAll).toBe(true);
  });

  it('a chosen theme is kept; an unknown or damaged one gives the default', () => {
    expect(migrate({ version: 8, settings: { theme: 'garden' } }, ids).settings.theme).toBe('garden');
    expect(migrate({ version: 8, settings: { theme: 'space' } }, ids).settings.theme).toBe('robot');
    expect(migrate({ version: 8, settings: { theme: 3 } }, ids).settings.theme).toBe('robot');
  });

  it('survives a write and a read', () => {
    const store = memory();
    const save = defaultSave();
    save.settings.theme = 'garden';
    writeSave(store, save);
    expect(loadSave(store, ids).settings.theme).toBe('garden');
  });
});
