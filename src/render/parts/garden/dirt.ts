/**
 * Garden board: the dirt tile (`buildDirtTile`), a new tile type the game has no rule for yet.
 * Reference: `13-sheet-tile-dirt`. Notes and proposals: `design/themes/garden-board-dirt.md`.
 *
 * The default tile is the owner's own picture: `assets/turnflock/garden/board/dirt/dirt-tile.webp`,
 * cut out of `13-sheet-tile-dirt` by `cut.py` next to it. One texture holds the tile's top (the
 * soil floor in its frame of clay blocks, with grass over the near corners) and the band of its
 * front wall; the tile is a plain rounded block with that picture on its top and round its side.
 * Sizes: `picture` in `data/themes/garden/dirt.json`.
 *
 * The earlier tile modelled in code (clay blocks, painted soil, grass tufts) stays available as
 * `buildDirtTile(alt, pegs, 'modelled')` and `buildDirtTileModelled`; sizes: `dirt` in the same file.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import DIRT from '../../../../data/themes/garden/dirt.json';
import dirtPictureUrl from '../../../../assets/turnflock/garden/board/dirt/dirt-tile.webp';
import { loftBody, Mesher, mergeAll, once, outline, plainMaterial, shade, shadowed, type Ring } from './geometry';
import { edgeShade, mottle, painted } from './paint';
import { seeded } from './layout';
import { addPegs, altTint, furBand, furMesh } from './grass';

const T = TILE.tile;
const P = DIRT.picture;
const G = { tile: T, dirt: DIRT.dirt, colors: DIRT.colors };
const C = DIRT.colors;

/** Where the two parts of the picture sit in the atlas, as texture v (1 = the picture's top row). */
export const dirtAtlas = (() => {
  const a = P.atlas;
  const h = a.top + a.pad + a.band;
  return { top: { v0: 1, v1: 1 - a.top / h }, band: { v0: 1 - (a.top + a.pad) / h, v1: 0 }, height: h, width: a.width };
})();

/**
 * The picture's material. Until the picture has loaded (a moment after start-up) the tile shows
 * in a plain soil colour; `dirtTileReady` settles once the picture is on. Outside a browser (the
 * unit tests) it stays plain.
 */
export const dirtMaterial = new THREE.MeshStandardMaterial({ color: P.fallback, vertexColors: true, roughness: 0.95 });

/** Settles when the dirt tile's picture is loaded and on its material (at once outside a browser). */
export const dirtTileReady: Promise<void> = typeof document === 'undefined'
  ? Promise.resolve()
  : new Promise<void>((resolve) => {
    new THREE.TextureLoader().load(dirtPictureUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      dirtMaterial.map = texture;
      dirtMaterial.color.set('#FFFFFF').multiplyScalar(P.brightness);
      dirtMaterial.needsUpdate = true;
      resolve();
    }, undefined, () => resolve());
  });

/**
 * The picture tile's block: a rounded square `tile.body` wide and `tile.height` tall. Its top
 * shows the top of the picture, stretched over the square (x left to right, the far side at the
 * picture's top); its side shows the band of the front wall, unrolled round the outline so the
 * band runs on without a jump at every corner. `mirror` flips the picture left to right (the
 * checkerboard's second tile), keeping the grass on the near side.
 */
