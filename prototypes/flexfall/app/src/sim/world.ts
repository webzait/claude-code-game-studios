// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The deterministic simulation: an elastic height field driven by clamps, and marbles that
// roll on it. Pure TypeScript, no DOM, no randomness, only + - * / and sqrt, on a fixed step:
// the same level and the same taps always give the same result.
import { DEFAULT_TRAY, type LevelData, type Tuning } from './types';

export interface SimEvent { type: 'hit' | 'wall' | 'catch'; x: number; z: number; speed: number; id: number; catcher: number }

interface Bump { x: number; z: number; r: number; h: number }

/** The whole simulated state of one level. */
export interface World {
  level: LevelData;
  halfW: number; halfD: number;
  /** Clamp state: index into heights, animated height and its speed. */
  aIndex: Int32Array; aHeight: Float64Array; aVel: Float64Array;
  /** Permanent bumps, catcher dimples included. */
  bumps: Bump[];
  n: number;
  px: Float64Array; pz: Float64Array; vx: Float64Array; vz: Float64Array;
  alive: Uint8Array;
  refX: Float64Array; refZ: Float64Array; still: Int32Array;
  collected: number;
  steps: number;
  events: SimEvent[];
}

/** Marble start positions: each group is a hexagonal cluster, nearest cells first. */
export function marblePositions(level: LevelData, radius: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const g of level.marbles) {
    const s = g.spacing ?? radius * 2.04;
    const cells: { x: number; z: number; d: number }[] = [];
    const R = 8;
    for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
      const x = s * (q + r * 0.5), z = s * r * 0.8660254037844386;
      cells.push({ x, z, d: x * x + z * z });
    }
    cells.sort((a, b) => (a.d - b.d) || (a.z - b.z) || (a.x - b.x));
    for (let i = 0; i < g.count; i++) out.push({ x: g.x + cells[i].x, z: g.z + cells[i].z });
  }
  return out;
}

/** Build a level's starting state. Calling it again is the reset: nothing carries over. */
export function createWorld(level: LevelData, t: Tuning): World {
  const tray = level.tray ?? DEFAULT_TRAY;
  const na = level.anchors.length;
  const pos = marblePositions(level, t.marble_radius);
  const n = pos.length;
  const w: World = {
    level, halfW: tray.w / 2, halfD: tray.d / 2,
    aIndex: new Int32Array(na), aHeight: new Float64Array(na), aVel: new Float64Array(na),
    bumps: [],
    n, px: new Float64Array(n), pz: new Float64Array(n), vx: new Float64Array(n), vz: new Float64Array(n),
    alive: new Uint8Array(n), refX: new Float64Array(n), refZ: new Float64Array(n), still: new Int32Array(n),
    collected: 0, steps: 0, events: [],
  };
  level.anchors.forEach((a, i) => { w.aIndex[i] = a.start ?? 0; w.aHeight[i] = a.heights[w.aIndex[i]]; });
  for (const b of level.bumps ?? []) w.bumps.push({ ...b });
  for (const c of level.catchers) w.bumps.push({ x: c.x, z: c.z, r: c.r * t.catch_reach, h: -t.catch_depth });
  pos.forEach((p, i) => { w.px[i] = p.x; w.pz[i] = p.z; w.refX[i] = p.x; w.refZ[i] = p.z; w.alive[i] = 1; });
  return w;
}

/** An independent copy, for the solver's search. */
export function cloneWorld(w: World): World {
  return {
    ...w,
    aIndex: w.aIndex.slice(), aHeight: w.aHeight.slice(), aVel: w.aVel.slice(),
    px: w.px.slice(), pz: w.pz.slice(), vx: w.vx.slice(), vz: w.vz.slice(), alive: w.alive.slice(),
    refX: w.refX.slice(), refZ: w.refZ.slice(), still: w.still.slice(), events: [],
  };
}

/** Tap a clamp: it heads for its next height. */
export function tapAnchor(w: World, i: number): void {
  const a = w.level.anchors[i];
  w.aIndex[i] = (w.aIndex[i] + 1) % a.heights.length;
}

/** The height a clamp is heading for. */
export function anchorTarget(w: World, i: number): number { return w.level.anchors[i].heights[w.aIndex[i]]; }

