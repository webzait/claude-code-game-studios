/**
 * Garden board: geometry helpers and the one plain vertex-coloured material that every garden part
 * shares. Shared by all garden board parts; change only what every part needs.
 */
import * as THREE from 'three';

/** The glossy vertex-coloured material of leaves, flowers, vines, clay and soil: one material, so they fuse into one draw. */
export const plainMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, side: THREE.DoubleSide });

/** A colour from the palette, scaled in brightness by `k`, as a vertex colour (which multiplies the texture). */
export const shade = (k: number, hex = '#FFFFFF'): THREE.Color => new THREE.Color(hex).multiplyScalar(k);

/** Geometry is built once per module and shared by every copy on the board. */
export const shared = new Map<string, THREE.BufferGeometry>();

export function once(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = build();
    shared.set(key, g);
  }
  return g;
}

/** Collected arrays of a geometry under construction. */
export class Mesher {
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
export function outline(w: number, d: number, r: number, inset: number, steps: number): { x: number; z: number; nx: number; nz: number; f: number }[] {
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
export interface Ring {
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
export function loftBody(w: number, r: number, rings: readonly Ring[], steps: number, turnUv = false, depth = w): THREE.BufferGeometry {
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

export function shadowed<T extends THREE.Object3D>(node: T): T {
  node.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return node;
}

/** Lay a tube of `radial` sides through `points` (with radii), into `m`, with bark texture coordinates. */
export function tube(m: Mesher, points: readonly THREE.Vector3[], radii: readonly number[], radial: number, uAt: (i: number) => number, vOffset: number, tone: (i: number, around: number) => THREE.Color, closed: boolean): void {
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

/** Merge geometries that share position, normal, uv and colour (all made non-indexed). */
export function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

/** The outline of a rounded rectangle `w` by `d` (not only a square), moved `inset` inward, closed. */
export function outlineRect(w: number, d: number, r: number, inset: number, steps: number): { x: number; z: number; nx: number; nz: number }[] {
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
