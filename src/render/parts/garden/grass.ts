/**
 * Garden board: the grass tile (`buildFloorTile`), and the grass fur and tile body that the glowing
 * and dirt tiles and the rim's inner grass reuse. Sizes and colours: `data/themes/garden/tile.json`.
 * Reference: `02-tile-grass`, `11-sheet-tile-grass`.
 *
 * The grass tile is the owner's own picture: `02-tile-grass` cut out into one texture atlas
 * (`assets/turnflock/garden/board/tile/grass-tile.webp`, made by `cut.py` next to it), laid on a
 * thin body. The older tile modelled in code is kept as `buildFloorTileCode`; its fur and body
 * helpers stay here because the other garden parts use them.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import UNDER from '../../../../data/themes/garden/underlay.json';
import grassTileUrl from '../../../../assets/turnflock/garden/board/tile/grass-tile.webp';
import { loftBody, Mesher, once, outline, plainMaterial, shade, shadowed, type Ring } from './geometry';
import { edgeShade, fur, mottle, painted } from './paint';
import { seeded } from './layout';

const T = TILE.tile;
const C = TILE.colors;

/** A three- or four-leaf clover in silhouette, `size` across, for the faint pattern on the grass. */
export function clover(g: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number, leaves: number): void {
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
  const t = T;
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
    edgeShade(g, n, C.grassSide, 0.3, 0.07, T.radius / T.body);
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

/** The grass tile's material: the lawn texture times the vertex colours (tone and the dark checkerboard tint). */
export const grassMaterial = new THREE.MeshStandardMaterial({ map: grassTileTexture(), vertexColors: true, roughness: 0.9 });

/** The material of every band of grass blades (tile fur, dirt fringe, rim grass). */
export const furMaterial = new THREE.MeshStandardMaterial({ map: bladeTexture(), vertexColors: true, roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide });

/** Shadows of the fur follow its blades, not its square cards. */
export const furDepth = new THREE.MeshDepthMaterial({ map: furMaterial.map, alphaTest: 0.5, side: THREE.DoubleSide });

/** Rings of a tile body: straight sides, then a quarter round over the bevel to the flat top. Colours are brightness. */
export function bodyRings(bottom: number, side: number, top: number, tint = '#FFFFFF'): Ring[] {
  const rings: Ring[] = [
    { inset: 0, y: 0, out: 1, up: 0, color: shade(bottom, tint) },
    { inset: 0, y: T.height - T.bevel, out: 1, up: 0, color: shade(side, tint) },
  ];
  for (let k = 1; k <= T.bevelSteps; k++) {
    const a = (k / T.bevelSteps) * (Math.PI / 2);
    rings.push({ inset: T.bevel * (1 - Math.cos(a)), y: T.height - T.bevel + T.bevel * Math.sin(a), out: Math.cos(a), up: Math.sin(a), color: shade(side + (top - side) * Math.sin(a), tint) });
  }
  return rings;
}

/**
 * A band of grass blades round a rounded square: rings from root (texture v = 0) to tip (v = 1),
 * each at an inset and a height. The blade picture repeats about every `blade` cells along the
 * outline, rounded to a whole number so the band closes without a seam.
 */
export function furBand(w: number, r: number, rings: readonly { inset: number; y: number; v: number; tone: number }[], blade: number, steps: number, tint = '#FFFFFF'): THREE.BufferGeometry {
  const m = new Mesher();
  const perimeter = 4 * (w - 2 * r) + 2 * Math.PI * r;
  const repeats = Math.max(1, Math.round(perimeter / blade));
  const rows = rings.map((ring) => outline(w, w, r, ring.inset, steps).map((p) =>
    m.vertex(new THREE.Vector3(p.x, ring.y, p.z), new THREE.Vector3(p.nx * 0.35, 1, p.nz * 0.35).normalize(), p.f * repeats, ring.v, shade(ring.tone, tint))));
  m.grid(rows, true);
  return m.build();
}

/** A mesh of grass fur, with blade-shaped shadows. */
export function furMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, furMaterial);
  mesh.customDepthMaterial = furDepth;
  return mesh;
}

/** Height of the tile's rounded bevel `inset` in from the outline. */
export function bevelY(inset: number): number {
  const b = T.bevel;
  const i = Math.min(b, Math.max(0, inset));
  return T.height - b + Math.sqrt(Math.max(0, b * b - (b - i) ** 2));
}

