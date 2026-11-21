// PROTOTYPE - NOT FOR PRODUCTION
import type { SymbolKind } from '../config';

/** Outline of a colour's symbol as a polygon in a -1..1 box, y up. Shared by the 3D bumpers and the 2D buttons. */
export function symbolPoints(kind: SymbolKind): [number, number][] {
  const ring = (n: number, r: (i: number) => number, rot = 0): [number, number][] =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i / n) * Math.PI * 2;
      return [Math.sin(a) * r(i), Math.cos(a) * r(i)] as [number, number];
    });
  switch (kind) {
    case 'triangle':
      return [[0, 0.86], [0.88, -0.62], [-0.88, -0.62]];
    case 'square':
      return [[-0.7, 0.7], [0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    case 'star':
      return ring(10, (i) => (i % 2 === 0 ? 1 : 0.46));
    case 'hexagon':
      return ring(6, () => 0.9);
    case 'diamond':
      return [[0, 0.95], [0.7, 0], [0, -0.95], [-0.7, 0]];
    case 'plus': {
      const a = 0.3;
      const b = 0.9;
      return [[-a, b], [a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]];
    }
  }
}

/** The same symbol as an inline SVG string (white, for buttons). */
export function symbolSvg(kind: SymbolKind, size = 30): string {
  const pts = symbolPoints(kind)
    .map(([x, y]) => `${(x * 10).toFixed(2)},${(-y * 10).toFixed(2)}`)
    .join(' ');
  return `<svg viewBox="-12 -12 24 24" width="${size}" height="${size}" aria-hidden="true"><polygon points="${pts}" fill="#fff" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}
