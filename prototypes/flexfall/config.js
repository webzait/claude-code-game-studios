// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name>; the simulation, the solver and the tests read this same file.
// Units: 1 unit is about 2.5 marble diameters; the tray is 8 x 11 units.
window.CONFIG = {
  seed: 1, // unused by gameplay: the game has no random calls (kept for the studio's checks)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- Marbles on slopes ----
  gravity: { value: 13, min: 4, max: 30, step: 0.5 },            // units/s^2 along a slope of 1 (rolling factor included)
  roll_friction: { value: 0.03, min: 0, max: 0.1, step: 0.002 },  // constant deceleration, as a slope it cancels
  rest_slope: { value: 0.05, min: 0, max: 0.15, step: 0.005 },   // a stopped marble stays put on slopes below this
  rest_speed: { value: 0.06, min: 0.01, max: 0.4, step: 0.01 },  // units/s under which a marble may stop
  drag: { value: 0.45, min: 0, max: 2, step: 0.05 },             // 1/s linear drag: caps top speed
  max_speed: { value: 11, min: 4, max: 20, step: 0.5 },          // units/s hard cap (no tunnelling)

  // ---- Collisions ----
  marble_radius: { value: 0.2, min: 0.12, max: 0.3, step: 0.01 },      // units
  marble_bounce: { value: 0.35, min: 0, max: 0.9, step: 0.05 },        // restitution marble on marble
  marble_grip: { value: 0.3, min: 0, max: 1, step: 0.05 },            // share of sideways slip two touching marbles lose per contact
  wall_bounce: { value: 0.3, min: 0, max: 0.9, step: 0.05 },           // restitution on walls, pegs and the tray
  bounce_min_speed: { value: 0.5, min: 0, max: 2, step: 0.05 },        // units/s: slower contacts do not bounce

  // ---- The rubber floor ----
  anchor_stiffness: { value: 15, min: 5, max: 30, step: 0.5 },   // rad/s: how fast a clamp reaches its height
  anchor_damping: { value: 0.42, min: 0.1, max: 1.2, step: 0.02 }, // 1 = no overshoot; lower = more wobble
  anchor_radius: { value: 0.38, min: 0.2, max: 0.6, step: 0.02 },   // units: a clamp's foot is solid; marbles roll around it
  floor_kick: { value: 0.5, min: 0, max: 2, step: 0.05 },        // push on marbles from a floor that is moving

  // ---- The catcher ----
  catch_depth: { value: 0.45, min: 0.1, max: 1, step: 0.05 },    // units: depth of the dimple around a catcher
  catch_reach: { value: 1.9, min: 1.1, max: 3, step: 0.1 },      // dimple radius as a multiple of the hole radius

  // ---- Rules ----
  settle_time: { value: 0.5, min: 0.1, max: 1.5, step: 0.05 },  // s everything must lie still before the next tap
  settle_move: { value: 0.05, min: 0.005, max: 0.15, step: 0.005 }, // units a marble may creep and still count as still
  settle_timeout: { value: 7, min: 3, max: 20, step: 0.5 },      // s without a catch after which a move is judged anyway
};
