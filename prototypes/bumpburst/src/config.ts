// PROTOTYPE - NOT FOR PRODUCTION
/**
 * Every tuning value of BUMPBURST lives here. Gameplay code reads `tune.*`
 * and never hardcodes a number, so balance changes are data changes.
 */
export const tune = {
  /** Fixed simulation step in seconds. */
  dt: 1 / 60,
  /** Physics substeps per fixed step (prevents tunnelling). */
  substeps: 4,
  /** Contact solver passes per substep. */
  iterations: 4,

  /** Marble radius in world units (the tray is 10 x 10). */
  marbleRadius: 0.24,

  /** Duration of one bumper pulse in seconds (expand + return). */
  pulseTime: 0.26,
  /** Fraction of the pulse spent expanding. */
  pulseExpandFraction: 0.45,
  /** Peak extra radius as a fraction of the bumper's rest radius. */
  pulseExpand: 0.5,

  /** Restitution marble vs bumper surface. */
  bumperRestitution: 0.35,
  /** Restitution marble vs marble. */
  marbleRestitution: 0.86,
  /** Restitution marble vs wall / obstacle. */
  wallRestitution: 0.5,

  /** Rolling friction: constant deceleration in units/s^2. */
  friction: 2.6,
  /** Viscous drag in 1/s (faster marbles lose a little more). */
  drag: 0.35,

  /** Hard speed limit in units/s (keeps squeezed marbles from shooting off unrealistically). */
  maxSpeed: 13,

  /** Safety cap: a pulse is force-settled after this many seconds. */
  maxResolveTime: 12,
} as const;

/** Functional game colours (visual standard). Three are used in the first levels. */
export const COLORS = {
  red: '#F04446',
  blue: '#2675E8',
  yellow: '#FFD12F',
  green: '#2FC56C',
  orange: '#FF9736',
  purple: '#9856E8',
} as const;

export type ColorId = keyof typeof COLORS;

/** Button / keyboard order. */
export const COLOR_ORDER: ColorId[] = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];

export type SymbolKind = 'triangle' | 'square' | 'star' | 'hexagon' | 'diamond' | 'plus';

/** Shape that backs each colour, so colour is never the only cue. */
export const SYMBOLS: Record<ColorId, SymbolKind> = {
  red: 'triangle',
  blue: 'square',
  yellow: 'star',
  green: 'hexagon',
  orange: 'diamond',
  purple: 'plus',
};

/** Look of the diorama. A future skin is another object of this shape. */
export const theme = {
  background: '#EEEBE5',
  floor: '#ECE8E1',
  wall: '#D5DAE0',
  /** The catch bin: the one place green appears until green bumpers exist. */
  bin: '#5FB889',
  obstacle: '#C6CBD6',
  pocket: '#2A2E3A',
  marble: '#FFFFFF',
};
