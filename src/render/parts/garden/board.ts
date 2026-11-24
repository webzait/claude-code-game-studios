/**
 * Garden theme board parts: the grass tile, the glowing (highlighted) tile, the dirt tile, the
 * braided-twig rim with leaves and white flowers, and the underlay with its grass bed.
 *
 * Same contract as the robot theme's `src/render/parts/board.ts`: the same function names and
 * parameters, sizes in cells, the floor at y = 0 and the tile top at `tile.height` (0.2, as the
 * robot tile, so a chick stands where a robot stands). The theme session can swap one module for
 * the other. Sizes and colours live in `data/themes/garden/board.json`; the design is described
 * in `design/themes/garden-board.md`.
 */
import * as THREE from 'three';
import G from '../../../../data/themes/garden/board.json';
import { barkTexture, bedTexture, bladeTexture, dirtTileTexture, glowTexture, grassTileTexture } from './textures';
import { boardFootprint, braidTwists, rimDecorLayout, rimPath, RoundedPath, type DecorPlace } from './layout';

export { boardFootprint, hintGlowCells, rimDecorLayout } from './layout';

const C = G.colors;
const T = G.tile;

/** A colour from the palette, scaled in brightness by `k`, as a vertex colour (which multiplies the texture). */
const shade = (k: number, hex = '#FFFFFF'): THREE.Color => new THREE.Color(hex).multiplyScalar(k);

/** Materials, made once and shared by every copy, so the game can fuse a whole board into a few meshes. */
const mats = {
  grass: new THREE.MeshStandardMaterial({ map: grassTileTexture(), vertexColors: true, roughness: 0.9 }),
  dirt: new THREE.MeshStandardMaterial({ map: dirtTileTexture(), vertexColors: true, roughness: 0.95 }),
  fur: new THREE.MeshStandardMaterial({ map: bladeTexture(), vertexColors: true, roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide }),
  bed: new THREE.MeshStandardMaterial({ map: bedTexture(), roughness: 0.95 }),
  bark: new THREE.MeshPhysicalMaterial({ map: barkTexture(), vertexColors: true, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
  decor: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
};
/** Shadows of the fur follow its blades, not its square cards. */
const furDepth = new THREE.MeshDepthMaterial({ map: mats.fur.map, alphaTest: 0.5, side: THREE.DoubleSide });

/** The materials of the garden board, for the theme session (to fuse, dispose or tune them). */
export const gardenBoardMaterials = mats;

/** Geometry is built once per module and shared by every copy on the board. */
const shared = new Map<string, THREE.BufferGeometry>();
function once(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = build();
    shared.set(key, g);
  }
  return g;
}

/** Collected arrays of a geometry under construction. */
class Mesher {
  position: number[] = [];
  normal: number[] = [];
  uv: number[] = [];
  color: number[] = [];
  index: number[] = [];

  /** Add one vertex; returns its index. */
  vertex(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, c: THREE.Color): number {
    this.position.push(p.x, p.y, p.z);
    this.normal.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.color.push(c.r, c.g, c.b);
    return this.position.length / 3 - 1;
  }

  /** Join rows of vertex indices (each the same length) with two triangles per quad, facing as `a, b, c` turn. */
  grid(rows: number[][], flip = false): void {
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < rows[i].length - 1; j++) {
      const a = rows[i][j];
      const b = rows[i][j + 1];
      const c = rows[i + 1][j];
      const d = rows[i + 1][j + 1];
      if (flip) this.index.push(a, b, c, c, b, d);
      else this.index.push(a, c, b, b, c, d);
    }
  }

  build(normals = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setIndex(this.index);
    if (normals) g.computeVertexNormals();
    return g;
  }
}

/**
 * The outline of a rounded square `w` wide moved `inset` inward, as points with their outward
 * normal and their share `f` (0 to 1) of the way round; the first point is repeated at the end
 * (f = 1), so a texture can wrap round without a seam.
 */