export function dirtBlock(mirror: boolean, tint: string): THREE.BufferGeometry {
  const m = new Mesher();
  const w = T.body;
  const r = P.corner * w;
  const color = shade(1, tint);
  const { top, band } = dirtAtlas;
  const flip = (u: number): number => (mirror ? 1 - u : u);
  const ring = outline(w, w, r, 0, P.cornerSteps * 2).slice(0, -1);
  // Top: a fan from the centre.
  const topUv = (x: number, z: number): [number, number] => [flip(x / w + 0.5), top.v0 + (z / w + 0.5) * (top.v1 - top.v0)];
  const [cu, cv] = topUv(0, 0);
  const centre = m.vertex(new THREE.Vector3(0, T.height, 0), new THREE.Vector3(0, 1, 0), cu, cv, color);
  const rim = ring.map((p) => {
    const [u, v] = topUv(p.x, p.z);
    return m.vertex(new THREE.Vector3(p.x, T.height, p.z), new THREE.Vector3(0, 1, 0), u, v, color);
  });
  for (let j = 0; j < rim.length; j++) m.index.push(centre, rim[(j + 1) % rim.length], rim[j]);
  // Side: u runs along the near wall left to right, on up the right wall, back along the far wall
  // and down the left wall, mirrored on every other wall so it meets itself at each corner.
  const wallU = (x: number, z: number, nx: number, nz: number): number => {
    const ux = x / w + 0.5;
    const uz = z / w + 0.5;
    if (nz >= Math.abs(nx)) return flip(ux);
    if (nx >= Math.abs(nz)) return flip(uz);
    if (-nz >= Math.abs(nx)) return flip(1 - ux);
    return flip(1 - uz);
  };
  // A thin rounded lip at the top edge, then the straight wall down to the floor.
  const heights: [number, number, number][] = [[T.height, 0.55, band.v0], [T.height - P.wallTop, 1, band.v0 + (band.v1 - band.v0) * (P.wallTop / T.height)], [0, 1, band.v1]];
  const rows = heights.map(([y, out, v]) => ring.map((p) => m.vertex(
    new THREE.Vector3(p.x, y, p.z),
    new THREE.Vector3(p.nx * out, out < 1 ? 0.8 : 0, p.nz * out).normalize(),
    wallU(p.x, p.z, p.nx, p.nz), v, color)));
  m.grid(rows.map((row) => [...row, row[0]]), true);
  return m.build();
}

/**
 * 1c. Dirt tile: the owner's picture `13-sheet-tile-dirt` on a plain rounded block: an earthen
 * floor in a frame of terracotta blocks, grass over the near corners. Same size and height as the
 * grass tile. `alt` is the checkerboard's second tile: a touch darker and mirrored left to right.
 * `style: 'modelled'` gives the earlier tile modelled in code instead (`buildDirtTileModelled`).
 * A new tile type: the game has no rule for it yet (see `design/themes/garden-board-dirt.md`).
 */
export function buildDirtTile(alt = false, pegs = true, style: 'picture' | 'modelled' = 'picture'): THREE.Group {
  if (style === 'modelled') return buildDirtTileModelled(alt, pegs);
  const tint = alt ? `#${new THREE.Color('#FFFFFF').multiplyScalar(P.altShade).getHexString()}` : '#FFFFFF';
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(once(`dirt-picture-${alt ? 'alt' : 'main'}`, () => dirtBlock(alt, tint)), dirtMaterial));
  if (pegs) addPegs(tile, plainMaterial);
  return shadowed(tile);
}

// ---------------------------------------------------------------------------------------------
// The earlier dirt tile, modelled in code. Kept as a choice; not the default.

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
    edgeShade(g, n, C.dirtDark, 0.6, 0.1, T.radius / T.body);
  }, false);
}

let modelled: THREE.MeshStandardMaterial | null = null;

/** The modelled dirt tile's soil material, painted the first time it is asked for. */
export function dirtModelledMaterial(): THREE.MeshStandardMaterial {
  modelled ??= new THREE.MeshStandardMaterial({ map: dirtTileTexture(), vertexColors: true, roughness: 0.95 });
  return modelled;
}

/** A small clump of crossed blade cards, `size` tall, for the grass that grows round the dirt tile. */
export function tuft(size: number): THREE.BufferGeometry {
  const m = new Mesher();
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI) / 5;
    const dx = Math.cos(a) * size * 0.5;
    const dz = Math.sin(a) * size * 0.5;
    const u0 = k * 0.13;
    const rows = [0, 1].map((v) => [-1, 1].map((s) => m.vertex(new THREE.Vector3(s * dx, v * size, s * dz), new THREE.Vector3(0, 1, 0), u0 + (s + 1) * 0.11, v, shade(0.75 + 0.3 * v))));
    m.grid(rows);
  }
  return m.build();
}

