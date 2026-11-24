import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import garden from '../../../../data/themes/garden/exit.json';
import { hash01, once, paint, paintByHeight, shadowed, softBox, turned, type TurnPoint, type TurnShaping } from './common';
import { buildExit } from './exit';

/**
 * Garden theme: the gazebo as the goal, after the owner's pictures `08-gazebo` and
 * `24-sheet-gazebo-goal`. An eight-sided stone gazebo on a round lawn: cream columns with arches,
 * a wooden balustrade, a red shingled roof with a golden finial and a red flag with a white
 * feather, flowering bushes and vines, two rocks, and (as the goal) the lit exit pad with its tick
 * in the middle under a soft beam of light.
 *
 * A separate part, not a board tile: about three cells across. Where it belongs in the game is a
 * proposal in design/themes/garden-exit.md (the "level complete" picture and the end of the level
 * path). Built in code only.
 */

const Z = garden.gazebo;
const SIDES = Z.sides;
const FLOOR_TOP = Z.base.height + Z.floor.height;
const COL_TOP = FLOOR_TOP + Z.columns.height;
const EAVES = COL_TOP + Z.arch.beam;

/** Join geometries into one, keeping only position, normal and colour. */
function joined(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(name)) n.deleteAttribute(name);
    if (!n.getAttribute('normal')) n.computeVertexNormals();
    return n;
  });
  return mergeGeometries(clean, false)!;
}

/** Radius factor that turns a circle into a regular polygon of `SIDES` sides with its corners on the circle and on the column angles. */
function polygon(a: number): number {
  const step = (Math.PI * 2) / SIDES;
  const d = ((((a + step / 2) % step) + step) % step) - step / 2;
  return Math.cos(step / 2) / Math.cos(d);
}

/** Angle around y (as `turned` measures it) of compass angle `theta` from the front (+z). */
const turnedAngle = (theta: number): number => theta - Math.PI / 2;
/** Point at compass angle `theta` from the front (+z), radius `r`. */
const around = (theta: number, r: number): [number, number] => [Math.sin(theta) * r, Math.cos(theta) * r];
/** Compass angles of the column corners: the front side is open, centred on +z. */
const cornerAngles = Array.from({ length: SIDES }, (_, i) => Math.PI / SIDES + (i * 2 * Math.PI) / SIDES);
/** Compass angles of the middles of the sides; index 0 is the open front. */
const sideAngles = Array.from({ length: SIDES }, (_, i) => (i * 2 * Math.PI) / SIDES);

const kit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, emissive: '#FFFFFF', emissiveIntensity: 0.06 });
const gloss = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.35, emissive: '#FFFFFF', emissiveIntensity: 0.1 });

/** The lawn disc with a soft wavy edge. */
function lawn(): THREE.BufferGeometry {
  const b = Z.base;
  const pts: TurnPoint[] = [
    { r: b.radius - 0.04, y: 0, color: b.edge },
    { r: b.radius, y: b.height * 0.5, color: b.edge },
    { r: b.radius - 0.03, y: b.height, color: b.color },
    { r: b.radius * 0.6, y: b.height, color: b.color },
    { r: 0, y: b.height, color: b.color },
  ];
  return turned(pts, 96, (a) => ({ inset: 0, mix: 0, gain: 1, scale: 1 + 0.018 * Math.sin(a * 23) + 0.012 * Math.sin(a * 37 + 1) }));
}