function outline(w: number, d: number, r: number, inset: number, steps: number): { x: number; z: number; nx: number; nz: number; f: number }[] {
  const reach = Math.max(0, r - inset);
  const points: { x: number; z: number; nx: number; nz: number; f: number }[] = [];
  const signs: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  signs.forEach(([sx, sz], k) => {
    for (let j = 0; j <= steps; j++) {
      const phi = (k + j / steps) * (Math.PI / 2);
      const nx = Math.cos(phi);
      const nz = Math.sin(phi);
      points.push({ x: sx * (w / 2 - r) + nx * reach, z: sz * (d / 2 - r) + nz * reach, nx, nz, f: 0 });
    }
  });
  points.push({ ...points[0] });
  let total = 0;
  const run = [0];
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    run.push(total);
  }
  points.forEach((p, i) => (p.f = total > 0 ? run[i] / total : 0));
  return points;
}

/** One ring of a lofted tile body: inset from the outline, height, normal (outward and up parts) and vertex colour. */
interface Ring {
  inset: number;
  y: number;
  out: number;
  up: number;
  color: THREE.Color;
}

/**
 * A tile body lofted from rings of a rounded square `w` wide, closed with a flat top. The texture
 * is laid on from above (u east, v north) over the body's square, so the top shows it whole and
 * the bevel and the sides take its edge.
 */
function loftBody(w: number, r: number, rings: readonly Ring[], steps: number, turnUv = false, depth = w): THREE.BufferGeometry {
  const m = new Mesher();
  const uvOf = (x: number, z: number): [number, number] => {
    const u = x / w + 0.5;
    const v = 0.5 - z / w;
    return turnUv ? [1 - u, 1 - v] : [u, v];
  };
  const rows = rings.map((ring) => {
    const len = Math.hypot(ring.out, ring.up) || 1;
    return outline(w, depth, r, ring.inset, steps).slice(0, -1).map((p) => {
      const [u, v] = uvOf(p.x, p.z);
      return m.vertex(new THREE.Vector3(p.x, ring.y, p.z), new THREE.Vector3((p.nx * ring.out) / len, ring.up / len, (p.nz * ring.out) / len), u, v, ring.color);
    });
  });
  // Close each row round (the outline's points are listed without the repeat here).
  m.grid(rows.map((row) => [...row, row[0]]));
  const last = rings[rings.length - 1];
  const top = outline(w, depth, r, last.inset, steps).slice(0, -1).map((p) => {
    const [u, v] = uvOf(p.x, p.z);
    return m.vertex(new THREE.Vector3(p.x, last.y, p.z), new THREE.Vector3(0, 1, 0), u, v, last.color);
  });
  const [cu, cv] = uvOf(0, 0);
  const centre = m.vertex(new THREE.Vector3(0, last.y, 0), new THREE.Vector3(0, 1, 0), cu, cv, last.color);
  for (let j = 0; j < top.length; j++) m.index.push(centre, top[(j + 1) % top.length], top[j]);
  return m.build();
}

/** Rings of a tile body: straight sides, then a quarter round over the bevel to the flat top. Colours are brightness. */
function bodyRings(bottom: number, side: number, top: number, tint = '#FFFFFF'): Ring[] {
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
function furBand(w: number, r: number, rings: readonly { inset: number; y: number; v: number; tone: number }[], blade: number, steps: number, tint = '#FFFFFF'): THREE.BufferGeometry {
  const m = new Mesher();
  const perimeter = 4 * (w - 2 * r) + 2 * Math.PI * r;
  const repeats = Math.max(1, Math.round(perimeter / blade));
  const rows = rings.map((ring) => outline(w, w, r, ring.inset, steps).map((p) =>
    m.vertex(new THREE.Vector3(p.x, ring.y, p.z), new THREE.Vector3(p.nx * 0.35, 1, p.nz * 0.35).normalize(), p.f * repeats, ring.v, shade(ring.tone, tint))));
  m.grid(rows, true);
  return m.build();
}

/** A mesh of grass fur, with blade-shaped shadows. */
function furMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mats.fur);
  mesh.customDepthMaterial = furDepth;
  return mesh;
}

