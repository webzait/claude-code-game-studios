// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// Every tuning value of the presentation lives here, each with value, min, max and step. The
// game reads them live through tune.<name>. The puzzle numbers (strengths, thresholds, pulse
// budgets, goals) are level data: src/levels/levels.ts.

export interface Tunable {
  value: number;
  min: number;
  max: number;
  step: number;
}

export const CONFIG = {
  seed: 1, // no gameplay randomness exists; kept so a check or a later feature can rely on it
  hop_time: { value: 0.34, min: 0.1, max: 1, step: 0.02 }, // seconds heat takes to cross one conductor
  latch_time: { value: 0.38, min: 0.1, max: 1, step: 0.02 }, // seconds a latch glows before it lets go
  tilt_time: { value: 0.6, min: 0.2, max: 1.5, step: 0.05 }, // seconds a platform takes to tilt
  tilt_angle: { value: 22, min: 10, max: 35, step: 1 }, // degrees
  switch_time: { value: 0.3, min: 0.1, max: 1, step: 0.02 }, // seconds a contact takes to swing
  ball_stagger: { value: 0.07, min: 0.02, max: 0.3, step: 0.01 }, // seconds between balls leaving
  ball_roll_time: { value: 0.42, min: 0.1, max: 1, step: 0.02 }, // seconds to roll one unit
  ball_fall_time: { value: 0.36, min: 0.1, max: 1, step: 0.02 }, // seconds to fall one unit (scales with sqrt of height)
  glow_decay: { value: 1.4, min: 0.3, max: 4, step: 0.1 }, // seconds for copper to cool to 1/e
  bloom: { value: 0.55, min: 0, max: 2, step: 0.05 }, // strength of the glow
  camera_sway: { value: 0.18, min: 0, max: 0.6, step: 0.02 }, // units the camera drifts sideways
  end_delay: { value: 0.5, min: 0, max: 2, step: 0.1 }, // seconds before the win or loss card
} satisfies { seed: number } & Record<string, Tunable | number>;

type Names = Exclude<keyof typeof CONFIG, 'seed'>;

/** Live read of a tuning value: tune.hop_time is CONFIG.hop_time.value at this moment. */
export const tune = new Proxy({} as Record<Names, number>, {
  get: (_, key: string) => (CONFIG as unknown as Record<string, Tunable>)[key].value,
});
