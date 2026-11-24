// Where the garden backdrop falls on a screen: the same sums as garden-scene.css, as plain
// functions so they can be checked for every phone size (tests/unit/garden-backdrop.test.ts).
import spec from '../../../../data/themes/garden/backdrop.json';

/** The game's screen zones in CSS pixels (the clamps of .tf-decor-screen and garden-scene.css). */
export interface Zones {
  /** Height of the top bar. */
  top: number;
  /** Height of the two button rows. */
  bottom: number;
  /** Side of the square the board is fitted in. */
  board: number;
  /** Free strip above and below the board. */
  band: number;
  /** Top edge of the board. */
  boardTop: number;
}

/** Placement of the two backdrop pictures on one screen. */
export interface SceneLayout {
  /** CSS pixels per pixel of the owner's picture (the same both ways: never distorted). */
  scale: number;
  /** Top of the scene picture; negative means the sky starts above the screen. */
  sceneTop: number;
  /** Bottom of the scene picture, where the repeating paving takes over. */
  sceneEnd: number;
  /** Screen y of a row of the owner's picture. */
  rowY: (row: number) => number;
  /** How many paving tiles are needed to reach the bottom of the screen. */
  tiles: number;
}

const clamp = (lo: number, v: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The game's zones for a screen of `w` × `h` CSS pixels.
 * @param w Screen width.
 * @param h Screen height.
 */
export function zones(w: number, h: number): Zones {
  const top = clamp(56, h * 0.114, 96);
  const bottom = clamp(62, h * 0.11, 92) + 88;
  const board = Math.min(w, 560) - 24;
  const band = Math.max(0, (h - top - bottom - board) / 2);
  return { top, bottom, board, band, boardTop: top + band };
}

/**
 * Where the scene and the paving fall on a screen of `w` × `h` CSS pixels.
 * @param w Screen width.
 * @param h Screen height.
 */
export function sceneLayout(w: number, h: number): SceneLayout {
  const scale = w / spec.source.width;
  const sceneTop = zones(w, h).boardTop - spec.scene.anchorRow * scale;
  const sceneEnd = sceneTop + spec.scene.sceneRows * scale;
  const tile = spec.paving.period * scale;
  return { scale, sceneTop, sceneEnd, rowY: (row) => sceneTop + row * scale, tiles: Math.max(0, Math.ceil((h - sceneEnd) / tile)) };
}

/** The layout numbers garden-scene.css repeats, from data/themes/garden/backdrop.json. */
export const GARDEN_BACKDROP = {
  width: spec.source.width,
  sceneRows: spec.scene.sceneRows,
  anchorRow: spec.scene.anchorRow,
  lawnEdgeRow: spec.scene.lawnEdgeRow,
  pavingTop: spec.paving.pavingTop,
  period: spec.paving.period,
  sky: spec.sky,
} as const;
