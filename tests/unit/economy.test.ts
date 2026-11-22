import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import everyLevel from '../../data/levels.json';
import { seeded } from '../../tools/level-design/measure';
import { drawWants, playLevel, playRun, poisson, quantile, rate, scaled, scoresFromReport, summarise, withScores, type EconLevel, type PlayerType, type RuleSet, type Wants } from '../../tools/economy/model';

// Pages 1 and 2 are the levels the economy was reasoned on; page 3 (the turn tile) joined the game later.
const MODEL_LEVELS = 40;
const levels = everyLevel.slice(0, MODEL_LEVELS);
const upcoming = everyLevel.slice(MODEL_LEVELS);

// The economy model (tools/economy, design/economy.md): its arithmetic, and that it reads the game's own data.

const sets = JSON.parse(readFileSync('tools/economy/sets.json', 'utf8')) as RuleSet[];
const players = JSON.parse(readFileSync('tools/economy/players.json', 'utf8')) as PlayerType[];
const set = (id: string): RuleSet => sets.find((s) => s.id === id)!;
const player = (id: string): PlayerType => players.find((p) => p.id === id)!;
const RULES = config.coins;
const LEVEL: EconLevel = { id: 'x', name: 'X', par: 7, score: 5 };
const wants = (w: Partial<Wants>): Wants => ({ over: 0, undos: 0, hints: 0, extraMoves: false, ...w });
const THREE = RULES.win + RULES.perfect;
const TWO = RULES.win + RULES.twoStars;
const SEED = 7;

describe('economy model: one level', () => {
  it('test_playLevel_noHelp_paysTheStarReward', () => {
    expect(playLevel(LEVEL, wants({ over: 0 }), 0, RULES, false)).toMatchObject({ stars: 3, earned: THREE, wallet: THREE, wanted: 0 });
    expect(playLevel(LEVEL, wants({ over: 1 }), 0, RULES, false)).toMatchObject({ stars: 2, earned: TWO });
    expect(playLevel(LEVEL, wants({ over: 2 }), 0, RULES, false)).toMatchObject({ stars: 2, earned: TWO });
  });

  it('test_playLevel_helpThatFits_isPaidBeforeTheReward', () => {
    const cost = 2 * RULES.undoCost + RULES.hintCost;
    const r = playLevel(LEVEL, wants({ undos: 2, hints: 1 }), cost, RULES, false);
    expect(r.spent).toEqual({ undo: 2 * RULES.undoCost, hint: RULES.hintCost, extraMoves: 0 });
    expect(r.refused).toEqual({ undo: 0, hint: 0, extraMoves: 0 });
    expect(r.wallet).toBe(r.earned);
    expect(r.wanted).toBe(cost);
  });

  it('test_playLevel_emptyWallet_refusesEveryHelpAndStillWins', () => {
    const r = playLevel(LEVEL, wants({ undos: 3, hints: 2, extraMoves: true }), 0, RULES, false);
    expect(r.refused).toEqual({ undo: 3, hint: 2, extraMoves: 1 });
    expect(r.spent).toEqual({ undo: 0, hint: 0, extraMoves: 0 });
    // The refused "+3 moves" becomes a free retry that wins on the last move of the budget: two stars.
    expect(r).toMatchObject({ stars: 2, earned: TWO, added: 0, wallet: TWO });
  });

  it('test_playLevel_extraMovesBought_isAOneStarWin', () => {
    const r = playLevel(LEVEL, wants({ extraMoves: true }), RULES.extraMovesCost, RULES, false);
    expect(r).toMatchObject({ stars: 1, earned: RULES.win, wallet: RULES.win });
  });

  it('test_playLevel_topUp_addsExactlyWhatIsMissing', () => {
    const want = wants({ undos: 3, hints: 1, extraMoves: true });
    const price = 3 * RULES.undoCost + RULES.hintCost + RULES.extraMovesCost;
    const r = playLevel(LEVEL, want, 7, RULES, true);
    expect(r.added).toBe(price - 7);
    expect(r.spent.undo + r.spent.hint + r.spent.extraMoves).toBe(price);
    expect(r.wallet).toBe(r.earned);
    expect(playLevel(LEVEL, want, price + 1, RULES, true).added).toBe(0);
  });

  it('test_playLevel_freeUndos_costNothingAndArePerLevel', () => {
    const rules = { ...RULES, freeUndosPerLevel: 2 };
    expect(playLevel(LEVEL, wants({ undos: 5 }), 100, rules, false).spent.undo).toBe(3 * RULES.undoCost);
    expect(playLevel(LEVEL, wants({ undos: 2 }), 0, rules, false).refused.undo).toBe(0);
  });

  it('test_playLevel_firstEconomy_aHintedWinPaysTheBaseOnly', () => {
    const first = set('current').coins;
    expect(playLevel(LEVEL, wants({}), 0, first, false).earned).toBe(26);
    expect(playLevel(LEVEL, wants({ over: 1 }), 0, first, false).earned).toBe(13);
    expect(playLevel(LEVEL, wants({ hints: 1 }), first.hintCost, first, false).earned).toBe(10);
    // The same hint refused leaves the full reward.
    expect(playLevel(LEVEL, wants({ hints: 1 }), 0, first, false).earned).toBe(26);
  });

  it('test_playLevel_alreadyPaid_paysOnlyTheImprovement', () => {
    expect(playLevel(LEVEL, wants({}), 0, RULES, false, TWO).earned).toBe(THREE - TWO);
    expect(playLevel(LEVEL, wants({ over: 1 }), 0, RULES, false, THREE).earned).toBe(0);
  });
});

