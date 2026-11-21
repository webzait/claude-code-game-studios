// PROTOTYPE - NOT FOR PRODUCTION
// SPRINGBANK's physics: a small 2D engine of its own, with no rendering and no clock.
// One call to step() advances exactly DT seconds. No Math.random, a fixed iteration order:
// the same level and the same input give the same game, every time.
import { tune } from './tune.ts';
import type { LevelDef } from './levels.ts';

/** Simulation step in seconds. */
export const DT = 1 / 120;
/** Board size in world units. */
export const WORLD_W = 9;
export const WORLD_H = 16;
/** Height of the tray floor with an empty spring. */
export const TRAY_REST_Y = 2.0;
/** Height of a goal hood above its mouth. */
export const GOAL_H = 1.1;
/** Half thickness of bars and goal walls. */
export const WALL_R = 0.1;

/** Ball states. Every ball is in exactly one of them at any time. */
export const QUEUED = 0; // waiting above the board to fall again
export const FREE = 1; // moving on the board
export const HELD = 2; // in the tray
export const SCORED = 3; // in a goal

export type Input = { hold: boolean; targetX: number };
export type Status = 'playing' | 'won' | 'lost';
export type SimEvent =
  | { type: 'catch'; id: number; energy: number; held: number }
  | { type: 'full'; id: number }
  | { type: 'launch'; count: number; speed: number; power: number; x: number; y: number }
  | { type: 'score'; goal: number; x: number; y: number }
  | { type: 'goalfull'; goal: number }
  | { type: 'won' }
  | { type: 'lost' };

type Seg = { x1: number; y1: number; x2: number; y2: number; r: number; goal: number; lid: boolean; bar: number };

/** Deterministic hash of two integers to [0, 1). */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Launch speed for a stored energy and a ball count: v = sqrt(2 * eta * E / (n*m + M)). */
export function launchSpeed(energy: number, count: number): number {
  if (count <= 0) return 0;
  const m = count * tune.ball_mass + tune.piston_mass * tune.ball_mass;
  return Math.min(tune.launch_speed_max, Math.sqrt((2 * tune.spring_gain * energy) / m));
}

/** Kinetic energy of one ball at a speed: E = 1/2 * m * v^2. */
export function kineticEnergy(vx: number, vy: number): number {
  return 0.5 * tune.ball_mass * (vx * vx + vy * vy);
}

export class Sim {
  readonly level: LevelDef;
  readonly n: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly state: Uint8Array;
  /** 1 while a ball is in the air after a launch and has not yet scored, fallen out or been caught. */
  readonly flight: Uint8Array;
  /** Slot index of a held ball in the tray. */
  readonly slot: Int16Array;
  /** Tick at which a queued ball may fall again. */
  readonly ready: Int32Array;

  tick = 0;
  status: Status = 'playing';
  trayX: number;
  trayVX = 0;
  energy = 0;
  held = 0;
  scored = 0;
  launchesUsed = 0;
  lastLaunchTick = -1;
  lastLaunchPower = 0;
  readonly goalCount: number[];
  readonly events: SimEvent[] = [];

  private holding = false;
  private readonly heldIds: number[] = [];
  private readonly queue: number[] = [];
  private spawnCount = 0;
  private nextSpawnTick = 0;
  private readonly segs: Seg[] = [];
  private readonly seed: number;
  // spatial hash grid
  private cell = 0.5;
  private cols = 0;
  private rows = 0;
  private gridY0 = -2;
  private head: Int16Array = new Int16Array(0);
  private next: Int16Array;

