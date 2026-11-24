import { describe, expect, it } from 'vitest';
import {
  GARDEN_FX,
  GARDEN_FX_KINDS,
  beamRays,
  envelope,
  fxSeconds,
  gardenCelebrationCues,
  planGardenCelebration,
  puffBalls,
  sparkleWave,
  starSpots,
  type SparkleBoard,
} from '../../src/render/parts/garden/effectsPlan';

/** An empty board of `w` by `h` with the exit at `ex`, `ey` and walls on `walls` (cell indices). */
function board(w: number, h: number, ex: number, ey: number, walls: number[] = []): SparkleBoard {
  return { width: w, height: h, exitX: ex, exitY: ey, walls: Array.from({ length: w * h }, (_, i) => walls.includes(i)) };
}

describe('garden effects: timing', () => {
  it('every effect is short enough not to hold up play, and its calm version is no longer', () => {
    for (const kind of GARDEN_FX_KINDS) {
      expect(fxSeconds(kind, false)).toBeGreaterThan(0);
      expect(fxSeconds(kind, false)).toBeLessThanOrEqual(1);
      expect(fxSeconds(kind, true)).toBeLessThanOrEqual(fxSeconds(kind, false));
    }
  });

  it('an envelope starts and ends at nothing and holds full strength in between', () => {
    expect(envelope(0, 0.2, 0.8)).toBe(0);
    expect(envelope(1, 0.2, 0.8)).toBe(0);
    expect(envelope(0.5, 0.2, 0.8)).toBe(1);
    expect(envelope(0.1, 0.2, 0.8)).toBeGreaterThan(0);
    expect(envelope(0.1, 0.2, 0.8)).toBeLessThan(envelope(0.15, 0.2, 0.8));
    expect(envelope(0.9, 0.2, 0.8)).toBeGreaterThan(envelope(0.95, 0.2, 0.8));
  });
});

describe('garden effects: layout', () => {
  it('a sparkle has between one and five stars that do not sit on top of each other', () => {
    expect(starSpots(0)).toHaveLength(1);
    expect(starSpots(3)).toHaveLength(3);
    expect(starSpots(9)).toHaveLength(5);
    const spots = starSpots(3);
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(0.6);
  });

  it('the beam has its tallest ray in the middle of the ring', () => {
    const rays = beamRays(GARDEN_FX.beam.rays);
    expect(rays).toHaveLength(GARDEN_FX.beam.rays);
    expect(rays[0]).toMatchObject({ x: 0, z: 0, height: 1 });
    for (const ray of rays.slice(1)) {
      expect(ray.height).toBeLessThan(1);
      expect(Math.hypot(ray.x, ray.z)).toBeLessThan(1);
    }
  });

  it('the cloud puff is the same every time and every ball shrinks away in turn', () => {
    expect(puffBalls()).toEqual(puffBalls());
    for (const ball of puffBalls()) {
      expect(ball.order).toBeGreaterThanOrEqual(0);
      expect(ball.order).toBeLessThanOrEqual(1);
      expect(ball.r).toBeGreaterThan(0);
    }
  });
});

describe('garden celebration', () => {
  it('twinkles on every free tile but not on obstacles or the exit, nearest tiles first', () => {
    const b = board(8, 8, 6, 1, [10, 33]);
    const wave = sparkleWave(b, 0.2, 1.0);
    expect(wave).toHaveLength(64 - 2 - 1);
    expect(wave.some((c) => c.cellX === 6 && c.cellY === 1)).toBe(false);
    expect(wave.some((c) => c.cellY * 8 + c.cellX === 10)).toBe(false);
    for (const c of wave) {
      expect(c.at).toBeGreaterThanOrEqual(0.2 * 0.85);
      expect(c.at).toBeLessThanOrEqual(1.0);
    }
    const near = wave.find((c) => c.cellX === 6 && c.cellY === 2)!;
    const far = wave.find((c) => c.cellX === 0 && c.cellY === 7)!;
    expect(near.at).toBeLessThan(far.at);
    expect(sparkleWave(b, 0.2, 1.0)).toEqual(wave);
  });

  it('plays a beam and stars on the exit; three stars add a burst over the middle; no blue ring', () => {
    const one = gardenCelebrationCues({ perfect: false, calm: false });
    expect(one.map((c) => `${c.kind}@${c.where}`)).toEqual(['beam@exit', 'stars@exit']);
    const three = gardenCelebrationCues({ perfect: true, calm: false });
    expect(three.filter((c) => c.where === 'middle')).toHaveLength(1);
    expect(three.find((c) => c.kind === 'stars')!.count).toBe(5);
    const calm = gardenCelebrationCues({ perfect: true, calm: true });
    expect(calm.every((c) => c.where === 'exit' && c.at === 0)).toBe(true);
    for (const cues of [one, three, calm]) expect(cues.some((c) => c.kind === 'ring')).toBe(false);
  });

  it('is planned like the robot celebration, with its own lengths, and every effect ends within it', () => {
    for (const stars of [1, 2, 3] as const)
      for (const reduced of [false, true]) {
        const plan = planGardenCelebration({ variant: 'confetti', stars, reduced, muted: false });
        expect(plan.calm).toBe(reduced);
        expect(plan.perfect).toBe(stars === 3);
        expect(plan.sound).toBe(stars === 3 ? 'perfect' : 'win');
        expect(plan.cardDelay).toBeLessThan(plan.seconds);
        const c = GARDEN_FX.celebration;
        expect(plan.seconds).toBe(reduced ? c.calm.seconds : stars === 3 ? c.perfectSeconds : c.seconds);
        for (const cue of gardenCelebrationCues(plan)) expect(cue.at + fxSeconds(cue.kind, plan.calm)).toBeLessThanOrEqual(plan.seconds);
      }
    expect(planGardenCelebration({ variant: 'wave', stars: 2, reduced: false, muted: true }).sound).toBeNull();
  });
});

describe('garden effects: config', () => {
  it('has a valid colour for every colour entry', () => {
    const colours: string[] = [];
    const walk = (o: unknown): void => {
      if (typeof o === 'string' && o.startsWith('#')) colours.push(o);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(GARDEN_FX);
    expect(colours.length).toBeGreaterThan(15);
    for (const c of colours) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
