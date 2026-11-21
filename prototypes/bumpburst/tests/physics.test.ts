// PROTOTYPE - NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';
import { tune } from '../src/config';
import { World, pulseProfile, type BoardDef, type WorldEvent } from '../src/physics/world';

const MR = tune.marbleRadius;
/** One red and one blue bumper pair plus a marble resting on each. */
function board(extra: Partial<BoardDef> = {}): BoardDef {
  return {
    size: { w: 10, h: 10 },
    bumpers: [
      { color: 'red', x: 2.5, y: 3, r: 1 },
      { color: 'red', x: 7.5, y: 3, r: 0.8 },
      { color: 'blue', x: 5, y: 6, r: 1 },
    ],
    marbles: [
      { x: 2.5, y: 3 + 1 + MR + 0.01 },
      { x: 7.5, y: 3 + 0.8 + MR + 0.01 },
      { x: 5, y: 6 + 1 + MR + 0.01 },
    ],
    obstacles: [],
    catchers: [{ x: 4, y: 9.3, w: 2, h: 0.7 }],
    ...extra,
  };
}

describe('pulse: global activation per colour', () => {
  it('expands every bumper of the pulsed colour in the same step, and no other', () => {
    const w = new World(board());
    w.startPulse('red');
    w.step();
    const [r1, r2, blue] = w.bumpers;
    expect(r1.amount).toBeGreaterThan(0);
    expect(r1.amount).toBe(r2.amount);
    expect(r1.radius).toBeGreaterThan(r1.r);
    expect(r2.radius).toBeGreaterThan(r2.r);
    expect(blue.amount).toBe(0);
    expect(blue.radius).toBe(blue.r);
  });

  it('moves the marbles of both red bumpers and leaves the blue one alone', () => {
    const w = new World(board());
    const before = w.marbles.map((m) => ({ x: m.x, y: m.y }));
    w.startPulse('red');
    w.resolve();
    expect(w.marbles[0].y).toBeGreaterThan(before[0].y + 1);
    expect(w.marbles[1].y).toBeGreaterThan(before[1].y + 1);
    expect(w.marbles[2].x).toBe(before[2].x);
    expect(w.marbles[2].y).toBe(before[2].y);
  });
});

describe('pulse timing', () => {
  it('lasts 0.2 to 0.3 seconds and returns to the exact rest radius', () => {
    expect(tune.pulseTime).toBeGreaterThanOrEqual(0.2);
    expect(tune.pulseTime).toBeLessThanOrEqual(0.3);
    const w = new World(board({ marbles: [] }));
    w.startPulse('red');
    let peak = 0;
    let steps = 0;
    while (w.resolving) {
      w.step();
      steps++;
      peak = Math.max(peak, w.bumpers[0].radius);
    }
    expect(steps).toBe(Math.ceil(tune.pulseTime / tune.dt - 1e-9));
    expect(peak).toBeGreaterThan(1 + tune.pulseExpand * 0.97);
    expect(peak).toBeLessThanOrEqual(1 + tune.pulseExpand + 1e-12);
    for (const b of w.bumpers) {
      expect(b.radius).toBe(b.r);
      expect(b.surfaceSpeed).toBe(0);
    }
  });

  it('has a smooth profile: starts and ends at rest', () => {
    expect(pulseProfile(0)).toEqual({ f: 0, df: 0 });
    expect(pulseProfile(1)).toEqual({ f: 0, df: 0 });
    expect(pulseProfile(tune.pulseExpandFraction).f).toBeCloseTo(1, 9);
    expect(pulseProfile(1e-6).df).toBeLessThan(0.001);
  });
});

