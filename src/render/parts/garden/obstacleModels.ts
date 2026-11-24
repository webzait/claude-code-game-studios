import * as THREE from 'three';
import data from '../../../../data/themes/garden/obstacles.json';
import type { GardenObstacleKind } from './obstacleChoice';
import { flowerGeometry, gardenMaterials, gridGeometry, leafGeometry, merged, orient, painted, seeded, shadowedMesh, tone, type FlowerColor, type LeafTones } from './plants';

/**
 * The garden obstacles modelled in code (the alternative to the owner's
 * pictures, which are the default: see `obstacles.ts`). A rock (plain or
 * mossy), a tree stump and a round bush (white or pink flowers), built from
 * `data/themes/garden/obstacles.json`. Same placement as the robot theme's
 * `buildObstacle`: a group standing on y = 0, centred on the cell, in cells.
 */

const deg = THREE.MathUtils.degToRad;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A direction from an azimuth (degrees: 0 = +x, to the viewer's right; 90 = +z, towards the viewer) and an elevation above the ground. */
function direction(azimuth: number, elevation: number): THREE.Vector3 {
  const a = deg(azimuth);
  const e = deg(elevation);
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
}

/** A vertex count scaled by `detail`, never below a usable minimum. */
const lod = (count: number, detail: number): number => Math.max(4, Math.round(count * detail));

function group(...meshes: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...meshes);
  return g;
}

/* ------------------------------------------------------------------ rock */

interface Plane {
  n: THREE.Vector3;
  d: number;
  shade: number;
}

/**
 * The rock as a distance from its centre in every direction: a squat
 * ellipsoid cut by a dozen and a half planes (a big top facet, an upper and a
 * lower ring of chunks, the floor), joined by a soft minimum so the facets
 * meet in rounded edges, with a shallow crack where two chunks meet.
 */
function rockShape() {
  const R = data.rock;
  const rand = seeded(R.seed);
  const a = R.halfWidth;
  const c = R.halfDepth;
  const up = R.height - R.centre;
  const down = R.centre * R.below;
  const support = (n: THREE.Vector3): number => Math.sqrt((a * n.x) ** 2 + ((n.y > 0 ? up : down) * n.y) ** 2 + (c * n.z) ** 2);
  const planes: Plane[] = [];
  const topN = new THREE.Vector3(R.top.tiltX, 1, R.top.tiltZ).normalize();
  planes.push({ n: topN, d: support(topN) * R.top.cut, shade: 1 });
  for (const ring of R.rings) {
    const offset = rand();
    for (let k = 0; k < ring.count; k++) {
      const az = ((k + offset + (rand() - 0.5) * 0.5) / ring.count) * 360;
      const n = direction(az, ring.elevation + (rand() - 0.5) * 2 * ring.jitter);
      planes.push({ n, d: support(n) * (ring.cut + (rand() - 0.5) * R.cutJitter), shade: 1 + (rand() - 0.5) * 2 * R.colors.facetJitter });
    }
  }
  const k = R.softness;
  const radius = (u: THREE.Vector3): { r: number; crack: number; facet: number; pair: number } => {
    const te = 1 / Math.sqrt((u.x / a) ** 2 + (u.y / (u.y > 0 ? up : down)) ** 2 + (u.z / c) ** 2);
    const tf = u.y < -1e-4 ? R.centre / -u.y : Infinity;
    let t1 = Infinity;
    let t2 = Infinity;
    let f1 = -1;
    let f2 = -1;
    const ts: number[] = [te, tf];
    planes.forEach((p, i) => {
      const dot = p.n.dot(u);
      if (dot <= 0.02) return;
      const t = p.d / dot;
      ts.push(t);
      if (t < t1) {
        t2 = t1;
        f2 = f1;
        t1 = t;
        f1 = i;
      } else if (t < t2) {
        t2 = t;
        f2 = i;
      }
    });
    const min = Math.min(...ts);
    let sum = 0;
    for (const t of ts) if (Number.isFinite(t)) sum += Math.exp(-k * (t - min));
    let r = min - Math.log(sum) / k;
    // A crack where two chunk faces meet, as long as both are actually cut into the rock.
    const both = smooth(-R.groove.width, R.groove.width, te - t2) * smooth(-R.groove.width, R.groove.width, tf - t2);
    const crack = Number.isFinite(t2) ? Math.exp(-(((t2 - t1) / R.groove.width) ** 2)) * both : 0;
    r -= R.groove.depth * crack;
    return { r, crack, facet: f1, pair: f1 * 31 + f2 };
  };
  return { radius, planes, centre: new THREE.Vector3(0, R.centre, 0) };
}