/** The stone floor: a round plinth of flagstones, joints on the side and on the top. */
function floorPlinth(): THREE.BufferGeometry {
  const f = Z.floor;
  const y0 = Z.base.height;
  const r = f.radius;
  const round = 0.025;
  const pts: TurnPoint[] = [
    { r: r - 0.01, y: y0 - 0.01, color: f.joint },
    { r, y: y0 + round, color: f.edge },
    { r, y: y0 + f.height - round, color: f.edge },
    { r: r - round * 0.3, y: y0 + f.height - round * 0.3, color: f.color },
    { r: r - round, y: y0 + f.height, color: f.color },
    { r: r * 0.72, y: y0 + f.height, color: f.color },
    { r: r * 0.7, y: y0 + f.height, color: f.joint },
    { r: r * 0.68, y: y0 + f.height, color: f.color },
    { r: r * 0.38, y: y0 + f.height, color: f.color },
    { r: r * 0.36, y: y0 + f.height, color: f.joint },
    { r: r * 0.34, y: y0 + f.height, color: f.color },
    { r: 0, y: y0 + f.height, color: f.color },
  ];
  const joint = new THREE.Color(f.joint);
  const shaping = (a: number, k: number): TurnShaping => {
    // Side blocks, outer flagstones and inner flagstones each have their own joints.
    const band = k <= 3 ? 0 : k <= 5 ? 1 : k <= 8 ? 2 : 3;
    if (band === 3) return { inset: 0, mix: 0, gain: 1 };
    const count = [18, 16, 9][band];
    const radius = [r, r * 0.85, r * 0.5][band];
    const step = (Math.PI * 2) / count;
    const u = a / step + band * 0.5;
    const block = Math.floor(u);
    const fr = u - block;
    const near = Math.max(0, 1 - (Math.min(fr, 1 - fr) * step * radius) / 0.02);
    return { inset: band === 0 ? 0.006 * near : 0, mix: 0.8 * near * near, tint: joint, gain: 1 + (hash01(block * 13 + band) - 0.5) * 0.08 };
  };
  return turned(pts, 96, shaping);
}

/** The two front steps. */
function steps(): THREE.BufferGeometry {
  const f = Z.floor;
  const y0 = Z.base.height;
  const pieces: THREE.BufferGeometry[] = [];
  const lower = softBox(f.stepWidth + 0.14, 2 * f.stepDepth + 0.25, f.height / 2 + 0.01, 0.07, 0.025, f.edge, f.color, 5);
  lower.translate(0, y0 - 0.01, f.radius + f.stepDepth - 0.12);
  pieces.push(lower);
  const upper = softBox(f.stepWidth, f.stepDepth + 0.25, f.height + 0.01, 0.06, 0.025, f.edge, f.color, 5);
  upper.translate(0, y0 - 0.01, f.radius + f.stepDepth / 2 - 0.12);
  pieces.push(upper);
  return joined(pieces);
}

/** One small turned shape (column shaft, baluster): radius profile `rs` at heights `ys`, coloured from `low` to `high`. */
function lathe(rs: number[], ys: number[], low: string, high: string, stations = 16): THREE.BufferGeometry {
  const pts = rs.map((r, i) => new THREE.Vector2(Math.max(0.0005, r), ys[i]));
  const g = new THREE.LatheGeometry(pts, stations);
  return paintByHeight(g, ys[0], ys[ys.length - 1], low, high);
}

/** Columns: a square base, a round shaft with a collar, a square capital; one at every corner. */
function columns(): THREE.BufferGeometry {
  const c = Z.columns;
  const pieces: THREE.BufferGeometry[] = [];
  const shaftH = c.height - c.base - c.cap;
  for (const theta of cornerAngles) {
    const [x, z] = around(theta, c.radius);
    const base = softBox(2.3 * c.thickness, 2.3 * c.thickness, c.base, 0.03, 0.02, c.shade, c.color);
    base.rotateY(theta);
    base.translate(x, FLOOR_TOP, z);
    pieces.push(base);
    const t = c.thickness;
    const shaft = lathe([t * 1.12, t * 1.12, t, t * 0.97, t * 0.97, t * 1.1, t * 1.1, 0], [0, 0.03, 0.06, shaftH * 0.5, shaftH - 0.05, shaftH - 0.03, shaftH, shaftH], c.shade, c.color, 20);
    shaft.translate(x, FLOOR_TOP + c.base, z);
    pieces.push(shaft);
    const cap = softBox(2.5 * c.thickness, 2.5 * c.thickness, c.cap, 0.03, 0.025, c.shade, c.color);
    cap.rotateY(theta);
    cap.translate(x, COL_TOP - c.cap, z);
    pieces.push(cap);
  }
  return joined(pieces);
}

