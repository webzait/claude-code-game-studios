import { CONFIG } from '../config';
import type { Color } from '../engine/types';

/**
 * Colour shapes: the player setting that gives each robot colour a shape of
 * its own, so red, blue and yellow can be told apart without seeing colour.
 * Which colour gets which shape is data (`colourShapes` in data/config.json);
 * the robots, the command buttons and the settings preview all draw from here,
 * so the shape is the same everywhere.
 */

/** A shape's outline as a rounded square: `side` and `corner` as shares of the box it is drawn in, turned by `turn` degrees. */
export interface ShapeOutline {
  readonly side: number;
  readonly corner: number;
  readonly turn: number;
}

/** The shapes on offer. Each fills its box to about the same weight, so none looks larger than the others. */
export const SHAPE_OUTLINES = {
  circle: { side: 0.92, corner: 0.46, turn: 0 },
  square: { side: 0.8, corner: 0.07, turn: 0 },
  diamond: { side: 0.76, corner: 0.05, turn: 45 },
} as const satisfies Record<string, ShapeOutline>;

export type ShapeName = keyof typeof SHAPE_OUTLINES;

/** The robot colours, in the order of their command buttons. */
export const SHAPE_COLOURS: readonly Color[] = ['red', 'blue', 'yellow'];

/** The shape that goes with a robot colour. */
export function shapeOf(color: Color): ShapeName {
  const name = (CONFIG.colourShapes as Record<Color, string>)[color];
  if (!(name in SHAPE_OUTLINES)) throw new Error(`colourShapes.${color}: unknown shape "${name}"`);
  return name as ShapeName;
}

/** The shape as an SVG picture in a `box` by `box` view box, filled by the CSS of the place it is shown. */
export function shapeSvg(name: ShapeName, box = 12): string {
  const { side, corner, turn } = SHAPE_OUTLINES[name];
  const s = +(side * box).toFixed(2);
  const r = +(corner * box).toFixed(2);
  return `<svg viewBox="${-box / 2} ${-box / 2} ${box} ${box}" aria-hidden="true"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${r}"${turn ? ` transform="rotate(${turn})"` : ''}/></svg>`;
}

/** The three shapes in words, for a screen reader: "Red circle, blue square, yellow diamond". */
export function shapesInWords(): string {
  const text = SHAPE_COLOURS.map((color) => `${color} ${shapeOf(color)}`).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Switch the shapes on the command buttons on or off. The first call puts each
 * colour's shape in the corner of its button (`.cmd[data-cmd]`); the page
 * class `colour-shapes` then shows or hides them.
 */
export function applyColourShapes(on: boolean, page: Document = document): void {
  for (const color of SHAPE_COLOURS) {
    const face = page.querySelector(`.cmd[data-cmd="${color}"] .tf-face`);
    if (!face || face.querySelector('.tf-cmd-shape')) continue;
    face.insertAdjacentHTML('beforeend', `<span class="tf-cmd-shape" data-shape="${shapeOf(color)}">${shapeSvg(shapeOf(color))}</span>`);
  }
  page.documentElement.classList.toggle('colour-shapes', on);
}
