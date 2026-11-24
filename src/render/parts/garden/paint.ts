/**
 * Garden board: helpers for the textures, painted once at start-up on a canvas. Nothing is loaded
 * from a file, so they add no bytes to the single-file build; every texture comes from a fixed seed
 * and looks the same on every run. Outside a browser (the unit tests) there is no canvas: `painted`
 * then returns null and the parts are drawn in their vertex colours alone.
 */
import * as THREE from 'three';
import { roundedSquareDistance } from './layout';

export const cache = new Map<string, THREE.Texture | null>();

/** A '#RRGGBB' colour as its three 0-255 sRGB bytes, as a canvas stores them. */
export function bytes(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A canvas texture of `w` by `h` pixels painted by `paint`, made once per `key`. */
export function painted(key: string, w: number, h: number, paint: Paint, repeat: boolean, color = true): THREE.Texture | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  if (typeof document === 'undefined') {
    cache.set(key, null);
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) {
    cache.set(key, null);
    return null;
  }
  paint(g, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  cache.set(key, texture);
  return texture;
}

/** Draw `draw` at (x, y) and again shifted by the canvas size, so a repeating texture has no seam. */
export function wrapped(w: number, h: number, x: number, y: number, reach: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    if (x + dx < -reach || x + dx > w + reach || y + dy < -reach || y + dy > h + reach) continue;
    draw(x + dx, y + dy);
  }
}

/** Soft round patches of lighter and darker colour, for a mottled, hand-painted ground. */
export function mottle(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, tones: readonly string[], alpha: number, repeat: boolean): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const radius = (0.05 + rand() * 0.13) * w;
    const rgb = bytes(tones[i % tones.length]).join(',');
    const a = alpha * (0.5 + rand() * 0.5);
    const blob = (cx: number, cy: number): void => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${rgb},${a})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    };
    if (repeat) wrapped(w, h, x, y, radius, blob);
    else blob(x, y);
  }
}

/** Many short, thin strokes leaning one way: the fine fur of a lawn seen from above. */
export function fur(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, tones: readonly string[], alpha: number, length: number, repeat: boolean): void {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const angle = -1.1 + (rand() - 0.5) * 1.4;
    const l = length * (0.5 + rand());
    g.strokeStyle = tones[i % tones.length];
    g.globalAlpha = alpha * (0.4 + rand() * 0.6);
    g.lineWidth = 0.8 + rand() * 0.9;
    const stroke = (sx: number, sy: number): void => {
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + Math.cos(angle) * l * 0.5 + 1, sy + Math.sin(angle) * l * 0.5, sx + Math.cos(angle) * l, sy + Math.sin(angle) * l);
      g.stroke();
    };
    if (repeat) wrapped(w, h, x, y, l, stroke);
    else stroke(x, y);
  }
  g.globalAlpha = 1;
}

/** Shade towards `tone` near the edge of a tile's rounded square (the bevel and the side); `round` is its corner radius as a share of its side. */
export function edgeShade(g: CanvasRenderingContext2D, n: number, tone: string, strength: number, band: number, round: number): void {
  const image = g.getImageData(0, 0, n, n);
  const target = bytes(tone);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = roundedSquareDistance((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5, 0.5, round);
    const k = Math.min(1, Math.max(0, (d + band) / band)) ** 2 * strength;
    if (k <= 0) continue;
    const p = (j * n + i) * 4;
    for (let ch = 0; ch < 3; ch++) image.data[p + ch] += (target[ch] - image.data[p + ch]) * k;
  }
  g.putImageData(image, 0, 0);
}
