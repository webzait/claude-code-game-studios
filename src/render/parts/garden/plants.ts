import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import data from '../../../../data/themes/garden/obstacles.json';

/**
 * Small garden plants (leaf, four-leaf sprig, grass tuft, flowers), built in
 * code. The bushes and the stump use the same pieces, and the backdrop and
 * the board rim can reuse them. Every piece carries vertex colours and is
 * drawn with the one shared plant material, so a whole board of plants
 * merges into a single draw call.
 */

const P = data.plants;
const M = data.materials;

/** Shared materials of the garden obstacles: one each for stone, wood and every plant. */
export const gardenMaterials = {
  stone: new THREE.MeshPhysicalMaterial({ vertexColors: true, ...M.stone }),
  wood: new THREE.MeshPhysicalMaterial({ vertexColors: true, ...M.wood }),
  plant: new THREE.MeshPhysicalMaterial({ vertexColors: true, ...M.plant }),
};

/** A small seeded random-number generator (mulberry32): the same seed always gives the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const tone = (hex: string): THREE.Color => new THREE.Color(hex);

/**
 * A grid of `cols` by `rows` vertices joined into triangles; `wrap` joins the
 * last column back to the first. `at` fills in each vertex's position and
 * colour. Triangles face the side from which (column, row) runs counter-clockwise;
 * `flip` turns them to the other side.
 */