/** Floor height at a point: resting shape + permanent bumps + every clamp's bump. */
export function heightAt(w: World, x: number, z: number): number {
  const b = w.level.base;
  let h = 0;
  if (b) h = (b.tiltX ?? 0) * x + (b.tiltZ ?? 0) * z + (b.bowlX ?? 0) * x * x + (b.bowlZ ?? 0) * z * z;
  for (const s of w.bumps) {
    const dx = x - s.x, dz = z - s.z, q = 1 - (dx * dx + dz * dz) / (s.r * s.r);
    if (q > 0) h += s.h * q * q;
  }
  const an = w.level.anchors;
  for (let i = 0; i < an.length; i++) {
    const s = an[i], dx = x - s.x, dz = z - s.z, q = 1 - (dx * dx + dz * dz) / (s.r * s.r);
    if (q > 0) h += w.aHeight[i] * q * q;
  }
  return h;
}

const G = { gx: 0, gz: 0, kx: 0, kz: 0 };
/** Floor slope at a point (gx, gz), and how fast that slope is changing (kx, kz). */
function slopeAt(w: World, x: number, z: number): void {
  const b = w.level.base;
  let gx = 0, gz = 0, kx = 0, kz = 0;
  if (b) { gx = (b.tiltX ?? 0) + 2 * (b.bowlX ?? 0) * x; gz = (b.tiltZ ?? 0) + 2 * (b.bowlZ ?? 0) * z; }
  for (const s of w.bumps) {
    const dx = x - s.x, dz = z - s.z, r2 = s.r * s.r, q = 1 - (dx * dx + dz * dz) / r2;
    if (q > 0) { const f = -4 * s.h * q / r2; gx += f * dx; gz += f * dz; }
  }
  const an = w.level.anchors;
  for (let i = 0; i < an.length; i++) {
    const s = an[i], dx = x - s.x, dz = z - s.z, r2 = s.r * s.r, q = 1 - (dx * dx + dz * dz) / r2;
    if (q > 0) {
      const f = -4 * q / r2;
      gx += w.aHeight[i] * f * dx; gz += w.aHeight[i] * f * dz;
      kx += w.aVel[i] * f * dx; kz += w.aVel[i] * f * dz;
    }
  }
  G.gx = gx; G.gz = gz; G.kx = kx; G.kz = kz;
}

/** Floor slope at a point, for the view's normals. */
export function gradAt(w: World, x: number, z: number): { gx: number; gz: number } {
  slopeAt(w, x, z); return { gx: G.gx, gz: G.gz };
}

function pushEvent(w: World, type: SimEvent['type'], x: number, z: number, speed: number, id: number, catcher = -1): void {
  if (w.events.length < 256) w.events.push({ type, x, z, speed, id, catcher });
}

// Broad phase: a grid of cells one marble wide, rebuilt each step. Module-level scratch space.
let cellHead = new Int32Array(0), cellNext = new Int32Array(0);

