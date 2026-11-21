import type { Board, Command, GameState, Rules } from '../engine/types';
import { solve } from '../solver/bfs';

/** Answer to "would extra moves save this position?". */
export type RescueResult =
  | { readonly kind: 'rescuable'; readonly solution: Command[] }
  | { readonly kind: 'hopeless' }
  /** The search was cut short: nothing is known, so nothing may be offered. */
  | { readonly kind: 'not-assessed' };

/**
 * Fair-continuation check: can the exact current state be won within
 * `extraMoves` more moves? extra moves are only offered on `rescuable`.
 */
export function checkRescue(board: Board, state: GameState, extraMoves: number, rules: Rules, maxVisited: number): RescueResult {
  const result = solve(board, state, extraMoves, rules, false, maxVisited);
  if (result.solution) return { kind: 'rescuable', solution: result.solution };
  return result.capped ? { kind: 'not-assessed' } : { kind: 'hopeless' };
}

/** What a hint found. */
export type ScanResult =
  /** The current position can still be won: `next` is the first move of a shortest way. */
  | { readonly kind: 'on-route'; readonly next: Command; readonly movesNeeded: number }
  /** The current position cannot be won in the moves left; undoing `undo` moves reaches one that can. */
  | { readonly kind: 'dead-end'; readonly undo: number }
  /** The search was cut short before it could tell. */
  | { readonly kind: 'not-assessed' };

/**
 * hint: look at the current position, and if it is a dead end walk back
 * through the attempt's earlier positions to the latest one that is still winnable.
 * `states` is the attempt oldest first, ending with the current state.
 */
export function routeScan(board: Board, states: readonly GameState[], totalBudget: number, rules: Rules, maxVisited: number): ScanResult {
  const last = states.length - 1;
  for (let i = last; i >= 0; i--) {
    const remaining = totalBudget - states[i].movesUsed;
    const result = solve(board, states[i], remaining, rules, false, maxVisited);
    if (result.solution && result.solution.length > 0) {
      return i === last ? { kind: 'on-route', next: result.solution[0], movesNeeded: result.solution.length } : { kind: 'dead-end', undo: last - i };
    }
    if (result.capped) return { kind: 'not-assessed' };
  }
  // The start is always winnable for a certified level; reaching here means it was not certified.
  return { kind: 'not-assessed' };
}

/**
 * Shortcut for a player who is still following the stored witness: the next
 * witness move, with no search. Null when the attempt has left the witness.
 */
export function witnessNext(witness: readonly Command[], commands: readonly Command[]): Command | null {
  if (commands.length >= witness.length) return null;
  for (let i = 0; i < commands.length; i++) if (commands[i] !== witness[i]) return null;
  return witness[commands.length];
}