/** The fur round the top edge of a tile, draped out and down over the bevel, and the shorter fur up its sides. */
export function tileFur(key: string, tint: string): THREE.BufferGeometry[] {
  const f = T.fur;
  const h = T.height;
  const b = T.bevel;
  const top = once(`fur-top-${key}`, () => furBand(T.body, T.radius, [
    { inset: f.inset, y: bevelY(f.inset) + 0.004, v: 0, tone: 1 },
    { inset: f.inset * 0.3, y: bevelY(f.inset * 0.3) + 0.012, v: 0.5, tone: 1 },
    { inset: -f.reach, y: h - f.droop, v: 1, tone: 1.05 },
  ], f.blade, T.cornerSteps, tint));
  const side = once(`fur-side-${key}`, () => furBand(T.body, T.radius, [
    { inset: -T.side.reach * 0.3, y: T.side.low, v: 0.05, tone: 0.75 },
    { inset: -T.side.reach, y: h - b * 0.45, v: 1, tone: 0.95 },
  ], f.blade * 0.8, T.cornerSteps, tint));
  return [top, side];
}

/** Four pegs under a tile, as on the robot tile; hidden on the board, shown on loose parts. */
export function addPegs(tile: THREE.Group, material: THREE.Material): void {
  const peg = once('garden-peg', () => {
    const g = new THREE.BoxGeometry(T.peg, T.pegHeight, T.peg);
    const count = g.getAttribute('position').count;
    const c = new THREE.Color(UNDER.colors.soil);
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
  });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const mesh = new THREE.Mesh(peg, material);
    mesh.position.set(sx * T.pegSpread, -T.pegHeight / 2, sz * T.pegSpread);
    tile.add(mesh);
  }
}

/** The tint of the second (checkerboard) tile: a touch darker and deeper green. */
export const altTint = (): string => `#${new THREE.Color('#FFFFFF').multiplyScalar(C.altShade).lerp(new THREE.Color('#E8FFD0').multiplyScalar(C.altShade * 0.97), 0.5).getHexString()}`;

/**
 * The grass tile as modelled in code (the first version): one cell, a soft rounded cushion of lawn
 * with a fuzzy edge of grass blades and a faint clover pattern on top. `alt` is the slightly darker
 * tile of the checkerboard; its pattern is also turned half round. Kept as a choice next to the
 * picture tile (`buildFloorTile`); same contract.
 */
export function buildFloorTileCode(alt = false, pegs = true): THREE.Group {
  const tint = alt ? altTint() : '#FFFFFF';
  const key = alt ? 'alt' : 'main';
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(once(`grass-${key}`, () => loftBody(T.body, T.radius, bodyRings(0.72, 0.9, 1, tint), T.cornerSteps, alt)), grassMaterial));
  for (const g of tileFur(key, tint)) tile.add(furMesh(g));
  if (pegs) addPegs(tile, grassMaterial);
  return shadowed(tile);
}

// ---------------------------------------------------------------------------------------------
// The grass tile from the owner's picture.

const I = TILE.image;

/**
 * The atlas picture, decoded before any tile is built (top-level await: a few milliseconds for a
 * 32 kB WebP inlined in the page), so the first frame already shows it. Outside a browser (the unit
 * tests) there is no image: the tile is then drawn in its vertex colours alone.
 */
async function loadAtlas(): Promise<THREE.Texture | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const image = new Image();
    image.src = grassTileUrl;
    await image.decode();
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null;
  }
}

/** The grass tile atlas (top and side fur), or null outside a browser. */
export const grassTileAtlas: THREE.Texture | null = await loadAtlas();

/**
 * The picture tile's material: the atlas times the vertex colours (the dark checkerboard tint).
 * Its fuzzy edge is soft, so it blends; it still writes depth, and its triangles are listed side
 * first, top last, so a tile's own fur lies over its side.
 */
export const grassImageMaterial = new THREE.MeshStandardMaterial({
  map: grassTileAtlas,
  vertexColors: true,
  roughness: 1,
  metalness: 0,
  transparent: true,
  alphaTest: I.alphaTest,
  color: new THREE.Color(1, 1, 1).multiplyScalar(I.light),
});

/** Shadows of the picture tile follow its fuzzy outline, not its square card. */
export const grassImageDepth = new THREE.MeshDepthMaterial({ map: grassTileAtlas, alphaTest: 0.5 });

/** Where the atlas's two pieces sit, as texture v (1 = the picture's top row). */
function atlasRows(): { topV0: number; topV1: number; sideV0: number; sideV1: number } {
  const a = I.atlas;
  const h = a.top + a.pad + a.side;
  return { topV1: 1, topV0: 1 - a.top / h, sideV1: 1 - (a.top + a.pad + 0.5) / h, sideV0: 0.5 / h };
}

