// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is het beladen van schepen in volgorde, met beperkte stapelruimte, zo leuk dat je na level 5 direct een zesde wilt?
// Date: 2026-11-21
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- Feel: the crane -------------------------------------------------------------------
  move_time: { value: 0.32, min: 0.12, max: 0.8, step: 0.02 },     // seconds for one crane move
  queue_rush: { value: 0.7, min: 0, max: 2, step: 0.1 },           // extra speed per move still waiting, so fast tapping is never held up
  hop_height: { value: 1.0, min: 0.4, max: 2.5, step: 0.1 },       // metres the container clears the tallest stack on its way
  select_lift: { value: 0.45, min: 0.1, max: 1, step: 0.05 },      // metres a picked container rises
  lift_speed: { value: 14, min: 4, max: 30, step: 1 },             // how fast the picked container rises (1/s)
  shake_time: { value: 0.28, min: 0.1, max: 0.6, step: 0.02 },     // seconds a refused move shakes
  shake_size: { value: 0.09, min: 0.02, max: 0.3, step: 0.01 },    // metres of that shake
  depart_time: { value: 1.1, min: 0.4, max: 3, step: 0.1 },        // seconds a full ship takes to sail off
  arrive_time: { value: 0.8, min: 0.3, max: 3, step: 0.1 },        // seconds the next ship takes to come in
  win_delay: { value: 0.5, min: 0, max: 2, step: 0.1 },            // seconds between the last ship leaving and the results card
  confetti: { value: 70, min: 0, max: 200, step: 10 },             // paper pieces when a ship is full

  tap_reach: { value: 110, min: 40, max: 250, step: 5 },            // how far from a stack a tap still counts, in screen units (the screen is 720 wide)

  // ---- Challenge ---------------------------------------------------------------------------
  // A level's move limit is the solver's proven minimum plus that level's margin (levels.js).
  margin_scale: { value: 1, min: 0, max: 3, step: 0.25 },          // multiplies every level's margin; 0 = perfect play only
  star3_over: { value: 0, min: 0, max: 3, step: 1 },               // moves over the minimum that still earn three stars
  star2_over: { value: 1, min: 0, max: 5, step: 1 },               // moves over the minimum that still earn two stars
  dock_guard: { value: 1, min: 0, max: 1, step: 1 },               // 1 = a ship cannot be called in while that would make the level unwinnable
  dead_end_warn: { value: 1, min: 0, max: 1, step: 1 },            // 1 = say so when the moves left can no longer finish the level

  // ---- View --------------------------------------------------------------------------------
  view_size: { value: 4.5, min: 3.5, max: 9, step: 0.1 },          // half the width of the scene the camera shows, in metres
  view_per_stack: { value: 0.8, min: 0, max: 1.5, step: 0.05 },   // metres added per yard stack beyond three
  cam_shift_x: { value: 0, min: -3, max: 3, step: 0.1 },         // metres the view is moved right of where the docked ship just fits the frame
  cam_shift_y: { value: 0.5, min: -4, max: 4, step: 0.1 },         // metres the view is moved down, which lifts the harbour on screen
  cam_pitch: { value: 33, min: 15, max: 60, step: 1 },             // degrees the camera looks down
  cam_yaw: { value: 38, min: 10, max: 70, step: 1 },               // degrees the camera is turned from straight-on
  stack_gap: { value: 1.5, min: 1.1, max: 2.2, step: 0.05 },       // metres between yard stacks
};
