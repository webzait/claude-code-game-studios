import garden from '../../../../data/themes/garden/levels.json';

/** The garden level screen's tuning values (data/themes/garden/levels.json, see design/themes/garden-levels.md). */
export type GardenLevels = typeof garden;

/** The values as shipped. */
export const GARDEN_LEVELS: GardenLevels = garden;

/**
 * The custom properties the garden styles (tf-levels-garden.css) read, from the config.
 * The stylesheet carries the same values as fallbacks, so it also looks right without this.
 */
export function gardenLevelsVars(config: GardenLevels): Record<string, string> {
  const { sky, lawn, rail, done, current, locked } = config;
  return {
    '--tg-ink': config.ink,
    '--tg-sky-0': sky[0], '--tg-sky-1': sky[1], '--tg-sky-2': sky[2],
    '--tg-lawn-0': lawn[0], '--tg-lawn-1': lawn[1], '--tg-lawn-2': lawn[2],
    '--tg-hedge': config.hedge,
    '--tg-rail-edge': rail.edge, '--tg-rail-fill': rail.fill,
    '--tg-done-top': done.top, '--tg-done-face': done.face, '--tg-done-deep': done.deep,
    '--tg-cur-top': current.top, '--tg-cur-face': current.face, '--tg-cur-deep': current.deep, '--tg-cur-ink': current.ink, '--tg-cur-glow': current.glow,
    '--tg-lock-top': locked.top, '--tg-lock-face': locked.face, '--tg-lock-deep': locked.deep, '--tg-lock-ink': locked.ink,
    '--tg-outline': config.outline,
    '--tg-gazebo-w': String(config.gazeboWidth),
    '--tg-dock': config.dock,
    '--tg-hz-width': String(config.horizonGazebo.width), '--tg-hz-base': String(config.horizonGazebo.baseY),
  };
}

/** Put the garden values on a level screen (`.tf-levels-phone`). */
export function applyGardenLevels(screen: HTMLElement, config: GardenLevels = GARDEN_LEVELS): void {
  for (const [name, value] of Object.entries(gardenLevelsVars(config))) screen.style.setProperty(name, value);
}

/**
 * What the level selection model gets in the garden: gardens of `chapter` levels that end at a
 * gazebo, and the last `behind` completed levels drawn below the current one.
 */
export function gardenPathModel(config: GardenLevels = GARDEN_LEVELS): { chapter: number; behind: number } {
  return { chapter: config.chapter, behind: config.behind };
}
