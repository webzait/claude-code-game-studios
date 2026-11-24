import data from '../../../../data/themes/garden/obstacles.json';

/** The garden obstacles a wall cell can show. */
export type GardenObstacleKind = 'rock' | 'rockMossLight' | 'rockMossy' | 'stump' | 'bushWhite' | 'bushPink';
/** Obstacles that read as "the same thing": two of one family never sit side by side. */
export type GardenObstacleFamily = 'rock' | 'stump' | 'bush';

/** Which obstacle a wall cell shows, and how far it is turned (quarter turns, 0 to 3). */
export interface ObstacleChoice {
  readonly kind: GardenObstacleKind;
  readonly turn: number;
}

/** How often each family, and each variant within it, is picked. Weights need not add up to 1. */
export interface ChoiceWeights {
  readonly families: Readonly<Record<GardenObstacleFamily, number>>;
  readonly variants: Readonly<Record<GardenObstacleFamily, Readonly<Record<string, number>>>>;
}

/** The weights in `data/themes/garden/obstacles.json`. */
export const DEFAULT_WEIGHTS: ChoiceWeights = data.choice as ChoiceWeights;

/** Family of each kind. */
export const FAMILY_OF: Readonly<Record<GardenObstacleKind, GardenObstacleFamily>> = {
  rock: 'rock',
  rockMossLight: 'rock',
  rockMossy: 'rock',
  stump: 'stump',
  bushWhite: 'bush',
  bushPink: 'bush',
};

const FAMILIES: readonly GardenObstacleFamily[] = ['rock', 'bush', 'stump'];

/**
 * A 32-bit hash of a cell in a level (FNV-1a over "level:x:y", then mixed).
 * The same level and cell always give the same number, on every device.
 */
export function cellHash(levelId: string, x: number, y: number): number {
  const text = `${levelId}:${x}:${y}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Final avalanche, so neighbouring cells differ in every bit.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Pick from `options` by weight, using `roll` in [0, 1). Equal chances when every weight is 0. */
function weighted<T extends string>(options: readonly T[], weight: (o: T) => number, roll: number): T {
  const total = options.reduce((sum, o) => sum + Math.max(0, weight(o)), 0);
  if (total <= 0) return options[Math.min(options.length - 1, Math.floor(roll * options.length))];
  let at = roll * total;
  for (const o of options) {
    at -= Math.max(0, weight(o));
    if (at < 0) return o;
  }
  return options[options.length - 1];
}

/**
 * Choose the obstacle for every wall cell of a board, row by row from the top
 * left. The rule (see design/themes/garden-obstacles.md):
 *
 * 1. Each cell gets a hash of the level id and its position.
 * 2. The family (rock, bush, stump) is drawn by weight from the hash, leaving
 *    out the families of the wall directly to the left and directly above,
 *    which were chosen before. Two touching walls are never the same family.
 * 3. The variant within the family (plain, lightly mossy or mossy rock; white or pink bush)
 *    and the quarter turn come from other bits of the same hash.
 *
 * Nothing is random: the same level always looks the same. Returns one entry
 * per cell, `null` where there is no wall.
 */
export function chooseObstacles(
  levelId: string,
  width: number,
  height: number,
  walls: readonly boolean[],
  weights: ChoiceWeights = DEFAULT_WEIGHTS,
): (ObstacleChoice | null)[] {
  const out: (ObstacleChoice | null)[] = new Array(width * height).fill(null);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!walls[i]) continue;
      const h = cellHash(levelId, x, y);
      const taken = new Set<GardenObstacleFamily>();
      const left = x > 0 ? out[i - 1] : null;
      const up = y > 0 ? out[i - width] : null;
      if (left) taken.add(FAMILY_OF[left.kind]);
      if (up) taken.add(FAMILY_OF[up.kind]);
      const open = FAMILIES.filter((f) => !taken.has(f));
      const family = weighted(open, (f) => weights.families[f], (h & 0xffff) / 0x10000);
      const variants = Object.keys(weights.variants[family]) as GardenObstacleKind[];
      const kind = weighted(variants, (v) => weights.variants[family][v], ((h >>> 16) & 0xff) / 0x100);
      out[i] = { kind, turn: (h >>> 24) & 3 };
    }
  }
  return out;
}