/** The arches between the columns, and the ring beam on top that carries the roof. */
function arches(): THREE.BufferGeometry {
  const a = Z.arch;
  const c = Z.columns;
  const side = 2 * c.radius * Math.sin(Math.PI / SIDES);
  const pieces: THREE.BufferGeometry[] = [];
  for (const theta of sideAngles) {
    const L = side - 0.02;
    const s = new THREE.Shape();
    s.moveTo(-L / 2, 0);
    s.lineTo(-L / 2, -a.rise * 1.5);
    s.absellipse(0, -a.rise * 1.5, L / 2 - 0.06, a.rise * 1.25, Math.PI, 0, true);
    s.lineTo(L / 2, -a.rise * 1.5);
    s.lineTo(L / 2, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: a.thickness - 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 12 });
    g.translate(0, 0, -(a.thickness - 0.02) / 2);
    paintByHeight(g, -a.rise * 1.5, 0, c.shade, a.color);
    g.rotateY(theta);
    const [x, z] = around(theta, c.radius * Math.cos(Math.PI / SIDES));
    g.translate(x, COL_TOP, z);
    pieces.push(g);
  }
  // Ring beam: an eight-sided band over the columns.
  const r0 = c.radius - 0.1;
  const r1 = c.radius + 0.11;
  const beam: TurnPoint[] = [
    { r: r1, y: COL_TOP - 0.005, color: c.shade },
    { r: r1, y: EAVES - 0.02, color: a.color },
    { r: r1 - 0.02, y: EAVES, color: a.color },
    { r: r0, y: EAVES, color: a.color },
    { r: r0, y: COL_TOP - 0.005, color: c.shade },
  ];
  pieces.push(turned(beam, 64, (an) => ({ inset: 0, mix: 0, gain: 1, scale: polygon(an - turnedAngle(cornerAngles[0])) / polygon(0) })));
  return joined(pieces);
}

/** The balustrade on every side but the open front: a wooden top rail, a bottom rail and turned balusters. */
function balustrade(): THREE.BufferGeometry {
  const r = Z.rail;
  const c = Z.columns;
  const side = 2 * c.radius * Math.sin(Math.PI / SIDES);
  const pieces: THREE.BufferGeometry[] = [];
  const inset = c.radius * Math.cos(Math.PI / SIDES);
  for (const theta of sideAngles.slice(1)) {
    const L = side - 0.12;
    const local: THREE.BufferGeometry[] = [];
    const top = softBox(L + 0.04, 0.085, 0.055, 0.025, 0.02, r.woodDark, r.wood);
    top.translate(0, r.height - 0.055, 0);
    local.push(top);
    const bottom = softBox(L, 0.065, 0.045, 0.02, 0.012, r.woodDark, r.wood);
    bottom.translate(0, 0.015, 0);
    local.push(bottom);
    const bh = r.height - 0.1;
    for (let k = 0; k < r.posts; k++) {
      const x = -L / 2 + ((k + 0.5) * L) / r.posts;
      const b = r.baluster;
      const g = lathe([b * 0.8, b * 0.8, b * 1.15, b * 1.3, b * 0.75, b * 0.7, b * 0.95, b * 0.95, 0], [0, bh * 0.08, bh * 0.25, bh * 0.4, bh * 0.62, bh * 0.75, bh * 0.88, bh, bh], '#D6C6A8', r.balusterColor, 8);
      g.translate(x, 0.06, 0);
      local.push(g);
    }
    const g = joined(local);
    g.rotateY(theta);
    const [x, z] = around(theta, inset);
    g.translate(x, FLOOR_TOP, z);
    pieces.push(g);
  }
  return joined(pieces);
}

