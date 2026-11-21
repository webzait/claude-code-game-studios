// PROTOTYPE - NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';
import { tune, type ColorId } from '../src/config';
import { Game, playSequence } from '../src/game/game';
import { LEVELS } from '../src/levels/levels';

const MR = tune.marbleRadius;

function sequences(colors: ColorId[], n: number): ColorId[][] {
  if (n === 0) return [[]];
  return sequences(colors, n - 1).flatMap((s) => colors.map((c) => [...s, c]));
}

describe('level data', () => {
  it('has the five levels in order', () => {
    expect(LEVELS.map((l) => l.name)).toEqual(['First Burst', 'Choose the Color', 'The Wrong First Move', 'Double Impact', 'Big Burst']);
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(LEVELS)('level $id starts from a valid, overlap-free board', (level) => {
    expect(level.target).toBeGreaterThan(0);
    expect(level.target).toBeLessThanOrEqual(level.marbles.length);
    expect(level.solution.length).toBeLessThanOrEqual(level.pulses);
    for (const m of level.marbles) {
      expect(m.x).toBeGreaterThanOrEqual(MR);
      expect(m.x).toBeLessThanOrEqual(level.size.w - MR);
      expect(m.y).toBeGreaterThanOrEqual(MR);
      expect(m.y).toBeLessThanOrEqual(level.size.h - MR);
      for (const b of level.bumpers) expect(Math.hypot(m.x - b.x, m.y - b.y)).toBeGreaterThanOrEqual(b.r + MR);
      for (const o of level.obstacles) {
        const cx = Math.max(o.x, Math.min(o.x + o.w, m.x));
        const cy = Math.max(o.y, Math.min(o.y + o.h, m.y));
        expect(Math.hypot(m.x - cx, m.y - cy)).toBeGreaterThanOrEqual(MR);
      }
      for (const c of level.catchers) expect(m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h).toBe(false);
    }
    for (let i = 0; i < level.marbles.length; i++)
      for (let j = i + 1; j < level.marbles.length; j++)
        expect(Math.hypot(level.marbles[i].x - level.marbles[j].x, level.marbles[i].y - level.marbles[j].y)).toBeGreaterThanOrEqual(MR * 2);
    // Bumpers at full expansion stay clear of each other and of the walls.
    const k = 1 + tune.pulseExpand;
    for (const b of level.bumpers) {
      expect(b.x - b.r).toBeGreaterThan(0);
      expect(b.x + b.r).toBeLessThan(level.size.w);
      expect(b.y - b.r).toBeGreaterThan(0);
    }
    for (let i = 0; i < level.bumpers.length; i++)
      for (let j = i + 1; j < level.bumpers.length; j++) {
        const a = level.bumpers[i];
        const b = level.bumpers[j];
        const reach = a.color === b.color ? (a.r + b.r) * k : Math.max(a.r * k + b.r, a.r + b.r * k);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(reach);
      }
  });
});

describe('solutions, checked with the real simulation', () => {
  it.each(LEVELS)('level $id: the stored solution wins', (level) => {
    const g = playSequence(level, level.solution);
    expect(g.phase).toBe('won');
    expect(g.collected).toBeGreaterThanOrEqual(level.target);
    expect(g.collected + g.world.marbles.filter((m) => m.alive).length).toBe(level.marbles.length);
  });

  it.each(LEVELS)('level $id: replaying the solution gives the identical end state', (level) => {
    const a = playSequence(level, level.solution);
    const b = playSequence(level, level.solution);
    expect(a.world.snapshot()).toBe(b.world.snapshot());
    expect(a.world.ticks).toBe(b.world.ticks);
  });

  it.each(LEVELS)('level $id: is a puzzle, not a formality (some full-length order loses, unless there is one colour)', (level) => {
    const colors = new Game(level).colors;
    const all = sequences(colors, level.pulses).map((s) => playSequence(level, s).phase);
    expect(all).toContain('won');
    if (colors.length > 1) expect(all).toContain('lost');
  });

  it('level 2: the other colour loses', () => {
    expect(playSequence(LEVELS[1], ['red']).phase).toBe('lost');
  });

  it('level 3: the tempting first move (blue) loses, whatever follows', () => {
    expect(playSequence(LEVELS[2], ['blue', 'red']).phase).toBe('lost');
    expect(playSequence(LEVELS[2], ['blue', 'blue']).phase).toBe('lost');
  });

  it('level 4: both red bumpers act in the one red pulse', () => {
    const g = new Game(LEVELS[3]);
    g.pulse('red');
    g.step();
    const reds = g.world.bumpers.filter((b) => b.color === 'red');
    expect(reds).toHaveLength(2);
    expect(reds.every((b) => b.amount > 0 && b.amount === reds[0].amount)).toBe(true);
    g.settle();
    expect(g.collected).toBe(4);
  });
});

describe('rules: input lock, counters, win and loss', () => {
  it('refuses input while a pulse resolves and spends exactly one pulse per accepted tap', () => {
    const g = new Game(LEVELS[2]);
    expect(g.pulse('red')).toBe(true);
    expect(g.pulsesLeft).toBe(1);
    for (let i = 0; i < 5; i++) {
      expect(g.pulse('red')).toBe(false);
      expect(g.pulse('blue')).toBe(false);
      g.step();
    }
    expect(g.pulsesLeft).toBe(1);
    expect(g.history).toEqual(['red']);
    g.settle();
    expect(g.phase).toBe('ready');
    expect(g.pulse('blue')).toBe(true);
    expect(g.pulsesLeft).toBe(0);
  });

  it('refuses a colour that is not on the board', () => {
    const g = new Game(LEVELS[0]);
    expect(g.pulse('yellow')).toBe(false);
    expect(g.pulsesLeft).toBe(LEVELS[0].pulses);
  });

  it('declares a win only once the pulse has settled, even if the target is reached earlier', () => {
    const g = new Game(LEVELS[0]);
    g.pulse('red');
    let reachedEarly = false;
    while (g.phase === 'resolving') {
      g.step();
      if (g.collected >= g.level.target && g.world.resolving) {
        reachedEarly = true;
        expect(g.phase).toBe('resolving');
      }
    }
    expect(reachedEarly).toBe(true);
    expect(g.phase).toBe('won');
    expect(g.world.resolving).toBe(false);
  });

  it('declares a loss only after the last pulse has settled, with consistent counters', () => {
    const g = new Game(LEVELS[1]);
    g.pulse('red');
    while (g.phase === 'resolving') {
      expect(g.phase).not.toBe('lost');
      g.step();
    }
    expect(g.phase).toBe('lost');
    expect(g.pulsesLeft).toBe(0);
    expect(g.collected).toBeLessThan(g.level.target);
    expect(g.pulse('blue')).toBe(false);
  });

  it('reset restores the exact start state', () => {
    const g = new Game(LEVELS[3]);
    const start = g.world.snapshot();
    g.pulse('red');
    g.settle();
    g.reset();
    expect(g.world.snapshot()).toBe(start);
    expect(g.pulsesLeft).toBe(LEVELS[3].pulses);
    expect(g.phase).toBe('ready');
    expect(g.history).toEqual([]);
  });

  it('extra pulses (future reward hook) let a lost attempt continue', () => {
    const g = playSequence(LEVELS[2], ['blue', 'blue']);
    expect(g.phase).toBe('lost');
    g.grantExtraPulses(1);
    expect(g.phase).toBe('ready');
    expect(g.pulse('red')).toBe(true);
  });
});

describe('performance of the simulation', () => {
  it('steps 60 marbles far faster than real time', () => {
    const marbles = [];
    for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) marbles.push({ x: 2.6 + i * 0.52, y: 5.4 + j * 0.52 });
    const level = { ...LEVELS[4], marbles, bumpers: [{ color: 'red' as const, x: 5, y: 3.8, r: 1.2 }], obstacles: [], target: 60, pulses: 1 };
    const g = new Game(level);
    g.pulse('red');
    const t0 = performance.now();
    let steps = 0;
    while (g.phase === 'resolving') {
      g.step();
      steps++;
    }
    const perStep = (performance.now() - t0) / steps;
    console.log(`60 marbles: ${perStep.toFixed(3)} ms per fixed step over ${steps} steps`);
    expect(perStep).toBeLessThan(4);
  });
});
