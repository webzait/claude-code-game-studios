// PROTOTYPE - NOT FOR PRODUCTION
/**
 * Every tuning value of the prototype lives here, so feel can be adjusted
 * without touching engine, renderer or UI code.
 */
export const CONFIG = {
  /** Brand palette. */
  colors: {
    red: '#F04446',
    blue: '#2675E8',
    yellow: '#FFD12F',
    green: '#2FC56C',
    orange: '#FF9736',
    purple: '#9856E8',
    background: '#F3F1EC',
    boardFrame: '#C6CDD7',
    boardGrout: '#D9DEE6',
    tileA: '#F6F7F9',
    tileB: '#EEF0F4',
    wall: '#7C8AA0',
    ink: '#2B3140',
  },
  /** Animation timings in seconds. */
  anim: {
    turnTime: 0.17,
    moveTime: 0.24,
    exitTime: 0.34,
    undoTime: 0.16,
    /** How far (in cells) a blocked robot lunges before springing back. */
    bumpDistance: 0.2,
    /** Hop height (in cells) while stepping. */
    hopHeight: 0.1,
    /** Extra playback speed per queued command, so fast tapping never waits. */
    queueSpeedup: 1.2,
    /** Pause between commands during a replay. */
    replayGap: 0.12,
  },
  /** Camera framing. */
  camera: {
    fov: 28,
    /** Tilt away from straight-down, in degrees. */
    tilt: 30,
    /** Fraction of the canvas the board may fill. */
    fill: 0.985,
  },
  /** Star thresholds: moves over par still earning 3 and 2 stars. */
  stars: { three: 0, two: 2 },
  /** Moves-left count at which the counter turns into a warning. */
  lowMoves: 2,
} as const;
