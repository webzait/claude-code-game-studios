/**
 * The coin economy as a model: what kinds of player earn and spend over the
 * levels, where the wallet runs short and how many coins they would have to
 * add. It plays no boards. A player type is a set of stated habits (how often
 * the shortest solution, how many Undos, hints and "+3 moves"), scaled by each
 * level's measured difficulty; every coin is counted by the game's own
 * functions in src/game/coins.ts. The habits are assumptions, not
 * measurements: the output is a scenario, never a forecast.
 */
import { CONFIG } from '../../src/config';
import { extraMovesPrice, hintPrice, payout, rewardFor, undoQuote, type CoinRules } from '../../src/game/coins';
import { seeded } from '../level-design/measure';

/** A level as the model sees it. */
export interface EconLevel {
  readonly id: string;
  readonly name: string;
  /** Length of the shortest solution. */
  readonly par: number;
  /** Measured difficulty, 0 to 10 (design/level-report.md). */
  readonly score: number;
}

/** A habit that grows with difficulty: its value on a level of score 0 and on one of score 10, a straight line between. */
export type Range = readonly [atScore0: number, atScore10: number];

/** One kind of player, described by behaviour. */
export interface PlayerType {
  readonly id: string;
  readonly name: string;
  readonly about: string;
  /** Chance that the win is the shortest solution. Otherwise it is one or two moves longer, equally often. */
  readonly perfect: Range;
  /** Undos wanted per level, on average. */
  readonly undos: Range;
  /** Paid hints wanted per level, on average. */
  readonly hints: Range;
  /** Chance of running out of moves in a position "+3 moves" can save, and wanting it. */
  readonly extraMoves: Range;
}

/** A named set of amounts. */
export interface RuleSet {
  readonly id: string;
  readonly name: string;
  readonly about: string;
  readonly coins: CoinRules;
}

/** What a player wants on one level, before the wallet has a say. */
export interface Wants {
  /** Moves over the shortest solution in the winning attempt: 0, 1 or 2. */
  readonly over: 0 | 1 | 2;
  readonly undos: number;
  readonly hints: number;
  readonly extraMoves: boolean;
}

/** Coins by kind of help. */
export interface ByHelp {
  undo: number;
  hint: number;
  extraMoves: number;
}

/** What one level did to the wallet. */
export interface LevelResult {
  readonly stars: 1 | 2 | 3;
  readonly earned: number;
  readonly spent: ByHelp;
  /** List price of everything wanted, bought or not. */
  readonly wanted: number;
  /** Times a wanted help could not be paid. */
  readonly refused: ByHelp;
  /** Coins added from outside to pay for everything wanted (only when topping up). */
  readonly added: number;
  /** The wallet after the level. */
  readonly wallet: number;
}

/** The value of a habit on a level of the given difficulty score. */
export function rate(range: Range, score: number): number {
  const t = Math.min(1, Math.max(0, score / 10));
  return range[0] + (range[1] - range[0]) * t;
}

/** A Poisson-distributed count with the given mean, from a generator of numbers in [0, 1). */
export function poisson(mean: number, random: () => number): number {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let count = 0;
  for (let p = random(); p > limit; p *= random()) count++;
  return count;
}

/** Draw what a player wants on a level. Always uses the same number of random values, so two players or two rule sets can share a seed. */
export function drawWants(player: PlayerType, level: EconLevel, random: () => number): Wants {
  const perfect = random() < rate(player.perfect, level.score);
  const longer = random() < 0.5 ? 1 : 2;
  const extraMoves = random() < rate(player.extraMoves, level.score);
  const undos = poisson(rate(player.undos, level.score), random);
  const hints = poisson(rate(player.hints, level.score), random);
  return { over: perfect ? 0 : longer, undos, hints, extraMoves };
}

/**
 * Play one level's coins. Help is paid for in the order Undo, hint, "+3 moves",
 * then the win pays. Without `topUp` a help the wallet cannot pay is refused
 * and the player goes on for free (Restart): a refused "+3 moves" becomes a
 * free retry that wins on the last move of the budget. With `topUp` exactly
 * the missing coins are added each time, so everything wanted is bought.
 * The free Undos of `freeUndosPerLevel` are counted once per level, although
 * the game grants them again after every Restart: a cautious reading.
 */
