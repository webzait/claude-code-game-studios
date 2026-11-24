/**
 * Garden board textures, painted once at start-up on a canvas. Nothing is loaded from a file, so
 * they add no bytes to the single-file build; every texture comes from a fixed seed and looks the
 * same on every run. Outside a browser (the unit tests) there is no canvas: every function then
 * returns null and the parts are drawn in their vertex colours alone.
 */
import * as THREE from 'three';
import G from '../../../../data/themes/garden/board.json';
import { roundedSquareDistance, seeded } from './layout';

const C = G.colors;
const cache = new Map<string, THREE.Texture | null>();

/** A '#RRGGBB' colour as its three 0-255 sRGB bytes, as a canvas stores them. */
function bytes(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** A canvas texture of `w` by `h` pixels painted by `paint`, made once per `key`. */
function painted(key: string, w: number, h: number, paint: Paint, repeat: boolean, color = true): THREE.Texture | null {
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
function wrapped(w: number, h: number, x: number, y: number, reach: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    if (x + dx < -reach || x + dx > w + reach || y + dy < -reach || y + dy > h + reach) continue;
    draw(x + dx, y + dy);
  }
}

/** Soft round patches of lighter and darker colour, for a mottled, hand-painted ground. */
function mottle(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, tones: readonly string[], alpha: number, repeat: boolean): void {
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
function fur(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, count: number, tones: readonly string[], alpha: number, length: number, repeat: boolean): void {
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

/** Shade towards `tone` near the edge of the tile's rounded square (the bevel and the side). */
function edgeShade(g: CanvasRenderingContext2D, n: number, tone: string, strength: number, band: number): void {
  const t = G.tile;
  const image = g.getImageData(0, 0, n, n);
  const target = bytes(tone);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = roundedSquareDistance((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5, 0.5, t.radius / t.body);
    const k = Math.min(1, Math.max(0, (d + band) / band)) ** 2 * strength;
    if (k <= 0) continue;
    const p = (j * n + i) * 4;
    for (let ch = 0; ch < 3; ch++) image.data[p + ch] += (target[ch] - image.data[p + ch]) * k;
  }
  g.putImageData(image, 0, 0);
}

/** A three- or four-leaf clover in silhouette, `size` across, for the faint pattern on the grass. */
function clover(g: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number, leaves: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(turn);
  const r = size * 0.27;
  for (let k = 0; k < leaves; k++) {
    g.save();
    g.rotate((k * Math.PI * 2) / leaves);
    // A heart: two round lobes and a point at the clover's centre.
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r * 1.3, -r * 0.4, -r * 1.25, -r * 2.05, -r * 0.45, -r * 2.05);
    g.bezierCurveTo(-r * 0.12, -r * 2.05, 0, -r * 1.75, 0, -r * 1.55);
    g.bezierCurveTo(0, -r * 1.75, r * 0.12, -r * 2.05, r * 0.45, -r * 2.05);
    g.bezierCurveTo(r * 1.25, -r * 2.05, r * 1.3, -r * 0.4, 0, 0);
    g.fill();
    g.restore();
  }
  g.restore();
}

/** Top of the grass tile: a bright lime lawn, mottled, with fine fur and a faint clover pattern (reference 02-tile-grass). */
export function grassTileTexture(): THREE.Texture | null {
  const t = G.tile;
  return painted('grass-tile', t.texture, t.texture, (g, n) => {
    const rand = seeded(t.seed);
    g.fillStyle = C.grassTop;
    g.fillRect(0, 0, n, n);
    mottle(g, n, n, rand, 46, [C.grassLight, C.grassDark, C.grassLight], 0.32, false);
    g.fillStyle = C.clover;
    g.globalAlpha = 0.32;
    // The clovers keep clear of the middle and of each other, as in the reference: a few, spread out.
    const spots = [[0.25, 0.22], [0.74, 0.17], [0.8, 0.5], [0.2, 0.62], [0.58, 0.8], [0.47, 0.42]];
    for (let i = 0; i < Math.min(t.clovers, spots.length); i++) {
      const [sx, sy] = spots[i];
      clover(g, (sx + (rand() - 0.5) * 0.05) * n, (sy + (rand() - 0.5) * 0.05) * n, n * (0.09 + rand() * 0.03), rand() * Math.PI, i % 3 === 0 ? 3 : 4);
    }
    g.globalAlpha = 1;
    fur(g, n, n, rand, Math.round(n * n * 0.05), [C.grassLight, C.grassDark, C.bladeTip], 0.4, n * 0.012, false);
    edgeShade(g, n, C.grassSide, 0.3, 0.07);
  }, false);
}

/** Top of the dirt tile: warm soil with soft patches, fine grains and a few pebbles (reference 13-sheet-tile-dirt). */
export function dirtTileTexture(): THREE.Texture | null {
  const d = G.dirt;
  return painted('dirt-tile', d.texture, d.texture, (g, n) => {
    const rand = seeded(d.seed);
    g.fillStyle = C.dirt;
    g.fillRect(0, 0, n, n);
    mottle(g, n, n, rand, 40, [C.dirtLight, C.dirtDark, C.dirtLight], 0.3, false);
    for (let i = 0; i < n * n * 0.012; i++) {
      g.fillStyle = rand() < 0.55 ? C.dirtDark : C.dirtLight;
      g.globalAlpha = 0.25 + rand() * 0.35;
      const s = 0.8 + rand() * 1.8;
      g.beginPath();
      g.ellipse(rand() * n, rand() * n, s, s * (0.6 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 22; i++) {
      const x = (0.12 + rand() * 0.76) * n;
      const y = (0.12 + rand() * 0.76) * n;
      const s = n * (0.008 + rand() * 0.01);
      g.globalAlpha = 0.7;
      g.fillStyle = C.dirtDark;
      g.beginPath();
      g.ellipse(x + s * 0.25, y + s * 0.3, s * 1.1, s * 0.8, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.dirtLight;
      g.beginPath();
      g.ellipse(x, y, s, s * 0.75, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    edgeShade(g, n, C.dirtDark, 0.6, 0.1);
  }, false);
}

/**
 * Grass blades standing in a row, on a transparent ground: the fur round a tile's edge. Blades
 * grow from the bottom of the picture (texture v = 0) to the top (v = 1); the picture repeats
 * sideways without a seam.
 */
export function bladeTexture(): THREE.Texture | null {
  return painted('blades', 1024, 256, (g, w, h) => {
    const rand = seeded(19);
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, C.blade);
    grad.addColorStop(0.55, C.grassTop);
    grad.addColorStop(1, C.bladeTip);
    g.fillStyle = grad;
    g.fillRect(0, h * 0.55, w, h * 0.45);
    for (let i = 0; i < 1400; i++) {
      const x = rand() * w;
      const tall = h * (0.5 + rand() * 0.5);
      const width = (2 + rand() * 3) * (w / 512);
      const lean = (rand() - 0.5) * 10 * (w / 512);
      const blade = (bx: number): void => {
        g.beginPath();
        g.moveTo(bx - width / 2, h);
        g.quadraticCurveTo(bx - width * 0.3 + lean * 0.3, h - tall * 0.55, bx + lean, h - tall);
        g.quadraticCurveTo(bx + width * 0.3 + lean * 0.3, h - tall * 0.55, bx + width / 2, h);
        g.closePath();
        g.fill();
      };
      g.fillStyle = grad;
      for (const dx of [-w, 0, w]) if (x + dx > -20 && x + dx < w + 20) blade(x + dx);
    }
    // Lighter and darker hairs over the top, as the light catches some blades and not others.
    for (let i = 0; i < 500; i++) {
      const x = rand() * w;
      const y = h * (0.35 + rand() * 0.6);
      g.strokeStyle = rand() < 0.5 ? C.bladeTip : C.grassDark;
      g.globalAlpha = 0.35;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 4, y - h * 0.15);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, true);
}

/** The grass bed between the tiles, seen from above: deeper green, dense short blades; repeats every `bedRepeat` cells. */
export function bedTexture(): THREE.Texture | null {
  const u = G.underlay;
  return painted('bed', u.texture, u.texture, (g, n) => {
    const rand = seeded(u.seed);
    g.fillStyle = C.bed;
    g.fillRect(0, 0, n, n);
    mottle(g, n, n, rand, 20, [C.bedLight, C.bedDark], 0.3, true);
    fur(g, n, n, rand, Math.round(n * n * 0.09), [C.bedDark, C.bedLight, C.bed, C.blade], 0.6, n * 0.03, true);
  }, true);
}

/**
 * Bark of the twigs: grain lines that run along the twig (texture u) with lighter streaks
 * between them; v runs once round the twig. Repeats both ways without a seam.
 */
export function barkTexture(): THREE.Texture | null {
  const r = G.rim;
  return painted('bark', r.texture, r.texture, (g, n) => {
    const rand = seeded(r.seed);
    const grad = g.createLinearGradient(0, 0, 0, n);
    grad.addColorStop(0, C.bark);
    grad.addColorStop(0.5, C.barkLight);
    grad.addColorStop(1, C.bark);
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
    g.lineCap = 'round';
    // Sizes below are drawn for a 256 px texture and scaled, so a larger texture is sharper, not finer.
    const k = n / 256;
    for (let i = 0; i < 46; i++) {
      const y = rand() * n;
      const amp = (1 + rand() * 4) * k;
      const waves = 1 + Math.floor(rand() * 3);
      const phase = rand() * Math.PI * 2;
      const dark = rand() < 0.6;
      g.strokeStyle = dark ? C.barkDark : C.barkLight;
      g.globalAlpha = dark ? 0.35 + rand() * 0.35 : 0.45 + rand() * 0.35;
      g.lineWidth = (dark ? 1.2 + rand() * 2.6 : 1 + rand() * 2) * k;
      // A grain line may stop part-way, as the grain does where two fibres meet.
      const from = rand() < 0.4 ? rand() * n : 0;
      const to = from > 0 ? from + n * (0.25 + rand() * 0.5) : n;
      for (const dy of [-n, 0, n]) {
        g.beginPath();
        for (let x = from; x <= to; x += 2 * k) {
          const yy = y + dy + Math.sin((x / n) * Math.PI * 2 * waves + phase) * amp;
          if (x === from) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
        if (to > n) {
          g.beginPath();
          for (let x = 0; x <= to - n; x += 2 * k) {
            const yy = y + dy + Math.sin(((x + n) / n) * Math.PI * 2 * waves + phase) * amp;
            if (x === 0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
          }
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
  }, true);
}

/**
 * The glow round a highlighted tile: a bright yellow-green line on the tile's outline, fading
 * outward over `reach` and a little inward, on a square `body + 2 * reach` cells wide.
 */
export function glowTexture(): THREE.Texture | null {
  const t = G.tile;
  const w = G.glow;
  return painted('glow', 512, 512, (g, n) => {
    const span = t.body + 2 * w.reach;
    const image = g.createImageData(n, n);
    const core = bytes(C.glowCore);
    const glow = bytes(C.glow);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * span;
      const y = ((j + 0.5) / n - 0.5) * span;
      const d = roundedSquareDistance(x, y, t.body / 2, t.radius);
      const line = Math.max(0, 1 - Math.abs(d) / w.line) ** 1.5;
      const out = d > 0 ? Math.max(0, 1 - d / w.reach) ** 2 : 0;
      const inside = d <= 0 ? Math.max(0, 1 - -d / w.inner) ** 2 : 0;
      const a = Math.min(1, line + out * 0.75 + inside * 0.55);
      const k = line * 0.8;
      image.data.set([0, 1, 2].map((ch) => glow[ch] + (core[ch] - glow[ch]) * k).concat(a * 255), (j * n + i) * 4);
    }
    g.putImageData(image, 0, 0);
  }, false);
}
