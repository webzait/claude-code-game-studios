// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Every level is proved solvable, deterministic and fair by playing it with the real simulation.
import { describe, expect, it } from 'vitest';
import { Session, playTaps } from '../app/src/game/session';
import { LEVELS } from '../app/src/levels/index';
import { loadTuning } from '../tools/config';
import { searchLevel } from '../tools/solver';

const T = loadTuning();

describe.each(LEVELS)('level $id', level => {
  it('is well formed', () => {
    const total = level.marbles.reduce((n, g) => n + g.count, 0);
    expect(level.target).toBeGreaterThan(0); expect(level.target).toBeLessThanOrEqual(total);
    expect(level.par).toBeLessThanOrEqual(level.moves); expect(level.anchors.length).toBeGreaterThan(0);
    expect(level.solution.length).toBeLessThanOrEqual(level.moves);
  });
  it('starts at rest with nothing caught', () => {
    const s = new Session(level, T);
    expect(s.collected).toBe(0); expect(s.phase).toBe('idle');
  });
  it('its recorded solution clears it, at par', () => {
    const s = playTaps(level, T, level.solution);
    expect(s.phase).toBe('won'); expect(level.solution.length).toBe(level.par); expect(s.stars()).toBe(3);
  });
  it('plays out identically every time (same taps, same result)', () => {
    const a = playTaps(level, T, level.solution), b = playTaps(level, T, level.solution);
    expect(a.world.steps).toBe(b.world.steps); expect(a.collected).toBe(b.collected);
    expect(Array.from(a.world.px)).toEqual(Array.from(b.world.px));
    expect(Array.from(a.world.pz)).toEqual(Array.from(b.world.pz));
  });
  it('cannot be cleared in fewer taps than par', { timeout: 120000 }, () => {
    const wins = searchLevel(level, T, level.par).filter(o => o.won);
    expect(wins.length).toBeGreaterThan(0);
    expect(Math.min(...wins.map(w => w.taps.length))).toBe(level.par);
  });
});

describe('level design intent', () => {
  const by = (id: string) => LEVELS.find(l => l.id.startsWith(id))!;
  it('level 2: one clamp wins, the other does not', () => {
    expect(playTaps(by('02'), T, [0]).phase).toBe('won'); expect(playTaps(by('02'), T, [1]).phase).toBe('lost');
  });
  it('level 3: the clamp straight behind the marbles traps them; the side clamp clears', () => {
    expect(playTaps(by('03'), T, [0]).collected).toBe(0); expect(playTaps(by('03'), T, [1]).phase).toBe('won');
  });
  it('level 5: neither tap alone clears it; the two together do', () => {
    expect(playTaps(by('05'), T, [1]).phase).not.toBe('won'); expect(playTaps(by('05'), T, [0]).phase).not.toBe('won');
    expect(playTaps(by('05'), T, [1, 0]).phase).toBe('won');
  });
});
