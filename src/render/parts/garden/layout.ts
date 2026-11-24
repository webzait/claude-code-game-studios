/**
 * Garden board: the plain arithmetic behind the 3D parts (rim path, decoration places, board size). Nothing here touches
 * three.js or the DOM, so it is unit-tested on its own (tests/unit/garden-board.test.ts).
 *
 * Coordinates are the game's: x to the right, z towards the player (the bottom of the screen),
 * one cell = 1. "Top" in the reference pictures is therefore -z, "left" is -x.
 */
import TILE from '../../../../data/themes/garden/tile.json';
import RIM from '../../../../data/themes/garden/rim.json';

const G = { tile: TILE.tile, rim: RIM.rim, decor: RIM.decor };

/** A small, fast seeded random generator (mulberry32): the same seed gives the same numbers every run. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Size of a garden board in cell units, for `cols` by `rows` cells with `gap` between tiles:
 * `inner` is the grass bed inside the twig rim, `outer` the rim's outside. Same shape as the
 * robot theme's `boardFootprint`, so the theme session can swap one for the other.
 */
export function boardFootprint(cols: number, rows: number, gap: number): { innerW: number; innerD: number; outerW: number; outerD: number } {
  const side = (cells: number): number => cells * G.tile.size + (cells - 1) * gap + 2 * G.rim.margin;
  const innerW = side(cols);
  const innerD = side(rows);
  return { innerW, innerD, outerW: innerW + 2 * G.rim.width, outerD: innerD + 2 * G.rim.width };
}

/** One point on a rounded rectangle, with its outward normal and the direction of travel. */
export interface PathPoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  tx: number;
  tz: number;
}

/**
 * A closed rounded rectangle, half-width `a`, half-depth `b`, corner radius `r`, walked by arc
 * length. It starts at the far (top) side's left end and runs clockwise seen from above
 * (+x along the top, +z down the right side, and so on).
 */
export class RoundedPath {
  readonly length: number;
  private readonly runs: { len: number; at: (t: number) => PathPoint }[];

  constructor(readonly a: number, readonly b: number, readonly r: number) {
    const sx = 2 * (a - r);
    const sz = 2 * (b - r);
    const q = (Math.PI / 2) * r;
    const arc = (cx: number, cz: number, from: number) => (t: number): PathPoint => {
      const phi = from + t * (Math.PI / 2);
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      return { x: cx + nx * r, z: cz + nz * r, nx, nz, tx: -nz, tz: nx };
    };
    this.runs = [
      { len: sx, at: (t) => ({ x: -a + r + t * sx, z: -b, nx: 0, nz: -1, tx: 1, tz: 0 }) },
      { len: q, at: arc(a - r, -b + r, -Math.PI / 2) },
      { len: sz, at: (t) => ({ x: a, z: -b + r + t * sz, nx: 1, nz: 0, tx: 0, tz: 1 }) },
      { len: q, at: arc(a - r, b - r, 0) },
      { len: sx, at: (t) => ({ x: a - r - t * sx, z: b, nx: 0, nz: 1, tx: -1, tz: 0 }) },
      { len: q, at: arc(-a + r, b - r, Math.PI / 2) },
      { len: sz, at: (t) => ({ x: -a, z: b - r - t * sz, nx: -1, nz: 0, tx: 0, tz: -1 }) },
      { len: q, at: arc(-a + r, -b + r, Math.PI) },
    ];
    this.length = this.runs.reduce((sum, run) => sum + run.len, 0);
  }

  /** The point `s` along the path (any real number; it wraps round). */
  at(s: number): PathPoint {
    let rest = ((s % this.length) + this.length) % this.length;
    for (const run of this.runs) {
      if (rest <= run.len || run === this.runs[this.runs.length - 1]) return run.at(run.len > 0 ? Math.min(1, rest / run.len) : 0);
      rest -= run.len;
    }
    return this.runs[0].at(0);
  }
}

/** The centre line of the twig rim on a `cols` by `rows` board. */
export function rimPath(cols: number, rows: number, gap: number): RoundedPath {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const half = G.rim.width / 2;
  return new RoundedPath(innerW / 2 + half, innerD / 2 + half, G.rim.cornerRadius);
}

/**
 * How many full twists one strand of the braid makes round the whole rim: as close to one twist
 * per `pitch` as a whole number allows, so the braid closes on itself without a seam.
 */
export function braidTwists(length: number): number {
  return Math.max(1, Math.round(length / G.rim.pitch));
}

/** The kinds of decoration on the rim: two or three leaves, one leaf, or a white flower with leaves. */
export type DecorKind = 'leaves' | 'leaf' | 'flower';

/** One decoration on the rim: where its root sits on the braid's centre line, which way is out, which way runs along. */
export interface DecorPlace {
  kind: DecorKind;
  side: 'top' | 'right' | 'bottom' | 'left';
  x: number;
  z: number;
  /** Outward normal of the side (unit, in x/z). */
  nx: number;
  nz: number;
  /** Direction along the side (unit, in x/z), left to right or top to bottom as seen in the reference. */
  ax: number;
  az: number;
  flip: boolean;
}

/**
 * Where the leaves and flowers sit on a `cols` by `rows` board. The places are fixed in
 * `data/themes/garden/rim.json` as a fraction along each straight side, as in the reference
 * `03-rim-vines`, so every board of a given size looks the same every time and a larger board
 * spreads the same arrangement over its longer sides.
 */
export function rimDecorLayout(cols: number, rows: number, gap: number): DecorPlace[] {
  const path = rimPath(cols, rows, gap);
  const { a, b, r } = path;
  return G.decor.clusters.map((c) => {
    const side = c.side as DecorPlace['side'];
    const along = side === 'top' || side === 'bottom';
    const half = along ? a : b;
    const t = -half + r + c.at * 2 * (half - r);
    const base = { kind: c.kind as DecorKind, side, flip: c.flip };
    switch (side) {
      case 'top': return { ...base, x: t, z: -b, nx: 0, nz: -1, ax: 1, az: 0 };
      case 'bottom': return { ...base, x: t, z: b, nx: 0, nz: 1, ax: 1, az: 0 };
      case 'left': return { ...base, x: -a, z: t, nx: -1, nz: 0, ax: 0, az: 1 };
      default: return { ...base, x: a, z: t, nx: 1, nz: 0, ax: 0, az: 1 };
    }
  });
}

/**
 * What a garden board of `cols` by `rows` cells measures on a screen where its outside is
 * `boardPx` wide: the pixels per cell and the sizes that follow (as the robot `boardPixels`).
 */
export function boardPixels(cols: number, rows: number, gap: number, boardPx: number): { unit: number; tile: number; gap: number; frame: number; width: number; height: number } {
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const unit = boardPx / outerW;
  return { unit, tile: G.tile.size * unit, gap: gap * unit, frame: G.rim.width * unit, width: boardPx, height: outerD * unit };
}

/** Distance from (x, y) to a rounded square of half-size `half` and corner radius `r`; negative inside. */
export function roundedSquareDistance(x: number, y: number, half: number, r: number): number {
  const qx = Math.abs(x) - half + r;
  const qy = Math.abs(y) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
