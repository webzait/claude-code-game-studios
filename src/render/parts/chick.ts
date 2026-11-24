import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import type { Color } from '../../engine/types';
import parts from '../../../data/parts.json';
import { SHAPE_OUTLINES, shapeOf } from '../../ui/colourShapes';
import { triangleShape } from './flockbot';
import { roundedRect } from './shapes';

// The flock chick: a round, soft chick as a second figure next to the Flockbot (design/chicks.md).
// Sizes come from data/parts.json (`chick`), colours from data/config.json (`colors.robots`, `colors.chicks`).
const K = parts.chick;
const B = K.body;
const TONES = CONFIG.colors.robots;
const INK = CONFIG.colors.chicks;
const RAD = Math.PI / 180;

/** The faces a chick can make: eyes open, or squeezed shut with joy. */
export type ChickExpression = 'open' | 'happy';
/** Every expression, in the order the parts sheet shows them. */
export const CHICK_EXPRESSIONS: readonly ChickExpression[] = ['open', 'happy'];

/**
 * Which way the triangle on the forehead points. `beak`: its tip towards the beak, so that seen from above
 * it points the way the chick will step. `crown`: upright, its tip towards the crown, as in the owner's
 * turnaround drawings; seen from above that points against the step.
 */
export type ChickTip = 'beak' | 'crown';
/** Mesh fineness: `fine` for the parts sheet and close-ups, `game` for a chick on a board tile. */
export type ChickDetail = keyof typeof K.mesh;

/** Choices when building a chick; what is left out comes from data/parts.json. */
export interface ChickOptions {
  readonly detail?: ChickDetail;
  readonly tip?: ChickTip;
}

/** A chick as separate parts, in cell units: it stands on y = 0, faces +z and is one cell wide across its wings. */
export interface ChickParts {
  /** Everything, ready to place on a tile. */
  readonly root: THREE.Group;
  /** The round body, with the lighter belly in its colouring and the blush lying on it. */
  readonly body: THREE.Mesh;
  /** The three feathers on the crown. */
  readonly tuft: THREE.Mesh;
  /** Left and right wing; each turns around its own root, where it meets the body. */
  readonly wings: THREE.Group;
  /** The three tail feathers at the back: with the beak they show which way the chick faces. */
  readonly tail: THREE.Mesh;
  /** Both feet. */
  readonly feet: THREE.Mesh;
  /** The open beak. */
  readonly beak: THREE.Mesh;
  /** Both expressions of the eyes; `setExpression` shows one of them. */
  readonly eyes: THREE.Group;
  /** The mark on the forehead. It is fixed to the body and turns with it. */
  readonly symbol: THREE.Group;
  /**
   * The "Colour shapes" setting: with it on, the pointer lies on a plate in the shape of the chick's
   * colour (data: `colourShapes`). Off at rest.
   */
  readonly showShape: (on: boolean) => void;
  /** Show one expression. A new chick has its eyes open. */
  readonly setExpression: (expression: ChickExpression) => void;
}

const BODY_CENTRE = new THREE.Vector3(0, B.widest, 0);

/** A unit direction from the middle of the body: `elevation` degrees above level, `azimuth` degrees from the front (+z) towards +x. */
export function chickDirection(elevation: number, azimuth: number): THREE.Vector3 {
  const e = elevation * RAD;
  const a = azimuth * RAD;
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
}

/** How far the skin lies from the middle of the body along the unit direction `d`. */
export function bodyReach(d: THREE.Vector3): number {
  const level = Math.hypot(d.x, d.z);
  const [tall, round] = d.y >= 0 ? [B.top - B.widest, B.upperRound] : [B.widest - B.bottom, B.lowerRound];
  if (level < 1e-9) return tall;
  // The outline seen from above is an ellipse; `across` is its radius along this direction.
  const across = 1 / Math.hypot(d.x / level / B.radius, d.z / level / B.depth);
  // Up the side the skin runs (across * sin(t)^round, tall * cos(t)^round); find the t that lies along `d`.
  const t = Math.atan2(1, ((across * Math.abs(d.y)) / (tall * level)) ** (1 / round));
  return Math.hypot(across * Math.sin(t) ** round, tall * Math.cos(t) ** round);
}

/** The point of the skin along the unit direction `d` from the middle of the body, `lift` further out. */
export function bodyPoint(d: THREE.Vector3, lift = 0): THREE.Vector3 {
  return d.clone().multiplyScalar(bodyReach(d) + lift).add(BODY_CENTRE);
}

