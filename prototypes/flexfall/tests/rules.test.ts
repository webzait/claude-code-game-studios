// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The game's key rules, checked on the real simulation with the real config.js values.
import { describe, expect, it } from 'vitest';
import { Session, playTaps } from '../app/src/game/session';
import { SUBSTEP, type LevelData } from '../app/src/sim/types';
import { createWorld, heightAt, stepWorld } from '../app/src/sim/world';
import { loadTuning } from '../tools/config';

const T = loadTuning();
const FLAT: LevelData = {
  id: 't', name: 't', moves: 2, par: 1, target: 1, anchors: [{ x: 0, z: 0, r: 2, heights: [0, 1] }],
  catchers: [{ x: 3, z: 0, r: 0.6 }], marbles: [{ x: 0.5, z: 0, count: 1 }], solution: [0],
};
const settle = (s: Session): void => { for (let i = 0; i < 3600 && s.phase === 'moving'; i++) s.tick(); };

describe('the floor', () => {
  it('a clamp lifts the floor most at its centre and not at all beyond its radius', () => {
    const w = createWorld(FLAT, T);
    w.aHeight[0] = 1;
    expect(heightAt(w, 0, 0)).toBeCloseTo(1, 6);
    expect(heightAt(w, 1, 0)).toBeCloseTo(0.5625, 6); // (1 - (1/2)^2)^2
    expect(heightAt(w, -2.5, 0)).toBe(0);
  });
  it('a tapped clamp springs to its next height and comes to rest there', () => {
    const s = new Session(FLAT, T);
    s.tap(0); settle(s);
    expect(s.world.aHeight[0]).toBeCloseTo(1, 1);
  });
});

describe('marbles', () => {
  it('a marble on a flat floor stays where it is', () => {
    const w = createWorld({ ...FLAT, anchors: [] }, T);
    const x0 = w.px[0];
    for (let i = 0; i < 600; i++) stepWorld(w, T, SUBSTEP);
    expect(w.px[0]).toBe(x0);
  });
  it('a marble rolls downhill, away from a raised clamp', () => {
    const s = new Session({ ...FLAT, catchers: [], target: 5, moves: 1 }, T);
    const x0 = s.world.px[0];
    s.tap(0); settle(s);
    expect(s.world.px[0]).toBeGreaterThan(x0 + 1);
  });
  it('marbles never overlap after settling and never leave the tray', () => {
    const lvl: LevelData = { ...FLAT, catchers: [], marbles: [{ x: 0, z: 0, count: 40 }], anchors: [{ x: -3, z: 0, r: 5, heights: [0, 1.2] }] };
    const s = new Session(lvl, T); s.tap(0); settle(s);
    const w = s.world, d = T.marble_radius * 2;
    for (let i = 0; i < w.n; i++) {
      expect(Math.abs(w.px[i])).toBeLessThanOrEqual(w.halfW); expect(Math.abs(w.pz[i])).toBeLessThanOrEqual(w.halfD);
      for (let j = i + 1; j < w.n; j++) expect(Math.hypot(w.px[i] - w.px[j], w.pz[i] - w.pz[j])).toBeGreaterThan(d * 0.9);
    }
  });
  it('a marble that reaches a catcher is caught and removed', () => {
    const s = new Session(FLAT, T); s.tap(0); settle(s);
    expect(s.collected).toBe(1); expect(s.world.alive[0]).toBe(0);
  });
});

describe('rules', () => {
  it('a tap costs one move and further taps wait until everything is at rest', () => {
    const s = new Session({ ...FLAT, target: 5 }, T);
    expect(s.tap(0)).toBe(true); expect(s.movesLeft).toBe(1);
    expect(s.tap(0)).toBe(false); expect(s.movesLeft).toBe(1);
    settle(s);
    expect(s.phase).toBe('idle'); expect(s.tap(0)).toBe(true);
  });
  it('reaching the target wins, with three stars at par', () => {
    const s = playTaps(FLAT, T, [0]);
    expect(s.phase).toBe('won'); expect(s.stars()).toBe(3);
  });
  it('running out of moves short of the target loses', () => {
    const s = playTaps({ ...FLAT, target: 2, moves: 1 }, T, [0]);
    expect(s.phase).toBe('lost'); expect(s.stars()).toBe(0); expect(s.tap(0)).toBe(false);
  });
  it('extra moves after a loss resume play (the rewarded-ad hook)', () => {
    const s = playTaps({ ...FLAT, target: 2, moves: 1 }, T, [0]);
    expect(s.grantMoves(2)).toBe(true); expect(s.phase).toBe('idle'); expect(s.movesLeft).toBe(2);
  });
  it('a restart is an exact reset: a new session equals the first one', () => {
    const a = playTaps(FLAT, T, [0]); const b = new Session(FLAT, T); const c = new Session(FLAT, T);
    expect(a.collected).toBe(1);
    expect(Array.from(b.world.px)).toEqual(Array.from(c.world.px));
    expect(b.collected).toBe(0); expect(b.movesLeft).toBe(FLAT.moves);
  });
});