/** Point on the roof's underlying surface at fraction `t` from the eaves (0) to the apex (1). */
function roofLine(t: number): { r: number; y: number } {
  const R = Z.roof;
  return { r: R.radius * (1 - t) + 0.05 * t, y: EAVES + R.height * t ** 1.12 };
}

/** The roof: rows of shingles from the eaves to the apex, eight-sided, each row overlapping the one below. */
function roof(): THREE.BufferGeometry {
  const R = Z.roof;
  const pieces: THREE.BufferGeometry[] = [];
  const corner = turnedAngle(cornerAngles[0]);
  const shape = (an: number): number => polygon(an - corner) / polygon(0);
  const dark = new THREE.Color(R.dark);
  for (let row = 0; row < R.rows; row++) {
    const tb = row === 0 ? 0 : row / R.rows - 0.03;
    const tt = Math.min(1, (row + 1) / R.rows + 0.02);
    const b = roofLine(tb);
    const th = R.thickness * (1 - row * 0.1);
    const pts: TurnPoint[] = [
      { r: b.r - th * 1.6, y: b.y + th * 0.2, color: R.dark },
      { r: b.r - 0.004, y: b.y - 0.004, color: R.dark },
      { r: b.r + 0.025, y: b.y + th * 0.45, color: R.color },
      { r: b.r - 0.006, y: b.y + th, color: R.light },
    ];
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const t = tb + ((tt - tb) * i) / n;
      const p = roofLine(t);
      // Bright just above the lip, the roof colour on the slope, and darker at the top of the row,
      // where the next row's lip shades it: that dark band is what makes the rows read as tiers.
      const tone = new THREE.Color(R.light).lerp(new THREE.Color(R.color), Math.min(1, i / 2));
      if (row < R.rows - 1 && i >= n - 1) tone.lerp(new THREE.Color(R.dark), i === n ? 0.8 : 0.45);
      pts.push({ r: p.r, y: p.y + th * (1 - 0.3 * (i / n)), color: tone });
    }
    if (row === R.rows - 1) pts.push({ r: 0, y: roofLine(1).y + th * 0.7, color: R.color });
    // Shingles: joints running down the slope, half a shingle offset per row; the lip is scalloped.
    const count = SIDES * Math.max(1, R.shingles - Math.floor(row * 0.7));
    const step = (Math.PI * 2) / count;
    const offset = (row % 2) * 0.5;
    pieces.push(turned(pts, count * 6, (an, k) => {
      const u = (an - corner) / step + offset;
      const block = Math.floor(u);
      const f = u - block;
      const edge = Math.min(f, 1 - f);
      const near = Math.max(0, 1 - (edge * step * b.r) / 0.05);
      const lip = k >= 1 && k <= 3;
      const groove = near * near;
      return { inset: lip ? 0.05 * groove : 0.012 * groove, mix: (lip ? 0.45 : 0.6) * groove, tint: dark, gain: 1 + (hash01(block * 31 + row * 7) - 0.5) * 0.1, scale: shape(an) };
    }));
  }
  // The underside of the eaves, so the roof is not hollow from below.
  pieces.push(turned([
    { r: Z.columns.radius - 0.05, y: EAVES + 0.003, color: '#B5475E' },
    { r: R.radius - 0.02, y: EAVES + 0.003, color: '#D35A70' },
  ], 64, (an) => ({ inset: 0, mix: 0, gain: 1, scale: shape(an) })));
  return joined(pieces);
}

/** Finial: a golden collar, a pole and a ball on the apex. */
function finial(): THREE.BufferGeometry {
  const F = Z.finial;
  const apex = roofLine(1).y + 0.02;
  const pieces: THREE.BufferGeometry[] = [];
  const collar = lathe([0.11, 0.11, 0.095, 0.07, 0], [0, 0.04, 0.075, 0.09, 0.09], F.goldDark, F.gold, 24);
  collar.translate(0, apex - 0.04, 0);
  pieces.push(collar);
  const pole = lathe([F.pole, F.pole, 0], [0, F.height, F.height], F.goldDark, F.gold, 14);
  pole.translate(0, apex, 0);
  pieces.push(pole);
  const ball = new THREE.SphereGeometry(F.ball, 20, 14);
  ball.translate(0, apex + F.height + F.ball * 0.6, 0);
  pieces.push(paintByHeight(ball, apex + F.height, apex + F.height + 2 * F.ball, F.goldDark, F.gold));
  return joined(pieces);
}

