import * as THREE from 'three';
import { profiledBlock } from '../shapes';

/**
 * Small geometry helpers shared by the garden exit, gazebo and special tiles.
 * Everything is built in code: no models or pictures from outside.
 */

/** A deterministic number in [0, 1) for an integer: looks random, needs no random source. */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** One point of a cross-section turned around the y axis: distance from the axis, height, colour. */
export interface TurnPoint {
  readonly r: number;
  readonly y: number;
  readonly color: string | THREE.Color;
}

/** What happens to the cross-section at one angle: pulled in by `inset` and darkened towards `tint` by `mix`. */
export interface TurnShaping {
  readonly inset: number;
  readonly mix: number;
  readonly tint?: THREE.Color;
  /** Brightness factor for this angle (stone blocks differ a little). */
  readonly gain: number;
  /** Factor on the distance from the axis before the inset (1 when left out): makes a round part many-sided. */
  readonly scale?: number;
}

/**
 * Turn `profile` once around the y axis in `stations` steps (a lathe with vertex colours). `shape`
 * may move and recolour each station, which carves the joints between stone blocks. The profile runs
 * from the outside inwards (or bottom to top) so the faces point outward. With `close` the last
 * profile point is joined to a centre point on the axis.
 */
export function turned(profile: readonly TurnPoint[], stations: number, shape?: (angle: number, k: number) => TurnShaping): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const base = profile.map((p) => (p.color instanceof THREE.Color ? p.color : new THREE.Color(p.color)));
  const c = new THREE.Color();
  for (let i = 0; i < stations; i++) {
    const a = (i / stations) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    profile.forEach((p, k) => {
      const s = shape?.(a, k);
      const r = Math.max(0, p.r * (s?.scale ?? 1) - (s?.inset ?? 0));
      positions.push(cos * r, p.y, -sin * r);
      c.copy(base[k]);
      if (s) {
        c.multiplyScalar(s.gain);
        if (s.tint && s.mix > 0) c.lerp(s.tint, Math.min(1, s.mix));
      }
      colors.push(c.r, c.g, c.b);
    });
  }
  const n = profile.length;
  const index: number[] = [];
  for (let i = 0; i < stations; i++) {
    const j = (i + 1) % stations;
    for (let k = 0; k < n - 1; k++) {
      const a = i * n + k;
      const b = j * n + k;
      index.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A flat round disc facing up at y = 0, `radius` across, coloured by distance from the centre
 * through `stops` (fraction of the radius, colour), centre first.
 */
export function shadedDisc(radius: number, stops: readonly (readonly [number, string])[], segments = 96, rings = 8): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(0, radius, segments, rings);
  g.rotateX(-Math.PI / 2);
  const tones = stops.map(([at, hex]) => [at, new THREE.Color(hex)] as const);
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.hypot(position.getX(i), position.getZ(i)) / radius;
    let k = 0;
    while (k < tones.length - 2 && t > tones[k + 1][0]) k++;
    const [t0, c0] = tones[k];
    const [t1, c1] = tones[k + 1];
    mixed.copy(c0).lerp(c1, Math.min(1, Math.max(0, (t - t0) / Math.max(1e-6, t1 - t0))));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Give every vertex of `g` the same colour, for parts drawn with a vertex-coloured material. */
export function paint(g: THREE.BufferGeometry, hex: string | THREE.Color): THREE.BufferGeometry {
  const c = hex instanceof THREE.Color ? hex : new THREE.Color(hex);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Colour each vertex of `g` by its height between `low` (at `y0`) and `high` (at `y1`). */
export function paintByHeight(g: THREE.BufferGeometry, y0: number, y1: number, low: string, high: string): THREE.BufferGeometry {
  const a = new THREE.Color(low);
  const b = new THREE.Color(high);
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    mixed.copy(a).lerp(b, Math.min(1, Math.max(0, (position.getY(i) - y0) / (y1 - y0))));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/**
 * Tick mark as one outline: a thick stroke from `start` through `elbow` to `end` (fractions of
 * `size`), `width` wide, with round ends, a round outer elbow and a small fillet in the inner one.
 */
export function tickShape(size: number, width: number, path: { start: number[]; elbow: number[]; end: number[]; fillet: number }): THREE.Shape {
  const at = (p: number[]): THREE.Vector2 => new THREE.Vector2(p[0] * size, p[1] * size);
  const [a, b, e] = [at(path.start), at(path.elbow), at(path.end)];
  const w = width / 2;
  const fillet = w * path.fillet;
  const d1 = b.clone().sub(a).normalize();
  const d2 = e.clone().sub(b).normalize();
  const t1 = Math.atan2(d1.y, d1.x);
  const t2 = Math.atan2(d2.y, d2.x);
  const n1 = new THREE.Vector2(-d1.y, d1.x);
  const n2 = new THREE.Vector2(-d2.y, d2.x);
  const inner = b.clone().add(n1.clone().add(n2).multiplyScalar((w + fillet) / (1 + n1.dot(n2))));
  const s = new THREE.Shape();
  s.moveTo(a.x - n1.x * w, a.y - n1.y * w);
  s.lineTo(b.x - n1.x * w, b.y - n1.y * w);
  s.absarc(b.x, b.y, w, t1 - Math.PI / 2, t2 - Math.PI / 2, false);
  s.lineTo(e.x - n2.x * w, e.y - n2.y * w);
  s.absarc(e.x, e.y, w, t2 - Math.PI / 2, t2 + Math.PI / 2, false);
  s.lineTo(inner.x - n2.x * fillet, inner.y - n2.y * fillet);
  s.absarc(inner.x, inner.y, fillet, t2 - Math.PI / 2, t1 - Math.PI / 2, true);
  s.lineTo(a.x + n1.x * w, a.y + n1.y * w);
  s.absarc(a.x, a.y, w, t1 + Math.PI / 2, t1 + Math.PI * 1.5, false);
  s.closePath();
  return s;
}

/** A flat shape made thick, lying in the x/z plane from y = 0 up to `depth`, with a rounded edge. */
export function slab(shape: THREE.Shape, depth: number, bevel = 0, curveSegments = 16): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

/** A soft round patch of light: `near` at radius `inner` (fraction of the half size), fading to nothing at the edge. */
export function radialGlowTexture(near: string, far: string, inner: number, falloff: number, n = 128): THREE.DataTexture {
  const a = new THREE.Color(near);
  const b = new THREE.Color(far);
  const mixed = new THREE.Color();
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2;
    const out = Math.min(1, Math.max(0, (r - inner) / (1 - inner)));
    mixed.copy(a).lerp(b, out);
    const alpha = r < inner ? 1 : (1 - out) ** falloff;
    data.set([mixed.r * 255, mixed.g * 255, mixed.b * 255, 255 * alpha], (j * n + i) * 4);
  }
  const map = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

/** Shadows on for every mesh under `node`. */
export function shadowed<T extends THREE.Object3D>(node: T): T {
  node.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return node;
}

/** Cache of geometries that are the same for every copy of a part. */
const shared = new Map<string, THREE.BufferGeometry>();
/** The geometry under `key`, built once. */
export function once(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = build();
    shared.set(key, g);
  }
  return g;
}

/** Count of triangles drawn for everything under `node` (visible meshes only). */
export function triangleCount(node: THREE.Object3D): number {
  let total = 0;
  node.traverse((n) => {
    if (!(n instanceof THREE.Mesh) || !n.visible) return;
    let hidden = false;
    for (let p: THREE.Object3D | null = n.parent; p; p = p.parent) if (!p.visible) hidden = true;
    if (hidden) return;
    const g = n.geometry as THREE.BufferGeometry;
    total += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return Math.round(total);
}

/** Number of draw calls for everything under `node` (one per visible mesh). */
export function drawCount(node: THREE.Object3D): number {
  let total = 0;
  node.traverse((n) => {
    if (!(n instanceof THREE.Mesh) || !n.visible) return;
    for (let p: THREE.Object3D | null = n.parent; p; p = p.parent) if (!p.visible) return;
    total++;
  });
  return total;
}

/**
 * A cheap rounded block standing on y = 0 (no bottom face): `w` by `d`, corner radius `r`, `h`
 * tall, its top edge rounded over `bevel`; coloured from `low` at the foot to `high` on top.
 */
export function softBox(w: number, d: number, h: number, r: number, bevel: number, low: string, high: string, arc = 3): THREE.BufferGeometry {
  const mid = new THREE.Color(low).lerp(new THREE.Color(high), 0.75).getStyle();
  return profiledBlock(w, d, r, [
    { inset: 0, y: 0, color: low },
    { inset: 0, y: h - bevel, color: mid },
    { inset: bevel * 0.3, y: h - bevel * 0.3, color: high },
    { inset: bevel, y: h, color: high },
  ], arc);
}