function shadowed<T extends THREE.Object3D>(node: T): T {
  node.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return node;
}

/** Height of the tile's rounded bevel `inset` in from the outline. */
function bevelY(inset: number): number {
  const b = T.bevel;
  const i = Math.min(b, Math.max(0, inset));
  return T.height - b + Math.sqrt(Math.max(0, b * b - (b - i) ** 2));
}

/** The fur round the top edge of a tile, draped out and down over the bevel, and the shorter fur up its sides. */
function tileFur(key: string, tint: string): THREE.BufferGeometry[] {
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
function addPegs(tile: THREE.Group, material: THREE.Material): void {
  const peg = once('garden-peg', () => {
    const g = new THREE.BoxGeometry(T.peg, T.pegHeight, T.peg);
    const count = g.getAttribute('position').count;
    const c = new THREE.Color(C.soil);
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
const altTint = (): string => `#${new THREE.Color('#FFFFFF').multiplyScalar(C.altShade).lerp(new THREE.Color('#E8FFD0').multiplyScalar(C.altShade * 0.97), 0.5).getHexString()}`;

/**
 * 1. Grass tile: one cell, a soft rounded cushion of lawn with a fuzzy edge of grass blades and
 * a faint clover pattern on top (reference `02-tile-grass`). `alt` is the slightly darker tile of
 * the checkerboard; its pattern is also turned half round, so neighbours do not repeat exactly.
 * The body is `tile.body` wide inside the 1-cell square, so the grass bed shows between tiles.
 */
export function buildFloorTile(alt = false, pegs = true): THREE.Group {
  const tint = alt ? altTint() : '#FFFFFF';
  const key = alt ? 'alt' : 'main';
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(once(`grass-${key}`, () => loftBody(T.body, T.radius, bodyRings(0.72, 0.9, 1, tint), T.cornerSteps, alt)), mats.grass));
  for (const g of tileFur(key, tint)) tile.add(furMesh(g));
  if (pegs) addPegs(tile, mats.grass);
  return shadowed(tile);
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
  tile.add(new THREE.Mesh(once(`grass-${key}`, () => loftBody(T.body, T.radius, bodyRings(0.6, 0.85, 1.05, tint), T.cornerSteps, alt)), mats.grass));
  for (const g of tileFur(key, tint)) tile.add(furMesh(g));
  if (pegs) addPegs(tile, mats.grass);
  shadowed(tile);
  const glow = buildTileGlow();
  tile.add(glow);
  tile.userData.glow = glow;
  return tile;
}

/** A small clump of crossed blade cards, `size` tall, for the grass that grows round the dirt tile. */
function tuft(size: number): THREE.BufferGeometry {
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
function clayBlock(w: number, d: number, y0: number, y1: number, round: number, corner: number): THREE.BufferGeometry {
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
 * 1c. Dirt tile: a bed of warm, bare soil with fine grains and pebbles, sunk a little into a
 * frame of rounded clay blocks (three along each side and one on each corner), with short grass
 * round its foot and tufts growing over its near edge (reference `13-sheet-tile-dirt`). A new
 * tile type: the game has no rule for it yet (see `design/themes/garden-board.md` for proposals).
 */
export function buildDirtTile(alt = false, pegs = true): THREE.Group {
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
  ], T.cornerSteps, alt)), mats.dirt));
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
  }), mats.decor));
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
  if (pegs) addPegs(tile, mats.dirt);
  return shadowed(tile);
}

