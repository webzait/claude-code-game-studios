/**
 * Garden board: the underlay (`buildUnderlay`), a plate tucked under the braid whose top is the grass
 * bed between the tiles. Sizes and colours: `data/themes/garden/underlay.json`. Reference: `01-board-full`.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import UNDER from '../../../../data/themes/garden/underlay.json';
import { Mesher, once, outlineRect, plainMaterial, shadowed } from './geometry';
import { fur, mottle, painted } from './paint';
import { boardFootprint, seeded } from './layout';
import { imageTexture } from './rim';
import bedUrl from '../../../../assets/turnflock/garden/board/rim/bed.webp';

const T = TILE.tile;
const G = { underlay: UNDER.underlay };
const C = UNDER.colors;

/** The grass bed between the tiles, seen from above: deeper green, dense short blades; repeats every `bedRepeat` cells. */
export function bedTexture(): THREE.Texture | null {
  const u = G.underlay;
  return painted('bed', u.texture, u.texture, (g, n) => {
    const rand = seeded(u.seed);
    g.fillStyle = C.bed;
    g.fillRect(0, 0, n, n);
    mottle(g, n, n, rand, 20, [C.bedLight, C.bedDark], 0.3, true);
    fur(g, n, n, rand, Math.round(n * n * 0.09), [C.bedDark, C.bedLight, C.bed, TILE.colors.blade], 0.6, n * 0.03, true);
  }, true);
}

const bed = imageTexture(bedUrl, true);

/** Settles once the grass bed picture (`bed.webp`, cut from `01-board-full`) has loaded. */
export const bedReady: Promise<void> = bed.ready;

/**
 * The grass bed's material: a repeating patch cut from `01-board-full` (`bed.webp`). Outside a
 * browser, or before it loads in the tests, the painted bed (`bedTexture`) stands in.
 */
export const bedMaterial = new THREE.MeshStandardMaterial({ map: bed.texture ?? bedTexture(), roughness: 0.95, color: new THREE.Color(1, 1, 1).multiplyScalar(G.underlay.bedTone) });

/**
 * Underlay: one plate under the whole board, `lip` wider than the rim all round, its top the
 * grass bed at y = 0 that shows between the tiles (a deeper green, dense short blades), its sides
 * dark soil. `pegs` adds one socket per tile, as on the robot underlay (hidden in the game).
 */
export function buildUnderlay(cols: number, rows: number, gap: number, pegs = false): THREE.Group {
  const u = G.underlay;
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const w = outerW + 2 * u.lip;
  const d = outerD + 2 * u.lip;
  // Its corners follow the braid's outside, so no bed shows past the twigs.
  const radius = Math.min(u.cornerRadius, Math.min(w, d) / 2);
  const plate = new THREE.Group();

  // The bed: a flat top textured in world units, so the blades are the same size on every board.
  const bed = new THREE.ShapeGeometry(roundedShape(w, d, radius, 8));
  bed.rotateX(-Math.PI / 2);
  const pos = bed.getAttribute('position');
  const uv = bed.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / u.bedRepeat, -pos.getZ(i) / u.bedRepeat);
  plate.add(new THREE.Mesh(bed, bedMaterial));

  // The sides: dark soil, a rounded shoulder at the top and a chamfer underneath.
  const soil = new THREE.Color(C.soil);
  const deep = new THREE.Color(C.soilDark);
  const m = new Mesher();
  const ringsOf: { inset: number; y: number; out: number; up: number; c: THREE.Color }[] = [
    { inset: 0.03, y: -u.height, out: 0.5, up: -1, c: deep },
    { inset: 0, y: -u.height + 0.03, out: 1, up: -0.3, c: deep },
    { inset: 0, y: -0.025, out: 1, up: 0.2, c: soil },
    { inset: 0.012, y: -0.004, out: 0.6, up: 1, c: soil.clone().lerp(new THREE.Color(C.bedDark), 0.5) },
    { inset: 0.02, y: 0, out: 0, up: 1, c: new THREE.Color(C.bedDark) },
  ];
  const sideRows = ringsOf.map((ring) => {
    const len = Math.hypot(ring.out, ring.up);
    return outlineRect(w, d, radius, ring.inset, 8).map((p) => m.vertex(new THREE.Vector3(p.x, ring.y, p.z), new THREE.Vector3((p.nx * ring.out) / len, ring.up / len, (p.nz * ring.out) / len), 0, 0, ring.c));
  });
  m.grid(sideRows, true);
  plate.add(new THREE.Mesh(m.build(), plainMaterial));

  if (pegs) {
    const socket = once('garden-socket', () => {
      const g = new THREE.BoxGeometry(0.16, 0.04, 0.16);
      const count = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [soil.r, soil.g, soil.b]).flat(), 3));
      return g;
    });
    const pitch = T.size + gap;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      const mesh = new THREE.Mesh(socket, plainMaterial);
      mesh.position.set((x - (cols - 1) / 2) * pitch, -0.02, (z - (rows - 1) / 2) * pitch);
      plate.add(mesh);
    }
  }
  shadowed(plate);
  return plate;
}

/** A rounded rectangle `w` by `d` as a flat shape (x, y), for the bed. */
export function roundedShape(w: number, d: number, r: number, steps: number): THREE.Shape {
  const points = outlineRect(w, d, r, 0, steps).slice(0, -1).map((p) => new THREE.Vector2(p.x, -p.z));
  return new THREE.Shape(points);
}