/** Sideways bend of the flag at distance `x` from the pole. */
function flagWave(x: number): number {
  const f = Z.flag;
  return f.wave * Math.sin((x / f.width) * Math.PI * 1.4) * (x / f.width);
}

/** The flag cloth, waving, starting at the pole and reaching out to +x. */
function flagCloth(): THREE.BufferGeometry {
  const f = Z.flag;
  const g = new THREE.PlaneGeometry(f.width, f.height, 20, 6);
  g.translate(f.width / 2, -f.height / 2, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const sag = (x / f.width) ** 2 * 0.03;
    p.setXYZ(i, x, y - sag, flagWave(x));
  }
  g.computeVertexNormals();
  return paint(g, f.color);
}

/**
 * The white feather on the flag, on both faces of the cloth: a finely divided leaf shape (so it
 * follows the cloth's wave instead of cutting through it) with a light grey quill.
 */
function flagMark(): THREE.BufferGeometry {
  const f = Z.flag;
  const len = f.height * 0.8;
  const wide = len * 0.2;
  const turn = 0.55;
  const cx = f.width * 0.52;
  const cy = -f.height * 0.5;
  const along = 18;
  const across = 4;
  /** A point of the feather at fraction `s` along it and `v` across (-1 lower edge, 1 upper edge, 0 the quill). */
  const at = (s: number, v: number, lift: number, face: number, quill: number): [number, number, number] => {
    const half = quill > 0 ? quill : wide * Math.max(0, Math.sin(Math.PI * s)) ** 0.7 * (1 - 0.3 * s);
    const bend = 0.12 * wide * Math.sin(Math.PI * Math.min(1, Math.max(0, s)));
    const lx = (s - 0.5) * len;
    const ly = bend + v * half * (v < 0 ? 0.8 : 1);
    const x = cx + lx * Math.cos(turn) - ly * Math.sin(turn);
    const y = cy + lx * Math.sin(turn) + ly * Math.cos(turn) - (x / f.width) ** 2 * 0.03;
    return [x, y, flagWave(x) + face * lift];
  };
  const strip = (v0: number, v1: number, s0: number, s1: number, lift: number, face: number, color: string, quill = 0): THREE.BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= along; i++) for (let j = 0; j <= across; j++) {
      const s = s0 + ((s1 - s0) * i) / along;
      pos.push(...at(s, v0 + ((v1 - v0) * j) / across, lift, face, quill));
    }
    for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      if (face > 0) idx.push(a, b, a + 1, a + 1, b, b + 1);
      else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return paint(g, color);
  };
  const pieces: THREE.BufferGeometry[] = [];
  for (const face of [1, -1]) {
    pieces.push(strip(-1, 1, 0.02, 0.98, 0.004, face, f.mark));
    pieces.push(strip(-1, 1, -0.12, 0.85, 0.006, face, '#E9D9DC', 0.006));
  }
  return joined(pieces);
}

/** A leaf blob: a squashed, slightly lumpy ball. */
function blob(x: number, y: number, z: number, sx: number, sy: number, sz: number, light: string, dark: string, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vy = p.getY(i);
    const vz = p.getZ(i);
    const k = 1 + 0.06 * Math.sin(vx * 7 + seed) * Math.sin(vz * 6 + seed * 2) + 0.04 * Math.sin(vy * 9 + seed);
    p.setXYZ(i, vx * k, vy * k, vz * k);
  }
  g.scale(sx, sy, sz);
  paintByHeight(g, -sy, sy, dark, light);
  g.translate(x, y, z);
  return g;
}

