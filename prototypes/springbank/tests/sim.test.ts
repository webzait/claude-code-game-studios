// PROTOTYPE - NOT FOR PRODUCTION
// The physics' promises: no ball is ever lost or made, the tray and the spring respect their
// capacities, the energy and launch formulas hold, and a launch behaves as the brief says.
import { describe, expect, it } from 'vitest';
import { tune } from '../src/sim/tune.ts';
import { DT, FREE, HELD, QUEUED, SCORED, Sim, kineticEnergy, launchSpeed, replay, type Input } from '../src/sim/sim.ts';
import { LEVELS, type LevelDef } from '../src/sim/levels.ts';

const SECOND = Math.round(1 / DT);
/** A bare level: one stream, no goals unless given. */
const level = (over: Partial<LevelDef> = {}): LevelDef => ({
  name: 'test', hint: '', balls: 12, launches: 3, target: 99, streams: [4.5], goals: [], pegs: [], bars: [], solution: [], ...over,
});
const run = (sim: Sim, ticks: number, input: Input) => { for (let i = 0; i < ticks; i++) sim.step(input); };
const total = (s: Sim) => s.count(QUEUED) + s.count(FREE) + s.count(HELD) + s.count(SCORED);

describe('ball count is conserved', () => {
  it('holds on every tick of every level solution', () => {
    for (const lv of LEVELS) {
      replay(lv, lv.solution, SECOND * 40, (s) => {
        if (total(s) !== lv.balls) throw new Error(`${lv.name}: ${total(s)} balls at tick ${s.tick}`);
        if (s.count(HELD) !== s.held || s.count(SCORED) !== s.scored) throw new Error(`${lv.name}: counters drifted at tick ${s.tick}`);
      });
    }
  });
  it('holds through 60 s of catching and launching 80 balls, with every number finite', () => {
    const lv = level({ balls: 80, launches: 999, streams: [1, 4.5, 8], goals: [{ x: 4.5, y: 11, w: 3, capacity: 20 }], pegs: [{ x: 3, y: 8, r: 0.3 }] });
    const sim = new Sim(lv);
    for (let t = 0; t < SECOND * 60; t++) {
      sim.step({ hold: t % 300 < 240, targetX: 1.5 + ((t * 7) % 600) / 100 });
      expect(total(sim)).toBe(80);
    }
    for (let i = 0; i < sim.n; i++) expect(Number.isFinite(sim.x[i] + sim.y[i] + sim.vx[i] + sim.vy[i])).toBe(true);
    expect(sim.scored).toBeLessThanOrEqual(20);
  });
});

describe('catch capacity', () => {
  it('never holds more balls than the tray capacity; the rest bounce off and stay in play', () => {
    const sim = new Sim(level({ balls: 30, capacity: 10 }));
    let full = 0;
    for (let t = 0; t < SECOND * 8; t++) {
      sim.step({ hold: true, targetX: 4.5 });
      expect(sim.held).toBeLessThanOrEqual(10);
      full += sim.events.filter((e) => e.type === 'full').length; sim.events.length = 0;
    }
    expect(sim.held).toBe(10);
    expect(full).toBeGreaterThan(0);
    expect(total(sim)).toBe(30);
  });
  it('catches nothing while the finger is up', () => {
    const sim = new Sim(level());
    run(sim, SECOND * 5, { hold: false, targetX: 4.5 });
    expect(sim.held).toBe(0);
    expect(sim.energy).toBe(0);
  });
  it('the spring never stores more than its energy capacity', () => {
    const sim = new Sim(level({ balls: 60 }));
    const cap = tune.energy_capacity;
    (globalThis as any).CONFIG.energy_capacity.value = 3000;
    try {
      run(sim, SECOND * 10, { hold: true, targetX: 4.5 });
      expect(sim.energy).toBe(3000);
      expect(sim.charge).toBe(1);
      expect(sim.compression).toBeCloseTo(tune.spring_travel);
    } finally { (globalThis as any).CONFIG.energy_capacity.value = cap; }
  });
});

describe('energy', () => {
  it('each catch adds exactly 1/2 m v^2 of the caught ball', () => {
    const sim = new Sim(level());
    let sum = 0, catches = 0;
    for (let t = 0; t < SECOND * 4; t++) {
      sim.step({ hold: true, targetX: 4.5 });
      for (const e of sim.events) if (e.type === 'catch') { sum += e.energy; catches++; }
      sim.events.length = 0;
    }
    expect(catches).toBe(12);
    expect(sim.energy).toBeCloseTo(sum, 6);
    expect(kineticEnergy(3, 4)).toBeCloseTo(0.5 * tune.ball_mass * 25);
  });
  it('a faster ball stores more energy than a slower one', () => {
    const fast = new Sim(level({ balls: 1 })), slow = new Sim(level({ balls: 1, pegs: [{ x: 4.2, y: 5.2, r: 0.3 }] }));
    run(fast, SECOND * 4, { hold: true, targetX: 4.5 });
    for (let t = 0; t < SECOND * 6 && slow.held === 0; t++) slow.step({ hold: true, targetX: slow.x[0] }); // the tray follows the deflected ball
    expect(fast.held).toBe(1); expect(slow.held).toBe(1);
    expect(fast.energy).toBeGreaterThan(slow.energy);
  });
  it('launch speed follows v = sqrt(2 eta E / (n m + M)) and grows with the group', () => {
    const E = 300 * 8, m = tune.ball_mass;
    expect(launchSpeed(E, 8)).toBeCloseTo(Math.sqrt((2 * tune.spring_gain * E) / (8 * m + tune.piston_mass * m)));
    expect(launchSpeed(0, 0)).toBe(0);
    expect(launchSpeed(300 * 24, 24)).toBeGreaterThan(launchSpeed(300 * 8, 8)); // same speed per ball, more balls
    expect(launchSpeed(1e9, 10)).toBe(tune.launch_speed_max);
  });
});