/** The outward normal of the skin along the unit direction `d`. */
export function bodyNormal(d: THREE.Vector3): THREE.Vector3 {
  const u = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0).cross(d).normalize() : new THREE.Vector3(1, 0, 0).cross(d).normalize();
  const v = d.clone().cross(u);
  const step = 2e-3;
  const at = (a: THREE.Vector3, sign: number): THREE.Vector3 => bodyPoint(d.clone().addScaledVector(a, sign * step).normalize());
  const n = at(u, 1).sub(at(u, -1)).cross(at(v, 1).sub(at(v, -1))).normalize();
  return n.dot(d) < 0 ? n.negate() : n;
}

/** A place on the skin with its own axes: `right` and `up` lie along the skin, `normal` points out of it. */
export interface SkinSpot {
  readonly position: THREE.Vector3;
  readonly right: THREE.Vector3;
  readonly up: THREE.Vector3;
  readonly normal: THREE.Vector3;
  /** Turns x/y/z onto right/up/normal. */
  readonly turn: THREE.Quaternion;
}

/** The spot on the skin at `elevation` and `azimuth` (degrees, as `chickDirection`). */
export function skinSpot(elevation: number, azimuth: number): SkinSpot {
  const d = chickDirection(elevation, azimuth);
  const normal = bodyNormal(d);
  const climb = bodyPoint(chickDirection(elevation + 0.5, azimuth)).sub(bodyPoint(chickDirection(elevation - 0.5, azimuth)));
  const up = climb.addScaledVector(normal, -climb.dot(normal)).normalize();
  const right = up.clone().cross(normal).normalize();
  const turn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
  return { position: bodyPoint(d), right, up, normal, turn };
}

/** Where the forehead mark sits. */
export function symbolSpot(): SkinSpot {
  return skinSpot(K.symbol.elevation, 0);
}

/**
 * How squarely the forehead mark faces a camera that looks down on the board, tilted `viewTilt` radians
 * from straight down towards the player, when the chick has turned `quarterTurns` clockwise from north
 * and leans back by `lean` radians, its crown away from the player. 1 is face on, 0 is edge on, below 0 is out of sight.
 */
export function symbolFacing(quarterTurns: number, viewTilt: number, lean = 0): number {
  // At north the chick's front (+z) points away from the player: half a turn; each quarter turn is clockwise from above.
  const normal = symbolSpot().normal.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - (quarterTurns * Math.PI) / 2);
  normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), -lean);
  return normal.dot(new THREE.Vector3(0, Math.cos(viewTilt), Math.sin(viewTilt)));
}