export function playLevel(level: EconLevel, wants: Wants, wallet: number, rules: CoinRules, topUp: boolean, alreadyPaid?: number): LevelResult {
  const spent: ByHelp = { undo: 0, hint: 0, extraMoves: 0 };
  const refused: ByHelp = { undo: 0, hint: 0, extraMoves: 0 };
  let added = 0;
  let wanted = 0;
  const pay = (price: number, kind: keyof ByHelp): boolean => {
    wanted += price;
    if (wallet < price) {
      if (!topUp) {
        refused[kind]++;
        return false;
      }
      added += price - wallet;
      wallet = price;
    }
    wallet -= price;
    spent[kind] += price;
    return true;
  };
  for (let taken = 0; taken < wants.undos; taken++) pay(undoQuote(wallet, false, taken, rules).cost, 'undo');
  let hinted = false;
  for (let i = 0; i < wants.hints; i++) hinted = pay(hintPrice(false, rules), 'hint') || hinted;
  const extraMoves = wants.extraMoves && pay(extraMovesPrice(false, rules), 'extraMoves');
  const budget = level.par + CONFIG.moveSlack;
  const moves = extraMoves ? budget + 1 : wants.extraMoves ? budget : level.par + wants.over;
  const reward = rewardFor(moves, level.par, budget, { hint: hinted, extraMoves }, rules);
  const earned = payout(reward.total, alreadyPaid);
  wallet += earned;
  return { stars: reward.stars, earned, spent, wanted, refused, added, wallet };
}

/** One player's whole run: a result per level, starting from the rule set's opening balance. */
export function playRun(levels: readonly EconLevel[], player: PlayerType, rules: CoinRules, seed: number, topUp: boolean): LevelResult[] {
  const random = seeded(seed);
  let wallet = rules.start;
  return levels.map((level) => {
    const result = playLevel(level, drawWants(player, level, random), wallet, rules, topUp);
    wallet = result.wallet;
    return result;
  });
}

/** The value below which the given share of the sorted numbers lies (nearest rank). */
export function quantile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))];
}

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const ascending = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

/** A player type under a rule set, over many runs. Amounts are means over the runs unless named otherwise. */
export interface Summary {
  readonly player: string;
  readonly set: string;
  readonly levels: number;
  readonly runs: number;
  /** Opening balance. */
  readonly start: number;
  /** Stars per level. */
  readonly stars: number;
  /** A player who never adds coins: earned, spent, and what stayed unbought. */
  readonly earned: number;
  readonly spent: ByHelp;
  readonly spentTotal: number;
  /** List price of everything wanted. */
  readonly wanted: number;
  /** Times help was refused, per run. */
  readonly refusals: number;
  /** Mean wallet after each level, for the player who never adds coins. */
  readonly balance: readonly number[];
  /** Share of runs in which help was refused at least once. */
  readonly shortShare: number;
  /** Level number of the first refusal, over the runs that had one: median, and the 10th and 90th percentile. Null when no run had one. */
  readonly firstShort: { readonly median: number; readonly early: number; readonly late: number } | null;
  /** A player who adds exactly what is missing: coins added in total (mean, median, 90th percentile) and per page of 20 levels (mean). */
  readonly added: { readonly mean: number; readonly median: number; readonly high: number; readonly perPage: readonly number[] };
  /** The same player's earnings and wallet at the end. */
  readonly toppedUp: { readonly earned: number; readonly spent: number; readonly left: number };
  /** Per page of 20 levels, per level: coins earned and list price of the help wanted. */
  readonly perPage: readonly { readonly earned: number; readonly wanted: number }[];
}

/** Levels per page of the level selection; the per-page figures follow it. */
export const PAGE = 20;