/** Advance the world by one fixed step of dt seconds. */
export function stepWorld(w: World, t: Tuning, dt: number): void {
  const an = w.level.anchors, R = t.marble_radius;
  // 1. Clamps: a damped spring pulls each to its height, with a little overshoot.
  const k = t.anchor_stiffness * t.anchor_stiffness, c = 2 * t.anchor_damping * t.anchor_stiffness;
  for (let i = 0; i < an.length; i++) {
    const target = an[i].heights[w.aIndex[i]];
    w.aVel[i] += (k * (target - w.aHeight[i]) - c * w.aVel[i]) * dt;
    w.aHeight[i] += w.aVel[i] * dt;
  }
  // 2. Marbles: roll down the slope, slowed by rolling friction and drag.
  const g = t.gravity, fr = t.roll_friction * g;
  for (let i = 0; i < w.n; i++) {
    if (!w.alive[i]) continue;
    slopeAt(w, w.px[i], w.pz[i]);
    const s2 = 1 + G.gx * G.gx + G.gz * G.gz;
    const ax = -g * G.gx / s2 - t.floor_kick * 4 * G.kx, az = -g * G.gz / s2 - t.floor_kick * 4 * G.kz;
    let vx = w.vx[i], vz = w.vz[i];
    const sp = Math.sqrt(vx * vx + vz * vz), pull = Math.sqrt(ax * ax + az * az);
    if (sp < t.rest_speed && pull < t.rest_slope * g) { w.vx[i] = 0; w.vz[i] = 0; continue; }
    vx += ax * dt; vz += az * dt;
    let sp2 = Math.sqrt(vx * vx + vz * vz);
    if (sp2 > 0) {
      let ns = sp2 - (fr + t.drag * sp2) * dt;
      if (ns < 0) ns = 0;
      if (ns > t.max_speed) ns = t.max_speed;
      vx *= ns / sp2; vz *= ns / sp2;
    }
    w.vx[i] = vx; w.vz[i] = vz;
    w.px[i] += vx * dt; w.pz[i] += vz * dt;
  }
  // 3. Collisions: marble on marble, then walls, pegs and the tray. Fixed order: by index.
  const cell = R * 2, cols = Math.ceil((w.halfW * 2) / cell) + 2, rows = Math.ceil((w.halfD * 2) / cell) + 2;
  if (cellHead.length < cols * rows) cellHead = new Int32Array(cols * rows);
  if (cellNext.length < w.n) cellNext = new Int32Array(w.n);
  const e = t.marble_bounce, minB = t.bounce_min_speed, d2 = cell * cell;
  for (let pass = 0; pass < 4; pass++) {
    cellHead.fill(-1, 0, cols * rows);
    for (let i = w.n - 1; i >= 0; i--) {
      if (!w.alive[i]) continue;
      let cx = Math.floor((w.px[i] + w.halfW) / cell) + 1, cz = Math.floor((w.pz[i] + w.halfD) / cell) + 1;
      cx = cx < 0 ? 0 : cx >= cols ? cols - 1 : cx; cz = cz < 0 ? 0 : cz >= rows ? rows - 1 : cz;
      const ci = cz * cols + cx; cellNext[i] = cellHead[ci]; cellHead[ci] = i;
    }
    for (let i = 0; i < w.n; i++) {
      if (!w.alive[i]) continue;
      let cx = Math.floor((w.px[i] + w.halfW) / cell) + 1, cz = Math.floor((w.pz[i] + w.halfD) / cell) + 1;
      cx = cx < 0 ? 0 : cx >= cols ? cols - 1 : cx; cz = cz < 0 ? 0 : cz >= rows ? rows - 1 : cz;
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox, nz = cz + oz;
        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
        for (let j = cellHead[nz * cols + nx]; j >= 0; j = cellNext[j]) {
          if (j <= i) continue;
          let dx = w.px[j] - w.px[i], dz = w.pz[j] - w.pz[i];
          const dd = dx * dx + dz * dz;
          if (dd >= d2) continue;
          let d = Math.sqrt(dd);
          if (d < 1e-9) { dx = 1e-4 * (1 + (i % 3)); dz = 1e-4 * (1 + (j % 5)); d = Math.sqrt(dx * dx + dz * dz); }
          const ux = dx / d, uz = dz / d, half = (cell - d) * 0.5;
          w.px[i] -= ux * half; w.pz[i] -= uz * half; w.px[j] += ux * half; w.pz[j] += uz * half;
          const vn = (w.vx[j] - w.vx[i]) * ux + (w.vz[j] - w.vz[i]) * uz;
          if (vn < 0) {
            const imp = -(1 + (-vn > minB ? e : 0)) * vn * 0.5;
            w.vx[i] -= imp * ux; w.vz[i] -= imp * uz; w.vx[j] += imp * ux; w.vz[j] += imp * uz;
            if (-vn > minB) pushEvent(w, 'hit', w.px[i], w.pz[i], -vn, i);
          }
          // Marbles rub: touching ones lose part of their sideways slip, so a pile comes to rest.
          const tx = -uz, tz = ux, vt = ((w.vx[j] - w.vx[i]) * tx + (w.vz[j] - w.vz[i]) * tz) * 0.5 * t.marble_grip;
          w.vx[i] += vt * tx; w.vz[i] += vt * tz; w.vx[j] -= vt * tx; w.vz[j] -= vt * tz;
        }
      }
    }
    for (let i = 0; i < w.n; i++) if (w.alive[i]) solids(w, t, i, pass === 0);
  }
  // 4. Catchers, then the stillness count the rules read.
  const cs = w.level.catchers, mv2 = t.settle_move * t.settle_move, win = Math.max(1, Math.round(t.settle_time / dt));
  for (let i = 0; i < w.n; i++) {
    if (!w.alive[i]) continue;
    for (let ci = 0; ci < cs.length; ci++) {
      const dx = w.px[i] - cs[ci].x, dz = w.pz[i] - cs[ci].z, rr = cs[ci].r; // caught once its centre passes the rim
      if (dx * dx + dz * dz < rr * rr) {
        w.alive[i] = 0; w.collected++;
        pushEvent(w, 'catch', w.px[i], w.pz[i], Math.sqrt(w.vx[i] * w.vx[i] + w.vz[i] * w.vz[i]), i, ci);
        break;
      }
    }
    if (!w.alive[i]) continue;
    const mx = w.px[i] - w.refX[i], mz = w.pz[i] - w.refZ[i];
    if (mx * mx + mz * mz > mv2) { w.refX[i] = w.px[i]; w.refZ[i] = w.pz[i]; w.still[i] = 0; }
    else if (++w.still[i] % win === 0) { w.refX[i] = w.px[i]; w.refZ[i] = w.pz[i]; } // creep is measured per window
  }
  w.steps++;
}

