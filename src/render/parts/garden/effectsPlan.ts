import FX from '../../../../data/themes/garden/effects.json';
import type { CelebrationInput, CelebrationPlan } from '../../../game/celebration';

/**
 * The timing and layout of the garden theme's effects, without any drawing: every number that
 * decides when a part of an effect shows and where it goes. `effects.ts` draws from these, the
 * unit tests check them. Values come from data/themes/garden/effects.json.
 */

/** The tuning values of the garden effects. */
export type GardenFxConfig = typeof FX;
/** The garden effects' tuning, as loaded. */
export const GARDEN_FX: GardenFxConfig = FX;

/** The four effects of the garden sheet (21-sheet-effects). */
export const GARDEN_FX_KINDS = ['beam', 'stars', 'cloud', 'ring'] as const;
/** One of the garden effects. */
export type GardenFxKind = (typeof GARDEN_FX_KINDS)[number];

/** The names the parts sheet shows. */
export const GARDEN_FX_NAMES: Record<GardenFxKind, string> = { beam: 'Lichtstraal', stars: 'Sterren', cloud: 'Wolkje', ring: 'Blauwe ring' };

/** How long one effect plays, in seconds; the calm version is shorter and has no flight. */
export function fxSeconds(kind: GardenFxKind, calm: boolean, config: GardenFxConfig = GARDEN_FX): number {
  const c = config[kind];
  return calm ? c.calmSeconds : c.seconds;
}

/** Clamp to 0..1. */
export const clamp01 = (k: number): number => (k < 0 ? 0 : k > 1 ? 1 : k);

/** Where `t` is between `from` and `to`, as 0..1. */
export const span = (t: number, from: number, to: number): number => clamp01((t - from) / Math.max(to - from, 1e-6));

/** Overshoots a little and settles at 1: a pop. */
export const easeOutBack = (k: number): number => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
/** Fast start, soft end. */
export const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3);
/** Soft start and end. */
export const smooth = (k: number): number => k * k * (3 - 2 * k);

/**
 * Rise, hold and fall of an effect over its life `u` (0..1): 0 at the start, 1 from `attack`
 * until `release`, back to 0 at the end. Every part of every effect is shaped by one of these,
 * so each has a clear beginning, middle and end.
 */
export function envelope(u: number, attack: number, release: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < attack) return smooth(u / attack);
  if (u > release) return smooth((1 - u) / (1 - release));
  return 1;
}

/** A small repeatable random source, so an effect looks the same every time. */
export function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a star of the sparkle ends up, in cells from its start, in the plane facing the player: x right, y up. */
export interface StarSpot {
  readonly x: number;
  readonly y: number;
  /** Size against the configured star size. */
  readonly size: number;
  /** When it pops out, in seconds after the effect starts. */
  readonly delay: number;
}

/**
 * The stars of one sparkle, as on the sheet: three stars in a loose triangle, the lower-left one
 * largest. One star goes straight up; two go up-left and up-right.
 */
export function starSpots(count: number): StarSpot[] {
  const n = Math.max(1, Math.min(Math.round(count), 5));
  const all: StarSpot[] = [
    { x: -0.55, y: 0.95, size: 1, delay: 0 },
    { x: 0.6, y: 0.55, size: 0.82, delay: 0.06 },
    { x: -0.45, y: 0.1, size: 0.95, delay: 0.12 },
    { x: 0.7, y: 1.25, size: 0.6, delay: 0.16 },
    { x: 0.05, y: 1.5, size: 0.55, delay: 0.2 },
  ];
  if (n === 1) return [{ x: 0, y: 0.8, size: 1.1, delay: 0 }];
  if (n === 2) return [{ x: -0.5, y: 0.75, size: 1, delay: 0 }, { x: 0.5, y: 0.6, size: 0.9, delay: 0.07 }];
  return all.slice(0, n);
}

/** One ball of the cloud puff, in units of the puff's radius: x right, y up, z towards the player. */
export interface PuffBall {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly r: number;
  /** Order in which the balls shrink away, 0..1. */
  readonly order: number;
}

/**
 * The balls of the cloud puff on the sheet: a big ball on top, a ring of balls around a small
 * one in the middle, a fuller bottom row. Seen from the front it reads as one round cloud.
 */
export function puffBalls(): PuffBall[] {
  return [
    { x: 0, y: 0.52, z: -0.05, r: 0.46, order: 0.5 },
    { x: -0.5, y: 0.12, z: 0, r: 0.4, order: 0.2 },
    { x: 0.52, y: 0.22, z: -0.02, r: 0.42, order: 0.75 },
    { x: -0.34, y: -0.42, z: 0.02, r: 0.38, order: 0.1 },
    { x: 0.36, y: -0.36, z: 0.04, r: 0.4, order: 0.9 },
    { x: 0.02, y: -0.62, z: 0.08, r: 0.36, order: 0.4 },
    { x: 0.02, y: 0.0, z: 0.3, r: 0.24, order: 0.6 },
    { x: -0.12, y: -0.18, z: 0.22, r: 0.26, order: 0.3 },
    { x: 0.22, y: -0.04, z: 0.24, r: 0.22, order: 0.0 },
  ];
}