/** Lay a tube of `radial` sides through `points` (with radii), into `m`, with bark texture coordinates. */
function tube(m: Mesher, points: readonly THREE.Vector3[], radii: readonly number[], radial: number, uAt: (i: number) => number, vOffset: number, tone: (i: number, around: number) => THREE.Color, closed: boolean): void {
  const up = new THREE.Vector3(0, 1, 0);
  const n = points.length;
  const rows: number[][] = [];
  for (let i = 0; i < n; i++) {
    const before = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const after = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = after.clone().sub(before).normalize();
    const side = t.clone().cross(up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const nrm = side.clone().cross(t).normalize();
    const row: number[] = [];
    for (let j = 0; j <= radial; j++) {
      const phi = (j / radial) * Math.PI * 2;
      const dir = nrm.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi));
      row.push(m.vertex(points[i].clone().addScaledVector(dir, radii[i]), dir, uAt(i), j / radial + vOffset, tone(i, Math.cos(phi))));
    }
    rows.push(row);
  }
  if (closed) {
    // The seam row repeats the first ring with the texture's last coordinate.
    const row: number[] = [];
    for (let j = 0; j <= radial; j++) {
      const k = rows[0][j];
      row.push(m.vertex(new THREE.Vector3(m.position[k * 3], m.position[k * 3 + 1], m.position[k * 3 + 2]), new THREE.Vector3(m.normal[k * 3], m.normal[k * 3 + 1], m.normal[k * 3 + 2]), uAt(n), m.uv[k * 2 + 1], new THREE.Color(m.color[k * 3], m.color[k * 3 + 1], m.color[k * 3 + 2])));
    }
    rows.push(row);
  }
  m.grid(rows, true);
}

/** Where the braid's centre runs at `s` along the rim, raised to `centreY`. */
function braidCentre(path: RoundedPath, s: number): { p: THREE.Vector3; out: THREE.Vector3 } {
  const q = path.at(s);
  return { p: new THREE.Vector3(q.x, G.rim.centreY, q.z), out: new THREE.Vector3(q.nx, 0, q.nz) };
}

/**
 * The braid: `strands` twigs twisted round the rim's centre line, and a darker core between them
 * so no light shows through. The number of twists is whole, so the braid closes without a seam on
 * every board size.
 */
function braidGeometry(path: RoundedPath): THREE.BufferGeometry {
  const r = G.rim;
  const m = new Mesher();
  const L = path.length;
  const twists = braidTwists(L);
  const samples = Math.ceil(L * r.perUnit);
  const bark = Math.max(1, Math.round(L / r.barkRepeat));
  for (let k = 0; k < r.strands; k++) {
    const points: THREE.Vector3[] = [];
    const radii: number[] = [];
    for (let i = 0; i < samples; i++) {
      const s = (L * i) / samples;
      const { p, out } = braidCentre(path, s);
      const theta = Math.PI * 2 * ((twists * i) / samples + k / r.strands);
      points.push(p.addScaledVector(out, Math.cos(theta) * r.twist).add(new THREE.Vector3(0, Math.sin(theta) * r.twist * r.flatten, 0)));
      radii.push(r.strandRadius + r.wobble * Math.sin(Math.PI * 2 * (13 * i / samples) + k * 2.1));
    }
    tube(m, points, radii, r.radial, (i) => (i / samples) * bark, k / r.strands, (_, around) => shade(0.82 + 0.18 * Math.max(0, around)), true);
  }
  const core: THREE.Vector3[] = [];
  const coreSamples = Math.ceil(samples / 3);
  for (let i = 0; i < coreSamples; i++) core.push(braidCentre(path, (L * i) / coreSamples).p);
  tube(m, core, core.map(() => r.core), 6, (i) => (i / coreSamples) * bark * 0.5, 0, () => shade(1, C.core).multiply(new THREE.Color('#BBBBBB')), true);
  return m.build();
}

