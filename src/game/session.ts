import { collectedCount, DEFAULT_RULES, isWon, step } from '../engine/engine';
import type { Command, GameState, Rules, StepResult } from '../engine/types';
import type { Level } from '../levels/parse';

/** Where a level attempt stands. */
export type Status = 'playing' | 'won' | 'lost';

/** How an attempt is set up. */
export interface SessionOptions {
  /** Moves allowed before extra moves. */
  readonly budget: number;
  /** Rules for this attempt; the default rules when omitted. */
  readonly rules?: Rules;
}

/**
 * One attempt at one level: current state, undo history and the command log
 * used for replays. Holds no rendering or DOM code.
 */
export class Session {
  private history: GameState[] = [];
  private log: Command[] = [];
  /** Current logical state. */
  state: GameState;
  /** Moves granted on top of the budget by extra moves. */
  bonusMoves = 0;
  readonly budget: number;
  readonly rules: Rules;

  constructor(
    readonly level: Level,
    options: SessionOptions,
  ) {
    this.state = level.start;
    this.budget = options.budget;
    this.rules = options.rules ?? DEFAULT_RULES;
  }

  /** Commands applied so far, oldest first. */
  get commands(): readonly Command[] {
    return this.log;
  }

  /** Every state of this attempt, oldest first, ending with the current one. */
  get states(): readonly GameState[] {
    return [...this.history, this.state];
  }

  /** Budget plus extra moves. */
  get totalBudget(): number {
    return this.budget + this.bonusMoves;
  }

  /** Moves the player may still make. */
  get movesLeft(): number {
    return this.totalBudget - this.state.movesUsed;
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
    const result = step(this.level.board, this.state, command, this.rules);
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

  /** Back to the start of the level. extra moves are cleared too. */
  restart(): void {
    this.history = [];
    this.log = [];
    this.bonusMoves = 0;
    this.state = this.level.start;
  }

  /** Add extra moves  */
  grantBonus(moves: number): void {
    this.bonusMoves += moves;
  }
}
