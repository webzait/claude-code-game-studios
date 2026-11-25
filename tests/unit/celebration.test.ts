import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CELEBRATION_NAMES, CELEBRATION_VARIANTS, CelebrationRun, defaultVariant, planCelebration, type CelebrationPlan, type Timer } from '../../src/game/celebration';
import { DEFAULT_LAB } from '../../src/game/lab';
import { defaultSave, migrate, SAVE_VERSION } from '../../src/game/save';

const C = CONFIG.celebration;

/** A clock the test moves by hand. */
function clock(): { timer: Timer; advance: (seconds: number) => void } {
  let now = 0;
  let pending: { at: number; fn: () => void }[] = [];
  return {
    timer: (seconds, fn) => {
      const entry = { at: now + seconds, fn };
      pending.push(entry);
      return () => {
        pending = pending.filter((p) => p !== entry);
      };
    },
    advance: (seconds) => {
      now += seconds;
      const due = pending.filter((p) => p.at <= now).sort((a, b) => a.at - b.at);
      pending = pending.filter((p) => p.at > now);
      for (const p of due) p.fn();
    },
  };
}

/** A run with a log of what it did. */
function run(plan: CelebrationPlan): { run: CelebrationRun; log: string[]; advance: (seconds: number) => void } {
  const log: string[] = [];
  const { timer, advance } = clock();
  return { run: new CelebrationRun(plan, { start: (p) => log.push(`start ${p.variant}`), stop: () => log.push('stop'), showCard: () => log.push('card') }, timer), log, advance };
}

const lively = (stars: 1 | 2 | 3 = 1): CelebrationPlan => planCelebration({ variant: 'confetti', stars, reduced: false, muted: false });

describe('the celebration that is planned for a win', () => {
  it('offers three named variants, and the configured one is the default of the test lab', () => {
    expect(CELEBRATION_VARIANTS).toEqual(['confetti', 'wave', 'hop', 'garden']);
    expect(new Set(Object.values(CELEBRATION_NAMES)).size).toBe(CELEBRATION_VARIANTS.length);
    expect(CELEBRATION_VARIANTS).toContain(C.variant);
    expect(DEFAULT_LAB.celebration).toBe(C.variant);
    expect(defaultVariant({ variant: 'fireworks' })).toBe(CELEBRATION_VARIANTS[0]);
  });

  it('takes its lengths from the config, per variant', () => {
    for (const variant of CELEBRATION_VARIANTS) {
      const plan = planCelebration({ variant, stars: 2, reduced: false, muted: false });
      expect(plan).toEqual({ variant, perfect: false, calm: false, seconds: C[variant].seconds, cardDelay: C.cardDelay, sound: 'win' });
    }
  });

  it('is more exuberant for three stars, and only for three', () => {
    for (const variant of CELEBRATION_VARIANTS) {
      const perfect = planCelebration({ variant, stars: 3, reduced: false, muted: false });
      expect(perfect).toMatchObject({ perfect: true, seconds: C[variant].perfectSeconds, cardDelay: C.perfectCardDelay, sound: 'perfect' });
      expect(perfect.seconds).toBeGreaterThan(C[variant].seconds);
      expect(planCelebration({ variant, stars: 1, reduced: false, muted: false })).toEqual(planCelebration({ variant, stars: 2, reduced: false, muted: false }));
    }
    expect(C.confetti.perfectPieces).toBeGreaterThan(C.confetti.pieces);
    expect(C.hop.perfectHeight).toBeGreaterThan(C.hop.height);
  });

  it('is short: the pop-up never waits a second, and no effect lasts much longer than two', () => {
    expect(C.cardDelay).toBeLessThan(1);
    expect(C.perfectCardDelay).toBeLessThan(1);
    for (const variant of CELEBRATION_VARIANTS) expect(C[variant].perfectSeconds).toBeLessThanOrEqual(2.2);
  });

  it('is the calm version with reduced motion: whichever variant, a short glow and the pop-up almost at once', () => {
    for (const variant of CELEBRATION_VARIANTS) {
      for (const stars of [1, 3] as const) {
        const plan = planCelebration({ variant, stars, reduced: true, muted: false });
        expect(plan).toMatchObject({ calm: true, seconds: C.calm.seconds, cardDelay: C.calm.cardDelay, perfect: stars === 3 });
      }
    }
    expect(C.calm.cardDelay).toBeLessThanOrEqual(C.cardDelay);
  });

  it('is silent when sound effects are off', () => {
    expect(planCelebration({ variant: 'hop', stars: 3, reduced: false, muted: true }).sound).toBeNull();
    expect(planCelebration({ variant: 'hop', stars: 1, reduced: true, muted: true }).sound).toBeNull();
  });

  it('keeps the chosen variant in the save and ignores an unknown one', () => {
    for (const variant of CELEBRATION_VARIANTS) expect(migrate({ version: SAVE_VERSION, lab: { celebration: variant } }, []).lab.celebration).toBe(variant);
    expect(migrate({ version: SAVE_VERSION, lab: { celebration: 'fireworks' } }, []).lab.celebration).toBe(defaultSave().lab.celebration);
    expect(migrate({ version: SAVE_VERSION, lab: {} }, []).lab.celebration).toBe(C.variant);
  });
});

