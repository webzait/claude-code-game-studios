// PROTOTYPE - NOT FOR PRODUCTION
import { tune } from '../config';
import type { Vec } from '../physics/world';
import type { LevelDef } from './types';

const MR = tune.marbleRadius;
const SIZE = { w: 10, h: 10 };

/** Marbles resting on an arc around a bumper. Angles in degrees, 0 = straight down, positive = right. */
function arc(cx: number, cy: number, bumperR: number, anglesDeg: number[], gap = 0.03): Vec[] {
  const d = bumperR + MR + gap;
  return anglesDeg.map((a) => {
    const t = (a * Math.PI) / 180;
    return { x: round(cx + Math.sin(t) * d), y: round(cy + Math.cos(t) * d) };
  });
}

/** A cols x rows block of marbles centred on (cx, cy). */
function block(cx: number, cy: number, cols: number, rows: number, spacing = MR * 2 + 0.04): Vec[] {
  const out: Vec[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ x: round(cx + (c - (cols - 1) / 2) * spacing), y: round(cy + (r - (rows - 1) / 2) * spacing) });
  return out;
}

/** `n` marbles in a line starting at (x, y), heading right. */
function row(x: number, y: number, n: number, spacing = 0.52): Vec[] {
  return Array.from({ length: n }, (_, i) => ({ x: round(x + i * spacing), y }));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'First Burst',
    hint: 'Tap the color. Its bumper bursts.',
    size: SIZE,
    bumpers: [{ color: 'red', x: 5, y: 4.2, r: 1.1 }],
    marbles: arc(5, 4.2, 1.1, [-52, -21, 0, 21, 52]),
    obstacles: [],
    catchers: [{ x: 3, y: 9.25, w: 4, h: 0.75 }],
    target: 3,
    pulses: 1,
    solution: ['red'],
  },
  {
    id: 2,
    name: 'Choose the Color',
    hint: 'One pulse. Which color sends them home?',
    size: SIZE,
    bumpers: [
      { color: 'red', x: 3.55, y: 5.6, r: 1.0 },
      { color: 'blue', x: 5, y: 3.3, r: 1.0 },
    ],
    marbles: block(5, 4.83, 2, 2),
    obstacles: [],
    catchers: [{ x: 3.6, y: 9.25, w: 4, h: 0.75 }],
    target: 3,
    pulses: 1,
    solution: ['blue'],
  },
  {
    id: 3,
    name: 'The Wrong First Move',
    hint: 'Two pulses. The order matters.',
    size: SIZE,
    bumpers: [
      { color: 'red', x: 1.2, y: 4.84, r: 0.64 },
      { color: 'blue', x: 5, y: 2.9, r: 1.15 },
    ],
    marbles: [...arc(5, 2.9, 1.15, [-14, 14]), ...row(1.2 + 0.64 + MR + 0.03, 4.84, 4)],
    obstacles: [
      { x: 6.0, y: 3.8, w: 0.6, h: 1.8 },
      { x: 1.6, y: 6.6, w: 2.2, h: 0.6 },
    ],
    catchers: [{ x: 3.2, y: 9.25, w: 3.6, h: 0.75 }],
    target: 5,
    pulses: 2,
    solution: ['red', 'blue'],
  },
  {
    id: 4,
    name: 'Double Impact',
    hint: 'Both red bumpers burst together.',
    size: SIZE,
    bumpers: [
      { color: 'red', x: 3.2, y: 3.95, r: 1.15 },
      { color: 'red', x: 6.8, y: 3.95, r: 1.15 },
      { color: 'blue', x: 5, y: 1.4, r: 1.2 },
    ],
    marbles: block(5, 4.25, 2, 3),
    obstacles: [],
    catchers: [{ x: 3.4, y: 9.25, w: 3.2, h: 0.75 }],
    target: 5,
    pulses: 2,
    solution: ['red', 'blue'],
  },
  {
    id: 5,
    name: 'Big Burst',
    hint: 'Three colors. Set up the chain.',
    size: SIZE,
    bumpers: [
      { color: 'red', x: 1.2, y: 3.54, r: 0.64 },
      { color: 'blue', x: 5, y: 1.6, r: 1.15 },
      { color: 'yellow', x: 3.2, y: 6.0, r: 1.15 },
      { color: 'yellow', x: 6.8, y: 6.0, r: 1.15 },
    ],
    marbles: [...row(1.2 + 0.64 + MR + 0.03, 3.54, 5), ...block(5, 6.3, 2, 4), ...arc(5, 1.6, 1.15, [-14, 14])],
    obstacles: [{ x: 6.0, y: 2.5, w: 0.6, h: 1.8 }],
    catchers: [{ x: 3.4, y: 9.25, w: 3.2, h: 0.75 }],
    target: 8,
    pulses: 4,
    solution: ['red', 'yellow', 'blue'],
  },
];