/** A five-petal flower facing up (tilted by `tilt`), with a yellow heart. */
function flower(x: number, y: number, z: number, size: number, petal: string, tilt: THREE.Euler): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const g = new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(size * 0.5, size * 0.12, size * 0.36);
    g.translate(size * 0.48, 0, 0);
    g.rotateY(a);
    pieces.push(paint(g, petal));
  }
  const heart = new THREE.SphereGeometry(size * 0.24, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  heart.scale(1, 0.7, 1);
  heart.translate(0, size * 0.08, 0);
  pieces.push(paint(heart, Z.plants.heart));
  const g = joined(pieces);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(tilt));
  g.translate(x, y, z);
  return g;
}

/** Bushes, vines on the front columns, rocks and flowers in the grass. */
function plants(): THREE.BufferGeometry {
  const P = Z.plants;
  const pieces: THREE.BufferGeometry[] = [];
  const up = new THREE.Euler(0, 0, 0);
  // Two flowering bushes flanking the steps, and two smaller ones further round.
  const bushes: [number, number, number][] = [[-0.82, 1.1, 0.38], [0.82, 1.1, 0.38], [-1.26, 0.3, 0.27], [1.26, 0.3, 0.27]];
  bushes.forEach(([bx, bz, s], i) => {
    const y = Z.base.height + s * 0.55;
    const parts: [number, number, number, number][] = [[0, 0, 0, 1], [-0.55, -0.1, 0.1, 0.75], [0.55, -0.12, 0.05, 0.78], [0, 0.35, -0.15, 0.7], [0.2, -0.15, 0.45, 0.62], [-0.3, -0.2, 0.42, 0.6]];
    parts.forEach(([dx, dy, dz, k], j) => {
      pieces.push(blob(bx + dx * s, y + dy * s, bz + dz * s, s * 0.62 * k, s * 0.55 * k, s * 0.6 * k, j % 2 ? P.leafLight : P.leaf, P.leafDark, i * 7 + j));
    });
    const flowers: [number, number, number, string][] = [[-0.35, 0.42, 0.45, P.flowerPink], [0.3, 0.5, 0.4, P.flowerWhite], [0.05, 0.62, 0.05, P.flowerWhite], [-0.62, 0.2, 0.25, P.flowerWhite], [0.62, 0.18, 0.3, P.flowerPink]];
    for (const [dx, dy, dz, c] of flowers) {
      pieces.push(flower(bx + dx * s, y + dy * s, bz + dz * s, s * 0.32, c, new THREE.Euler(0.7, (dx * 2) % 1, -dx * 0.6)));
    }
  });
  // Vines up the two front columns: leaves and white flowers.
  for (const theta of [cornerAngles[0], cornerAngles[SIDES - 1], cornerAngles[1], cornerAngles[SIDES - 2]]) {
    const [cx, cz] = around(theta, Z.columns.radius + Z.columns.thickness + 0.02);
    for (let k = 0; k < 4; k++) {
      const h = FLOOR_TOP + 0.3 + k * 0.17;
      const swing = (k % 2 ? 1 : -1) * 0.06;
      const [ox, oz] = around(theta + Math.PI / 2, swing);
      pieces.push(blob(cx + ox, h, cz + oz, 0.085, 0.07, 0.06, P.leafLight, P.leafDark, k + theta * 10));
      pieces.push(blob(cx - ox * 0.8, h + 0.08, cz - oz * 0.8, 0.07, 0.06, 0.05, P.leaf, P.leafDark, k + theta * 13));
      if (k % 2 === 1) pieces.push(flower(cx + ox * 0.4, h + 0.04, cz + oz * 0.4 + 0.03, 0.11, P.flowerWhite, new THREE.Euler(1.25, 0, swing * 4)));
    }
  }
  // Rocks at the foot.
  for (const [x, z, s] of [[-1.05, 1.05, 0.16], [1.12, 0.98, 0.14]] as [number, number, number][]) {
    const g = new THREE.IcosahedronGeometry(1, 2);
    g.scale(s * 1.4, s * 0.75, s);
    g.translate(x, Z.base.height + s * 0.2, z);
    pieces.push(paintByHeight(g, Z.base.height, Z.base.height + s, P.rock, P.rockLight));
  }
  // Little white flowers in the grass.
  for (const [x, z] of [[-0.45, 1.42], [0.5, 1.45], [-1.38, 0.75], [1.4, 0.6], [0.05, 1.5]] as [number, number][]) {
    pieces.push(flower(x, Z.base.height + 0.015, z, 0.08, P.flowerWhite, up));
  }
  return joined(pieces);
}