/** Push marble i out of walls, pegs and the tray's sides, bouncing it. */
function solids(w: World, t: Tuning, i: number, report: boolean): void {
  const R = t.marble_radius;
  const bounce = (ux: number, uz: number): void => { // (ux, uz): unit normal pointing away from the solid
    const vn = w.vx[i] * ux + w.vz[i] * uz;
    if (vn < 0) {
      const f = -(1 + (-vn > t.bounce_min_speed ? t.wall_bounce : 0)) * vn;
      w.vx[i] += f * ux; w.vz[i] += f * uz;
      if (report && -vn > t.bounce_min_speed) pushEvent(w, 'wall', w.px[i], w.pz[i], -vn, i);
    }
  };
  for (const s of w.level.walls ?? []) {
    const ex = s.x2 - s.x1, ez = s.z2 - s.z1, len2 = ex * ex + ez * ez;
    let u = len2 > 0 ? ((w.px[i] - s.x1) * ex + (w.pz[i] - s.z1) * ez) / len2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const dx = w.px[i] - (s.x1 + ex * u), dz = w.pz[i] - (s.z1 + ez * u), min = R + s.t, dd = dx * dx + dz * dz;
    if (dd < min * min && dd > 1e-12) {
      const d = Math.sqrt(dd), ux = dx / d, uz = dz / d;
      w.px[i] += ux * (min - d); w.pz[i] += uz * (min - d); bounce(ux, uz);
    }
  }
  for (const p of w.level.pegs ?? []) {
    const dx = w.px[i] - p.x, dz = w.pz[i] - p.z, min = R + p.r, dd = dx * dx + dz * dz;
    if (dd < min * min && dd > 1e-12) {
      const d = Math.sqrt(dd), ux = dx / d, uz = dz / d;
      w.px[i] += ux * (min - d); w.pz[i] += uz * (min - d); bounce(ux, uz);
    }
  }
  for (const p of w.level.anchors) { // a clamp's foot is a solid post
    const dx = w.px[i] - p.x, dz = w.pz[i] - p.z, min = R + t.anchor_radius, dd = dx * dx + dz * dz;
    if (dd < min * min && dd > 1e-12) {
      const d = Math.sqrt(dd), ux = dx / d, uz = dz / d;
      w.px[i] += ux * (min - d); w.pz[i] += uz * (min - d); bounce(ux, uz);
    }
  }
  const mx = w.halfW - R, mz = w.halfD - R;
  if (w.px[i] < -mx) { w.px[i] = -mx; bounce(1, 0); } else if (w.px[i] > mx) { w.px[i] = mx; bounce(-1, 0); }
  if (w.pz[i] < -mz) { w.pz[i] = -mz; bounce(0, 1); } else if (w.pz[i] > mz) { w.pz[i] = mz; bounce(0, -1); }
}

/** True when every clamp has arrived and every marble has lain still for settle_time. */
export function isSettled(w: World, t: Tuning, dt: number): boolean {
  const an = w.level.anchors;
  for (let i = 0; i < an.length; i++) {
    const d = an[i].heights[w.aIndex[i]] - w.aHeight[i];
    if (d > 0.01 || d < -0.01 || w.aVel[i] > 0.05 || w.aVel[i] < -0.05) return false;
  }
  const need = t.settle_time / dt;
  for (let i = 0; i < w.n; i++) if (w.alive[i] && w.still[i] < need) return false;
  return true;
}

/** Marbles still on the floor. */
export function marblesLeft(w: World): number { return w.n - w.collected; }