function buildRock(mossy: boolean, detail: number): THREE.Group {
  const R = data.rock;
  const C = R.colors;
  const shape = rockShape();
  const low = tone(C.low);
  const high = tone(C.high);
  const top = tone(C.top);
  const grooveTone = tone(C.groove);
  const foot = tone(C.foot);
  const crackMoss = tone(R.moss.crackTint);
  const u = new THREE.Vector3();
  // Rows bunch up over the visible upper part; the flat underside gets few.
  const around = lod(R.around, detail);
  const rowCount = lod(R.rows, detail);
  const theta = (j: number): number => {
    const t = j / (rowCount - 1);
    return t < 0.86 ? (t / 0.86) * deg(112) : deg(112) + ((t - 0.86) / 0.14) * deg(68);
  };
  const body = gridGeometry(around, rowCount, true, (i, j, p, col) => {
    const th = theta(j);
    const ph = -(i / around) * Math.PI * 2;
    u.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    const s = shape.radius(u);
    p.copy(u).multiplyScalar(s.r).add(shape.centre);
    const h = Math.min(1, Math.max(0, p.y / R.height));
    col.copy(low).lerp(high, smooth(0.05, 0.85, h));
    if (s.facet === 0) col.lerp(top, smooth(0.6, 0.9, h));
    else if (s.facet > 0) col.multiplyScalar(shape.planes[s.facet].shade);
    col.lerp(foot, 0.6 * (1 - smooth(0, 0.12, h)));
    const crackTone = mossy && ((s.pair * 2654435761) >>> 0) / 4294967296 < R.moss.crackShare && h < 0.75 ? crackMoss : grooveTone;
    col.lerp(crackTone, (crackTone === grooveTone ? 0.75 : 0.55) * s.crack);
  });
  const meshes = [shadowedMesh(body, gardenMaterials.stone)];
  if (mossy) meshes.push(shadowedMesh(mossGeometry(shape, detail), gardenMaterials.plant));
  const g = group(...meshes);
  return g;
}

/** The moss cap: a thick rosette of rounded lobes draped over the rock's shoulder, plus a few small clumps lower down. */
function mossGeometry(shape: ReturnType<typeof rockShape>, detail: number): THREE.BufferGeometry {
  const M = data.rock.moss;
  const centre = direction(M.azimuth, M.elevation);
  const e1 = new THREE.Vector3(0, 1, 0).cross(centre).normalize();
  const e2 = new THREE.Vector3().crossVectors(centre, e1);
  const reach = deg(M.reach);
  const [tc, tm, te, tv] = [M.colors.centre, M.colors.mid, M.colors.edge, M.colors.vein].map(tone);
  const u = new THREE.Vector3();
  const rows = lod(M.rows, detail);
  const around = lod(M.around, detail);
  const cap = gridGeometry(around, rows + 2, true, (i, j, p, col) => {
    const beta = -(i / around) * Math.PI * 2;
    const lobe = Math.abs(Math.cos((M.petals * beta) / 2)) ** 0.6;
    const edgeAngle = reach * (1 - M.scallop / 2 + M.scallop * lobe);
    // Rows run from the centre out; the last two tuck the rim back into the stone.
    const s = j <= rows ? 1 - (1 - j / rows) ** 1.6 : 1.035;
    const alpha = edgeAngle * Math.min(s, 1.035);
    u.copy(centre).multiplyScalar(Math.cos(alpha)).addScaledVector(e1, Math.sin(alpha) * Math.cos(beta)).addScaledVector(e2, Math.sin(alpha) * Math.sin(beta)).normalize();
    const r = shape.radius(u).r;
    const lift = j <= rows ? M.thickness * Math.sqrt(Math.max(0, 1 - s * s)) * (0.8 + 0.2 * lobe) + 0.002 : -0.006;
    p.copy(u).multiplyScalar(r + lift).add(shape.centre);
    col.copy(tc).lerp(tm, smooth(0.1, 0.6, s)).lerp(te, smooth(0.75, 1, s));
    col.lerp(tv, 0.35 * lobe ** 8 * smooth(0.25, 0.7, s) * (1 - smooth(0.85, 1, s)));
  }, true);
  const pieces = [cap];
  const rand = seeded(data.rock.seed + 101);
  for (const tuft of M.tufts) {
    const base = direction(tuft.azimuth, tuft.elevation);
    for (let k = 0; k < tuft.count; k++) {
      const jitter = base.clone().add(new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).multiplyScalar(tuft.size * 2.2)).normalize();
      const r = shape.radius(jitter).r;
      const size = tuft.size * (0.55 + 0.45 * rand());
      const ball = new THREE.SphereGeometry(size, lod(12, detail), lod(8, detail));
      painted(ball, (q, _n, col) => col.copy(te).lerp(tm, Math.max(0, q.y / size)).lerp(tc, Math.max(0, q.y / size) ** 3));
      const at = jitter.multiplyScalar(r + size * 0.25).add(shape.centre);
      ball.translate(at.x, at.y, at.z);
      pieces.push(ball);
    }
  }
  return merged(pieces);
}

