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

// ---------------------------------------------------------------------------------------------
// The rim as the owner's picture: where each piece of 03-rim-vines lands on a board.
// ---------------------------------------------------------------------------------------------

/**
 * One of the owner's rim pictures, cut into pieces: `rim` from 03-rim-vines (`rim-atlas.webp`),
 * `board` from 01-board-full with the lawn strip inside the braid (`board-rim-atlas.webp`).
 */
export interface RimPicture {
  image: { pxPerCell: number; decorOrder: string[]; innerInset?: number; height: number; layer: number };
  atlas: { size: number[]; fade: number; inner: number[]; mirrorShift: number; pieces: AtlasPiece[] };
}

/** The two rim pictures. */
export const RIM_PICTURES: Record<'rim' | 'board', RimPicture> = {
  rim: { image: RIM.image, atlas: RIM.atlas as RimPicture['atlas'] },
  board: { image: RIM.imageBoard, atlas: RIM.atlasBoard as RimPicture['atlas'] },
};

/** A side of the board, as in the reference picture: top is far (-z), left is -x. */
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** One piece of the picture in the atlas: its rectangle in 03-rim-vines and, for a tile, its period. */
export interface AtlasPiece {
  name: string;
  kind: string;
  side?: string;
  src: number[];
  atlas: number[];
  period?: number;
}

/**
 * One flat rectangle of the rim on the board: world x from `x0` to `x1`, z from `z0` to `z1`, at
 * height layer `layer` (0 plain braid, 1 decorated piece, 2 corner, drawn in that order), showing
 * the source rectangle of `piece` whose corner (`sx0`, `sy0`) lands on (`x0`, `z0`) and
 * (`sx1`, `sy1`) on (`x1`, `z1`). A mirrored piece has `sx0` > `sx1`.
 */
export interface RimQuad {
  piece: string;
  kind: 'corner' | 'tile' | 'decor';
  side: Side | 'corner';
  layer: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  sx0: number;
  sx1: number;
  sy0: number;
  sy1: number;
}

/** A decorated piece as placed along its side: world along-range (from the side's inner start). */
export interface DecorSlot {
  name: string;
  side: Side;
  start: number;
  end: number;
  home: number;
}

const piece = (name: string, pic: RimPicture = RIM_PICTURES.rim): AtlasPiece => {
  const p = pic.atlas.pieces.find((q) => q.name === name);
  if (!p) throw new Error(`rim atlas has no piece ${name}`);
  return p;
};

/** Source pixels per cell: the picture is laid on the board at this one scale, never stretched. */
export const RIM_PX = RIM.image.pxPerCell;

/**
 * The geometry of one side, in source pixels along it: the inner length in the picture, where the
 * corner at its start ends and the corner at its end begins, the axis that runs along it, and
 * where along-coordinates start (the picture's inner edge).
 */
export function sideSpec(side: Side, pic: RimPicture = RIM_PICTURES.rim): { along: 'x' | 'y'; origin: number; length: number; cornerStart: number; cornerEnd: number; corners: [string, string] } {
  const [ix0, ix1, iy0, iy1] = pic.atlas.inner;
  const horizontal = side === 'top' || side === 'bottom';
  const corners: [string, string] = side === 'top' ? ['tl', 'tr'] : side === 'bottom' ? ['bl', 'br'] : side === 'left' ? ['tl', 'bl'] : ['tr', 'br'];
  const a = piece(corners[0], pic).src;
  const b = piece(corners[1], pic).src;
  const origin = horizontal ? ix0 : iy0;
  return {
    along: horizontal ? 'x' : 'y',
    origin,
    length: horizontal ? ix1 - ix0 : iy1 - iy0,
    cornerStart: (horizontal ? a[2] : a[3]) - origin,
    cornerEnd: (horizontal ? b[0] : b[1]) - origin,
    corners,
  };
}

/** Length of a board side inside the rim, in cells. */
function sideLength(side: Side, cols: number, rows: number, gap: number, pic: RimPicture): number {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  return (side === 'top' || side === 'bottom' ? innerW : innerD) - 2 * (pic.image.innerInset ?? 0);
}

/**
 * Where the decorated pieces sit on each side of a `cols` by `rows` board. Each keeps its place
 * in the picture as a share of the straight run between the two corners, so the board the size
 * of the picture (about 5×5) shows the picture exactly, and a larger board spreads the same
 * pieces out. Pieces may overlap a neighbour (or a corner) only by their faded ends; where the
 * run is too short for them all, they are pushed together, and if that is not enough, the least
 * important (last in `image.decorOrder`) is left out. Never random: the same board, the same rim.
 */
export function rimDecorSlots(cols: number, rows: number, gap: number, pic: RimPicture = RIM_PICTURES.rim): DecorSlot[] {
  const px = pic.image.pxPerCell;
  const fade = pic.atlas.fade / px;
  const slots: DecorSlot[] = [];
  for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
    const spec = sideSpec(side, pic);
    const L = sideLength(side, cols, rows, gap, pic);
    const startW = spec.cornerStart / px;
    const endW = L - (spec.length - spec.cornerEnd) / px;
    let names = pic.image.decorOrder.filter((n) => piece(n, pic).side === side);
    for (;;) {
      const placed = names
        .map((name) => {
          const src = piece(name, pic).src;
          const s0 = (spec.along === 'x' ? src[0] : src[1]) - spec.origin;
          const s1 = (spec.along === 'x' ? src[2] : src[3]) - spec.origin;
          const f = ((s0 + s1) / 2 - spec.cornerStart) / (spec.cornerEnd - spec.cornerStart);
          const home = startW + f * (endW - startW);
          const half = (s1 - s0) / px / 2;
          return { name, side, start: home - half, end: home + half, home };
        })
        .sort((a, b) => a.home - b.home);
      // Push forward past the previous piece, then back from the next one.
      let limit = startW - fade;
      for (const p of placed) {
        const move = Math.max(0, limit - p.start);
        p.start += move;
        p.end += move;
        limit = p.end - fade;
      }
      limit = endW + fade;
      for (let i = placed.length - 1; i >= 0; i--) {
        const p = placed[i];
        const move = Math.max(0, p.end - limit);
        p.start -= move;
        p.end -= move;
        limit = p.start + fade;
      }
      const fits = placed.every((p, i) => p.start >= (i === 0 ? startW - fade : placed[i - 1].end - fade) - 1e-9);
      if (fits || names.length === 0) {
        slots.push(...placed);
        break;
      }
      names = names.slice(0, -1);
    }
  }
  return slots;
}

