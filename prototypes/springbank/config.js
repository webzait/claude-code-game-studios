// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is het opvangen en krachtig teruglanceren van dezelfde grote groep balletjes zo leuk dat spelers het steeds opnieuw willen doen?
// Date: 2026-11-21
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (src/sim/tune.ts). World units: the board is 9 wide and 16 high.
window.CONFIG = {
  seed: 1, // the spawn jitter's seed; the same seed and the same input give the same game
  volume: { value: 0.6, min: 0, max: 1, step: 0.05 },

  // --- The catch and the launch: the hook ---
  spring_gain: { value: 1.1, min: 0.5, max: 2, step: 0.05 }, // eta: launch energy = eta * stored energy
  piston_mass: { value: 10, min: 0, max: 40, step: 1 }, // in ball masses; the spring also lifts this, so few balls launch slower
  energy_capacity: { value: 16000, min: 2000, max: 40000, step: 500 }, // storage cap of the spring (mass * units^2 / s^2)
  tray_capacity: { value: 48, min: 6, max: 60, step: 1 }, // balls the tray holds; a level may set fewer
  launch_speed_max: { value: 30, min: 10, max: 45, step: 1 }, // units/s; keeps a ball from tunnelling
  launch_spread: { value: 0.35, min: 0, max: 2, step: 0.05 }, // units/s of sideways scatter in the group
  tray_speed: { value: 16, min: 4, max: 40, step: 1 }, // units/s the tray follows the finger
  tray_width: { value: 2.7, min: 1.5, max: 4, step: 0.1 }, // inner width, units
  spring_travel: { value: 0.95, min: 0.2, max: 1.4, step: 0.05 }, // units the tray sinks at a full spring

  // --- The world ---
  gravity: { value: 22, min: 5, max: 60, step: 1 }, // units/s^2
  ball_radius: { value: 0.22, min: 0.12, max: 0.35, step: 0.01 }, // units
  ball_mass: { value: 1, min: 0.2, max: 5, step: 0.1 },
  air_drag: { value: 0.02, min: 0, max: 0.5, step: 0.01 }, // fraction of speed lost per second
  restitution_ball: { value: 0.35, min: 0, max: 0.95, step: 0.05 }, // bounce between balls
  restitution_wall: { value: 0.45, min: 0, max: 0.95, step: 0.05 }, // bounce off walls, pegs, bars, goals
  friction: { value: 0.12, min: 0, max: 1, step: 0.01 }, // share of sliding speed lost per contact

  // --- The stream ---
  spawn_interval: { value: 0.11, min: 0.03, max: 0.5, step: 0.01 }, // s between balls leaving the top
  recycle_delay: { value: 0.5, min: 0, max: 3, step: 0.1 }, // s before a ball that fell out returns to the top
  settle_timeout: { value: 10, min: 3, max: 30, step: 1 }, // s after the last launch before the level is judged anyway

  // --- Feel ---
  shake: { value: 0.28, min: 0, max: 1, step: 0.02 }, // units of camera kick at a full-power launch
};
