/**
 * Garden board: the glowing tile (`buildHighlightTile`) and its glow (`buildTileGlow`), for the hint,
 * and `hintGlowCells`, which cells the hint lights. Sizes and colours: `data/themes/garden/highlight.json`.
 * Reference: `12-sheet-tile-highlight`.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import HL from '../../../../data/themes/garden/highlight.json';
import { loftBody, once, shadowed } from './geometry';
import { bytes, painted } from './paint';
import { roundedSquareDistance } from './layout';
import { addPegs, bodyRings, furMesh, grassMaterial, tileFur } from './grass';

const T = TILE.tile;
const G = { tile: T, glow: HL.glow };
const C = HL.colors;

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

/**
 * The glow round a highlighted cell: a flat patch of light lying just above a tile, a bright
 * yellow-green line on the tile's outline fading out over `glow.reach` (reference
 * `12-sheet-tile-highlight`). It has a material of its own so the game can pulse it: swing its
 * `material.opacity` between `glow.pulse.low` and `glow.pulse.high`, one cycle per
 * `glow.pulse.seconds`. Light, not body: it does not count towards a tile's measured size.
 */
export function buildTileGlow(): THREE.Mesh {
  const w = G.glow;
  const span = T.body + 2 * w.reach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  const half = T.body / 2;
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({
    map: glowTexture(), color: glowTexture() ? '#FFFFFF' : C.glow, transparent: true, opacity: w.pulse.high,
    depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
  }));
  glow.name = 'tile-glow';
  glow.position.y = T.height + w.lift;
  glow.renderOrder = 2;
  return glow;
}

/**
 * 1b. Highlighted grass tile: the grass tile, its top a little brighter and more yellow, with the
 * glowing outline of `buildTileGlow` on it (at `userData.glow`). For the hint: in the garden the
 * hint lights the cells the flock will step onto (see `hintGlowCells`), in place of the robot
 * theme's arrows. A plain tile can also be lit by laying `buildTileGlow()` on it.
 */
export function buildHighlightTile(alt = false, pegs = true): THREE.Group {
  const tint = `#${new THREE.Color(C.highlightTop).lerp(new THREE.Color('#FFFFFF'), 0.35).multiplyScalar(1 + G.glow.brighten).getHexString()}`;
  const key = alt ? 'lit-alt' : 'lit';
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(once(`grass-${key}`, () => loftBody(T.body, T.radius, bodyRings(0.6, 0.85, 1.05, tint), T.cornerSteps, alt)), grassMaterial));
  for (const g of tileFur(key, tint)) tile.add(furMesh(g));
  if (pegs) addPegs(tile, grassMaterial);
  shadowed(tile);
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