describe('collisions', () => {
  it('gives one push, never a double impulse: launch speed is bounded by the surface speed', () => {
    const w = new World(board());
    w.startPulse('red');
    w.resolve();
    const peakSurface = (1 * tune.pulseExpand * 1.5) / tune.pulseExpandFraction / tune.pulseTime;
    expect(w.peakSpeed).toBeGreaterThan(peakSurface * 0.9);
    expect(w.peakSpeed).toBeLessThanOrEqual(peakSurface * (1 + tune.bumperRestitution));
  });

  it('never teleports: no marble moves further in a step than its speed limit allows', () => {
    const marbles = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) marbles.push({ x: 1.6 + i * 0.5, y: 4.3 + j * 0.5 });
    const w = new World(board({ marbles }));
    for (const color of ['red', 'blue', 'red'] as const) {
      w.startPulse(color);
      while (w.resolving) {
        const before = w.marbles.map((m) => ({ x: m.x, y: m.y }));
        w.step();
        w.marbles.forEach((m, i) => {
          if (!m.alive) return;
          const d = Math.hypot(m.x - before[i].x, m.y - before[i].y);
          expect(d).toBeLessThan(tune.maxSpeed * tune.dt + MR);
        });
      }
    }
  });

  it('keeps marbles inside the tray and out of walls, bumpers, obstacles and each other at rest', () => {
    const marbles = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) marbles.push({ x: 1.2 + i * 0.5, y: 4.2 + j * 0.5 });
    const w = new World(board({ marbles, obstacles: [{ x: 6.5, y: 5, w: 1.5, h: 0.6 }] }));
    for (const color of ['blue', 'red', 'blue', 'red'] as const) {
      w.startPulse(color);
      w.resolve();
      const live = w.marbles.filter((m) => m.alive);
      for (const m of live) {
        expect(Number.isFinite(m.x) && Number.isFinite(m.y)).toBe(true);
        expect(m.x).toBeGreaterThanOrEqual(MR - 1e-9);
        expect(m.x).toBeLessThanOrEqual(w.w - MR + 1e-9);
        expect(m.y).toBeGreaterThanOrEqual(MR - 1e-9);
        expect(m.y).toBeLessThanOrEqual(w.h - MR + 1e-9);
        expect(m.vx).toBe(0);
        expect(m.vy).toBe(0);
        for (const b of w.bumpers) expect(Math.hypot(m.x - b.x, m.y - b.y)).toBeGreaterThan(b.r + MR - 0.02);
        for (const o of w.obstacles) {
          const cx = Math.max(o.x, Math.min(o.x + o.w, m.x));
          const cy = Math.max(o.y, Math.min(o.y + o.h, m.y));
          expect(Math.hypot(m.x - cx, m.y - cy)).toBeGreaterThan(MR - 0.02);
        }
      }
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++)
          expect(Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y)).toBeGreaterThan(MR * 2 - 0.02);
    }
  });

  it('bounces off a wall and loses speed doing so', () => {
    const w = new World(board({ bumpers: [{ color: 'red', x: 5.5, y: 5, r: 1 }], marbles: [{ x: 5.5 + 1 + MR + 0.01, y: 5 }], catchers: [] }));
    w.startPulse('red');
    let hits = 0;
    const ev: WorldEvent[] = [];
    while (w.resolving) w.step(ev);
    for (const e of ev) if (e.type === 'hit' && e.kind === 'wall') hits++;
    expect(hits).toBeGreaterThan(0);
    expect(w.marbles[0].x).toBeLessThan(w.w - MR);
  });

  it('always comes to rest by itself, well inside the safety cap', () => {
    const w = new World(board());
    w.startPulse('red');
    const ev = w.resolve();
    const settled = ev.find((e) => e.type === 'settled');
    expect(settled).toEqual({ type: 'settled', forced: false });
    expect(w.pulseT).toBeLessThan(tune.maxResolveTime);
  });
});

describe('marble conservation and the catcher', () => {
  it('never loses or invents a marble; a caught marble stays caught and counted once', () => {
    const marbles = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) marbles.push({ x: 4 + i * 0.5, y: 7.3 + j * 0.5 });
    const w = new World(board({ marbles }));
    const total = w.marbles.length;
    let collectEvents = 0;
    const seen = new Set<number>();
    let last = 0;
    for (const color of ['blue', 'red', 'blue'] as const) {
      w.startPulse(color);
      while (w.resolving) {
        const ev = w.step();
        for (const e of ev)
          if (e.type === 'collect') {
            collectEvents++;
            expect(seen.has(e.id)).toBe(false);
            seen.add(e.id);
          }
        const alive = w.marbles.filter((m) => m.alive).length;
        expect(w.marbles.length).toBe(total);
        expect(alive + w.collected).toBe(total);
        expect(w.collected).toBeGreaterThanOrEqual(last);
        last = w.collected;
        expect(w.collected).toBe(collectEvents);
      }
    }
    expect(collectEvents).toBeGreaterThan(0);
    for (const id of seen) expect(w.marbles[id].alive).toBe(false);
  });

  it('counts a marble only when its centre is in the opening', () => {
    const w = new World(board({ bumpers: [{ color: 'red', x: 5, y: 6.5, r: 1 }], marbles: [{ x: 5, y: 6.5 + 1 + MR + 0.01 }, { x: 5 + 1 + MR + 0.01, y: 6.5 }] }));
    w.startPulse('red');
    w.resolve();
    expect(w.marbles[0].alive).toBe(false);
    expect(w.marbles[1].alive).toBe(true);
    expect(w.collected).toBe(1);
  });
});

describe('determinism', () => {
  it('ignores steps while at rest and refuses a pulse while one resolves', () => {
    const w = new World(board());
    const s0 = w.snapshot();
    for (let i = 0; i < 30; i++) w.step();
    expect(w.snapshot()).toBe(s0);
    expect(w.startPulse('red')).toBe(true);
    w.step();
    expect(w.startPulse('blue')).toBe(false);
    expect(w.pulseColor).toBe('red');
  });

  it('gives bit-identical end states for the same pulse order', () => {
    const run = () => {
      const marbles = [];
      for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) marbles.push({ x: 1.2 + i * 0.5, y: 4.2 + j * 0.5 });
      const w = new World(board({ marbles }));
      const states: string[] = [];
      for (const c of ['red', 'blue', 'red', 'blue'] as const) {
        w.startPulse(c);
        w.resolve();
        states.push(w.snapshot());
      }
      return states;
    };
    expect(run()).toEqual(run());
  });
});