/* ----------------------------------------------------------------- stump */

function buildStump(detail: number): THREE.Group {
  const S = data.stump;
  const C = S.colors;
  const rand = seeded(S.seed);
  const notches: number[] = [];
  for (let k = 0; k < S.notches.count; k++) notches.push(((k + 0.5 + (rand() - 0.5) * S.notches.jitter) / S.notches.count) * Math.PI * 2);
  /** Distance (along the rim, in cells at radius `r`) to the nearest notch. */
  const notchAt = (phi: number, r: number): number => {
    let best = Infinity;
    for (const n of notches) {
      let d = Math.abs(phi - n) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      best = Math.min(best, d * r);
    }
    return Math.max(0, 1 - best / S.notches.width) ** 2;
  };
  const H = S.height;
  const rTop = S.radiusTop;
  // The profile from the foot up the side, over the rounded edge and in across the top.
  type Row = { r: number; y: number; part: 'side' | 'edge' | 'top' };
  const rows: Row[] = [];
  const sideRows = lod(S.sideRows, detail);
  const edgeRows = lod(S.edgeRows, detail);
  const topRows = lod(S.topRows, detail);
  for (let j = 0; j < sideRows; j++) {
    const t = j / (sideRows - 1);
    const y = t * (H - S.edgeRound);
    const flare = (1 - smooth(0, S.flare / H, t * (H - S.edgeRound) / H)) * (S.radiusBottom - rTop);
    rows.push({ r: rTop + flare + (S.radiusBottom - rTop) * 0.25 * (1 - t), y, part: 'side' });
  }
  for (let j = 1; j <= edgeRows; j++) {
    const a = (j / edgeRows) * (Math.PI / 2);
    rows.push({ r: rTop - S.edgeRound + S.edgeRound * Math.cos(a), y: H - S.edgeRound + S.edgeRound * Math.sin(a), part: 'edge' });
  }
  const inner = rTop - S.edgeRound;
  for (let j = 1; j <= topRows; j++) {
    const t = j / topRows;
    rows.push({ r: inner * (1 - t) ** 1.12, y: H, part: 'top' });
  }
  const bandAt = rTop - S.band;
  const [sideTop, sideLow, barkGroove, edge, topTone, band, ring, notchTone, foot] = [C.sideTop, C.sideLow, C.barkGroove, C.edge, C.top, C.band, C.ring, C.notch, C.foot].map(tone);
  const B = S.bark;
  const around = lod(S.around, detail);
  const body = gridGeometry(around, rows.length, true, (i, j, p, col) => {
    const phi = -(i / around) * Math.PI * 2;
    const row = rows[j];
    let r = row.r;
    let y = row.y;
    if (row.part === 'side') {
      const h = y / H;
      const wave = B.wobble * Math.sin(5 * h + 2 * phi) + 0.3 * Math.sin(11 * h - phi * 3);
      const line = (1 - Math.abs(Math.sin((B.lines / 2) * phi + wave))) ** B.sharp;
      const n = notchAt(phi, r) * smooth(1 - S.notches.reach, 1, h);
      r -= B.depth * line + S.notches.depthSide * n;
      col.copy(sideLow).lerp(sideTop, smooth(0, 1, h)).lerp(barkGroove, 0.6 * line + 0.7 * n);
      col.lerp(foot, 0.55 * (1 - smooth(0, 0.18, h)));
    } else if (row.part === 'edge') {
      const n = notchAt(phi, r);
      y -= S.notches.depthTop * n;
      r -= S.notches.depthSide * n;
      col.copy(sideTop).lerp(edge, (j - sideRows + 1) / edgeRows).lerp(notchTone, 0.8 * n);
    } else {
      const rel = r / inner;
      y += S.dome * (1 - rel * rel);
      const bandGroove = Math.exp(-(((r - bandAt) / S.bandGroove.width) ** 2));
      y -= S.bandGroove.depth * bandGroove;
      let ringGroove = 0;
      for (const at of S.rings) ringGroove = Math.max(ringGroove, Math.exp(-(((r - at) / S.ringGroove.width) ** 2)));
      y -= S.ringGroove.depth * ringGroove;
      const n = r > bandAt ? notchAt(phi, r) * smooth(bandAt, bandAt + 0.015, r) : 0;
      y -= S.notches.depthTop * n;
      col.copy(r > bandAt ? band : topTone).lerp(edge, smooth(inner - 0.01, inner, r) * 0.5);
      col.lerp(ring, Math.max(ringGroove, bandGroove) * 0.9).lerp(notchTone, 0.85 * n);
    }
    p.set(r * Math.cos(phi), y, r * Math.sin(phi));
  }, true);
  // Leaves and small sprouts round the foot.
  const pieces: THREE.BufferGeometry[] = [];
  const leafTones: LeafTones = { body: tone(S.leafColors.body), light: tone(S.leafColors.light), dark: tone(S.leafColors.dark) };
  for (const leaf of S.leaves) {
    const out = direction(leaf.azimuth, 0);
    // Standing almost upright round the foot, the upper face turned outwards, so both the game
    // camera (from above) and a front view see the face; swung a little sideways for a fan.
    const at = out.clone().multiplyScalar(S.radiusBottom * 0.98).setY(0.01);
    const forward = direction(leaf.azimuth + leaf.swing, leaf.lift);
    pieces.push(orient(leafGeometry(leaf.size, leafTones, { detail }), at, forward, out, deg(leaf.twist)));
  }
  for (const sprout of S.sprouts) {
    for (let k = -1; k <= 1; k++) {
      const out = direction(sprout.azimuth + k * 9, 0);
      const at = out.clone().multiplyScalar(S.radiusBottom * 0.97);
      const forward = direction(sprout.azimuth + k * 28, 62 - Math.abs(k) * 18);
      pieces.push(orient(leafGeometry(sprout.size * (k === 0 ? 1.1 : 0.85), leafTones, { detail: 0.6 * detail }), at, forward, out.clone().negate().setY(0.4), 0));
    }
  }
  return group(shadowedMesh(body, gardenMaterials.wood), shadowedMesh(merged(pieces), gardenMaterials.plant));
}