export function gridGeometry(cols: number, rows: number, wrap: boolean, at: (i: number, j: number, p: THREE.Vector3, c: THREE.Color) => void, flip = false): THREE.BufferGeometry {
  const position = new Float32Array(cols * rows * 3);
  const color = new Float32Array(cols * rows * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      at(i, j, p, c);
      const k = (j * cols + i) * 3;
      position[k] = p.x;
      position[k + 1] = p.y;
      position[k + 2] = p.z;
      color[k] = c.r;
      color[k + 1] = c.g;
      color[k + 2] = c.b;
    }
  }
  const index: number[] = [];
  const last = wrap ? cols : cols - 1;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < last; i++) {
      const a = j * cols + i;
      const b = j * cols + ((i + 1) % cols);
      const d = a + cols;
      const e = b + cols;
      if (flip) index.push(a, b, d, b, e, d);
      else index.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Give a ready-made geometry one colour per vertex from `paint(position, normal)` and drop its texture coordinates. */
export function painted(g: THREE.BufferGeometry, paint: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    paint(p.fromBufferAttribute(pos, i), n.fromBufferAttribute(nor, i), c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Merge pieces drawn with the same material into one geometry. All pieces must be indexed. */
export function merged(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces, false);
  if (!g) throw new Error('garden plants: pieces could not be merged');
  return g;
}

/** A mesh with shadows on, as every board part has. */
export function shadowedMesh(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Colours of one leaf: its body, a lighter midrib and tip, a darker edge and base. */
export interface LeafTones {
  readonly body: THREE.Color;
  readonly light: THREE.Color;
  readonly dark: THREE.Color;
}

const DEFAULT_LEAF: LeafTones = { body: tone(P.colors.leaf), light: tone(P.colors.leafLight), dark: tone(P.colors.leafDark) };

/** Overrides for one leaf's shape; anything left out comes from `plants.leaf` in the data file. */
export interface LeafOptions {
  /** Build the underside too (a leaf seen from every side). Default true. */
  readonly closed?: boolean;
  /** Mesh density: 1 is the data file's grid. */
  readonly detail?: number;
  /** Width as a share of the length. */
  readonly width?: number;
  /** Bend along the length: positive lifts the tip, negative drops it. */
  readonly curl?: number;
  /** Where the widest point sits (smaller = nearer the stalk) and how full the outline is (smaller = blunter). */
  readonly base?: number;
  readonly round?: number;
}

/**
 * One rounded, pointed leaf, `length` long. Its stalk end is at the origin,
 * it points along +z and its upper face looks up (+y). `closed` builds a
 * plump leaf with an underside (for a leaf seen from every side); otherwise
 * only the upper face is built (for leaves lying on a bush).
 */
export function leafGeometry(length: number, tones: LeafTones = DEFAULT_LEAF, options: LeafOptions = {}): THREE.BufferGeometry {
  const L = { ...P.leaf, ...options };
  const closed = options.closed ?? true;
  const detail = options.detail ?? 1;
  const along = Math.max(4, Math.round(L.along * detail));
  const across = Math.max(4, Math.round(L.across * detail));
  const width = L.width * length;
  // Across positions: -1..1 over the upper face, then back 1..-1 under it (closed leaves wrap round).
  const vs: number[] = [];
  for (let k = 0; k <= across; k++) vs.push(-1 + (2 * k) / across);
  const loop: [number, number][] = vs.map((v) => [v, 1]);
  if (closed) for (let k = across - 1; k >= 1; k--) loop.push([vs[k], -1]);
  const halfWidth = (u: number): number => (width / 2) * Math.sin(Math.PI * u ** L.base) ** L.round;
  const c = new THREE.Color();
  const g = gridGeometry(loop.length, along + 1, closed, (i, j, p, col) => {
    const u = j / along;
    const [v, side] = loop[i];
    const w = halfWidth(u);
    const edge = 1 - v * v;
    const shape = length * (L.cup * v * v * (w / (width / 2)) * 0.5 + L.curl * u * u) - length * 0.035 * Math.exp(-((v / 0.14) ** 2)) * Math.sin(Math.PI * u);
    const puff = L.puff * length * Math.sqrt(Math.max(0, edge)) * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6;
    p.set(v * w, shape + (side > 0 ? puff : -puff * 0.45), u * length);
    // Lighter along the midrib and towards the tip, darker at the rim and at the stalk.
    const rib = Math.exp(-((v / 0.12) ** 2)) * Math.sin(Math.PI * u) ** 0.5;
    c.copy(tones.body).lerp(tones.light, Math.min(1, 0.25 * u + 0.55 * rib));
    c.lerp(tones.dark, Math.min(1, 0.35 * (1 - edge) ** 2 + 0.55 * Math.max(0, 1 - u / 0.3)));
    if (side < 0) c.multiplyScalar(0.72);
    col.copy(c);
  });
  return g;
}

/** Place `g` so its local +z points along `forward` and its +y towards `up` (made perpendicular), at `at`. */
export function orient(g: THREE.BufferGeometry, at: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3, twist = 0): THREE.BufferGeometry {
  const z = forward.clone().normalize();
  const y = up.clone().addScaledVector(z, -up.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z).multiply(new THREE.Matrix4().makeRotationZ(twist));
  m.setPosition(at);
  return g.applyMatrix4(m);
}

/** The petal colours a flower can have. */
export type FlowerColor = 'white' | 'pink' | 'lilac';

/**
 * A five-petal flower facing up (+y), `size` across, with a domed yellow
 * centre; its back sits at y = 0. Plump petals as on the owner's sheet.
 */
export function flowerGeometry(size: number, color: FlowerColor, detail = 1): THREE.BufferGeometry {
  const F = P.flower;
  const [tip, base] = F.colors[color].map(tone);
  const [middleTop, middleLow] = F.colors.centre.map(tone);
  const pieces: THREE.BufferGeometry[] = [];
  const ws = Math.max(8, Math.round(14 * detail));
  const hs = Math.max(6, Math.round(9 * detail));
  for (let k = 0; k < F.petals; k++) {
    const a = (k / F.petals) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(1, ws, hs);
    petal.scale(F.petal[0] * size, F.petal[1] * size, F.petal[2] * size);
    painted(petal, (p, _n, out) => {
      const t = Math.min(1, Math.max(0, (p.x / (F.petal[0] * size) + 1) / 2));
      out.copy(base).lerp(tip, t ** 0.7);
      if (p.y < 0) out.multiplyScalar(0.85);
    });
    petal.translate(F.reach * size, F.petal[1] * size * 0.9, 0);
    petal.rotateZ(THREE.MathUtils.degToRad(F.cup));
    petal.rotateY(a);
    pieces.push(petal);
  }
  const middle = new THREE.SphereGeometry(F.centre * size, ws, hs);
  middle.scale(1, 0.75, 1);
  painted(middle, (p, _n, out) => out.copy(middleLow).lerp(middleTop, Math.max(0, p.y / (F.centre * size * 0.75))));
  middle.translate(0, F.petal[1] * size * 1.6, 0);
  pieces.push(middle);
  return merged(pieces);
}

/** A tuft of grass blades, `height` tall, standing on y = 0. */
export function grassGeometry(height: number, seed = 5): THREE.BufferGeometry {
  const G = P.grass;
  const rand = seeded(seed);
  const tip = tone(G.colors.tip);
  const base = tone(G.colors.base);
  const pieces: THREE.BufferGeometry[] = [];
  for (let b = 0; b < G.blades; b++) {
    const spread = (b / (G.blades - 1)) * 2 - 1;
    const h = height * G.height * (0.62 + 0.38 * (1 - Math.abs(spread)) + 0.1 * rand());
    const w = height * G.width * (0.85 + 0.3 * rand());
    const lean = THREE.MathUtils.degToRad(G.lean * spread + 8 * (rand() - 0.5));
    const along = 8;
    // Cross-section: left edge, raised front midrib, right edge, back midrib.
    const section: [number, number][] = [[-1, 0], [0, 0.35], [1, 0], [0, -0.2]];
    const blade = gridGeometry(section.length, along + 1, true, (i, j, p, c) => {
      const u = j / along;
      const half = (w / 2) * (1 - u) ** 0.8 * (0.85 + 0.15 * Math.sin(Math.PI * u));
      const [sx, sz] = section[i];
      const bend = h * 0.22 * u * u;
      p.set(sx * half, u * h, sz * half + bend);
      c.copy(base).lerp(tip, u ** 0.8);
      if (sz < 0) c.multiplyScalar(0.8);
    });
    blade.rotateX(-0.05);
    blade.rotateZ(-lean);
    blade.translate(spread * height * 0.18, 0, (rand() - 0.5) * height * 0.12);
    blade.rotateY((rand() - 0.5) * 0.5 + (b % 2 ? 0.25 : -0.25));
    pieces.push(blade);
  }
  return merged(pieces);
}

/** Four leaves in a cross with a small round bud in the middle, `size` across, lying on y = 0. */
export function sprigGeometry(size: number): THREE.BufferGeometry {
  const S = P.sprig;
  const pieces: THREE.BufferGeometry[] = [];
  const length = size * 0.52;
  for (let k = 0; k < S.leaves; k++) {
    const a = (k / S.leaves) * Math.PI * 2 + Math.PI / 4;
    const dir = new THREE.Vector3(Math.cos(a), Math.tan(THREE.MathUtils.degToRad(S.lift)), Math.sin(a));
    pieces.push(orient(leafGeometry(length), new THREE.Vector3(0, length * 0.08, 0), dir, new THREE.Vector3(0, 1, 0)));
  }
  const bud = new THREE.SphereGeometry(S.bud * size, 12, 8);
  const light = tone(P.colors.leafLight);
  const body = tone(P.colors.leaf);
  painted(bud, (p, _n, out) => out.copy(body).lerp(light, Math.max(0, p.y / (S.bud * size))));
  bud.translate(0, length * 0.14, 0);
  pieces.push(bud);
  return merged(pieces);
}

/** A group with one plant mesh, standing on y = 0. */
function plant(g: THREE.BufferGeometry): THREE.Group {
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, 0);
  const group = new THREE.Group();
  group.add(shadowedMesh(g, gardenMaterials.plant));
  return group;
}

/** One loose leaf, `length` long (cells), lying on the ground, stalk at the origin pointing along +z. */
export function buildLeaf(length = 0.3): THREE.Group {
  return plant(leafGeometry(length));
}

/** The four-leaf sprig of the owner's plant sheet, `size` across (cells). */
export function buildSprig(size = 0.3): THREE.Group {
  return plant(sprigGeometry(size));
}

/** A grass tuft, `height` tall (cells). */
export function buildGrassTuft(height = 0.25): THREE.Group {
  return plant(grassGeometry(height));
}

/** A single flower facing up, `size` across (cells): white, pink or lilac. */
export function buildFlower(color: FlowerColor = 'white', size = 0.25): THREE.Group {
  return plant(flowerGeometry(size, color));
}
