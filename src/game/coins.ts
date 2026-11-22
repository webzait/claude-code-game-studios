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

/** What the next Undo costs, and whether the wallet can pay it. */
export interface UndoQuote {
  /** Coins the Undo takes; zero when it is free. */
  readonly cost: number;
  /** `free`: costs nothing. `ok`: affordable. `short`: the wallet cannot pay, so the Undo is refused. */
  readonly state: 'free' | 'ok' | 'short';
}

/**
 * Price of taking back one command. Each step undone is paid for on its own.
 * Free when the test lab makes help free, and for the first
 * `coins.freeUndosPerLevel` Undos of an attempt.
 * @param undosTaken Undos already taken in this attempt (since the level was opened or restarted).
 */
export function undoPrice(freeHelp: boolean, undosTaken: number): number {
  if (freeHelp || undosTaken < CONFIG.coins.freeUndosPerLevel) return 0;
  return CONFIG.coins.undoCost;
}

/** The next Undo for a wallet of `coins`: its price and whether it can be paid. */
export function undoQuote(coins: number, freeHelp: boolean, undosTaken: number): UndoQuote {
  const cost = undoPrice(freeHelp, undosTaken);
  return { cost, state: cost === 0 ? 'free' : coins < cost ? 'short' : 'ok' };
}

/** Price of the extra moves offered when out of moves. Zero when the test lab makes help free. */
export function extraMovesPrice(freeHelp: boolean): number {
  return freeHelp ? 0 : CONFIG.coins.extraMovesCost;
}
