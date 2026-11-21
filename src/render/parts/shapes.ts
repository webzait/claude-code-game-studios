import * as THREE from 'three';

/** Signed power: keeps the sign of `t` while raising its size to `e`. */
function spow(t: number, e: number): number {
  return Math.sign(t) * Math.abs(t) ** e;
}

/**
 * Half of a superquadric: a dome (or, upside down, a bowl) on a rounded-square
 * footprint. `a` and `c` are the half width and half depth, `h` the height.
 * `roundV` shapes the side profile (1 = round like a ball, towards 0 = boxy)
 * and `roundH` the footprint (1 = circle, 0.5 = squircle). The open edge lies
 * at y = 0; a dome rises to +h, a bowl hangs to -h.
 */
export function halfSuperquadric(a: number, h: number, c: number, roundV: number, roundH: number, dome: boolean): THREE.BufferGeometry {
  const around = 96;
  const up = 32;
  const positions: number[] = [];
  for (let v = 0; v <= up; v++) {
    const theta = (v / up) * (Math.PI / 2);
    const y = h * Math.cos(theta) ** roundV * (dome ? 1 : -1);
    const reach = Math.sin(theta) ** roundV;
    for (let u = 0; u < around; u++) {
      const phi = (u / around) * Math.PI * 2;
      positions.push(a * reach * spow(Math.cos(phi), roundH), y, c * reach * spow(Math.sin(phi), roundH));
    }
  }
  const index: number[] = [];
  for (let v = 0; v < up; v++) {
    for (let u = 0; u < around; u++) {
      const p = v * around + u;
      const q = v * around + ((u + 1) % around);
      const r = p + around;
      const s = q + around;
      // Counter-clockwise seen from outside, for a dome; a bowl is the mirror image.
      if (dome) index.push(p, s, r, p, q, s);
      else index.push(p, r, s, p, s, q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Outline of a rectangle with rounded corners, centred on the origin. */
export function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -d / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * A block standing on y = 0: `w` by `d` in plan with corner radius `r`, `h`
 * tall, its top and bottom edges rounded over `bevel`.
 */
export function roundedBlock(w: number, d: number, h: number, r: number, bevel: number): THREE.BufferGeometry {
  const shape = roundedRect(w - 2 * bevel, d - 2 * bevel, Math.max(0.001, r - bevel));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 20,
  });
  // Extruded along z; stand it up so the extrusion runs along +y from the floor.
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

/** A flat shape made thick: lies in the x/z plane, from y = 0 up to `depth`. */
export function slabOf(shape: THREE.Shape, depth: number, bevel = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

/** Colour each vertex by its height, blending through `stops` (height, colour), lowest first. */
export function shadeByHeight(g: THREE.BufferGeometry, stops: readonly (readonly [number, string])[]): void {
  const tones = stops.map(([at, hex]) => [at, new THREE.Color(hex)] as const);
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    let k = 0;
    while (k < tones.length - 2 && y > tones[k + 1][0]) k++;
    const [y0, c0] = tones[k];
    const [y1, c1] = tones[k + 1];
    mixed.copy(c0).lerp(c1, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** One ring of a `profiledBlock`: how far it sits inside the footprint, how high, and its colour. */
export interface ProfileRing {
  readonly inset: number;
  readonly y: number;
  readonly color: string;
}

/**
 * A block on a rounded-rectangle footprint (`w` by `d`, corner radius `r`)
 * whose side follows `rings` from the floor up: each ring is the footprint
 * shrunk by `inset` at height `y`. The last ring is closed with a flat cap.
 * Consecutive rings are joined smoothly; repeat a ring (same inset and y) to
 * get a crisp edge or a hard colour change there. Carries vertex colours.
 */
export function profiledBlock(w: number, d: number, r: number, rings: readonly ProfileRing[], arc = 12): THREE.BufferGeometry {
  const around = 4 * (arc + 1);
  const positions: number[] = [];
  const colors: number[] = [];
  const tone = new THREE.Color();
  const corners: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const ring of rings) {
    const rr = Math.max(0, r - ring.inset);
    const cx = Math.max(0, w / 2 - ring.inset - rr);
    const cz = Math.max(0, d / 2 - ring.inset - rr);
    tone.set(ring.color);
    corners.forEach(([sx, sz], q) => {
      for (let i = 0; i <= arc; i++) {
        const a = (q + i / arc) * (Math.PI / 2);
        positions.push(sx * cx + Math.cos(a) * rr, ring.y, -(sz * cz + Math.sin(a) * rr));
        colors.push(tone.r, tone.g, tone.b);
      }
    });
  }
  const index: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    if (rings[k].inset === rings[k + 1].inset && rings[k].y === rings[k + 1].y) continue;
    for (let u = 0; u < around; u++) {
      const p = k * around + u;
      const q = k * around + ((u + 1) % around);
      index.push(p, q, q + around, p, q + around, p + around);
    }
  }
  const last = rings[rings.length - 1];
  const centre = positions.length / 3;
  tone.set(last.color);
  positions.push(0, last.y, 0);
  colors.push(tone.r, tone.g, tone.b);
  const top = (rings.length - 1) * around;
  for (let u = 0; u < around; u++) index.push(top + u, top + ((u + 1) % around), centre);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
