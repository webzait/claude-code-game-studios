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

/** A coin pack as the data file writes it; `configuredPacks` in shop.ts checks and sorts them. */
export interface PackData {
  readonly id: string;
  readonly name: string;
  readonly coins: number;
  readonly examplePriceCents: number;
}

/**
 * One tuning of the economy: the amounts and the shop's packs that belong together.
 * The game's own is `coins` and `shop.packs` in data/config.json, named by `economy.tuning`;
 * `economy.alternatives` holds the others, which the test lab can switch to (finding B12).
 */
export interface Tuning {
  readonly id: string;
  /** Short name on the test lab's choice. */
  readonly label: string;
  /** One line on what sets this tuning apart. */
  readonly about: string;
  readonly coins: CoinRules;
  readonly packs: readonly PackData[];
}

/** The id of the tuning the game uses unless the test lab says otherwise. */
export const DEFAULT_TUNING: string = CONFIG.economy.tuning.id;

/** Every tuning, in the order of `economy.order`: the game's own and the alternatives. */
export const TUNINGS: readonly Tuning[] = (() => {
  const own: Tuning = { ...CONFIG.economy.tuning, coins: CONFIG.coins, packs: CONFIG.shop.packs };
  const all: readonly Tuning[] = [own, ...CONFIG.economy.alternatives];
  const place = (t: Tuning): number => {
    const at = CONFIG.economy.order.indexOf(t.id);
    return at < 0 ? CONFIG.economy.order.length : at;
  };
  return [...all].sort((a, b) => place(a) - place(b));
})();

/** The tuning with this id; an unknown id (one that was since removed) gives the game's own. */
export function tuningFor(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS.find((t) => t.id === DEFAULT_TUNING)!;
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
 * Levels paid under other amounts (an earlier economy, or another tuning chosen in the test lab), brought to
 * the given ones: a level that was paid counts as paid for the result it has, so the same result never pays
 * a leftover difference and a better one pays the step between the given amounts. This is bookkeeping only:
 * no coins are added or taken. Unpaid and unsolved levels are left alone. Returns the new `paid` map.
 */
export function settlePaid(
  paid: Readonly<Record<string, number>>,
  best: Readonly<Record<string, number>>,
  levels: readonly { readonly id: string; readonly par: number }[],
  rules: CoinRules = CONFIG.coins,
): Record<string, number> {
  const out: Record<string, number> = { ...paid };
  for (const level of levels) {
    const moves = best[level.id];
    if (paid[level.id] === undefined || moves === undefined) continue;
    const budget = level.par + CONFIG.moveSlack;
    // A win carried over from the first prototype has no move count (0): it is a one-star win.
    out[level.id] = moves === 0 ? rules.win : rewardFor(moves, level.par, budget, { hint: false, extraMoves: moves > budget }, rules).total;
  }
  return out;
}

/** What changing the tuning does to a save's wallet and paid amounts. */
export interface Retuned {
  readonly coins: number;
  readonly paid: Record<string, number>;
}

/**
 * Change the tuning under a running save (the test lab's choice). The paid amounts are settled to the new
 * tuning. The wallet is kept as it is, with one exception: a player who has not won a level and still holds
 * exactly the old opening balance gets the new one, so a fresh tester sees each tuning as a new player would.
 */
export function retune(
  wallet: { readonly coins: number; readonly paid: Readonly<Record<string, number>>; readonly best: Readonly<Record<string, number>> },
  from: CoinRules,
  to: CoinRules,
  levels: readonly { readonly id: string; readonly par: number }[],
): Retuned {
  const untouched = Object.keys(wallet.best).length === 0 && wallet.coins === from.start;
  return { coins: untouched ? to.start : wallet.coins, paid: settlePaid(wallet.paid, wallet.best, levels, to) };
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
