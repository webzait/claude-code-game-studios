// The theme register (src/render/themes.ts), the theme setting in the save, and the
// fallback that keeps every theme playable. Contract: design/themes.md.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { DEFAULT_THEME, isThemeId, THEME_IDS } from '../../src/game/theme';
import { defaultSave, loadSave, migrate, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { LEVELS } from '../../src/levels/index';
import { exportClashes, GARDEN_MODULES, mergeExports, resolveBuilders, resolveColours, resolveLight, resolveSoundSet, resolveTheme, ROBOT_BUILDERS, ROBOT_LIGHT, slotStatus, THEME_SLOTS, themeSources, type ThemeSources } from '../../src/render/themes';

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
  it('knows robot and garden, and the garden is the main theme', () => {
    expect(THEME_IDS).toEqual(['garden', 'robot']);
    expect(isThemeId('garden')).toBe(true);
    expect(isThemeId('space')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(DEFAULT_THEME).toBe('garden');
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

  it('a theme sound set is used only when it names a set that exists', () => {
    expect(resolveSoundSet(partial)).toBeNull();
    expect(resolveSoundSet({ ...partial, data: { 'sounds.json': { set: CONFIG.audio.set } } })).toBe(CONFIG.audio.set);
    expect(resolveSoundSet({ ...partial, data: { 'sounds.json': { set: 'no-such-set' } } })).toBeNull();
  });

  it('buttons and icons are not theme slots; the level screen is (owner, 2026-11-24)', () => {
    const slots = THEME_SLOTS.map((s) => s.id);
    expect(slots).not.toContain('buttons');
    expect(slots).toEqual(['robot', 'floorTile', 'rim', 'underlay', 'obstacle', 'exit', 'turnTile', 'plate', 'gate', 'effects', 'hint', 'backdrop', 'decor', 'levelScreen', 'colours', 'light', 'sounds']);
  });

  it('every 3D slot names a value the robot theme has', () => {
    for (const slot of THEME_SLOTS.filter((s) => s.kind === '3d')) for (const name of slot.supplies) expect(ROBOT_BUILDERS[name as keyof typeof ROBOT_BUILDERS]).toBeDefined();
  });

  it('the garden theme is always complete: own light and colours, robot parts wherever it has none', () => {
    const garden = resolveTheme('garden');
    for (const name of Object.keys(ROBOT_BUILDERS)) expect(typeof garden.builders[name as keyof typeof garden.builders]).toBe(typeof ROBOT_BUILDERS[name as keyof typeof ROBOT_BUILDERS]);
    expect(garden.light.sun).toBeGreaterThan(0);
    expect(garden.light).not.toEqual(ROBOT_LIGHT);
    expect(garden.colours['--tf-theme-sky']).toMatch(/^#[0-9A-F]{6}$/i);
    const status = slotStatus(themeSources('garden'));
    expect(status.light).toBe('own');
    expect(status.colours).toBe('own');
  });
});

describe('two versions of a part', () => {
  it('register.ts decides a name two files export, whatever the file order', () => {
    const a = (): number => 1;
    const b = (): number => 2;
    const chosen = (): number => 3;
    expect(mergeExports({ './z.ts': { buildExit: a }, './register.ts': { buildExit: chosen }, './a.ts': { buildExit: b } }).buildExit).toBe(chosen);
    expect(exportClashes({ './z.ts': { buildExit: a }, './a.ts': { buildExit: b, other: a } })).toEqual(['buildExit']);
  });

  it('every register name the garden folder exports twice is settled in its register.ts', () => {
    const settled = Object.keys((GARDEN_MODULES['./parts/garden/register.ts'] ?? {}) as object);
    const registerNames = Object.keys(ROBOT_BUILDERS);
    for (const name of exportClashes(GARDEN_MODULES).filter((n) => registerNames.includes(n))) expect(settled, name).toContain(name);
  });

  it('the garden board uses the grass tile and the picture exit, not the stand-ins', async () => {
    const garden = resolveTheme('garden');
    const grass = await import('../../src/render/parts/garden/grass');
    const pictures = await import('../../src/render/parts/garden/exitPictures');
    expect(garden.builders.buildFloorTile).toBe(grass.buildFloorTile);
    expect(garden.builders.buildExit).toBe(pictures.buildExit);
    expect(garden.builders.gateDoorScale).toBe(pictures.gateDoorScale);
  });
});

describe('effects and hint during play', () => {
  it('the robot theme keeps its own: no theme effects, arrows for the hint', () => {
    expect(ROBOT_BUILDERS.playEffects(new THREE.Group(), { pitch: 1, floorY: 0.2 })).toBeNull();
    expect(ROBOT_BUILDERS.hintGlow()).toBeNull();
  });

  // Playing them loads the owner's pictures, which needs a browser: shown in production/qa/evidence/garden-theme/step8-play-*.
  it('the garden lights hint cells and supplies effects for the exit and a bump', () => {
    const garden = resolveTheme('garden');
    const glow = garden.builders.hintGlow();
    expect(glow).toBeInstanceOf(THREE.Mesh);
    const parent = new THREE.Group();
    const fx = garden.builders.playEffects(parent, { pitch: 1, floorY: 0.2 })!;
    expect(fx).not.toBeNull();
    expect(typeof fx.exit).toBe('function');
    expect(typeof fx.bump).toBe('function');
    fx.reduced = true;
    expect(fx.reduced).toBe(true);
    fx.update(0.1);
    fx.dispose();
    expect(parent.children).toHaveLength(0);
  });
});

describe('theme in the save', () => {
  it('a fresh save starts in the garden, not picked by the player', () => {
    expect(SAVE_VERSION).toBe(9);
    expect(defaultSave().settings.theme).toBe('garden');
    expect(defaultSave().settings.themeChosen).toBe(false);
  });

  it('a version 7 save keeps everything and gets the garden', () => {
    const save = migrate({ version: 7, best: { [ids[0]]: 7 }, coins: 73, paid: { [ids[0]]: 26 }, economy: 2, settings: { mute: true, music: false, reduceMotion: true, colourShapes: true }, lab: { unlockAll: true } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ [ids[0]]: 7 });
    expect(save.coins).toBe(73);
    expect(save.paid).toEqual({ [ids[0]]: 26 });
    expect(save.settings).toEqual({ mute: true, music: false, reduceMotion: true, colourShapes: true, theme: 'garden', themeChosen: false });
    expect(save.lab.unlockAll).toBe(true);
  });

  it('a version 8 save goes to the garden, robot included: whether robot was picked was not kept', () => {
    const robot = migrate({ version: 8, best: { [ids[0]]: 7 }, coins: 73, settings: { theme: 'robot', mute: true }, lab: {} }, ids);
    expect(robot.settings).toMatchObject({ theme: 'garden', themeChosen: false, mute: true });
    expect(robot.best).toEqual({ [ids[0]]: 7 });
    expect(robot.coins).toBe(73);
    expect(migrate({ version: 8, settings: { theme: 'garden' } }, ids).settings.theme).toBe('garden');
  });

  it('from version 9 a picked theme is kept, robot too; an unpicked one follows the default', () => {
    expect(migrate({ version: 9, settings: { theme: 'robot', themeChosen: true } }, ids).settings).toMatchObject({ theme: 'robot', themeChosen: true });
    expect(migrate({ version: 9, settings: { theme: 'robot', themeChosen: false } }, ids).settings).toMatchObject({ theme: 'garden', themeChosen: false });
    expect(migrate({ version: 9, settings: { theme: 'space', themeChosen: true } }, ids).settings).toMatchObject({ theme: 'garden', themeChosen: false });
    expect(migrate({ version: 9, settings: { theme: 3, themeChosen: true } }, ids).settings.theme).toBe('garden');
  });

  it('a picked robot theme survives a write and a read', () => {
    const store = memory();
    const save = defaultSave();
    save.settings.theme = 'robot';
    save.settings.themeChosen = true;
    writeSave(store, save);
    expect(loadSave(store, ids).settings).toMatchObject({ theme: 'robot', themeChosen: true });
  });
});