/**
 * Every flat rectangle of the picture rim on a `cols` by `rows` board (see `RimQuad`): the four
 * corners from their own corner of the picture, each straight side filled with its plain braid
 * repeated (cut short at the end, never stretched), and the decorated pieces from
 * `rimDecorSlots` over it. The left side has no plain stretch long enough in the picture, so it
 * repeats the right side's braid, mirrored.
 */
export function rimQuads(cols: number, rows: number, gap: number, pic: RimPicture = RIM_PICTURES.rim): RimQuad[] {
  const inset = pic.image.innerInset ?? 0;
  const { innerW: fullW, innerD: fullD } = boardFootprint(cols, rows, gap);
  const innerW = fullW - 2 * inset;
  const innerD = fullD - 2 * inset;
  const A = innerW / 2;
  const B = innerD / 2;
  const [ix0, ix1, iy0, iy1] = pic.atlas.inner;
  const s = pic.image.pxPerCell;
  const fade = pic.atlas.fade / s;
  const quads: RimQuad[] = [];
  // Where a source x / y lands for each corner of the board.
  const wx = (left: boolean, sx: number): number => (left ? -A + (sx - ix0) / s : A + (sx - ix1) / s);
  const wz = (top: boolean, sy: number): number => (top ? -B + (sy - iy0) / s : B + (sy - iy1) / s);

  for (const name of ['tl', 'tr', 'bl', 'br']) {
    const [x0, y0, x1, y1] = piece(name, pic).src;
    const left = name[1] === 'l';
    const top = name[0] === 't';
    quads.push({ piece: name, kind: 'corner', side: 'corner', layer: 2, x0: wx(left, x0), x1: wx(left, x1), z0: wz(top, y0), z1: wz(top, y1), sx0: x0, sx1: x1, sy0: y0, sy1: y1 });
  }

  // A rectangle on `side` covering world along-range [w0, w1] (from the side's inner start) and
  // showing the source along-range [a0, a1] (source px from the picture's inner edge) of `p`.
  const onSide = (side: Side, p: AtlasPiece, kind: 'tile' | 'decor', w0: number, w1: number, a0: number, a1: number): RimQuad => {
    const [bx0, by0, bx1, by1] = p.src;
    const layer = kind === 'tile' ? 0 : 1;
    const base = { piece: p.name, kind, side, layer };
    if (side === 'top' || side === 'bottom') {
      const top = side === 'top';
      return { ...base, x0: -A + w0, x1: -A + w1, z0: wz(top, by0), z1: wz(top, by1), sx0: ix0 + a0, sx1: ix0 + a1, sy0: by0, sy1: by1 };
    }
    if (side === 'right' || p.side === 'left') {
      const left = side === 'left';
      return { ...base, x0: wx(left, bx0), x1: wx(left, bx1), z0: -B + w0, z1: -B + w1, sx0: bx0, sx1: bx1, sy0: iy0 + a0, sy1: iy0 + a1 };
    }
    // The right side's braid on the left side, mirrored: its outside (large source x) lands outside
    // (-x), moved in by `mirrorShift` so its outside lines up with the left side's own.
    const m = pic.atlas.mirrorShift / s;
    return { ...base, x0: -A - (bx1 - ix1) / s + m, x1: -A - (bx0 - ix1) / s + m, z0: -B + w0, z1: -B + w1, sx0: bx1, sx1: bx0, sy0: iy0 + a0, sy1: iy0 + a1 };
  };

  const tiles: Record<Side, string> = { top: 'top-tile', bottom: 'bottom-tile', right: 'right-tile', left: 'right-tile' };
  for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
    const spec = sideSpec(side, pic);
    const L = side === 'top' || side === 'bottom' ? innerW : innerD;
    const from = spec.cornerStart / s - fade;
    const to = L - (spec.length - spec.cornerEnd) / s + fade;
    const tile = piece(tiles[side], pic);
    const t0 = (spec.along === 'x' ? tile.src[0] : tile.src[1]) - spec.origin;
    const period = (tile.period ?? 0) / s;
    for (let w = from; w < to - 1e-6; w += period) {
      const w1 = Math.min(w + period, to);
      quads.push(onSide(side, tile, 'tile', w, w1, t0, t0 + (w1 - w) * s));
    }
  }

  for (const slot of rimDecorSlots(cols, rows, gap, pic)) {
    const p = piece(slot.name, pic);
    const spec = sideSpec(slot.side, pic);
    const a0 = (spec.along === 'x' ? p.src[0] : p.src[1]) - spec.origin;
    const a1 = (spec.along === 'x' ? p.src[2] : p.src[3]) - spec.origin;
    quads.push(onSide(slot.side, p, 'decor', slot.start, slot.end, a0, a1));
  }
  return quads.sort((a, b) => a.layer - b.layer);
}
