/**
 * The theme register: for every part of the game's look, which build function,
 * style or data the active theme uses. The robot theme is complete; any part a
 * theme does not supply yet falls back to the robot part, so every theme is
 * always playable. The contract the theme parts follow is in design/themes.md.
 *
 * Theme parts are found by where they are, not by a list to keep up to date:
 * - 3D: any export from `src/render/parts/<theme>/*.ts` named like a robot
 *   build function (`buildFloorTile`, `buildPartsRobot`, ...) replaces that function.
 * - 2D: `src/ui/themes/<theme>/<slot>.css`, written under `[data-theme="<theme>"]`
 *   (loaded by src/ui/themes.ts).
 * - Data: `data/themes/<theme>/<slot>.json`.
 * A 3D part may be a picture instead of a model: src/render/parts/sprite.ts.
 */
import { CONFIG } from '../config';
import type { ThemeId } from '../game/theme';
import { isSoundSet } from '../sound/sets';
import { buildExit, buildFloorTile, buildGate, buildObstacle, buildPlate, buildRim, buildTurnTile, buildUnderlay, gateDoorScale } from './parts/board';
import { buildPartsRobot, buildRobot } from './robot';

/** Every build function a theme can replace. Each keeps the robot function's name, parameters and return value. */
export interface ThemeBuilders {
  /** The flock member from the parts (the default): robot, or chick in the garden. */
  readonly buildPartsRobot: typeof buildPartsRobot;
  /** The flock member drawn the simple way (test lab: Robots, Built-in). */
  readonly buildRobot: typeof buildRobot;
  readonly buildFloorTile: typeof buildFloorTile;
  readonly buildRim: typeof buildRim;
  readonly buildUnderlay: typeof buildUnderlay;
  readonly buildObstacle: typeof buildObstacle;
  readonly buildExit: typeof buildExit;
  readonly buildTurnTile: typeof buildTurnTile;
  readonly buildPlate: typeof buildPlate;
  readonly buildGate: typeof buildGate;
  /** How far the gate's barrier is scaled when open or shut; belongs with `buildGate`. */
  readonly gateDoorScale: typeof gateDoorScale;
}

/** The robot theme's parts: the game as it has always looked. */
export const ROBOT_BUILDERS: ThemeBuilders = {
  buildPartsRobot,
  buildRobot,
  buildFloorTile,
  buildRim,
  buildUnderlay,
  buildObstacle,
  buildExit,
  buildTurnTile,
  buildPlate,
  buildGate,
  gateDoorScale,
};

/** Light on the 3D board. `sky`, `ground`, `ambient`, `sun`, `reflections` and `shadow` mean what they mean in `config.light`. */
export interface ThemeLight {
  readonly sky: string;
  readonly ground: string;
  readonly ambient: number;
  readonly sun: number;
  /** Colour of the sunlight. */
  readonly sunColor: string;
  readonly reflections: number;
  readonly shadow: number;
  /** Colour of the shadow the board casts on the ground under it. */
  readonly shadowColor: string;
}

/** The robot theme's light: `config.light` with the colours that were fixed in the board view. */
export const ROBOT_LIGHT: ThemeLight = { ...CONFIG.light, sunColor: '#FFFFFF', shadowColor: '#1F3A7A' };

/** How a slot is supplied: a build function (3D), a style sheet (2D) or a data file. */
export type SlotKind = '3d' | '2d' | 'data';

/** One part of the look a theme can supply. */
export interface ThemeSlot {
  readonly id: string;
  readonly kind: SlotKind;
  /** 3D: the build functions that make up the slot. 2D and data: the file name in the theme's folder. */
  readonly supplies: readonly string[];
  /** Where the robot theme's version lives. */
  readonly robot: string;
}

/**
 * Every part of the look a theme may change, in the order of design/themes.md. Buttons, icons and
 * the screens around the board are not here: by the owner's decision (2026-11-24) they are the
 * robot theme's in every theme.
 */
export const THEME_SLOTS: readonly ThemeSlot[] = [
  { id: 'robot', kind: '3d', supplies: ['buildPartsRobot', 'buildRobot'], robot: 'src/render/robot.ts' },
  { id: 'floorTile', kind: '3d', supplies: ['buildFloorTile'], robot: 'src/render/parts/board.ts' },
  { id: 'rim', kind: '3d', supplies: ['buildRim'], robot: 'src/render/parts/board.ts' },
  { id: 'underlay', kind: '3d', supplies: ['buildUnderlay'], robot: 'src/render/parts/board.ts' },
  { id: 'obstacle', kind: '3d', supplies: ['buildObstacle'], robot: 'src/render/parts/board.ts' },
  { id: 'exit', kind: '3d', supplies: ['buildExit'], robot: 'src/render/parts/board.ts' },
  { id: 'turnTile', kind: '3d', supplies: ['buildTurnTile'], robot: 'src/render/parts/board.ts' },
  { id: 'plate', kind: '3d', supplies: ['buildPlate'], robot: 'src/render/parts/board.ts' },
  { id: 'gate', kind: '3d', supplies: ['buildGate', 'gateDoorScale'], robot: 'src/render/parts/board.ts' },
  { id: 'backdrop', kind: '2d', supplies: ['backdrop.css'], robot: 'src/ui/tf-scene.css' },
  { id: 'decor', kind: '2d', supplies: ['decor.css'], robot: 'src/ui/style.css (.tf-decor-*)' },
  { id: 'colours', kind: 'data', supplies: ['colours.json'], robot: '(none: the robot theme sets no theme colours)' },
  { id: 'light', kind: 'data', supplies: ['light.json'], robot: 'data/config.json (light)' },
  { id: 'sounds', kind: 'data', supplies: ['sounds.json'], robot: 'the sound set chosen in the test lab (data/sound-sets.json)' },
];