  constructor(level: LevelDef, seed = tune.seed) {
    this.level = level;
    this.seed = seed;
    const n = (this.n = level.balls);
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.state = new Uint8Array(n); this.flight = new Uint8Array(n);
    this.slot = new Int16Array(n); this.ready = new Int32Array(n);
    this.next = new Int16Array(n);
    this.trayX = level.trayStart ?? WORLD_W / 2;
    this.goalCount = level.goals.map(() => 0);
    for (let i = 0; i < n; i++) { this.state[i] = QUEUED; this.queue.push(i); this.y[i] = WORLD_H + 2; }
    // static geometry: bars, then each goal's hood (two walls, a peaked roof, a lid when full)
    level.bars.forEach((b, i) => this.segs.push({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, r: WALL_R, goal: -1, lid: false, bar: i }));
    level.goals.forEach((g, i) => {
      const l = g.x - g.w / 2 - WALL_R, r = g.x + g.w / 2 + WALL_R, top = g.y + GOAL_H;
      const add = (x1: number, y1: number, x2: number, y2: number, lid = false) =>
        this.segs.push({ x1, y1, x2, y2, r: WALL_R, goal: i, lid, bar: -1 });
      add(l, g.y, l, top); add(r, g.y, r, top);
      add(l, top, g.x, top + 0.45); add(g.x, top + 0.45, r, top);
      add(l, g.y, r, g.y, true);
    });
  }

  // ---- Readouts ----------------------------------------------------------------------

  get capacity(): number { return Math.min(this.level.capacity ?? 999, tune.tray_capacity); }
  get launchesLeft(): number { return this.level.launches - this.launchesUsed; }
  get catching(): boolean { return this.holding && this.launchesLeft > 0 && this.status === 'playing'; }
  /** Fill of the spring, 0 to 1. */
  get charge(): number { return Math.min(1, this.energy / tune.energy_capacity); }
  /** How far the spring is pressed in, in units: x = travel * sqrt(E / Emax), as E = 1/2 k x^2. */
  get compression(): number { return tune.spring_travel * Math.sqrt(this.charge); }
  get trayFloorY(): number { return TRAY_REST_Y - this.compression; }
  /** Offset of a bar at the current tick (moving bars slide on a sine). */
  barOffset(i: number): { dx: number; dy: number } {
    const m = this.level.bars[i].move;
    if (!m) return { dx: 0, dy: 0 };
    const s = Math.sin((2 * Math.PI * this.tick * DT) / m.period + (m.phase ?? 0));
    return { dx: m.dx * s, dy: m.dy * s };
  }

  /** Position of tray slot k relative to the tray: rows of 6 and 5 balls, packed like a honeycomb. */
  slotPos(k: number): { x: number; y: number } {
    const r = tune.ball_radius * 1.02;
    const wide = Math.max(2, Math.floor(tune.tray_width / (2 * r)));
    const per = wide * 2 - 1, cyc = Math.floor(k / per), p = k % per;
    const odd = p >= wide, col = odd ? p - wide : p, row = cyc * 2 + (odd ? 1 : 0);
    const cnt = odd ? wide - 1 : wide;
    return { x: (col - (cnt - 1) / 2) * 2 * r, y: r + row * r * Math.sqrt(3) };
  }

  /** Height the launch would reach right now: the pile's top plus v^2 / 2g. 0 with an empty tray. */
  predictedApex(): number {
    if (this.held === 0) return 0;
    const v = launchSpeed(this.energy, this.held);
    const top = this.trayFloorY + this.slotPos(this.held - 1).y;
    return Math.min(WORLD_H, top + (v * v) / (2 * tune.gravity));
  }

  count(state: number): number {
    let c = 0;
    for (let i = 0; i < this.n; i++) if (this.state[i] === state) c++;
    return c;
  }

  inFlight(): number {
    let c = 0;
    for (let i = 0; i < this.n; i++) c += this.flight[i];
    return c;
  }

  // ---- The step ----------------------------------------------------------------------

