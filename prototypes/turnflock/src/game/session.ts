// PROTOTYPE - NOT FOR PRODUCTION
import { collectedCount, isWon, step } from '../engine/engine';
import type { Command, GameState, StepResult } from '../engine/types';
import type { Level } from '../levels/parse';

/** Where a level attempt stands. */
export type Status = 'playing' | 'won' | 'lost';

/**
 * One attempt at one level: current state, undo history and the command log
 * used for replays. Holds no rendering or DOM code. Later features hook in
 * here: extra moves raise `bonusMoves`, a hint asks the solver from `state`,
 * and a daily challenge is just another `Level`.
 */
export class Session {
  private history: GameState[] = [];
  private log: Command[] = [];
  /** Current logical state. */
  state: GameState;
  /** Moves granted on top of the level budget (0 in the prototype). */
  bonusMoves = 0;

  constructor(readonly level: Level) {
    this.state = level.start;
  }

  /** Commands applied so far, oldest first. */
  get commands(): readonly Command[] {
    return this.log;
  }

  /** Moves the player may still make. */
  get movesLeft(): number {
    return this.level.moveBudget + this.bonusMoves - this.state.movesUsed;
  }

  /** Robots collected so far. */
  get collected(): number {
    return collectedCount(this.state);
  }

  /** Total robots in the level. */
  get total(): number {
    return this.state.robots.length;
  }

  /** Won when every robot is collected; lost when moves run out first. */
  get status(): Status {
    if (isWon(this.state)) return 'won';
    return this.movesLeft <= 0 ? 'lost' : 'playing';
  }

  /** Apply a command. Returns null when the level is already won or lost. */
  apply(command: Command): StepResult | null {
    if (this.status !== 'playing') return null;
    const result = step(this.level.board, this.state, command);
    this.history.push(this.state);
    this.log.push(command);
    this.state = result.state;
    return result;
  }

  /** Take back the last command. Returns false when there is nothing to undo. */
  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.log.pop();
    this.state = previous;
    return true;
  }

  /** Back to the start of the level. */
  restart(): void {
    this.history = [];
    this.log = [];
    this.state = this.level.start;
  }
}