const smooth = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Give every vertex of `g` one colour. */
function tint(g: THREE.BufferGeometry, hex: string | THREE.Color): THREE.BufferGeometry {
  const tone = new THREE.Color(hex);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([tone.r, tone.g, tone.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Only what every part has, so parts can be merged and fused: position, normal and colour. */
function plain(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}

/** An egg-shaped blob: half sizes `x`, `y`, `z` around the origin. */
function blob(x: number, y: number, z: number, mesh: readonly number[]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, mesh[0], mesh[1]);
  g.scale(x, y, z);
  return g;
}

/**
 * One feather: a flattened blob `length` long (half its length, like the other sizes) whose long axis runs
 * along `along`, starting a little inside its root at the origin.
 */
function feather(length: number, wide: number, thick: number, along: THREE.Vector3, mesh: readonly number[]): THREE.BufferGeometry {
  const g = blob(wide, length, thick, mesh);
  const dir = along.clone().normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  g.translate(dir.x * length * 0.6, dir.y * length * 0.6, dir.z * length * 0.6);
  return g;
}

/** The body: a ball that is a little flatter underneath, coloured by height, with the belly blended in. */
function bodyGeometry(color: Color, detail: ChickDetail): THREE.BufferGeometry {
  const { around, up } = K.mesh[detail];
  const tones = TONES[color];
  const M = K.material;
  const main = new THREE.Color(tones.main);
  const crown = main.clone().lerp(new THREE.Color(tones.top), M.topTint);
  const under = main.clone().lerp(new THREE.Color(tones.side), M.underShade);
  const belly = new THREE.Color(INK[color].belly);
  const bellyDir = chickDirection(K.belly.elevation, 0);
  const positions: number[] = [];
  const colors: number[] = [];
  const mixed = new THREE.Color();
  for (let v = 0; v <= up; v++) {
    const elevation = 90 - (v / up) * 180;
    for (let u = 0; u < around; u++) {
      const d = chickDirection(elevation, (u / around) * 360);
      const p = bodyPoint(d);
      positions.push(p.x, p.y, p.z);
      const height = (p.y - B.bottom) / (B.top - B.bottom);
      if (height > 0.5) mixed.copy(main).lerp(crown, smooth((height - 0.5) / 0.5));
      else mixed.copy(under).lerp(main, smooth(height / 0.5));
      // The belly: a lighter bib low on the front, wider than it is tall.
      const off = Math.acos(Math.min(1, Math.max(-1, new THREE.Vector3(d.x / K.belly.wide, d.y, d.z).normalize().dot(bellyDir)))) / RAD;
      mixed.lerp(belly, INK[color].bellyMix * (1 - smooth((off - K.belly.reach) / K.belly.fade)));
      colors.push(mixed.r, mixed.g, mixed.b);
    }
  }
  const index: number[] = [];
  for (let v = 0; v < up; v++) {
    for (let u = 0; u < around; u++) {
      const p = v * around + u;
      const q = v * around + ((u + 1) % around);
      // The first and last ring are single points: one triangle each instead of two.
      if (v > 0) index.push(p, q + around, q);
      if (v < up - 1) index.push(p, p + around, q + around);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  // The skin's own normals rather than averaged ones: no pinch at the crown and none underneath.
  const normals: number[] = [];
  for (let v = 0; v <= up; v++) {
    for (let u = 0; u < around; u++) {
      const n = bodyNormal(chickDirection(90 - (v / up) * 180, (u / around) * 360));
      normals.push(n.x, n.y, n.z);
    }
  }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

/** Several blobs as one part in one colour, blended from `from` at the root to `to` at the tips along `axis`. */
function feathers(pieces: THREE.BufferGeometry[], from: THREE.Color, to: THREE.Color, axis: THREE.Vector3): THREE.BufferGeometry {
  const g = mergeGeometries(pieces.map(plain), false)!;
  const position = g.getAttribute('position');
  let far = 1e-6;
  const p = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) far = Math.max(far, p.fromBufferAttribute(position, i).dot(axis));
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    mixed.copy(from).lerp(to, smooth(p.fromBufferAttribute(position, i).dot(axis) / far));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** One half of the beak: a blob drawn to a rounded point along +z. */
function beakHalf(wide: number, high: number, long: number, mesh: readonly number[]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, mesh[0], mesh[1]);
  const position = g.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    if (z <= 0) continue;
    const narrow = 1 - K.beak.taper * z ** 1.5;
    position.setXY(i, position.getX(i) * narrow, position.getY(i) * narrow);
  }
  g.scale(wide, high, long);
  g.computeVertexNormals();
  return g;
}

/**
 * The open beak, in the spot's own axes: a rounded upper half, and under it the open mouth (dark, with a
 * tongue) inside the lower beak's rim.
 */
function beakGeometry(mesh: readonly number[]): THREE.BufferGeometry {
  const P = K.beak;
  const upper = tint(beakHalf(P.width, P.height, P.length, mesh), INK.beak);
  upper.rotateX(-6 * RAD);
  upper.translate(0, P.height * 0.5, -P.sink);
  // The mouth hangs below the upper half: an oval, `gape` times as tall as the upper half.
  const wide = P.width * P.mouth;
  const tall = P.height * P.gape;
  const middle = -tall * 0.8;
  const mouth = tint(blob(wide, tall, P.jut * 0.5, mesh), INK.mouth);
  mouth.translate(0, middle, 0);
  const tongue = tint(blob(wide * 0.58, tall * 0.42, P.jut * 0.5, mesh), INK.tongue);
  tongue.translate(0, middle - tall * 0.46, P.jut * 0.22);
  // The lower beak: a rim around the underside of the mouth, standing out further at the bottom.
  const lip = new THREE.TorusGeometry(1, P.lip, Math.max(6, Math.round(mesh[1] / 2)), mesh[0], Math.PI * 1.3);
  lip.rotateZ(Math.PI * 0.85);
  lip.scale(wide, tall, P.jut * 1.6);
  lip.rotateX(-14 * RAD);
  lip.translate(0, middle, P.jut * 0.3);
  return mergeGeometries([upper, mouth, tongue, tint(lip, INK.beakUnder)].map(plain), false)!;
}

/** The blush: a soft pink oval lying on the skin under each eye, fading out at its edge. */
function blushGeometry(color: Color, detail: ChickDetail): THREE.BufferGeometry {
  const U = K.blush;
  const around = K.mesh[detail].rim;
  const rings = 8;
  const tone = new THREE.Color(INK[color].blush);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  for (const side of [-1, 1]) {
    const spot = skinSpot(U.elevation, side * U.spread);
    const first = positions.length / 3;
    const put = (x: number, y: number, t: number): void => {
      const flat = spot.position.clone().addScaledVector(spot.right, x).addScaledVector(spot.up, y);
      const d = flat.sub(BODY_CENTRE).normalize();
      const p = bodyPoint(d, U.lift);
      const n = bodyNormal(d);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      colors.push(tone.r, tone.g, tone.b, U.strength * (1 - smooth((t - U.core) / (1 - U.core))));
    };
    put(0, 0, 0);
    for (let k = 1; k <= rings; k++) {
      for (let u = 0; u < around; u++) {
        const angle = (u / around) * Math.PI * 2;
        put((U.wide * k * Math.cos(angle)) / rings, (U.high * k * Math.sin(angle)) / rings, k / rings);
      }
    }
    for (let u = 0; u < around; u++) index.push(first, first + 1 + u, first + 1 + ((u + 1) % around));
    for (let k = 1; k < rings; k++) {
      for (let u = 0; u < around; u++) {
        const a = first + 1 + (k - 1) * around + u;
        const b = first + 1 + (k - 1) * around + ((u + 1) % around);
        index.push(a, a + around, b + around, a, b + around, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  g.setIndex(index);
  return g;
}

/** Bake a spot's place and axes into a geometry made in the spot's own axes. */
function seat(g: THREE.BufferGeometry, spot: SkinSpot): THREE.BufferGeometry {
  g.applyMatrix4(new THREE.Matrix4().compose(spot.position, spot.turn, new THREE.Vector3(1, 1, 1)));
  return g;
}

/**
 * Open eyes, flat on the skin and built in layers so every edge is crisp: a dark rim (thickest on top),
 * the white, a large black pupil turned towards the beak so the white shows on the outside, a brown
 * crescent low in the pupil, and one round glint.
 */
function openEyes(detail: ChickDetail): THREE.BufferGeometry {
  const E = K.eye;
  const mesh = K.mesh[detail].eye;
  const r = E.radius;
  const pieces: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const spot = skinSpot(E.elevation, side * E.spread);
    // Each layer is a little smaller and a little thicker than the one under it, so it shows through it cleanly.
    let depth = E.bulge * 0.7;
    const layer = (size: number, hex: string, x = 0, y = 0, round = false): void => {
      const g = tint(blob(r * size, r * size * (round ? 1 : E.tall), r * depth, mesh), hex);
      g.translate(x * r, y * r, 0);
      pieces.push(seat(plain(g), spot));
      depth += E.bulge * 0.3;
    };
    const inward = -side * E.inward;
    layer(E.rim, INK.eye, 0, E.rimLift);
    layer(1, INK.eyeWhite);
    layer(E.pupil, INK.eye, inward, E.drop);
    layer(E.iris, INK.eyeIris, inward, E.drop - E.irisDrop);
    layer(E.cover, INK.eye, inward, E.drop + E.coverLift);
    layer(E.glint, INK.eyeWhite, inward - side * 0.2, E.drop + 0.36, true);
  }
  return mergeGeometries(pieces, false)!;
}

/** Eyes squeezed shut with joy: a dark bow, open underneath, lying on the skin where each eye is. */
function happyEyes(detail: ChickDetail): THREE.BufferGeometry {
  const E = K.eye;
  const H = E.happy;
  const { tube, ball } = K.mesh[detail];
  const pieces: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const s = (i / 16) * 2 - 1;
      points.push(bodyPoint(chickDirection(E.elevation - H.high / 2 + H.high * (1 - s * s), side * E.spread + s * H.wide), H.lift));
    }
    const bow = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), tube, H.thick, Math.max(6, Math.round(tube / 4)), false);
    pieces.push(plain(tint(bow, INK.eye)));
    for (const end of [points[0], points[points.length - 1]]) {
      const cap = tint(blob(H.thick, H.thick, H.thick, ball), INK.eye);
      cap.translate(end.x, end.y, end.z);
      pieces.push(plain(cap));
    }
  }
  return mergeGeometries(pieces, false)!;
}

/**
 * A flat outline laid on the skin as a thin raised mark around `spot`: the outline (x to the spot's right,
 * y up the skin, turned by `turn` degrees) follows the curve of the body, `lift` above it, with a rim
 * that runs down into the skin so it is closed from every side.
 */
function decal(outline: THREE.Shape, spot: SkinSpot, turn: number, lift: number, detail: ChickDetail): THREE.BufferGeometry {
  const { decal: levels, rim } = K.mesh[detail];
  const cos = Math.cos(turn * RAD);
  const sin = Math.sin(turn * RAD);
  const positions: number[] = [];
  const normals: number[] = [];
  const onSkin = (x: number, y: number, raise: number): THREE.Vector3 => {
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    const flat = spot.position.clone().addScaledVector(spot.right, u).addScaledVector(spot.up, v);
    return bodyPoint(flat.sub(BODY_CENTRE).normalize(), raise);
  };
  const outward = (p: THREE.Vector3): THREE.Vector3 => bodyNormal(p.clone().sub(BODY_CENTRE).normalize());
  // The face: the outline's own triangles, split until each is small enough to follow the curve.
  const flat = new THREE.ShapeGeometry(outline, 8).toNonIndexed().getAttribute('position');
  let triangles: number[][] = [];
  for (let i = 0; i < flat.count; i += 3) triangles.push([flat.getX(i), flat.getY(i), flat.getX(i + 1), flat.getY(i + 1), flat.getX(i + 2), flat.getY(i + 2)]);
  for (let level = 0; level < levels; level++) {
    const next: number[][] = [];
    for (const [ax, ay, bx, by, cx, cy] of triangles) {
      const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
      next.push([ax, ay, abx, aby, cax, cay], [abx, aby, bx, by, bcx, bcy], [cax, cay, bcx, bcy, cx, cy], [abx, aby, bcx, bcy, cax, cay]);
    }
    triangles = next;
  }
  for (const t of triangles) {
    for (let k = 0; k < 6; k += 2) {
      const p = onSkin(t[k], t[k + 1], lift);
      const n = outward(p);
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
    }
  }
  // The rim: a wall under every edge of the outline (and of its holes), facing away from the mark.
  const walls = [outline.getSpacedPoints(rim), ...outline.holes.map((hole) => hole.getSpacedPoints(Math.round(rim / 2)))];
  walls.forEach((points, k) => {
    // Outer edges run counter-clockwise and holes clockwise, so "to the right of the edge" is always away from the mark.
    if (THREE.ShapeUtils.isClockWise(points) !== k > 0) points.reverse();
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.distanceToSquared(b) < 1e-12) continue;
      const aTop = onSkin(a.x, a.y, lift), bTop = onSkin(b.x, b.y, lift);
      const aLow = onSkin(a.x, a.y, -K.symbol.sink), bLow = onSkin(b.x, b.y, -K.symbol.sink);
      const n = bLow.clone().sub(aLow).cross(aTop.clone().sub(aLow)).normalize();
      for (const p of [aTop, aLow, bLow, aTop, bLow, bTop]) {
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return g;
}

/** The outline of a colour's shape (data: `colourShapes`), `size` across the box it is drawn in. */
function shapeOutline(color: Color, size: number): { outline: THREE.Shape; turn: number } {
  const o = SHAPE_OUTLINES[shapeOf(color)];
  return { outline: roundedRect(o.side * size, o.side * size, Math.min((o.side * size) / 2, o.corner * size)), turn: o.turn };
}

const M = K.material;
const softMats = new Map<string, THREE.Material>();
/**
 * The smooth material of everything feathered: clear, saturated colour with hardly any shine; the colours are in the vertices. It glows a little
 * in `glow` (the body's own colour), so the shaded underside stays saturated instead of going grey.
 * Beak and feet share one that glows a little orange.
 */
function softMat(glow: string | null): THREE.Material {
  const key = glow ?? 'trim';
  let mat = softMats.get(key);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: M.roughness,
      clearcoat: M.clearcoat,
      clearcoatRoughness: M.clearcoatRoughness,
      envMapIntensity: M.reflect,
      emissive: glow ?? INK.beakUnder,
      emissiveIntensity: glow ? M.glow : M.trimGlow,
    });
    softMats.set(key, mat);
  }
  return mat;
}
// The eyes are the one glossy thing on a chick.
const eyeMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.35 });
// The blush is see-through at its edge; its strength is in the vertices.
const blushMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
// Matt, so a mark does not mirror the sky and turn grey seen from above.
const markLight = new THREE.MeshStandardMaterial({ color: INK.symbolLight, roughness: 0.6, envMapIntensity: 0.2, emissive: INK.symbolLight, emissiveIntensity: 0.22 });
const markDark = new THREE.MeshStandardMaterial({ color: INK.symbolDark, roughness: 0.75, envMapIntensity: 0 });
const markTint = new Map<Color, THREE.Material>();
/** The material of the small pointer that lies on a colour's shape plate: the body's own colour. */
function tintMat(color: Color): THREE.Material {
  let mat = markTint.get(color);
  if (!mat) {
    const tone = color === 'yellow' ? TONES[color].main : TONES[color].side;
    mat = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.6, envMapIntensity: 0, emissive: tone, emissiveIntensity: 0.3 });
    markTint.set(color, mat);
  }
  return mat;
}