let beamMap: THREE.DataTexture | null = null;
/** Vertical fade for the light beam: bright at the foot, gone at the top. */
function beamFade(): THREE.DataTexture {
  if (beamMap) return beamMap;
  const n = 64;
  const data = new Uint8Array(n * 4);
  for (let j = 0; j < n; j++) {
    const v = j / (n - 1);
    const a = 255 * (1 - v) ** 1.6;
    data.set([a, a, a, 255], j * 4);
  }
  beamMap = new THREE.DataTexture(data, 1, n, THREE.RGBAFormat);
  beamMap.magFilter = THREE.LinearFilter;
  beamMap.minFilter = THREE.LinearFilter;
  beamMap.needsUpdate = true;
  return beamMap;
}

/**
 * The gazebo. With `goal` it carries the lit exit pad (green, with its tick) on its floor and a soft
 * beam of light rising from it, as on `24-sheet-gazebo-goal`; without, it is the empty gazebo of
 * `08-gazebo`. `userData.flag` is the flag (to sway), `userData.pad` and `userData.beam` the goal's
 * pad and beam.
 */
export function buildGazebo(goal = true): THREE.Group {
  const root = new THREE.Group();
  root.name = 'garden-gazebo';
  const add = (key: string, build: () => THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const m = new THREE.Mesh(once(key, build), mat);
    m.name = key;
    root.add(m);
    return m;
  };
  add('gazebo-lawn', lawn, kit);
  add('gazebo-floor', floorPlinth, kit);
  add('gazebo-steps', steps, kit);
  add('gazebo-columns', columns, gloss);
  add('gazebo-arches', arches, gloss);
  add('gazebo-rail', balustrade, gloss);
  add('gazebo-roof', roof, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4, emissive: '#FFFFFF', emissiveIntensity: 0.02 }));
  add('gazebo-finial', finial, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.2, clearcoat: 0.6 }));
  add('gazebo-plants', plants, kit);
  const flag = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  flag.add(new THREE.Mesh(once('gazebo-flag', flagCloth), clothMat));
  flag.add(new THREE.Mesh(once('gazebo-flag-mark', flagMark), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide })));
  flag.position.set(Z.finial.pole * 0.8, roofLine(1).y + 0.02 + Z.finial.height - 0.02, 0);
  root.add(flag);
  root.userData.flag = flag;
  shadowed(root);
  if (goal) {
    const pad = buildExit(undefined, 'green');
    pad.scale.setScalar(Z.pad.scale);
    pad.position.y = FLOOR_TOP;
    root.add(pad);
    root.userData.pad = pad;
    const beam = new THREE.Mesh(
      once('gazebo-beam', () => new THREE.CylinderGeometry(0.62 * Z.pad.scale, 0.4 * Z.pad.scale, Z.pad.beam, 40, 1, true).translate(0, Z.pad.beam / 2, 0)),
      new THREE.MeshBasicMaterial({ color: Z.pad.beamColor, alphaMap: beamFade(), transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    beam.position.y = FLOOR_TOP + garden.exit.faceHeight * Z.pad.scale;
    beam.renderOrder = 2;
    // Light, not body: keep it out of the measured size.
    beam.geometry.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    root.add(beam);
    root.userData.beam = beam;
  }
  return root;
}