/** A small rounded clay block `w` by `d`, from `y0` up to `y1`, its edges rounded over by `round`. */
export function clayBlock(w: number, d: number, y0: number, y1: number, round: number, corner: number): THREE.BufferGeometry {
  const clay = new THREE.Color(G.colors.clay);
  const light = new THREE.Color(G.colors.clayLight);
  const dark = new THREE.Color(G.colors.clayDark);
  const rings: Ring[] = [
    { inset: 0, y: y0, out: 1, up: 0, color: dark },
    { inset: 0, y: y1 - round, out: 1, up: 0, color: clay.clone().lerp(dark, 0.4) },
  ];
  for (let k = 1; k <= 3; k++) {
    const a = (k / 3) * (Math.PI / 2);
    rings.push({ inset: round * (1 - Math.cos(a)), y: y1 - round + round * Math.sin(a), out: Math.cos(a), up: Math.sin(a), color: clay.clone().lerp(light, Math.sin(a) * 0.6) });
  }
  return loftBody(w, corner, rings, 2, false, d);
}

/**
 * The earlier dirt tile, modelled in code: a bed of warm, bare soil with fine grains and pebbles, sunk a little into a
 * frame of rounded clay blocks (three along each side and one on each corner), with short grass
 * round its foot and tufts growing over its near edge (reference `13-sheet-tile-dirt`). A new
 * tile type: the game has no rule for it yet. Not the default: `buildDirtTile` shows the owner's picture.
 */
export function buildDirtTileModelled(alt = false, pegs = true): THREE.Group {
  const dirtMaterial = dirtModelledMaterial();
  const d = G.dirt;
  const tint = alt ? altTint() : '#FFFFFF';
  const key = alt ? 'alt' : 'main';
  const floor = T.height - d.recess;
  const tile = new THREE.Group();
  // The body, its top the soil floor.
  tile.add(new THREE.Mesh(once(`dirt-${key}`, () => loftBody(T.body, d.radius, [
    { inset: 0, y: 0, out: 1, up: 0, color: shade(0.6, tint) },
    { inset: 0, y: floor - 0.01, out: 1, up: 0, color: shade(0.8, tint) },
    { inset: 0.01, y: floor, out: 0.3, up: 1, color: shade(0.85, tint) },
  ], T.cornerSteps, alt)), dirtMaterial));
  // The clay frame, made once as one geometry.
  tile.add(new THREE.Mesh(once('dirt-frame', () => {
    const blocks: THREE.BufferGeometry[] = [];
    const half = T.body / 2;
    const f = d.frame;
    const g = d.blockGap;
    const run = T.body - 2 * f;
    const len = (run - (d.perSide + 1) * g) / d.perSide;
    const at = half - f / 2;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const b = clayBlock(f - g, f - g, floor - 0.02, T.height, d.blockRound, d.cornerRound);
      b.translate(sx * (at - g / 4), 0, sz * (at - g / 4));
      blocks.push(b);
    }
    for (let k = 0; k < d.perSide; k++) {
      const c = -run / 2 + g + len / 2 + k * (len + g);
      for (const s of [1, -1]) {
        const x = clayBlock(len, f - g, floor - 0.02, T.height, d.blockRound, d.blockRound * 1.2);
        x.translate(c, 0, s * at);
        const z = clayBlock(f - g, len, floor - 0.02, T.height, d.blockRound, d.blockRound * 1.2);
        z.translate(s * at, 0, c);
        blocks.push(x, z);
      }
    }
    return mergeAll(blocks);
  }), plainMaterial));
  tile.add(furMesh(once('dirt-fringe', () => furBand(T.body, d.radius, [
    { inset: 0.01, y: 0, v: 0, tone: 0.8 },
    { inset: -d.fringe.reach, y: d.fringe.height, v: 1, tone: 1 },
  ], d.fringe.blade, T.cornerSteps))));
  const clump = once('dirt-tuft', () => tuft(d.tuftSize));
  // Tufts at fixed places: grass climbing over the near edge and its two corners, as in the reference.
  const spots: [number, number, number][] = [[-0.42, 0.42, 1.2], [0.42, 0.42, 1.1], [-0.1, 0.47, 0.9], [0.18, 0.47, 0.8], [-0.47, 0.15, 0.85]];
  for (const [x, z, k] of spots.slice(0, d.tufts)) {
    const mesh = furMesh(clump);
    mesh.position.set(x * T.body, 0.02, z * T.body);
    mesh.scale.set(1, k * 1.25, 1);
    mesh.rotation.y = x * 3 + z;
    tile.add(mesh);
  }
  if (pegs) addPegs(tile, dirtMaterial);
  return shadowed(tile);
}