/**
 * The thin body under the picture: straight sides from the floor to just under the top, a rounded
 * square `image.wall` wide, wrapped in the side strip of fur, repeated a whole number of times
 * round the outline so it closes without a seam.
 */
function imageWalls(m: Mesher, tint: string): void {
  const { sideV0, sideV1 } = atlasRows();
  const w = I.wall;
  const pts = outline(w, w, I.wallRadius, 0, I.cornerSteps);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  const repeats = Math.max(4, Math.round(total / I.sideRepeat));
  // Columns along the outline, with a doubled column wherever the strip starts again.
  const cols: { x: number; z: number; nx: number; nz: number; u: number }[] = [];
  const at = (k: number): number => pts[k].f * repeats;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const a = at(i - 1);
      const b = at(i);
      for (let n = Math.floor(a) + 1; n < b - 1e-9; n++) {
        const t = (n - a) / (b - a);
        const p = pts[i - 1];
        const q = pts[i];
        const x = p.x + (q.x - p.x) * t;
        const z = p.z + (q.z - p.z) * t;
        const nx = p.nx + (q.nx - p.nx) * t;
        const nz = p.nz + (q.nz - p.nz) * t;
        cols.push({ x, z, nx, nz, u: 1 }, { x, z, nx, nz, u: 0 });
      }
    }
    const f = at(i);
    const frac = f - Math.floor(f);
    cols.push({ ...pts[i], u: i === pts.length - 1 ? 1 : frac });
  }
  const lift = I.sideLift;
  const bottom = shade(I.sideFoot, tint);
  const top = shade(1, tint);
  const row = (y: number, v: number, c: THREE.Color): number[] => cols.map((p) =>
    m.vertex(new THREE.Vector3(p.x, y, p.z), new THREE.Vector3(p.nx, lift, p.nz).normalize(), p.u, v, c));
  const rows = [row(0, sideV0, bottom), row(I.wallTop, sideV1, top)];
  // Drop the zero-width quads at each doubled column (their two corners coincide).
  for (let j = 0; j < cols.length - 1; j++) {
    if (cols[j].x === cols[j + 1].x && cols[j].z === cols[j + 1].z) continue;
    const a = rows[0][j];
    const b = rows[0][j + 1];
    const c = rows[1][j];
    const d = rows[1][j + 1];
    m.index.push(a, c, b, b, c, d);
  }
}

/** The top: a rounded square `image.top` wide at the tile's height, the cut-out picture laid on from above. */
function imageTop(m: Mesher, tint: string): void {
  const { topV0, topV1 } = atlasRows();
  const q = I.top;
  const y = T.height;
  const uv = (x: number, z: number): [number, number] => [x / q + 0.5, topV0 + (topV1 - topV0) * (0.5 - z / q)];
  const c = shade(1, tint);
  const up = new THREE.Vector3(0, 1, 0);
  const ring = outline(q, q, I.topRadius, 0, I.cornerSteps).slice(0, -1).map((p) => m.vertex(new THREE.Vector3(p.x, y, p.z), up, ...uv(p.x, p.z), c));
  const centre = m.vertex(new THREE.Vector3(0, y, 0), up, ...uv(0, 0), c);
  for (let j = 0; j < ring.length; j++) m.index.push(centre, ring[(j + 1) % ring.length], ring[j]);
}

/** Geometry of the picture tile: side first, then top (see `grassImageMaterial`). */
export function grassImageGeometry(tint = '#FFFFFF'): THREE.BufferGeometry {
  const m = new Mesher();
  imageWalls(m, tint);
  imageTop(m, tint);
  return m.build();
}

/**
 * 1. Grass tile: one cell, the owner's picture `02-tile-grass` cut out and laid on top of a thin
 * body, its fuzzy outline on a transparent ground; the body's side wears the picture's own side
 * fur. `alt` is the slightly darker tile of the checkerboard: the same picture with a tint. Same
 * contract as the robot tile: one cell, floor at y = 0, top at 0.2; pegs only on loose parts.
 */
export function buildFloorTile(alt = false, pegs = true): THREE.Group {
  const tint = alt ? altTint() : '#FFFFFF';
  const tile = new THREE.Group();
  const mesh = new THREE.Mesh(once(`grass-image-${alt ? 'alt' : 'main'}`, () => grassImageGeometry(tint)), grassImageMaterial);
  mesh.customDepthMaterial = grassImageDepth;
  tile.add(mesh);
  if (pegs) addPegs(tile, plainMaterial);
  return shadowed(tile);
}
