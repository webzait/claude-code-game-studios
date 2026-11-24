/**
 * Garden board: the glowing tile (`buildHighlightTile`) and its glow (`buildTileGlow`), for the hint,
 * and `hintGlowCells`, which cells the hint lights. Sizes, colours and the glow's profile:
 * `data/themes/garden/highlight.json`. Reference: `12-sheet-tile-highlight`. Design:
 * `design/themes/garden-board-highlight.md`.
 *
 * Two looks of the glow (`GlowStyle`): 'picture', the default (`glow.style`), is the glow rim cut
 * out of the owner's picture (`assets/turnflock/garden/board/highlight/glow-rim.webp`, made by
 * `cutout.py` there); 'painted' is the same glow painted in code from the profile measured from
 * that picture (`glow.profile`).
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import HL from '../../../../data/themes/garden/highlight.json';
import { bytes, painted } from './paint';
import { roundedSquareDistance } from './layout';
import { buildFloorTile } from './grass';
import glowPictureUrl from '../../../../assets/turnflock/garden/board/highlight/glow-rim.webp';

const T = TILE.tile;
const W = HL.glow;

/** One stop of the glow's profile: distance to the tile outline in cells (negative inside), colour, opacity. */
type Stop = readonly [number, string, number];
const PROFILE = W.profile as unknown as readonly Stop[];

/**
 * The glow at distance `d` (cells) from the tile's outline, negative inside: sRGB bytes and an
 * opacity 0–1, interpolated linearly between the stops of `glow.profile` (measured from
 * `12-sheet-tile-highlight`). Nothing beyond the first and last stop.
 */
export function glowAt(d: number): { rgb: [number, number, number]; alpha: number } {
  const first = PROFILE[0];
  const last = PROFILE[PROFILE.length - 1];
  if (d <= first[0]) return { rgb: bytes(first[1]), alpha: first[2] };
  if (d >= last[0]) return { rgb: bytes(last[1]), alpha: last[2] };
  let i = 0;
  while (PROFILE[i + 1][0] < d) i++;
  const [d0, c0, a0] = PROFILE[i];
  const [d1, c1, a1] = PROFILE[i + 1];
  const k = (d - d0) / (d1 - d0);
  const p = bytes(c0);
  const q = bytes(c1);
  return { rgb: [0, 1, 2].map((ch) => p[ch] + (q[ch] - p[ch]) * k) as [number, number, number], alpha: a0 + (a1 - a0) * k };
}

/**
 * The glow texture: a square `body + 2 * reach` cells wide, `glow.texture` pixels, painted from
 * `glow.profile` along the grass tile's own outline (`tile.body`, `tile.radius`), so the line
 * always sits exactly on the tile's edge. Transparent where there is no glow.
 */
export function glowTexture(): THREE.Texture | null {
  return painted('glow', W.texture, W.texture, (g, n) => {
    const span = T.body + 2 * W.reach;
    const image = g.createImageData(n, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n - 0.5) * span;
      const y = ((j + 0.5) / n - 0.5) * span;
      const { rgb, alpha } = glowAt(roundedSquareDistance(x, y, T.body / 2, T.radius));
      image.data.set([...rgb, alpha * 255], (j * n + i) * 4);
    }
    g.putImageData(image, 0, 0);
  }, false);
}

/** The look of a glow: the owner's picture cut out ('picture'), or painted in code ('painted'). */
export type GlowStyle = 'picture' | 'painted';

/** Glow materials of the 'picture' style made before the picture had loaded: they get it when it has. */
const waiting: THREE.MeshBasicMaterial[] = [];
let picture: THREE.Texture | null = null;
let pictureLoaded = false;

/**
 * Resolves when the glow picture has loaded (at once outside a browser, where there is none).
 * A glow made before then shows the painted glow, and switches to the picture when it is in.
 */