/** What a theme's folders hold: the exports of its 3D part files, and the names of its style and data files. */
export interface ThemeSources {
  readonly exports: Readonly<Record<string, unknown>>;
  readonly styles: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

const NONE: ThemeSources = { exports: {}, styles: [], data: {} };

const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);
/** Exports of every module, merged; a later file wins a name clash. */
function mergeExports(modules: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const mod of Object.values(modules)) if (mod && typeof mod === 'object') Object.assign(out, mod);
  return out;
}
const byFileName = (modules: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(modules).map(([path, value]) => [fileName(path), value]));

/** The garden theme's folders, read at build time. An empty folder simply means: nothing of its own yet. */
const GARDEN: ThemeSources = {
  exports: mergeExports(import.meta.glob('./parts/garden/*.ts', { eager: true })),
  styles: Object.keys(import.meta.glob('../ui/themes/garden/*.css')).map(fileName),
  data: byFileName(import.meta.glob('../../data/themes/garden/*.json', { eager: true, import: 'default' })),
};

/** What each theme supplies of its own. The robot theme is the base the others fall back to. */
export function themeSources(theme: ThemeId): ThemeSources {
  return theme === 'garden' ? GARDEN : NONE;
}

/** The build functions for a theme: its own where it has them, the robot theme's everywhere else. */
export function resolveBuilders(sources: ThemeSources): ThemeBuilders {
  const out: Record<string, unknown> = { ...ROBOT_BUILDERS };
  for (const name of Object.keys(ROBOT_BUILDERS)) {
    const own = sources.exports[name];
    if (typeof own === 'function') out[name] = own;
  }
  return out as unknown as ThemeBuilders;
}

/** The light for a theme: the robot light with the values from the theme's `light.json` laid over it (wrong types are ignored). */
export function resolveLight(sources: ThemeSources): ThemeLight {
  const own = sources.data['light.json'];
  const out: Record<string, string | number> = { ...ROBOT_LIGHT };
  if (own && typeof own === 'object') {
    for (const [key, value] of Object.entries(own)) {
      if (key in ROBOT_LIGHT && typeof value === typeof ROBOT_LIGHT[key as keyof ThemeLight]) out[key] = value as string | number;
    }
  }
  return out as unknown as ThemeLight;
}

/**
 * The theme's colours from its `colours.json`, as CSS custom properties: `{ "sky": "#..." }`
 * becomes `--tf-theme-sky`. Keys starting with `_` (notes) and non-string values are left out.
 */
export function resolveColours(sources: ThemeSources): Record<string, string> {
  const own = sources.data['colours.json'];
  if (!own || typeof own !== 'object') return {};
  return Object.fromEntries(Object.entries(own).filter(([key, value]) => !key.startsWith('_') && typeof value === 'string').map(([key, value]) => [`--tf-theme-${key}`, value as string]));
}

/**
 * The sound set a theme plays, from its `sounds.json` (`{ "set": "<id in data/sound-sets.json>" }`),
 * or null when it has none (or names a set that does not exist): then the test lab's choice plays.
 */
export function resolveSoundSet(sources: ThemeSources): string | null {
  const own = sources.data['sounds.json'];
  const set = own && typeof own === 'object' ? (own as Record<string, unknown>).set : undefined;
  return isSoundSet(set) ? set : null;
}

/** For each slot, whether the theme supplies it itself (`own`) or shows the robot part (`robot`). */
export function slotStatus(sources: ThemeSources): Record<string, 'own' | 'robot'> {
  const has = (slot: ThemeSlot): boolean => {
    if (slot.kind === '3d') return slot.supplies.some((name) => typeof sources.exports[name] === 'function');
    if (slot.kind === '2d') return slot.supplies.some((file) => sources.styles.includes(file));
    return slot.supplies.some((file) => sources.data[file] !== undefined);
  };
  return Object.fromEntries(THEME_SLOTS.map((slot) => [slot.id, has(slot) ? 'own' : 'robot']));
}

/** Everything the game needs to show one theme. */
export interface ResolvedTheme {
  readonly id: ThemeId;
  readonly builders: ThemeBuilders;
  readonly light: ThemeLight;
  readonly colours: Record<string, string>;
  /** The theme's own sound set, or null to play the one chosen in the test lab. */
  readonly soundSet: string | null;
}

/** The register's answer for one theme. */
export function resolveTheme(theme: ThemeId, sources: ThemeSources = themeSources(theme)): ResolvedTheme {
  return { id: theme, builders: resolveBuilders(sources), light: resolveLight(sources), colours: resolveColours(sources), soundSet: resolveSoundSet(sources) };
}