/* ------------------------------------------------------------------ bush */

function buildBush(flowers: 'white' | 'pink', detail: number): THREE.Group {
  const B = data.bush;
  const C = B.colors;
  const rand = seeded(B.seed);
  const a = B.halfWidth;
  const h = B.height;
  const surface = (dir: THREE.Vector3, scale = 1): THREE.Vector3 =>
    new THREE.Vector3(dir.x * a * scale, Math.max(0, dir.y) * h * scale + Math.min(0, dir.y) * 0.08, dir.z * a * scale);
  const [topTone, midTone, lowTone, coreTone] = [C.top, C.mid, C.low, C.core].map(tone);
  const toneAt = (elevation: number): THREE.Color => {
    const t = (elevation + 10) / 95;
    return t > 0.5 ? midTone.clone().lerp(topTone, (t - 0.5) / 0.5) : lowTone.clone().lerp(midTone, t / 0.5);
  };
  const pieces: THREE.BufferGeometry[] = [];
  // A dark round core, so no light shows between the leaves.
  const core = new THREE.SphereGeometry(1, lod(28, detail), lod(14, detail), 0, Math.PI * 2, 0, Math.PI / 2);
  core.scale(a * 0.86, h * 0.86, a * 0.86);
  painted(core, (p, _n, col) => col.copy(coreTone).lerp(lowTone, p.y / h));
  pieces.push(core);
  const J = B.jitter;
  B.rows.forEach((row, r) => {
    for (let k = 0; k < row.count; k++) {
      const az = ((k + (r % 2) * 0.5 + (rand() - 0.5) * J.azimuth) / row.count) * 360;
      const elevation = row.elevation;
      // The stalk sits a little higher on the dome, the leaf points down the slope and lifts off it.
      const stalkEl = Math.min(89, elevation + 14);
      const stalkDir = direction(az, stalkEl);
      const at = surface(stalkDir, 0.9);
      const normal = new THREE.Vector3(stalkDir.x / a, Math.max(0.05, stalkDir.y) / h, stalkDir.z / a).normalize();
      // Down the slope: along the meridian, away from the top; flat outward at the very top.
      const down = surface(direction(az, stalkEl - 2)).sub(surface(direction(az, stalkEl))).normalize();
      // Leaves near the top stand up more, like a closing rosette; low ones lie close and tuck in.
      const lift = deg(B.lift.bottom + (B.lift.top - B.lift.bottom) * Math.max(0, elevation) / 90);
      const forward = down.clone().multiplyScalar(Math.cos(lift)).addScaledVector(normal, Math.sin(lift));
      const size = row.size * (1 + (rand() - 0.5) * 2 * J.size);
      const body = toneAt(elevation).multiplyScalar(0.94 + rand() * 0.12);
      const tones: LeafTones = { body, light: body.clone().lerp(topTone, 0.6).multiplyScalar(1.1), dark: body.clone().lerp(coreTone, 0.6) };
      pieces.push(orient(leafGeometry(size, tones, { closed: false, detail: 0.75 * detail, ...B.leaf }), at, forward, normal, deg((rand() - 0.5) * 2 * J.twist)));
    }
  });
  for (const f of B.flowers[flowers]) {
    const dir = direction(f.azimuth, f.elevation);
    const normal = new THREE.Vector3(dir.x / a, dir.y / h, dir.z / a).normalize();
    const at = surface(dir, 1.02);
    const flower = flowerGeometry(f.size, f.color as FlowerColor, 0.8 * detail);
    // The flower faces out of the bush: its +y along the normal.
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    flower.applyQuaternion(q).translate(at.x, at.y, at.z);
    pieces.push(flower);
  }
  return group(shadowedMesh(merged(pieces), gardenMaterials.plant));
}

