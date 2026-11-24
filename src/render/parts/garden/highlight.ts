/**
 * Garden board: the glowing tile (`buildHighlightTile`) and its glow (`buildTileGlow`), for the hint,
 * and `hintGlowCells`, which cells the hint lights. Sizes, colours and the glow's profile:
 * `data/themes/garden/highlight.json`. Reference: `12-sheet-tile-highlight`. Design:
 * `design/themes/garden-highlight.md`.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import HL from '../../../../data/themes/garden/highlight.json';
import { bytes, painted } from './paint';
import { roundedSquareDistance } from './layout';
import { buildFloorTile } from './grass';

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
 * lying just above a tile's top, a cream line on the tile's outline with a yellow halo outside
 * and a yellow glow fading inward. Normal (not additive) blending, so it reads on light and dark
 * grass alike. It has a material of its own so the game can pulse it (`glowPulse`). Light, not
 * body: it does not count towards a tile's measured size. `map` replaces the painted glow (the
 * parts page uses it to compare the cut-out picture); outside a browser there is no texture and
 * the patch is plain glow-coloured.
 */
export function buildTileGlow(map: THREE.Texture | null = glowTexture()): THREE.Mesh {
  const span = T.body + 2 * W.reach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  const half = T.body / 2;
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({
    map, color: map ? '#FFFFFF' : PROFILE[PROFILE.length - 2][1], transparent: true, opacity: W.pulse.high,
    depthWrite: false, toneMapped: false,
  }));
  glow.name = 'tile-glow';
  glow.position.y = T.height + W.lift;
  glow.renderOrder = 2;
  return glow;
}

/**
 * 1b. Highlighted grass tile: the ordinary grass tile (`buildFloorTile`, light or dark) with the
 * glow of `buildTileGlow` on it, at `userData.glow`. As in the reference, the tile itself is not
 * recoloured: the inner glow makes its edge yellow. For the hint: in the garden the hint lights
 * the cells the flock will step onto (see `hintGlowCells`), in place of the robot theme's arrows.
 */
export function buildHighlightTile(alt = false, pegs = true): THREE.Group {
  const tile = buildFloorTile(alt, pegs);
  const glow = buildTileGlow();
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