describe('a celebration as it runs', () => {
  it('starts when it is begun, not before, and only once', () => {
    const r = run(lively());
    expect(r.run.active).toBe(false);
    expect(r.log).toEqual([]);
    r.run.begin();
    r.run.begin();
    expect(r.log).toEqual(['start confetti']);
    expect(r.run.active).toBe(true);
  });

  it('brings the pop-up after the card delay while the effect plays on, then ends by itself', () => {
    const plan = lively(3);
    const r = run(plan);
    r.run.begin();
    r.advance(plan.cardDelay - 0.01);
    expect(r.log).toEqual(['start confetti']);
    r.advance(0.02);
    expect(r.log).toEqual(['start confetti', 'card']);
    expect(r.run.active).toBe(true);
    r.advance(plan.seconds);
    expect(r.log).toEqual(['start confetti', 'card', 'stop']);
    expect(r.run.active).toBe(false);
  });

  it('a tap before the pop-up skips it: the effect stops and the pop-up comes at once, once', () => {
    const r = run(lively());
    r.run.begin();
    r.advance(0.1);
    expect(r.run.skip()).toBe(true);
    expect(r.log).toEqual(['start confetti', 'stop', 'card']);
    expect(r.run.active).toBe(false);
    r.advance(10);
    expect(r.run.skip()).toBe(false);
    expect(r.log).toEqual(['start confetti', 'stop', 'card']);
  });

  it('a tap after the pop-up only stops the effect', () => {
    const plan = lively(3);
    const r = run(plan);
    r.run.begin();
    r.advance(plan.cardDelay + 0.05);
    expect(r.run.skip()).toBe(true);
    expect(r.log).toEqual(['start confetti', 'card', 'stop']);
  });

  it('leaving or restarting the level cancels it: the effect stops and no pop-up follows', () => {
    const r = run(lively());
    r.run.begin();
    r.run.cancel();
    r.advance(10);
    expect(r.log).toEqual(['start confetti', 'stop']);
    expect(r.run.skip()).toBe(false);
  });

  it('Next while the effect still plays behind the pop-up ends it without a second pop-up', () => {
    const plan = lively(3);
    const r = run(plan);
    r.run.begin();
    r.advance(plan.cardDelay + 0.05);
    r.run.cancel();
    r.advance(10);
    expect(r.log).toEqual(['start confetti', 'card', 'stop']);
  });

  it('the calm version shows the pop-up after its own short delay', () => {
    const plan = planCelebration({ variant: 'wave', stars: 1, reduced: true, muted: false });
    const r = run(plan);
    r.run.begin();
    r.advance(C.calm.cardDelay + 0.01);
    expect(r.log).toEqual(['start wave', 'card']);
  });
});