/* ------------------------------------------------------------- contract */

/**
 * One garden obstacle modelled in code, filling one cell: a group standing on
 * y = 0, centred on x = z = 0, to be placed at the floor tile's height like
 * the robot theme's `buildObstacle()`. `kind` picks the obstacle (default: the plain
 * rock), `turn` turns it by quarter turns so neighbouring copies differ;
 * `detail` scales the mesh density (1 = the close-up quality of the parts
 * page; the default is the lighter game setting from the data file);
 * `chooseObstacles` in `obstacleChoice.ts` picks the kind and the turn per cell.
 */
export function buildObstacleModel(kind: GardenObstacleKind = 'rock', turn = 0, detail: number = data.detail.game): THREE.Group {
  const built =
    kind === 'rock' ? buildRock(false, detail)
    : kind === 'rockMossy' ? buildRock(true, detail)
    : kind === 'stump' ? buildStump(detail)
    : buildBush(kind === 'bushPink' ? 'pink' : 'white', detail);
  const box = new THREE.Box3().setFromObject(built);
  for (const child of built.children) (child as THREE.Mesh).geometry.translate(0, -box.min.y, 0);
  built.rotation.y = (turn % 4) * (Math.PI / 2);
  built.userData.kind = kind;
  return built;
}

/** Every garden obstacle kind, in the order the parts page shows them. */
export const GARDEN_OBSTACLE_KINDS: readonly GardenObstacleKind[] = ['rock', 'rockMossy', 'stump', 'bushWhite', 'bushPink'];
