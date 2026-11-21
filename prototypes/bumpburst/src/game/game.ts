// PROTOTYPE - NOT FOR PRODUCTION
import type { ColorId } from '../config';
import { COLOR_ORDER } from '../config';
import type { LevelDef } from '../levels/types';
import { World, type WorldEvent } from '../physics/world';

export type Phase = 'ready' | 'resolving' | 'won' | 'lost';

/**
 * Rules of one level on top of the simulation: pulse budget, input lock,
 * counters and the win / lose decision. No rendering, no DOM.
 */
export class Game {
  readonly level: LevelDef;
  world: World;
  pulsesLeft: number;
  phase: Phase = 'ready';
  /** Pulses played so far, in order (a replay of the attempt). */
  history: ColorId[] = [];

  constructor(level: LevelDef) {
    this.level = level;
    this.world = new World(level);
    this.pulsesLeft = level.pulses;
  }

  get collected(): number {
    return this.world.collected;
  }

  get total(): number {
    return this.world.marbles.length;
  }

  /** Colours that have at least one bumper on this board, in button order. */
  get colors(): ColorId[] {
    return COLOR_ORDER.filter((c) => this.level.bumpers.some((b) => b.color === c));
  }

  /** Spends one pulse on `color`. Refused (false) unless the board is at rest and pulses remain. */
  pulse(color: ColorId): boolean {
    if (this.phase !== 'ready' || this.pulsesLeft <= 0) return false;
    if (!this.colors.includes(color)) return false;
    if (!this.world.startPulse(color)) return false;
    this.pulsesLeft--;
    this.history.push(color);
    this.phase = 'resolving';
    return true;
  }

  /** Advances one fixed step. Win or loss is decided only when the pulse has settled. */
  step(events: WorldEvent[] = []): WorldEvent[] {
    this.world.step(events);
    if (this.phase === 'resolving' && !this.world.resolving) {
      if (this.collected >= this.level.target) this.phase = 'won';
      else if (this.pulsesLeft <= 0) this.phase = 'lost';
      else this.phase = 'ready';
    }
    return events;
  }

  /** Steps until the current pulse is fully resolved (used by tests and the solver). */
  settle(): void {
    while (this.phase === 'resolving') this.step();
  }

  /** Back to the level's start state. */
  reset(): void {
    this.world = new World(this.level);
    this.pulsesLeft = this.level.pulses;
    this.phase = 'ready';
    this.history = [];
  }

  /**
   * Extension point for a later reward (e.g. a rewarded ad): adds pulses and,
   * after a loss, lets the same attempt continue. Not wired to anything yet.
   */
  grantExtraPulses(n: number): void {
    if (n <= 0 || this.phase === 'won' || this.phase === 'resolving') return;
    this.pulsesLeft += n;
    if (this.phase === 'lost') this.phase = 'ready';
  }
}

/** Plays `sequence` on a fresh game and returns it, fully settled. */
export function playSequence(level: LevelDef, sequence: ColorId[]): Game {
  const g = new Game(level);
  for (const c of sequence) {
    if (!g.pulse(c)) break;
    g.settle();
  }
  return g;
}