const cache = new Map<string, THREE.BufferGeometry>();
/** Geometry is built once per colour and fineness and shared by every chick that uses it. */
function once(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

/**
 * Build one flock chick from its parts: a round body with a lighter belly and blush, a tuft of three
 * feathers, large glossy eyes (open or squeezed shut), an open beak, two short wings, three tail feathers,
 * two feet and the mark on its forehead. The chick's own shape shows where it faces: beak and eyes in
 * front, tail behind, a wing on each side.
 */
export function buildChick(color: Color, options: ChickOptions = {}): ChickParts {
  const detail = options.detail ?? 'fine';
  const tip = options.tip ?? (K.symbol.tip as ChickTip);
  const mesh = K.mesh[detail];
  const tones = TONES[color];
  const main = new THREE.Color(tones.main);
  const light = main.clone().lerp(new THREE.Color(tones.top), M.topTint);
  const shade = main.clone().lerp(new THREE.Color(tones.side), M.wingShade);

  const soft = softMat(tones.main);
  const trim = softMat(null);
  const body = new THREE.Mesh(once(`body:${color}:${detail}`, () => bodyGeometry(color, detail)), soft);

  // Tuft: three feathers fanned on the crown, the middle one tallest, leaning back a little.
  const T = K.tuft;
  const tuft = new THREE.Mesh(
    once(`tuft:${color}:${detail}`, () => {
      const lean = -Math.sin(T.lean * RAD);
      const pieces = [feather(T.length, T.wide, T.thick, new THREE.Vector3(0, 1, lean), mesh.ball)];
      for (const side of [-1, 1]) pieces.push(feather(T.length * T.sideLength, T.wide * 0.9, T.thick, new THREE.Vector3(side * Math.sin(T.fan * RAD), Math.cos(T.fan * RAD), lean * 0.5), mesh.ball));
      return feathers(pieces, main, light, new THREE.Vector3(0, 1, 0));
    }),
    soft,
  );
  tuft.position.copy(bodyPoint(chickDirection(90 - T.back, 180), -0.02));

  // Wings: a broad leaf of three feathers on each side, held out from the body, tips outwards and up.
  const W = K.wing;
  const wings = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(
      once(`wing:${color}:${detail}:${side}`, () => {
        const along = new THREE.Vector3(side * W.out, W.up, -W.back).normalize();
        // The wing is held out: its broad side shows from the front and from above.
        const face = new THREE.Vector3(side * 0.35, 0, 1);
        const thin = face.addScaledVector(along, -face.dot(along)).normalize();
        const pieces = W.fan.map((angle, i) => {
          const dir = along.clone().applyAxisAngle(thin, angle * RAD);
          const g = blob(W.wide, W.length * (i === 1 ? 1.1 : 0.9), W.thick, mesh.ball);
          g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(dir, thin), dir, thin));
          g.translate(dir.x * W.length * 0.6, dir.y * W.length * 0.6, dir.z * W.length * 0.6);
          return g;
        });
        return feathers(pieces, main, light, along);
      }),
      soft,
    );
    wing.position.copy(bodyPoint(chickDirection(W.elevation, side * W.azimuth), -W.sink));
    wings.add(wing);
  }

  // Tail: three feathers fanned out behind, pointing back and up.
  const A = K.tail;
  const tail = new THREE.Mesh(
    once(`tail:${color}:${detail}`, () => {
      const pieces = [-1, 0, 1].map((k) => {
        const g = feather(A.length * (k === 0 ? 1.1 : 0.92), A.wide, A.thick, new THREE.Vector3(0, Math.sin(A.pitch * RAD), -Math.cos(A.pitch * RAD)), mesh.ball);
        g.rotateY(-k * A.fan * RAD);
        return g;
      });
      return feathers(pieces, shade, main, new THREE.Vector3(0, 0.5, -1).normalize());
    }),
    soft,
  );
  tail.position.copy(bodyPoint(chickDirection(A.elevation, 180), -0.03));

  // Feet: three toes each, fanned forwards from under the body.
  const P = K.foot;
  const feet = new THREE.Mesh(
    once(`feet:${detail}`, () => {
      const pieces: THREE.BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        for (const k of [-1, 0, 1]) {
          const toe = blob(P.wide, P.height / 2, P.toe, mesh.ball);
          toe.translate(0, P.height / 2, P.toe * 0.7);
          toe.rotateY(k * P.fan * RAD);
          toe.translate(side * P.spread, 0, P.forward);
          pieces.push(plain(tint(toe, INK.foot)));
        }
        // A short leg, so the body rests on its feet instead of hovering over them.
        const leg = blob(P.leg, B.bottom / 2 + 0.03, P.leg, mesh.ball);
        leg.translate(side * P.spread, B.bottom / 2 + 0.03, P.forward);
        pieces.push(plain(tint(leg, INK.beakUnder)));
      }
      return mergeGeometries(pieces, false)!;
    }),
    trim,
  );

  const beak = new THREE.Mesh(once(`beak:${detail}`, () => seat(beakGeometry(mesh.ball), skinSpot(K.beak.elevation, 0))), trim);

  const blush = new THREE.Mesh(once(`blush:${color}:${detail}`, () => blushGeometry(color, detail)), blushMat);

  // Eyes: both expressions are built; one is shown.
  const eyes = new THREE.Group();
  const faces: Record<ChickExpression, THREE.Mesh> = {
    open: new THREE.Mesh(once(`eyes:open:${detail}`, () => openEyes(detail)), eyeMat),
    happy: new THREE.Mesh(once(`eyes:happy:${detail}`, () => happyEyes(detail)), eyeMat),
  };
  eyes.add(faces.open, faces.happy);
  const setExpression = (expression: ChickExpression): void => {
    for (const name of CHICK_EXPRESSIONS) faces[name].visible = name === expression;
  };
  setExpression('open');

  // The mark on the forehead: white, or dark on yellow where white would not show.
  const S = K.symbol;
  const spot = symbolSpot();
  const markMat = color === 'yellow' ? markDark : markLight;
  const symbol = new THREE.Group();
  const bare = new THREE.Group();
  const marked = new THREE.Group();
  // One triangle for every colour, the same on all three: the colour says which chick it is.
  const tipTurn = tip === 'crown' ? 0 : 180;
  bare.add(new THREE.Mesh(once(`pointer:${tip}:${detail}`, () => decal(triangleShape(S.size, S.soften), spot, tipTurn, S.lift, detail)), markMat));
  const plate = shapeOutline(color, S.shape.size);
  marked.add(
    new THREE.Mesh(once(`plate:${color}:${detail}`, () => decal(plate.outline, spot, plate.turn, S.lift, detail)), markMat),
    new THREE.Mesh(once(`pointer:small:${tip}:${detail}`, () => decal(triangleShape(S.shape.pointer, S.soften), spot, tipTurn, S.lift + S.shape.lift, detail)), tintMat(color)),
  );
  marked.visible = false;
  symbol.add(bare, marked);
  const showShape = (on: boolean): void => {
    bare.visible = !on;
    marked.visible = on;
  };

  const root = new THREE.Group();
  root.add(feet, tail, body, wings, tuft, beak, eyes, symbol);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  // The blush is a tint on the skin: it throws no shadow.
  body.add(blush);
  return { root, body, tuft, wings, tail, feet, beak, eyes, symbol, showShape, setExpression };
}