describe('launch', () => {
  const caught = () => { const sim = new Sim(level()); run(sim, SECOND * 4, { hold: true, targetX: 4.5 }); return sim; };
  it('throws every held ball straight up at the predicted speed, and empties the spring', () => {
    const sim = caught();
    const n = sim.held, v = launchSpeed(sim.energy, n), apex = sim.predictedApex();
    sim.events.length = 0;
    sim.step({ hold: false, targetX: 4.5 });
    const ev = sim.events.find((e) => e.type === 'launch');
    expect(ev && ev.type === 'launch' && ev.count).toBe(n);
    expect(sim.held).toBe(0); expect(sim.energy).toBe(0); expect(sim.launchesUsed).toBe(1);
    expect(sim.inFlight()).toBe(n);
    let top = 0;
    for (let i = 0; i < sim.n; i++) {
      expect(sim.state[i]).toBe(FREE);
      expect(Math.abs(sim.vx[i])).toBeLessThanOrEqual(tune.launch_spread + 1e-6);
      expect(sim.vy[i]).toBeGreaterThan(v - 1);
    }
    for (let t = 0; t < SECOND * 2; t++) { sim.step({ hold: false, targetX: 4.5 }); for (let i = 0; i < sim.n; i++) if (sim.state[i] === FREE && sim.flight[i]) top = Math.max(top, sim.y[i]); }
    expect(top).toBeGreaterThan(apex - 1.5); // the guide line is honest: the group reaches about that height
    expect(top).toBeLessThan(apex + 0.5);
  });
  it('an empty tray costs no launch', () => {
    const sim = new Sim(level());
    sim.step({ hold: true, targetX: 4.5 }); sim.step({ hold: false, targetX: 4.5 });
    expect(sim.launchesUsed).toBe(0);
  });
  it('balls that reach no goal fall back, return to the top and can be caught again', () => {
    const sim = caught();
    run(sim, 1, { hold: false, targetX: 4.5 });
    let queued = 0;
    for (let t = 0; t < SECOND * 6; t++) { sim.step({ hold: false, targetX: 4.5 }); queued = Math.max(queued, sim.count(QUEUED)); }
    expect(queued).toBeGreaterThan(0); // they went through the pit
    expect(sim.inFlight()).toBe(0); // and the launch has settled
    run(sim, SECOND * 4, { hold: true, targetX: 4.5 });
    expect(sim.held).toBe(12); // the same balls are the mass again
    expect(total(sim)).toBe(12);
  });
  it('the level is lost only after the last launch has settled, and won at once on the target', () => {
    const lose = new Sim(level({ launches: 1 }));
    run(lose, SECOND * 4, { hold: true, targetX: 4.5 });
    lose.step({ hold: false, targetX: 4.5 });
    expect(lose.status).toBe('playing'); // balls still in the air
    run(lose, SECOND * 8, { hold: true, targetX: 4.5 });
    expect(lose.status).toBe('lost');
    expect(lose.held).toBe(0); // no catching once the launches are gone
    const win = new Sim(level({ target: 3, streams: [2], goals: [{ x: 6, y: 7, w: 2.4, capacity: 5 }] }));
    run(win, SECOND * 4, { hold: true, targetX: 2 }); run(win, SECOND, { hold: true, targetX: 6 }); run(win, SECOND * 2, { hold: false, targetX: 6 });
    expect(win.status).toBe('won');
    expect(win.scored).toBeLessThanOrEqual(5); // a goal never takes more than its capacity
  });
});

describe('determinism', () => {
  it('the same level and the same input give bit-identical balls', () => {
    const lv = LEVELS[4];
    const a = replay(lv, lv.solution, SECOND * 10), b = replay(lv, lv.solution, SECOND * 10);
    expect(a.tick).toBe(b.tick);
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.vy)).toEqual(Array.from(b.vy));
    expect(a.scored).toBe(b.scored);
  });
  it('steps 80 moving balls well inside a 60 fps frame', () => {
    const sim = new Sim(level({ balls: 80, launches: 99, streams: [2, 4.5, 7] }));
    const t0 = performance.now();
    for (let t = 0; t < SECOND * 20; t++) sim.step({ hold: t % 400 < 300, targetX: 4.5 });
    const perFrame = ((performance.now() - t0) / (SECOND * 20)) * 2; // two steps a frame at 60 fps
    expect(perFrame).toBeLessThan(4);
  });
});