/** The grass that grows up against the inside of the rim, leaning in over the bed. */
function rimGrass(cols: number, rows: number, gap: number): THREE.BufferGeometry {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const m = new Mesher();
  const h = G.underlay.edgeGrass;
  const radius = Math.max(0.05, G.rim.cornerRadius - G.rim.width / 2);
  const outer = new RoundedPath(innerW / 2 + 0.03, innerD / 2 + 0.03, radius);
  const inner = new RoundedPath(innerW / 2 - 0.02, innerD / 2 - 0.02, Math.max(0.03, radius - 0.05));
  const samples = Math.ceil(outer.length * 10);
  const repeats = Math.max(1, Math.round(outer.length / 0.24));
  const rowsOut: number[][] = [[], []];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const a = outer.at(f * outer.length);
    const b = inner.at(f * inner.length);
    rowsOut[0].push(m.vertex(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(0, 1, 0), f * repeats, 0, shade(0.7)));
    rowsOut[1].push(m.vertex(new THREE.Vector3(b.x, h, b.z), new THREE.Vector3(0, 1, 0), f * repeats, 1, shade(0.95)));
  }
  m.grid(rowsOut);
  return m.build();
}

/** A leaf lying along +x from its stalk at the origin: pointed, its midrib raised, its tip curling down. */
function leafGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const m = new Mesher();
  const across = [-1, -0.5, 0, 0.5, 1];
  const rows: number[][] = [];
  const light = new THREE.Color(C.leafLight);
  const leaf = new THREE.Color(C.leaf);
  const dark = new THREE.Color(C.leafDark);
  for (let i = 0; i <= d.leafSteps; i++) {
    const t = i / d.leafSteps;
    const half = (d.leafWidth / 2) * Math.sin(Math.PI * t ** 0.8) ** 0.6;
    rows.push(across.map((a) => {
      const y = -0.18 * d.leafLength * t * t + (1 - a * a) * half * 0.45 + 0.02 * Math.sin(Math.PI * t);
      const c = leaf.clone().lerp(light, (1 - Math.abs(a)) * 0.55 * Math.sin(Math.PI * t)).lerp(dark, (1 - t) ** 3 * 0.6 + Math.abs(a) * 0.15);
      return m.vertex(new THREE.Vector3(d.leafLength * t, y, a * half), new THREE.Vector3(0, 1, 0), t, a, c);
    }));
  }
  m.grid(rows);
  return m.build(true);
}

/** One petal along +x, starting at the flower's heart: a rounded tip and a gently cupped face. */
function petalGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const m = new Mesher();
  const across = [-1, -0.5, 0, 0.5, 1];
  const rows: number[][] = [];
  const white = new THREE.Color(C.petal);
  const deep = new THREE.Color(C.petalShade);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const half = (d.petalWidth / 2) * Math.sqrt(Math.max(0, 1 - (1.7 * t - 1) ** 2)) ** 0.7 + 0.004;
    rows.push(across.map((a) => {
      const y = 0.22 * d.petal * t * t + a * a * half * 0.3;
      return m.vertex(new THREE.Vector3(d.heart * 0.5 + d.petal * t, y, a * half), new THREE.Vector3(0, 1, 0), t, a, deep.clone().lerp(white, Math.min(1, t * 1.6)));
    }));
  }
  m.grid(rows);
  return m.build(true);
}

/** A white flower: five petals round a yellow heart, facing up (+y). */
function flowerGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const p = petalGeometry();
    p.rotateY((k * Math.PI * 2) / 5 + 0.3);
    parts.push(p);
  }
  const heart = new THREE.SphereGeometry(d.heart, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  heart.scale(1, 0.8, 1);
  heart.translate(0, 0.01, 0);
  const pos = heart.getAttribute('position');
  const top = new THREE.Color(C.heart);
  const low = new THREE.Color(C.heartDark);
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const c = low.clone().lerp(top, Math.min(1, pos.getY(i) / (d.heart * 0.6)));
    colors.push(c.r, c.g, c.b);
  }
  heart.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const flat = [...parts, heart].map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  return mergeAll(flat);
}

/** Merge geometries that share position, normal, uv and colour (all made non-indexed). */
function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ['position', 'normal', 'uv', 'color'] as const;
  const sizes = { position: 3, normal: 3, uv: 2, color: 3 };
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const arrays = list.map((g) => {
      const flat = g.index ? g.toNonIndexed() : g;
      return Array.from(flat.getAttribute(name).array as Float32Array);
    });
    out.setAttribute(name, new THREE.Float32BufferAttribute(arrays.flat(), sizes[name]));
  }
  return out;
}