/** Where a light ray of the beam stands, in units of the ring's radius, and how tall it gets. */
export interface BeamRay {
  readonly x: number;
  readonly z: number;
  /** Height against the configured ray height. */
  readonly height: number;
  /** When it shoots up, as a share of the effect's life. */
  readonly start: number;
}

/** The rays of the beam: the tallest in the middle, the others round it, lower and later. */
export function beamRays(count: number): BeamRay[] {
  const out: BeamRay[] = [{ x: 0, z: 0, height: 1, start: 0.08 }];
  const random = randomSource(11);
  for (let i = 1; i < count; i++) {
    const a = (i / Math.max(count - 1, 1)) * Math.PI * 2 + 0.4;
    const d = 0.45 + random() * 0.3;
    out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, height: 0.45 + random() * 0.35, start: 0.1 + random() * 0.12 });
  }
  return out;
}

/** A free tile of the board where the garden celebration lets a sparkle pop, and when. */
export interface SparkleCue {
  readonly cellX: number;
  readonly cellY: number;
  /** Seconds after the celebration starts. */
  readonly at: number;
}

/** What the garden celebration needs to know about the board. */
export interface SparkleBoard {
  readonly width: number;
  readonly height: number;
  readonly walls: readonly boolean[];
  readonly exitX: number;
  readonly exitY: number;
}

/**
 * The sparkle wave of the garden celebration: one twinkle per free tile, in a ring that runs from
 * the exit to the far corner, like the robot theme's light wave. The wave starts at `from` and
 * reaches the farthest tile by `until` seconds.
 */
export function sparkleWave(board: SparkleBoard, from: number, until: number): SparkleCue[] {
  const cells: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < board.height; y++)
    for (let x = 0; x < board.width; x++) {
      if (board.walls[y * board.width + x] || (x === board.exitX && y === board.exitY)) continue;
      cells.push({ x, y, d: Math.hypot(x - board.exitX, y - board.exitY) });
    }
  const reach = cells.reduce((m, c) => Math.max(m, c.d), 1);
  const random = randomSource(3);
  return cells.map((c) => ({ cellX: c.x, cellY: c.y, at: from + (c.d / reach) * (until - from) * (0.85 + random() * 0.15) }));
}

/** One effect the garden celebration starts. */
export interface GardenCue {
  readonly kind: GardenFxKind;
  /** On the exit, or in the middle of the board. */
  readonly where: 'exit' | 'middle';
  /** Seconds after the celebration starts. */
  readonly at: number;
  readonly scale: number;
  /** Stars only: how many. */
  readonly count?: number;
}

/**
 * The garden celebration of a win, as a list of effects: a beam rises from the exit, stars burst
 * from it, and a wave of twinkles runs over the lawn (`sparkleWave`). Three stars: five stars, and
 * a second burst of stars over the middle of the board. Calm: the beam and the stars without flight.
 * The blue ring is not part of it: it is kept for the element it belongs to (a portal, proposed).
 */
export function gardenCelebrationCues(plan: Pick<CelebrationPlan, 'perfect' | 'calm'>, config: GardenFxConfig = GARDEN_FX): GardenCue[] {
  const c = config.celebration;
  const cues: GardenCue[] = [
    { kind: 'beam', where: 'exit', at: 0, scale: c.beamScale },
    { kind: 'stars', where: 'exit', at: plan.calm ? 0 : c.starsAt, scale: c.starsScale, count: plan.perfect ? 5 : 3 },
  ];
  if (plan.perfect && !plan.calm) cues.push({ kind: 'stars', where: 'middle', at: c.perfectBurstAt, scale: c.perfectBurstScale, count: 5 });
  return cues;
}

/**
 * Plan a win for the garden theme: the same decisions as `planCelebration` (stars, calm, sound),
 * with the garden celebration's own lengths. The result drives `CelebrationRun` unchanged.
 */
export function planGardenCelebration(input: CelebrationInput, config: GardenFxConfig = GARDEN_FX): CelebrationPlan {
  const c = config.celebration;
  const perfect = input.stars === 3;
  const sound = input.muted ? null : perfect ? 'perfect' : 'win';
  if (input.reduced) return { variant: input.variant, perfect, calm: true, seconds: c.calm.seconds, cardDelay: c.calm.cardDelay, sound };
  return { variant: input.variant, perfect, calm: false, seconds: perfect ? c.perfectSeconds : c.seconds, cardDelay: perfect ? c.perfectCardDelay : c.cardDelay, sound };
}