describe('economy model: habits and draws', () => {
  it('test_rate_isAStraightLineBetweenScore0And10_andClamped', () => {
    expect(rate([1, 5], 0)).toBe(1);
    expect(rate([1, 5], 10)).toBe(5);
    expect(rate([1, 5], 2.5)).toBe(2);
    expect(rate([1, 5], -3)).toBe(1);
    expect(rate([1, 5], 40)).toBe(5);
  });

  it('test_poisson_zeroMeanIsZero_andTheMeanComesOut', () => {
    const random = seeded(SEED);
    expect(poisson(0, random)).toBe(0);
    const draws = Array.from({ length: 20000 }, () => poisson(3, random));
    expect(draws.reduce((a, b) => a + b, 0) / draws.length).toBeCloseTo(3, 1);
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
  });

  it('test_drawWants_sameSeed_sameWants_andAPlayerWithoutHabitsWantsNothing', () => {
    expect(drawWants(player('average'), LEVEL, seeded(SEED))).toEqual(drawWants(player('average'), LEVEL, seeded(SEED)));
    const random = seeded(SEED);
    for (let i = 0; i < 200; i++) expect(drawWants(player('frugal'), LEVEL, random)).toMatchObject({ undos: 0, hints: 0, extraMoves: false });
  });

  it('test_quantile_nearestRank', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.9)).toBe(4);
    expect(quantile([5], 0.1)).toBe(5);
  });

  it('test_scaled_multipliesOneHabitOnly', () => {
    const twice = scaled(player('average'), 'undos', 2);
    expect(twice.undos).toEqual(player('average').undos.map((v) => v * 2));
    expect(twice.hints).toEqual(player('average').hints);
  });
});

describe('economy model: the game\'s own data', () => {
  const report = readFileSync('design/level-report.md', 'utf8');
  const all = withScores([...levels, ...upcoming], scoresFromReport(report));
  const shipped = all.slice(0, levels.length);

  it('test_scores_everyLevelHasItsMeasuredScore', () => {
    expect(all).toHaveLength(levels.length + upcoming.length);
    for (const level of all) {
      expect(level.score).toBeGreaterThan(0);
      expect(level.score).toBeLessThanOrEqual(10);
    }
    expect(all[0]).toMatchObject({ name: 'First Steps', par: 3, score: 0.8 });
    expect(() => withScores([{ id: 'nope', name: 'Not In The Report', par: 5 }], scoresFromReport(report))).toThrow(/npm run measure/);
  });

  it('test_sets_theRecommendedSetIsWhatTheGameUses', () => {
    expect(set('recommended').coins).toEqual(config.coins);
  });

  it('test_sets_theFirstEconomyPaid26_13And10', () => {
    const first = set('current').coins;
    expect(first.win + first.perfect + config.moveSlack * first.perSpareMove).toBe(26);
    expect(first.win + first.perSpareMove).toBe(13);
  });

  it('test_run_aPlayerWhoNeverPaysEndsOnStartPlusEveryReward', () => {
    const run = playRun(shipped, player('frugal'), RULES, SEED, false);
    const earned = run.reduce((sum, r) => sum + r.earned, 0);
    expect(run[run.length - 1].wallet).toBe(RULES.start + earned);
    // Never fewer than two stars without extra moves, never more than three.
    expect(earned).toBeGreaterThanOrEqual(shipped.length * TWO);
    expect(earned).toBeLessThanOrEqual(shipped.length * THREE);
  });

  it('test_run_walletNeverGoesNegative_andTheBooksBalance', () => {
    for (const p of players) {
      for (const topUp of [false, true]) {
        let wallet = RULES.start;
        for (const r of playRun(all, p, RULES, SEED, topUp)) {
          const spent = r.spent.undo + r.spent.hint + r.spent.extraMoves;
          expect(r.wallet).toBe(wallet + r.added - spent + r.earned);
          expect(r.wallet).toBeGreaterThanOrEqual(0);
          expect(spent).toBeLessThanOrEqual(r.wanted);
          if (topUp) expect(spent).toBe(r.wanted);
          else expect(r.added).toBe(0);
          wallet = r.wallet;
        }
      }
    }
  });

  it('test_summarise_sameSeedSameTable_andThePlayerWithoutHelpIsNeverShort', () => {
    const a = summarise(shipped, player('average'), set('recommended'), 50, SEED);
    expect(summarise(shipped, player('average'), set('recommended'), 50, SEED)).toEqual(a);
    expect(a.balance).toHaveLength(shipped.length);
    expect(a.spentTotal).toBeCloseTo(a.spent.undo + a.spent.hint + a.spent.extraMoves, 6);
    expect(a.added.perPage.reduce((x, y) => x + y, 0)).toBeCloseTo(a.added.mean, 6);
    const frugal = summarise(shipped, player('frugal'), set('recommended'), 50, SEED);
    expect(frugal).toMatchObject({ firstShort: null, shortShare: 0, refusals: 0, wanted: 0 });
    expect(frugal.added.mean).toBe(0);
  });

  it('test_summarise_whoAddsCoinsBuysEverythingWanted', () => {
    const s = summarise(shipped, player('struggler'), set('recommended'), 50, SEED);
    expect(s.toppedUp.left).toBeCloseTo(s.start + s.toppedUp.earned + s.added.mean - s.toppedUp.spent, 6);
    expect(s.added.mean).toBeGreaterThan(0);
    expect(s.firstShort).not.toBeNull();
  });

  it('test_sets_scarcerSetsLeaveTheSamePlayerShorter', () => {
    const need = (id: string): number => summarise(shipped, player('struggler'), set(id), 200, SEED).added.mean;
    expect(need('generous')).toBeLessThan(need('recommended'));
    expect(need('recommended')).toBeLessThan(need('scarce'));
  });
});
