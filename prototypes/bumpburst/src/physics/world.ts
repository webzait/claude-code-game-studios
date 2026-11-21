// PROTOTYPE - NOT FOR PRODUCTION
import { tune, type ColorId } from '../config';

/** A point in tray space: x right, y towards the player, origin top-left. */
export interface Vec {
  x: number;
  y: number;
}

/** Axis-aligned rectangle, top-left corner plus size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A fixed round bumper. */
export interface BumperDef {
  color: ColorId;
  x: number;
  y: number;
  r: number;
}

/** Everything the simulation needs to build a board. */
export interface BoardDef {
  size: { w: number; h: number };
  marbles: Vec[];
  bumpers: BumperDef[];
  obstacles: Rect[];
  catchers: Rect[];
}

export interface Marble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** False once collected; a collected marble never moves again. */
  alive: boolean;
}

export interface Bumper extends BumperDef {
  /** Current radius. */
  radius: number;
  /** Current radial surface speed (units/s), positive while expanding. */
  surfaceSpeed: number;
  /** 0..1 expansion amount, for rendering. */
  amount: number;
}

export type WorldEvent =
  | { type: 'collect'; id: number; x: number; y: number; catcher: number }
  | { type: 'hit'; kind: 'bumper' | 'marble' | 'wall'; x: number; y: number; speed: number }
  | { type: 'settled'; forced: boolean };

/** Pulse shape: 0 -> 1 -> 0 over s in [0,1]. Polynomial only, so it is bit-reproducible. */
export function pulseProfile(s: number): { f: number; df: number } {
  const pe = tune.pulseExpandFraction;
  if (s <= 0 || s >= 1) return { f: 0, df: 0 };
  if (s < pe) {
    const u = s / pe;
    return { f: u * u * (3 - 2 * u), df: (6 * u * (1 - u)) / pe };
  }
  const u = (s - pe) / (1 - pe);
  return { f: 1 - u * u * (3 - 2 * u), df: (-6 * u * (1 - u)) / (1 - pe) };
}

/**
 * Deterministic 2D simulation of the tray. No DOM, no clock, no randomness:
 * the same board and the same pulse order always give the same end state.
 */
export class World {
  readonly w: number;
  readonly h: number;
  readonly marbles: Marble[];
  readonly bumpers: Bumper[];
  readonly obstacles: Rect[];
  readonly catchers: Rect[];
  /** Colour of the pulse being resolved, or null when the board is at rest. */
  pulseColor: ColorId | null = null;
  /** Seconds since the current pulse started. */
  pulseT = 0;
  /** Fixed steps taken since construction. */
  ticks = 0;
  /** Largest marble speed seen during the current pulse (for tests). */
  peakSpeed = 0;

  constructor(def: BoardDef) {
    this.w = def.size.w;
    this.h = def.size.h;
    this.marbles = def.marbles.map((m, id) => ({ id, x: m.x, y: m.y, vx: 0, vy: 0, alive: true }));
    this.bumpers = def.bumpers.map((b) => ({ ...b, radius: b.r, surfaceSpeed: 0, amount: 0 }));
    this.obstacles = def.obstacles.map((o) => ({ ...o }));
    this.catchers = def.catchers.map((c) => ({ ...c }));
  }

  /** True while a pulse is being resolved; no new pulse is accepted meanwhile. */
  get resolving(): boolean {
    return this.pulseColor !== null;
  }

  get collected(): number {
    let n = 0;
    for (const m of this.marbles) if (!m.alive) n++;
    return n;
  }

  /** Starts a pulse on every bumper of `color`. Returns false if one is still resolving. */
  startPulse(color: ColorId): boolean {
    if (this.resolving) return false;
    this.pulseColor = color;
    this.pulseT = 0;
    this.peakSpeed = 0;
    return true;
  }

  /** Advances one fixed step (tune.dt). */
  step(events: WorldEvent[] = []): WorldEvent[] {
    this.ticks++;
    if (!this.resolving) return events;
    const h = tune.dt / tune.substeps;
    for (let s = 0; s < tune.substeps; s++) this.substep(h, events);

    if (this.pulseT >= tune.pulseTime) {
      let moving = false;
      for (const m of this.marbles) if (m.alive && (m.vx !== 0 || m.vy !== 0)) moving = true;
      const forced = moving && this.pulseT >= tune.maxResolveTime;
      if (!moving || forced) {
        for (const m of this.marbles) m.vx = m.vy = 0;
        this.pulseColor = null;
        events.push({ type: 'settled', forced });
      }
    }
    return events;
  }

  /** Runs until the current pulse has settled. Returns the events of the whole pulse. */
  resolve(): WorldEvent[] {
    const events: WorldEvent[] = [];
    while (this.resolving) this.step(events);
    return events;
  }

  /** Compact, exact description of the state, for replay comparison. */
  snapshot(): string {
    return this.marbles.map((m) => (m.alive ? `${m.x},${m.y}` : 'c')).join(';');
  }

