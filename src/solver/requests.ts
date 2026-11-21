import type { Board, Command, GameState, Rules } from '../engine/types';
import { checkRescue, routeScan, type RescueResult, type ScanResult } from '../game/assist';
import { solve } from './bfs';

/** A question for the solver, as plain data so it can cross to a worker. */
export type SolverRequest =
  | { kind: 'scan'; board: Board; states: GameState[]; totalBudget: number; rules: Rules; maxVisited: number }
  | { kind: 'rescue'; board: Board; state: GameState; extraMoves: number; rules: Rules; maxVisited: number }
  | { kind: 'certify'; board: Board; state: GameState; maxMoves: number; rules: Rules; maxVisited: number };

/** Result of certifying a level under non-default rules. */
export type CertifyResult =
  | { kind: 'certified'; par: number; witness: Command[] }
  | { kind: 'unsolvable' }
  | { kind: 'not-assessed' };

export type SolverAnswer = ScanResult | RescueResult | CertifyResult;

/** Answer one request. The same function serves the worker and the fallback. */
export function handleSolverRequest(request: SolverRequest): SolverAnswer {
  switch (request.kind) {
    case 'scan':
      return routeScan(request.board, request.states, request.totalBudget, request.rules, request.maxVisited);
    case 'rescue':
      return checkRescue(request.board, request.state, request.extraMoves, request.rules, request.maxVisited);
    case 'certify': {
      const result = solve(request.board, request.state, request.maxMoves, request.rules, false, request.maxVisited);
      if (result.solution) return { kind: 'certified', par: result.solution.length, witness: result.solution };
      return result.capped ? { kind: 'not-assessed' } : { kind: 'unsolvable' };
    }
  }
}
