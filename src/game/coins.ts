import { CONFIG } from '../config';
import { starsFor } from './progress';

/**
 * The amounts and rules of the coin economy: the `coins` block of data/config.json.
 * Every function here takes one as its last argument and uses the game's own by
 * default, so the economy model (tools/economy) can run other sets through the same code.
 */
export interface CoinRules {
  /** Coins a new player begins with. */
  readonly start: number;
  /** Every win pays this; a one-star win pays nothing else. */
  readonly win: number;
  /** Added to `win` for a two-star win. */
  readonly twoStars: number;
  /** Added to `win` for a three-star win, the shortest solution. */
  readonly perfect: number;
  /** Added for every move of the budget left unused. Zero when the reward follows the stars alone. */
  readonly perSpareMove: number;
  /** What a win that used a paid hint pays: `stars`, the same as any win, or `base`, the `win` amount only. */
  readonly hintedWinPays: string;
  readonly hintCost: number;
  readonly extraMovesCost: number;
  readonly undoCost: number;
  readonly freeUndosPerLevel: number;
}

/** Paid help used in the attempt that won. */
export interface Help {
  /** A paid hint showed a move. */
  readonly hint: boolean;
  /** Extra moves were bought; the win is then worth one star. */
  readonly extraMoves: boolean;
}

/** No paid help. */
export const NO_HELP: Help = { hint: false, extraMoves: false };

/** What a level win is worth, with the parts that add up to it. */
export interface Reward {
  /** Stars of the win; the reward follows them. */
  readonly stars: 1 | 2 | 3;
  readonly base: number;
  /** The bonus for two or three stars. */
  readonly starBonus: number;
  readonly spareMoves: number;
  readonly total: number;
}

/**
 * Coins for winning a level: the reward follows the stars. Every win pays
 * `win`, two stars add `twoStars`, three stars (the shortest solution) add
 * `perfect`, and `perSpareMove` adds an amount per unused move when it is not
 * zero. A win with extra moves is a one-star win. A win with a paid hint pays
 * by its stars, or `win` only when `hintedWinPays` is `base`.
 */
export function rewardFor(moves: number, par: number, budget: number, help: Help, rules: CoinRules = CONFIG.coins): Reward {
  const stars = starsFor(moves, par, help.extraMoves);
  const base = rules.win;
  if (help.extraMoves || (help.hint && rules.hintedWinPays === 'base')) return { stars, base, starBonus: 0, spareMoves: 0, total: base };
  const starBonus = stars === 3 ? rules.perfect : stars === 2 ? rules.twoStars : 0;
  const spareMoves = Math.max(0, budget - moves) * rules.perSpareMove;
  return { stars, base, starBonus, spareMoves, total: base + starBonus + spareMoves };
}

/**
 * Levels paid under earlier amounts, brought to today's: a level that was paid
 * counts as paid for the result it has, so the same result never pays a
 * leftover difference and a better one pays the step between today's amounts.
 * No coins are added or taken. Returns the new `paid` map.
 */
export function settlePaid(
  paid: Readonly<Record<string, number>>,
  best: Readonly<Record<string, number>>,
  levels: readonly { readonly id: string; readonly par: number }[],
  rules: CoinRules = CONFIG.coins,
): Record<string, number> {
  const out: Record<string, number> = { ...paid };
  for (const level of levels) {
    const was = paid[level.id];
    const moves = best[level.id];
    if (was === undefined || moves === undefined) continue;
    const budget = level.par + CONFIG.moveSlack;
    // A win carried over from the first prototype has no move count (0): it is a one-star win.
    const worth = moves === 0 ? rules.win : rewardFor(moves, level.par, budget, { hint: false, extraMoves: moves > budget }, rules).total;
    out[level.id] = Math.max(was, worth);
  }
  return out;
}

/**
 * Coins to pay out now. A level pays its best reward once: replaying it pays
 * only the improvement over what it already paid, so levels cannot be farmed.
 */
export function payout(reward: number, alreadyPaid: number | undefined): number {
  return Math.max(0, reward - (alreadyPaid ?? 0));
}

/** Price of revealing the next move. Zero when the test lab makes help free. */
export function hintPrice(freeHelp: boolean, rules: CoinRules = CONFIG.coins): number {
  return freeHelp ? 0 : rules.hintCost;
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
export function undoPrice(freeHelp: boolean, undosTaken: number, rules: CoinRules = CONFIG.coins): number {
  if (freeHelp || undosTaken < rules.freeUndosPerLevel) return 0;
  return rules.undoCost;
}

/** The next Undo for a wallet of `coins`: its price and whether it can be paid. */
export function undoQuote(coins: number, freeHelp: boolean, undosTaken: number, rules: CoinRules = CONFIG.coins): UndoQuote {
  const cost = undoPrice(freeHelp, undosTaken, rules);
  return { cost, state: cost === 0 ? 'free' : coins < cost ? 'short' : 'ok' };
}

/** Price of the extra moves offered when out of moves. Zero when the test lab makes help free. */
export function extraMovesPrice(freeHelp: boolean, rules: CoinRules = CONFIG.coins): number {
  return freeHelp ? 0 : rules.extraMovesCost;
}