export const glowPictureReady: Promise<void> = typeof document === 'undefined'
  ? Promise.resolve()
  : new Promise((resolve) => {
    picture = new THREE.TextureLoader().load(glowPictureUrl, () => {
      pictureLoaded = true;
      for (const m of waiting.splice(0)) {
        m.map = picture;
        m.needsUpdate = true;
      }
      resolve();
    }, undefined, () => resolve());
    picture.colorSpace = THREE.SRGBColorSpace;
    picture.anisotropy = 8;
    picture.wrapS = picture.wrapT = THREE.ClampToEdgeWrapping;
  });

/** The glow picture's address (an inlined data URL in the single-file build). */
export const glowPictureSource: string = glowPictureUrl;

/**
 * Opacity of a pulsing glow `seconds` after it lit: a smooth swing from `glow.pulse.high` down to
 * `glow.pulse.low` and back, one cycle per `glow.pulse.seconds`. The game sets
 * `glow.material.opacity = glowPulse(t)` each frame.
 */
export function glowPulse(seconds: number): number {
  const p = W.pulse;
  const k = 0.5 + 0.5 * Math.cos((2 * Math.PI * seconds) / p.seconds);
  return p.low + (p.high - p.low) * k;
}

/**
 * The glow round a highlighted cell (reference `12-sheet-tile-highlight`): a flat patch of light
 * `body + 2 * glow.reach` cells wide, lying just above a tile's top: a cream line on the tile's
 * outline with a yellow halo outside and a yellow glow fading inward. `style` 'picture' (the
 * default, `glow.style`) shows the rim cut out of the owner's picture; 'painted' paints it from
 * `glow.profile`. Normal blending, so it reads on light and dark grass alike. It has a material
 * of its own so the game can pulse it (`glowPulse`). Light, not body: it does not count towards
 * a tile's measured size. Outside a browser there is no texture and the patch is plain colour.
 */
export function buildTileGlow(style: GlowStyle = W.style as GlowStyle): THREE.Mesh {
  const span = T.body + 2 * W.reach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  const half = T.body / 2;
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half));
  const painted = glowTexture();
  const material = new THREE.MeshBasicMaterial({
    map: style === 'picture' && pictureLoaded ? picture : painted,
    color: painted ? '#FFFFFF' : PROFILE[PROFILE.length - 2][1], transparent: true, opacity: W.pulse.high,
    depthWrite: false, toneMapped: false,
  });
  if (style === 'picture' && !pictureLoaded && picture) waiting.push(material);
  const glow = new THREE.Mesh(light, material);
  glow.name = 'tile-glow';
  glow.userData.style = style;
  glow.position.y = T.height + W.lift;
  glow.renderOrder = 2;
  return glow;
}

/**
 * 1b. Highlighted grass tile: the ordinary grass tile (`buildFloorTile`, light or dark) with the
 * glow of `buildTileGlow(style)` on it, at `userData.glow`. As in the reference, the tile itself
 * is not recoloured: the inner glow makes its edge yellow. For the hint: in the garden the hint
 * lights the cells the flock will step onto (see `hintGlowCells`), in place of the robot arrows.
 */
export function buildHighlightTile(alt = false, pegs = true, style: GlowStyle = W.style as GlowStyle): THREE.Group {
  const tile = buildFloorTile(alt, pegs);
  const glow = buildTileGlow(style);
  tile.add(glow);
  tile.userData.glow = glow;
  return tile;
}

/** What the garden hint needs from one engine event (see `RobotEvent`). */
export interface HintStep {
  readonly toX: number;
  readonly toY: number;
  readonly outcome: string;
}

/**
 * The cells the garden hint lights up for one hinted command: every cell a chick will step
 * onto (or leave the board through, for an exit). A chick that is blocked or only turns stays
 * where it is, so its cell is not lit: the hint shows where the flock goes. Each cell once, as
 * `y * width + x`, in order of first appearance.
 */
export function hintGlowCells(events: readonly HintStep[], width: number): number[] {
  const cells: number[] = [];
  for (const e of events) {
    if (e.outcome !== 'moved' && e.outcome !== 'exited') continue;
    const cell = e.toY * width + e.toX;
    if (!cells.includes(cell)) cells.push(cell);
  }
  return cells;
}