  /** Advance the world by DT with this tick's input. */
  step(input: Input): void {
    const r = tune.ball_radius;
    this.tick++;

    // 1. the tray follows the finger at a capped speed
    const half = tune.tray_width / 2 + 0.15;
    const target = Math.min(WORLD_W - half, Math.max(half, input.targetX));
    const maxMove = tune.tray_speed * DT;
    const move = Math.min(maxMove, Math.max(-maxMove, target - this.trayX));
    this.trayX += move; this.trayVX = move / DT;

    // 2. hold and release
    if (this.status === 'playing') {
      if (this.holding && !input.hold) this.launch();
      this.holding = input.hold;
    } else this.holding = false;

    // 3. the stream: one queued ball leaves the top every spawn interval
    if (this.tick >= this.nextSpawnTick && this.queue.length > 0 && this.ready[this.queue[0]] <= this.tick) {
      this.spawn(this.queue.shift()!);
      this.nextSpawnTick = this.tick + Math.max(1, Math.round((this.level.spawnInterval ?? tune.spawn_interval) / DT));
    }

    // 4. free balls: gravity, drag, move
    const g = tune.gravity * DT, drag = 1 - tune.air_drag * DT;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== FREE) continue;
      this.vy[i] = (this.vy[i] - g) * drag; this.vx[i] *= drag;
      this.x[i] += this.vx[i] * DT; this.y[i] += this.vy[i] * DT;
    }

    // 5. collisions: ball against ball (grid), then the static world
    this.collideBalls(r);
    for (let i = 0; i < this.n; i++) if (this.state[i] === FREE) this.collideWorld(i, r);

    // 6. the tray catches, goals collect, the pit recycles
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== FREE) continue;
      if (this.catching) this.tryCatch(i, r);
      if (this.state[i] === FREE) this.tryScore(i);
      if (this.state[i] === FREE && this.y[i] < -1) this.recycle(i);
    }

    // 7. held balls ride in the tray
    const floor = this.trayFloorY;
    for (const id of this.heldIds) {
      const p = this.slotPos(this.slot[id]);
      this.x[id] = this.trayX + p.x; this.y[id] = floor + p.y;
    }

    // 8. judge: win at once, lose only when the last launch has settled
    if (this.status === 'playing') {
      if (this.scored >= this.level.target) { this.status = 'won'; this.events.push({ type: 'won' }); }
      else if (this.launchesLeft <= 0 && this.held === 0) {
        const timedOut = this.tick - this.lastLaunchTick > tune.settle_timeout / DT;
        if (this.inFlight() === 0 || timedOut) { this.status = 'lost'; this.events.push({ type: 'lost' }); }
      }
    }
  }

  private spawn(i: number): void {
    const s = this.level.streams, k = this.spawnCount++;
    this.state[i] = FREE; this.flight[i] = 0;
    this.x[i] = s[k % s.length] + (hash01(k, this.seed) - 0.5) * 0.36;
    this.y[i] = WORLD_H + 0.6;
    this.vx[i] = (hash01(k, this.seed + 77) - 0.5) * 0.5;
    this.vy[i] = -2;
  }

  private recycle(i: number): void {
    this.state[i] = QUEUED; this.flight[i] = 0;
    this.vx[i] = 0; this.vy[i] = 0; this.y[i] = WORLD_H + 2;
    this.ready[i] = this.tick + Math.round(tune.recycle_delay / DT);
    this.queue.push(i);
  }

  private tryCatch(i: number, r: number): void {
    const dx = this.x[i] - this.trayX, halfW = tune.tray_width / 2;
    if (Math.abs(dx) > halfW || this.vy[i] > 1) return;
    const floor = this.trayFloorY;
    const full = this.held >= this.capacity;
    const top = floor + this.slotPos(full ? this.held - 1 : this.held).y + (full ? r : 0);
    if (this.y[i] > top + r * 0.5 || this.y[i] < floor - r) return;
    if (full) { // a full tray takes no more: the ball bounces off the pile and rolls away
      this.y[i] = top + r * 0.5;
      this.vy[i] = Math.abs(this.vy[i]) * 0.3 + 1.5;
      this.vx[i] += (dx >= 0 ? 1 : -1) * (2.5 + Math.abs(dx));
      this.events.push({ type: 'full', id: i });
      return;
    }
    const e = kineticEnergy(this.vx[i], this.vy[i]);
    this.energy = Math.min(tune.energy_capacity, this.energy + e);
    this.state[i] = HELD; this.flight[i] = 0; this.slot[i] = this.held;
    this.vx[i] = 0; this.vy[i] = 0;
    this.heldIds.push(i); this.held++;
    this.events.push({ type: 'catch', id: i, energy: e, held: this.held });
  }

  /** Release: the spring throws every held ball straight up at one speed. An empty tray costs nothing. */
  private launch(): void {
    if (this.held === 0 || this.launchesLeft <= 0) return;
    const v = launchSpeed(this.energy, this.held), floor = this.trayFloorY;
    const power = this.charge, count = this.held;
    for (const id of this.heldIds) {
      const p = this.slotPos(this.slot[id]);
      this.state[id] = FREE; this.flight[id] = 1;
      this.x[id] = this.trayX + p.x; this.y[id] = floor + p.y;
      this.vx[id] = (hash01(id, this.launchesUsed + this.seed * 31) - 0.5) * 2 * tune.launch_spread;
      this.vy[id] = v;
    }
    this.heldIds.length = 0; this.held = 0; this.energy = 0;
    this.launchesUsed++; this.lastLaunchTick = this.tick; this.lastLaunchPower = power;
    this.events.push({ type: 'launch', count, speed: v, power, x: this.trayX, y: floor });
  }

  private tryScore(i: number): void {
    const goals = this.level.goals;
    for (let k = 0; k < goals.length; k++) {
      const g = goals[k];
      if (this.goalCount[k] >= g.capacity) continue;
      if (Math.abs(this.x[i] - g.x) < g.w / 2 && this.y[i] > g.y + 0.3 && this.y[i] < g.y + GOAL_H) {
        this.state[i] = SCORED; this.flight[i] = 0; this.vx[i] = 0; this.vy[i] = 0;
        this.goalCount[k]++; this.scored++;
        this.events.push({ type: 'score', goal: k, x: this.x[i], y: this.y[i] });
        if (this.goalCount[k] >= g.capacity) this.events.push({ type: 'goalfull', goal: k });
        return;
      }
    }
  }

  private collideBalls(r: number): void {
    const cell = (this.cell = Math.max(2 * r, 0.3));
    const cols = Math.ceil(WORLD_W / cell) + 2, rows = Math.ceil((WORLD_H + 4) / cell) + 2;
    if (cols * rows !== this.head.length || cols !== this.cols) { this.head = new Int16Array(cols * rows); this.cols = cols; this.rows = rows; }
    const head = this.head, next = this.next;
    head.fill(-1);
    for (let i = this.n - 1; i >= 0; i--) {
      if (this.state[i] !== FREE) continue;
      const c = this.cellOf(this.x[i], this.y[i]);
      next[i] = head[c]; head[c] = i;
    }
    const e = tune.restitution_ball, mu = tune.friction, d = 2 * r, d2 = d * d;
    for (let i = 0; i < this.n; i++) {
      if (this.state[i] !== FREE) continue;
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(this.x[i] / cell) + 1));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor((this.y[i] - this.gridY0) / cell)));
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy; if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox; if (xx < 0 || xx >= cols) continue;
          for (let j = head[yy * cols + xx]; j >= 0; j = next[j]) {
            if (j <= i) continue;
            const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i], dd = dx * dx + dy * dy;
            if (dd >= d2 || dd < 1e-10) continue;
            const dist = Math.sqrt(dd), nx = dx / dist, ny = dy / dist, push = (d - dist) / 2;
            this.x[i] -= nx * push; this.y[i] -= ny * push; this.x[j] += nx * push; this.y[j] += ny * push;
            const rvx = this.vx[j] - this.vx[i], rvy = this.vy[j] - this.vy[i], vn = rvx * nx + rvy * ny;
            if (vn >= 0) continue;
            const jn = (-(1 + e) * vn) / 2;
            const tx = -ny, ty = nx, jt = ((rvx * tx + rvy * ty) * mu) / 2;
            this.vx[i] -= jn * nx - jt * tx; this.vy[i] -= jn * ny - jt * ty;
            this.vx[j] += jn * nx - jt * tx; this.vy[j] += jn * ny - jt * ty;
          }
        }
      }
    }
  }

  private cellOf(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell) + 1));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor((y - this.gridY0) / this.cell)));
    return cy * this.cols + cx;
  }

  private collideWorld(i: number, r: number): void {
    const e = tune.restitution_wall;
    // side walls and the ceiling (balls enter from above it, so it only stops rising balls)
    if (this.x[i] < r) { this.x[i] = r; if (this.vx[i] < 0) this.vx[i] = -this.vx[i] * e; }
    else if (this.x[i] > WORLD_W - r) { this.x[i] = WORLD_W - r; if (this.vx[i] > 0) this.vx[i] = -this.vx[i] * e; }
    if (this.vy[i] > 0 && this.y[i] > WORLD_H - r && this.y[i] < WORLD_H + r) { this.y[i] = WORLD_H - r; this.vy[i] = -this.vy[i] * e; }
    for (const p of this.level.pegs) this.bounce(i, p.x, p.y, p.r + r, e);
    for (const s of this.segs) {
      if (s.lid && this.goalCount[s.goal] < this.level.goals[s.goal].capacity) continue;
      let ox = 0, oy = 0;
      if (s.bar >= 0) { const o = this.barOffset(s.bar); ox = o.dx; oy = o.dy; }
      const ax = s.x1 + ox, ay = s.y1 + oy, bx = s.x2 + ox - ax, by = s.y2 + oy - ay;
      const t = Math.min(1, Math.max(0, ((this.x[i] - ax) * bx + (this.y[i] - ay) * by) / (bx * bx + by * by)));
      this.bounce(i, ax + bx * t, ay + by * t, s.r + r, e);
    }
  }

  /** Push ball i out of a circle of radius R at (cx, cy) and reflect its velocity. */
  private bounce(i: number, cx: number, cy: number, R: number, e: number): void {
    const dx = this.x[i] - cx, dy = this.y[i] - cy, dd = dx * dx + dy * dy;
    if (dd >= R * R) return;
    const dist = Math.sqrt(dd) || 1e-6, nx = dist > 1e-6 ? dx / dist : 0, ny = dist > 1e-6 ? dy / dist : 1;
    this.x[i] = cx + nx * R; this.y[i] = cy + ny * R;
    const vn = this.vx[i] * nx + this.vy[i] * ny;
    if (vn >= 0) return;
    const tx = -ny, ty = nx, vt = (this.vx[i] * tx + this.vy[i] * ty) * (1 - tune.friction);
    this.vx[i] = -vn * e * nx + vt * tx; this.vy[i] = -vn * e * ny + vt * ty;
  }
}

/** A recorded run: at each listed tick the input changes to hold and targetX. */
export type InputEvent = { t: number; hold: boolean; x: number };

/** Replay recorded input from a fresh level until it is won, lost or maxTicks pass. */
export function replay(level: LevelDef, inputs: InputEvent[], maxTicks = 120 * 90, onStep?: (s: Sim) => void): Sim {
  const sim = new Sim(level);
  const input: Input = { hold: false, targetX: sim.trayX };
  let k = 0;
  while (sim.tick < maxTicks && sim.status === 'playing') {
    while (k < inputs.length && inputs[k].t <= sim.tick) { input.hold = inputs[k].hold; input.targetX = inputs[k].x; k++; }
    sim.step(input);
    onStep?.(sim);
  }
  return sim;
}
