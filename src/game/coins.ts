import { CONFIG } from '../config';

/** What a level win is worth, with the parts that add up to it. */
export interface Reward {
  readonly base: number;
  readonly spareMoves: number;
  readonly perfect: number;
  readonly total: number;
}

/**
 * Coins for winning a level. A base amount, a bonus for every move left
 * unused, and a bonus for the shortest possible solution. A win that used a
 * paid hint or extra moves earns the base amount only.
 */
export function rewardFor(moves: number, par: number, budget: number, helped: boolean): Reward {
  const c = CONFIG.coins;
  const base = c.win;
  if (helped) return { base, spareMoves: 0, perfect: 0, total: base };
  const spareMoves = Math.max(0, budget - moves) * c.perSpareMove;
  const perfect = moves <= par ? c.perfect : 0;
  return { base, spareMoves, perfect, total: base + spareMoves + perfect };
}

/**
 * Coins to pay out now. A level pays its best reward once: replaying it pays
 * only the improvement over what it already paid, so levels cannot be farmed.
 */
export function payout(reward: number, alreadyPaid: number | undefined): number {
  return Math.max(0, reward - (alreadyPaid ?? 0));
}

/** Price of revealing the next move. Zero when the test lab makes help free. */
export function hintPrice(freeHelp: boolean): number {
  return freeHelp ? 0 : CONFIG.coins.hintCost;
}

/** Price of the extra moves offered when out of moves. Zero when the test lab makes help free. */
export function extraMovesPrice(freeHelp: boolean): number {
  return freeHelp ? 0 : CONFIG.coins.extraMovesCost;
}