/** The vine that winds round the braid through a decoration, along its side and never into a corner. */
function vinePoints(place: DecorPlace, path: RoundedPath): THREE.Vector3[] {
  const d = G.decor;
  const r = G.rim;
  const along = place.side === 'top' || place.side === 'bottom';
  const half = (along ? path.a : path.b) - path.r;
  const t = along ? place.x : place.z;
  const from = Math.max(-half, t - d.vineLength / 2);
  const to = Math.min(half, t + d.vineLength / 2);
  const reach = r.twist + r.strandRadius + 0.006;
  const points: THREE.Vector3[] = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const at = from + (to - from) * k;
    const theta = Math.PI * 0.15 + (place.flip ? -1 : 1) * k * d.vineTurns * Math.PI * 2;
    const base = along ? new THREE.Vector3(at, r.centreY, place.z) : new THREE.Vector3(place.x, r.centreY, at);
    base.x += place.nx * Math.cos(theta) * reach;
    base.z += place.nz * Math.cos(theta) * reach;
    base.y += Math.sin(theta) * reach * (r.flatten + 0.25);
    points.push(base);
  }
  return points;
}

/** One decoration (leaves, a leaf, or a flower with leaves) in place on the braid. */
function decoration(place: DecorPlace): THREE.Group {
  const r = G.rim;
  const group = new THREE.Group();
  // Local frame: x outward, z along the side (mirrored by `flip`), y up; the root sits on the braid's top, towards the outside.
  const out = new THREE.Vector3(place.nx, 0, place.nz);
  const along = new THREE.Vector3(place.ax, 0, place.az).multiplyScalar(place.flip ? -1 : 1);
  const basis = new THREE.Matrix4().makeBasis(out, new THREE.Vector3(0, 1, 0), along);
  group.quaternion.setFromRotationMatrix(basis);
  group.position.set(place.x, r.centreY + r.twist * r.flatten + r.strandRadius * 0.6, place.z).addScaledVector(out, r.twist * 0.35);
  const leaf = once('garden-leaf', leafGeometry);
  /** A leaf pointing `angle` degrees from outward towards "along", tipped up by `lift` degrees, scaled by `size`. */
  const addLeaf = (angle: number, lift: number, size: number, dx = 0, dz = 0): void => {
    const mesh = new THREE.Mesh(leaf, mats.decor);
    mesh.scale.setScalar(size);
    mesh.rotation.set(0, (-angle * Math.PI) / 180, (lift * Math.PI) / 180, 'YXZ');
    mesh.position.set(dx, 0, dz);
    group.add(mesh);
  };
  // The leaves lie on the braid as in the reference: along the rim either way, and one reaching out over its edge.
  if (place.kind === 'leaf') addLeaf(55, 6, 0.85, -0.04, 0);
  if (place.kind === 'leaves') {
    addLeaf(-78, 7, 0.82, -0.02, -0.03);
    addLeaf(12, 10, 0.95, -0.05, 0);
    addLeaf(72, 6, 0.85, -0.02, 0.04);
  }
  if (place.kind === 'flower') {
    addLeaf(-150, 4, 0.8, 0.02, -0.08);
    addLeaf(120, 6, 0.9, 0.02, 0.08);
    addLeaf(40, 6, 0.75, 0.04, 0.12);
    const flower = new THREE.Mesh(once('garden-flower', flowerGeometry), mats.decor);
    flower.position.set(-0.02, 0.04, 0);
    flower.rotation.z = -0.18;
    group.add(flower);
  }
  return group;
}

/**
 * Whole board frame: a braid of three twigs round the board, with leaves, vines and white flowers
 * at fixed places (`rimDecorLayout`), and the grass that grows against its inside. It fits any
 * board from 4×4 to 8×8, square or not: the braid follows the footprint and twists a whole
 * number of times, the decorations sit at fixed fractions of each side.
 */
