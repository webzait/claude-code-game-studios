// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The rules of one level attempt: taps, waiting for rest, win, loss, stars. No DOM, no drawing.
import { SUBSTEP, type LevelData, type Tuning } from '../sim/types';
import { createWorld, isSettled, stepWorld, tapAnchor, type World } from '../sim/world';

export type Phase = 'idle' | 'moving' | 'won' | 'lost';
/** Simulation steps per game tick (a tick is 1/60 s). */
export const SUBSTEPS_PER_TICK = 2;
export const TICK = SUBSTEP * SUBSTEPS_PER_TICK;

/** One attempt at one level. Restarting is making a new Session. */
export class Session {
  readonly world: World;
  phase: Phase = 'idle';
  movesLeft: number;
  movesUsed = 0;
  /** Extra taps granted after a loss (a rewarded ad or a booster would call grantMoves). */
  extraMoves = 0;
  /** Every tap so far, as anchor indexes: a replay of the attempt. */
  readonly taps: number[] = [];
  private sinceTap = 0;
  private lastCollected = 0;

  constructor(readonly level: LevelData, private readonly tuning: Tuning) {
    this.world = createWorld(level, tuning);
    this.movesLeft = level.moves;
    // Let the marbles find their resting places before the first tap, so a level's data need
    // not place each one exactly. Deterministic: it is part of every start and every reset.
    const max = tuning.settle_timeout / SUBSTEP;
    for (let i = 0; i < max && !isSettled(this.world, tuning, SUBSTEP); i++) stepWorld(this.world, tuning, SUBSTEP);
    this.freeze();
  }

  /** Stop every marble dead. The world does not move between taps, so when you tap never matters. */
  private freeze(): void {
    this.world.vx.fill(0); this.world.vz.fill(0); this.world.events.length = 0;
  }

  get collected(): number { return this.world.collected; }
  get target(): number { return this.level.target; }

  /** Whether a tap is accepted now: only while everything is at rest and taps remain. */
  canTap(): boolean { return this.phase === 'idle' && this.movesLeft > 0; }

  /** Tap clamp i. Returns false when the tap is refused. */
  tap(i: number): boolean {
    if (!this.canTap() || i < 0 || i >= this.level.anchors.length) return false;
    tapAnchor(this.world, i);
    this.movesLeft--; this.movesUsed++; this.taps.push(i);
    this.sinceTap = 0; this.phase = 'moving';
    for (let m = 0; m < this.world.n; m++) this.world.still[m] = 0;
    return true;
  }

  /** Advance one tick (1/60 s). The level is judged only when everything has come to rest. */
  tick(): void {
    if (this.phase === 'won' || this.phase === 'lost') {
      // Keep the world alive so late marbles keep rolling under the end screen.
      for (let s = 0; s < SUBSTEPS_PER_TICK; s++) stepWorld(this.world, this.tuning, SUBSTEP);
      return;
    }
    if (this.phase !== 'moving') return; // idle: the world is frozen until the next tap
    for (let s = 0; s < SUBSTEPS_PER_TICK; s++) stepWorld(this.world, this.tuning, SUBSTEP);
    // The timeout counts from the last catch, so a flood still pouring in is never cut short.
    if (this.collected !== this.lastCollected) { this.lastCollected = this.collected; this.sinceTap = 0; }
    this.sinceTap += TICK;
    // A win is called the moment the target is reached; a loss only once everything is at rest.
    if (this.collected >= this.target) { this.phase = 'won'; return; }
    if (isSettled(this.world, this.tuning, SUBSTEP) || this.sinceTap >= this.tuning.settle_timeout) {
      if (this.collected >= this.target) this.phase = 'won';
      else if (this.movesLeft <= 0) this.phase = 'lost';
      else { this.phase = 'idle'; this.freeze(); }
    }
  }

  /** Stars for a win: 3 at or under par, 2 one over, otherwise 1. 0 when not won. */
  stars(): number {
    if (this.phase !== 'won') return 0;
    const used = this.movesUsed;
    return used <= this.level.par ? 3 : used === this.level.par + 1 ? 2 : 1;
  }

  /** Give extra taps after a loss and resume play. The hook for rewarded ads and boosters. */
  grantMoves(n: number): boolean {
    if (this.phase !== 'lost' || n <= 0) return false;
    this.movesLeft += n; this.extraMoves += n; this.phase = 'idle';
    return true;
  }
}

/** Play a list of taps from a fresh start, each after the last has settled. For tests and the solver. */
export function playTaps(level: LevelData, tuning: Tuning, taps: number[], maxTicks = 60 * 30): Session {
  const s = new Session(level, tuning);
  for (const a of taps) {
    if (!s.tap(a)) break;
    for (let i = 0; i < maxTicks && s.phase === 'moving'; i++) s.tick();
  }
  return s;
}