  private substep(h: number, events: WorldEvent[]): void {
    this.pulseT += h;
    const T = tune.pulseTime;
    const active = this.pulseT < T;
    for (const b of this.bumpers) {
      if (active && b.color === this.pulseColor) {
        const { f, df } = pulseProfile(this.pulseT / T);
        const amp = b.r * tune.pulseExpand;
        b.amount = f;
        b.radius = b.r + amp * f;
        b.surfaceSpeed = (amp * df) / T;
      } else {
        b.amount = 0;
        b.radius = b.r;
        b.surfaceSpeed = 0;
      }
    }

    const ms = this.marbles;
    for (const m of ms) {
      if (!m.alive) continue;
      m.x += m.vx * h;
      m.y += m.vy * h;
    }

    for (let it = 0; it < tune.iterations; it++) {
      this.solveBumpers(events, it === 0);
      this.solveMarbles(events, it === 0);
      this.solveObstacles(events, it === 0);
      this.solveWalls(events, it === 0);
    }

    for (const m of ms) {
      if (!m.alive) continue;
      let sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (sp > tune.maxSpeed) {
        m.vx *= tune.maxSpeed / sp;
        m.vy *= tune.maxSpeed / sp;
        sp = tune.maxSpeed;
      }
      if (sp > this.peakSpeed) this.peakSpeed = sp;
      if (sp > 0) {
        const next = sp - (tune.friction + tune.drag * sp) * h;
        if (next <= 0) {
          m.vx = m.vy = 0;
        } else {
          const k = next / sp;
          m.vx *= k;
          m.vy *= k;
        }
      }
      for (let c = 0; c < this.catchers.length; c++) {
        const r = this.catchers[c];
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
          m.alive = false;
          m.vx = m.vy = 0;
          events.push({ type: 'collect', id: m.id, x: m.x, y: m.y, catcher: c });
          break;
        }
      }
    }
  }

  private solveBumpers(events: WorldEvent[], report: boolean): void {
    const mr = tune.marbleRadius;
    for (const b of this.bumpers) {
      const reach = b.radius + mr;
      for (const m of this.marbles) {
        if (!m.alive) continue;
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2);
        const nx = d > 1e-9 ? dx / d : 0;
        const ny = d > 1e-9 ? dy / d : 1;
        m.x = b.x + nx * reach;
        m.y = b.y + ny * reach;
        const vn = m.vx * nx + m.vy * ny;
        const vs = b.surfaceSpeed;
        if (vn < vs) {
          const out = vs + tune.bumperRestitution * (vs - vn);
          m.vx += (out - vn) * nx;
          m.vy += (out - vn) * ny;
          if (report && out - vn > 1.2) events.push({ type: 'hit', kind: 'bumper', x: m.x, y: m.y, speed: out - vn });
        }
      }
    }
  }

  private solveMarbles(events: WorldEvent[], report: boolean): void {
    const ms = this.marbles;
    const dia = tune.marbleRadius * 2;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= dia * dia) continue;
        const d = Math.sqrt(d2);
        const nx = d > 1e-9 ? dx / d : 1;
        const ny = d > 1e-9 ? dy / d : 0;
        const push = (dia - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const j2 = (-(1 + tune.marbleRestitution) * vn) / 2;
          a.vx -= j2 * nx;
          a.vy -= j2 * ny;
          b.vx += j2 * nx;
          b.vy += j2 * ny;
          if (report && -vn > 1.2) events.push({ type: 'hit', kind: 'marble', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, speed: -vn });
        }
      }
    }
  }

  private solveObstacles(events: WorldEvent[], report: boolean): void {
    const mr = tune.marbleRadius;
    for (const o of this.obstacles) {
      for (const m of this.marbles) {
        if (!m.alive) continue;
        const cx = m.x < o.x ? o.x : m.x > o.x + o.w ? o.x + o.w : m.x;
        const cy = m.y < o.y ? o.y : m.y > o.y + o.h ? o.y + o.h : m.y;
        const dx = m.x - cx;
        const dy = m.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= mr * mr) continue;
        let nx: number;
        let ny: number;
        let pen: number;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
          pen = mr - d;
        } else {
          // Centre is inside the box: leave through the nearest face.
          const l = m.x - o.x;
          const r = o.x + o.w - m.x;
          const t = m.y - o.y;
          const bt = o.y + o.h - m.y;
          const min = Math.min(l, r, t, bt);
          nx = min === l ? -1 : min === r ? 1 : 0;
          ny = nx !== 0 ? 0 : min === t ? -1 : 1;
          pen = min + mr;
        }
        m.x += nx * pen;
        m.y += ny * pen;
        const vn = m.vx * nx + m.vy * ny;
        if (vn < 0) {
          m.vx -= (1 + tune.wallRestitution) * vn * nx;
          m.vy -= (1 + tune.wallRestitution) * vn * ny;
          if (report && -vn > 1.2) events.push({ type: 'hit', kind: 'wall', x: m.x, y: m.y, speed: -vn });
        }
      }
    }
  }

  private solveWalls(events: WorldEvent[], report: boolean): void {
    const mr = tune.marbleRadius;
    const e = tune.wallRestitution;
    for (const m of this.marbles) {
      if (!m.alive) continue;
      let hit = 0;
      if (m.x < mr) {
        m.x = mr;
        if (m.vx < 0) { hit = -m.vx; m.vx = -m.vx * e; }
      } else if (m.x > this.w - mr) {
        m.x = this.w - mr;
        if (m.vx > 0) { hit = m.vx; m.vx = -m.vx * e; }
      }
      if (m.y < mr) {
        m.y = mr;
        if (m.vy < 0) { hit = -m.vy; m.vy = -m.vy * e; }
      } else if (m.y > this.h - mr) {
        m.y = this.h - mr;
        if (m.vy > 0) { hit = m.vy; m.vy = -m.vy * e; }
      }
      if (report && hit > 1.2) events.push({ type: 'hit', kind: 'wall', x: m.x, y: m.y, speed: hit });
    }
  }
}