export function buildRim(cols: number, rows: number, gap: number): THREE.Group {
  const path = rimPath(cols, rows, gap);
  const frame = new THREE.Group();
  frame.add(new THREE.Mesh(braidGeometry(path), mats.bark));
  frame.add(furMesh(rimGrass(cols, rows, gap)));
  const vines = new Mesher();
  const vineTone = new THREE.Color(C.vine);
  for (const place of rimDecorLayout(cols, rows, gap)) {
    frame.add(decoration(place));
    const points = vinePoints(place, path);
    tube(vines, points, points.map((_, i) => G.decor.vineRadius * (1 - 0.5 * Math.abs(i / (points.length - 1) - 0.5) * 2) + 0.004), 5, () => 0, 0, (_, around) => vineTone.clone().multiplyScalar(0.8 + 0.25 * Math.max(0, around)), false);
  }
  frame.add(new THREE.Mesh(vines.build(), mats.decor));
  return shadowed(frame);
}

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
  const radius = Math.min(G.rim.cornerRadius + G.rim.width / 2 + u.lip, Math.min(w, d) / 2);
  const plate = new THREE.Group();

  // The bed: a flat top textured in world units, so the blades are the same size on every board.
  const bed = new THREE.ShapeGeometry(roundedShape(w, d, radius, 8));
  bed.rotateX(-Math.PI / 2);
  const pos = bed.getAttribute('position');
  const uv = bed.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / u.bedRepeat, -pos.getZ(i) / u.bedRepeat);
  plate.add(new THREE.Mesh(bed, mats.bed));

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
  plate.add(new THREE.Mesh(m.build(), mats.decor));

  if (pegs) {
    const socket = once('garden-socket', () => {
      const g = new THREE.BoxGeometry(0.16, 0.04, 0.16);
      const count = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [soil.r, soil.g, soil.b]).flat(), 3));
      return g;
    });
    const pitch = T.size + gap;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      const mesh = new THREE.Mesh(socket, mats.decor);
      mesh.position.set((x - (cols - 1) / 2) * pitch, -0.02, (z - (rows - 1) / 2) * pitch);
      plate.add(mesh);
    }
  }
  shadowed(plate);
  return plate;
}

/** A rounded rectangle `w` by `d` as a flat shape (x, y), for the bed. */
function roundedShape(w: number, d: number, r: number, steps: number): THREE.Shape {
  const points = outlineRect(w, d, r, 0, steps).slice(0, -1).map((p) => new THREE.Vector2(p.x, -p.z));
  return new THREE.Shape(points);
}

/** The outline of a rounded rectangle `w` by `d` (not only a square), moved `inset` inward, closed. */
function outlineRect(w: number, d: number, r: number, inset: number, steps: number): { x: number; z: number; nx: number; nz: number }[] {
  const reach = Math.max(0, r - inset);
  const points: { x: number; z: number; nx: number; nz: number }[] = [];
  const signs: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  signs.forEach(([sx, sz], k) => {
    for (let j = 0; j <= steps; j++) {
      const phi = (k + j / steps) * (Math.PI / 2);
      points.push({ x: sx * (w / 2 - r) + Math.cos(phi) * reach, z: sz * (d / 2 - r) + Math.sin(phi) * reach, nx: Math.cos(phi), nz: Math.sin(phi) });
    }
  });
  points.push({ ...points[0] });
  return points;
}

/**
 * What a garden board of `cols` by `rows` cells measures on a screen where its outside is
 * `boardPx` wide: the pixels per cell and the sizes that follow (as the robot `boardPixels`).
 */
export function boardPixels(cols: number, rows: number, gap: number, boardPx: number): { unit: number; tile: number; gap: number; frame: number; width: number; height: number } {
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const unit = boardPx / outerW;
  return { unit, tile: T.size * unit, gap: gap * unit, frame: G.rim.width * unit, width: boardPx, height: outerD * unit };
}
