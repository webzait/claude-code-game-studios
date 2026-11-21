// PROTOTYPE - NOT FOR PRODUCTION
import { DEFAULT_RULES, isWon, stateKey, step } from '../engine/engine';
import { COMMANDS, type Board, type Command, type GameState, type Rules } from '../engine/types';

/** Outcome of a solver run. */
export interface SolveResult {
  /** Shortest command list, or null when none exists within maxMoves. */
  readonly solution: Command[] | null;
  /** Number of distinct states visited. */
  readonly visited: number;
  /** Number of distinct shortest solutions (only counted when requested). */
  readonly optimalCount: number;
}

/**
 * Breadth-first search for the shortest winning command list. Uses the same
 * `step` function as the game, so solver and gameplay can never disagree.
 */
export function solve(
  board: Board,
  start: GameState,
  maxMoves: number,
  rules: Rules = DEFAULT_RULES,
  countOptimal = false,
  maxVisited = Infinity,
): SolveResult {
  if (isWon(start)) return { solution: [], visited: 1, optimalCount: 1 };
  interface Node {
    state: GameState;
    parent: Node | null;
    command: Command | null;
    ways: number;
  }
  const seen = new Map<string, Node>();
  const root: Node = { state: start, parent: null, command: null, ways: 1 };
  seen.set(stateKey(start, board.width), root);
  let frontier: Node[] = [root];
  for (let depth = 1; depth <= maxMoves && frontier.length > 0; depth++) {
    const next: Node[] = [];
    const fresh = new Set<Node>();
    let winner: Node | null = null;
    let winWays = 0;
    for (const node of frontier) {
      const activeColors = new Set(node.state.robots.filter((r) => !r.collected).map((r) => r.color));
      for (const command of COMMANDS) {
        // A colour with no robots left behaves exactly like "forward".
        if (command !== 'forward' && !activeColors.has(command)) continue;
        const result = step(board, node.state, command, rules).state;
        if (isWon(result)) {
          winWays += node.ways;
          if (!winner) winner = { state: result, parent: node, command, ways: 0 };
          continue;
        }
        const key = stateKey(result, board.width);
        const known = seen.get(key);
        if (known) {
          if (countOptimal && fresh.has(known)) known.ways += node.ways;
          continue;
        }
        const child: Node = { state: result, parent: node, command, ways: node.ways };
        seen.set(key, child);
        fresh.add(child);
        next.push(child);
      }
      if (winner && !countOptimal) break;
      if (seen.size > maxVisited) return { solution: null, visited: seen.size, optimalCount: 0 };
    }
    if (winner) {
      const solution: Command[] = [];
      for (let n: Node | null = winner; n && n.command; n = n.parent) solution.unshift(n.command);
      return { solution, visited: seen.size, optimalCount: winWays };
    }
    frontier = next;
  }
  return { solution: null, visited: seen.size, optimalCount: 0 };
}