/** Run a player type through the levels many times and summarise. Run `i` uses seed `seed + i` for both the paying and the non-paying player, so they want the same things. */
export function summarise(levels: readonly EconLevel[], player: PlayerType, set: RuleSet, runs: number, seed: number): Summary {
  const pages = Math.ceil(levels.length / PAGE);
  const balance = levels.map(() => 0);
  const firsts: number[] = [];
  const addedTotals: number[] = [];
  const addedPage = Array.from({ length: pages }, () => 0);
  const page = Array.from({ length: pages }, () => ({ earned: 0, wanted: 0 }));
  const spent: ByHelp = { undo: 0, hint: 0, extraMoves: 0 };
  let earned = 0;
  let wanted = 0;
  let refusals = 0;
  let stars = 0;
  const topped = { earned: 0, spent: 0, left: 0 };
  for (let run = 0; run < runs; run++) {
    const plain = playRun(levels, player, set.coins, seed + run, false);
    let first = 0;
    plain.forEach((r, i) => {
      balance[i] += r.wallet;
      earned += r.earned;
      wanted += r.wanted;
      stars += r.stars;
      for (const kind of ['undo', 'hint', 'extraMoves'] as const) {
        spent[kind] += r.spent[kind];
        refusals += r.refused[kind];
        if (first === 0 && r.refused[kind] > 0) first = i + 1;
      }
      const p = page[Math.floor(i / PAGE)];
      p.earned += r.earned;
      p.wanted += r.wanted;
    });
    if (first > 0) firsts.push(first);
    const paying = playRun(levels, player, set.coins, seed + run, true);
    let total = 0;
    paying.forEach((r, i) => {
      total += r.added;
      addedPage[Math.floor(i / PAGE)] += r.added;
      topped.earned += r.earned;
      topped.spent += r.spent.undo + r.spent.hint + r.spent.extraMoves;
    });
    topped.left += paying.length > 0 ? paying[paying.length - 1].wallet : set.coins.start;
    addedTotals.push(total);
  }
  const sortedFirsts = ascending(firsts);
  const sortedAdded = ascending(addedTotals);
  const per = (n: number): number => n / runs;
  const inPage = (index: number): number => Math.min(PAGE, levels.length - index * PAGE);
  return {
    player: player.id,
    set: set.id,
    levels: levels.length,
    runs,
    start: set.coins.start,
    stars: stars / runs / Math.max(1, levels.length),
    earned: per(earned),
    spent: { undo: per(spent.undo), hint: per(spent.hint), extraMoves: per(spent.extraMoves) },
    spentTotal: per(spent.undo + spent.hint + spent.extraMoves),
    wanted: per(wanted),
    refusals: per(refusals),
    balance: balance.map(per),
    shortShare: firsts.length / runs,
    firstShort: firsts.length === 0 ? null : { median: quantile(sortedFirsts, 0.5), early: quantile(sortedFirsts, 0.1), late: quantile(sortedFirsts, 0.9) },
    added: { mean: mean(addedTotals), median: quantile(sortedAdded, 0.5), high: quantile(sortedAdded, 0.9), perPage: addedPage.map(per) },
    toppedUp: { earned: per(topped.earned), spent: per(topped.spent), left: per(topped.left) },
    perPage: page.map((p, i) => ({ earned: per(p.earned) / inPage(i), wanted: per(p.wanted) / inPage(i) })),
  };
}

/** The same player with one habit scaled, for asking "what if they undo half or twice as often". */
export function scaled(player: PlayerType, habit: 'undos' | 'hints' | 'extraMoves', factor: number): PlayerType {
  const [easy, hard] = player[habit];
  return { ...player, [habit]: [easy * factor, hard * factor] };
}

/**
 * The same player, taking less of a help as it gets dearer. The habits in players.json were assumed at the
 * prices of `base`; under `rules` each habit is scaled by (base price / price) ^ `elasticity`. 0 is the
 * model's plain assumption (the same help whatever it costs); 1 means the coins a player wants to spend
 * on each help stay the same, so a price three times as high gives a third of the help.
 */
export function priceAware(player: PlayerType, base: CoinRules, rules: CoinRules, elasticity: number): PlayerType {
  const factor = (was: number, now: number): number => (was > 0 && now > 0 ? Math.pow(was / now, elasticity) : 1);
  const by = (range: Range, f: number): Range => [range[0] * f, range[1] * f];
  return {
    ...player,
    undos: by(player.undos, factor(base.undoCost, rules.undoCost)),
    hints: by(player.hints, factor(base.hintCost, rules.hintCost)),
    extraMoves: by(player.extraMoves, factor(base.extraMovesCost, rules.extraMovesCost)),
  };
}

/** What a help costs in euro when its coins come from a pack: the price in coins times the pack's price per coin. */
export function euroPerHelp(price: number, pack: { readonly coins: number; readonly examplePriceCents: number }): number {
  return (price * pack.examplePriceCents) / pack.coins / 100;
}

/** How many of one help the coins earned over ten levels buy, when they buy nothing else. */
export function helpPerTenLevels(earned: number, levels: number, price: number): number {
  return price > 0 && levels > 0 ? ((earned / levels) * 10) / price : Infinity;
}

/** The difficulty scores in the generated level report, by level name. */
export function scoresFromReport(report: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const line of report.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    // A row of a "Getallen" table: | 12 | Name | … | **4.3** |
    const score = /^\*\*(\d+(?:\.\d+)?)\*\*$/.exec(cells[cells.length - 2] ?? '');
    if (score && /^\d+$/.test(cells[1] ?? '') && cells[2]) scores.set(cells[2], Number(score[1]));
  }
  return scores;
}

/** Levels with their measured score. Throws when a level is missing from the report: measure it first (`npm run measure`). */
export function withScores(levels: readonly { readonly id: string; readonly name: string; readonly par: number }[], scores: ReadonlyMap<string, number>): EconLevel[] {
  return levels.map((l) => {
    const score = scores.get(l.name);
    if (score === undefined) throw new Error(`No difficulty score for "${l.name}" in design/level-report.md: run npm run measure`);
    return { id: l.id, name: l.name, par: l.par, score };
  });
}
