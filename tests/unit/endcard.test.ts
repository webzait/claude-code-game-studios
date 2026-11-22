import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import parts from '../../data/parts.json';
import { payout, rewardFor } from '../../src/game/coins';
import { formatCoins, landingAmounts, rewardPlate, type RewardView } from '../../src/ui/coins';
import { winLine, winMarkup, type WinCard } from '../../src/ui/endCard';

// Findings B5 and B6 (production/findings.md): the win pop-up shows one amount, the one really paid, and the coin
// flight ends exactly on the true balance.

const PAR = 7;
const BUDGET = PAR + config.moveSlack;
const noop = (): void => {};
/** What a three-star win pays: the base, the three-star bonus and whatever each unused move adds. */
const THREE_STARS = config.coins.win + config.coins.perfect + config.moveSlack * config.coins.perSpareMove;

/** The win pop-up for a win in `moves`, on a level that already paid `alreadyPaid`, built the way the game builds it. */
function winCard(moves: number, alreadyPaid: number | undefined, helped = false /* extra moves were bought */, extra: Partial<WinCard> = {}): { card: WinCard; earned: number } {
  const reward = rewardFor(moves, PAR, BUDGET, { hint: false, extraMoves: helped });
  const earned = payout(reward.total, alreadyPaid);
  const view: RewardView = { reward, spare: Math.max(0, BUDGET - moves), earned, balance: config.coins.start + earned, helped };
  return { card: { kind: 'win', stars: 3, moves, par: PAR, backup: false, last: false, reward: view, next: noop, retry: noop, levels: noop, ...extra }, earned };
}
/** Every "+N" a player can read in the markup (tags and attributes left out). */
const amountsShown = (html: string): string[] => html.replace(/<[^>]*>/g, ' ').match(/\+\d[\d ]*/g)?.map((s) => s.trim()) ?? [];
const plates = (html: string): number => html.split('tf-coin-total').length - 1;

describe('win pop-up: the one amount shown is the real payout', () => {
  it('test_winPopup_firstWin_showsExactlyThePayout', () => {
    const { card, earned } = winCard(PAR, undefined);
    const html = winMarkup(card, false);
    expect(earned).toBe(THREE_STARS);
    expect(plates(html)).toBe(1);
    expect(amountsShown(html)).toEqual([`+${earned}`]);
    expect(html).toContain(`data-earned="${earned}"`);
    expect(html).toContain(`aria-label="${earned} coins earned"`);
  });

  it('test_winPopup_replayThatPaysNothing_showsNoPlateAndNoAmount', () => {
    const first = winCard(PAR, undefined);
    const { card, earned } = winCard(PAR, first.card.reward.reward.total);
    const html = winMarkup(card, false);
    expect(earned).toBe(0);
    expect(plates(html)).toBe(0);
    expect(amountsShown(html)).toEqual([]);
    expect(html).toContain('Best reward already paid');
  });

  it('test_winPopup_betterReplay_showsOnlyTheImprovement', () => {
    const slow = winCard(PAR + 1, undefined);
    const { card, earned } = winCard(PAR, slow.card.reward.reward.total);
    expect(earned).toBe(card.reward.reward.total - slow.card.reward.reward.total);
    expect(earned).toBeGreaterThan(0);
    expect(amountsShown(winMarkup(card, false))).toEqual([`+${earned}`]);
  });

  it('test_winPopup_worseReplay_paysAndShowsNothing', () => {
    const best = winCard(PAR, undefined);
    const { card, earned } = winCard(PAR + 1, best.card.reward.reward.total);
    expect(earned).toBe(0);
    expect(amountsShown(winMarkup(card, false))).toEqual([]);
  });

  it('test_winPopup_helpedWin_showsTheBaseAmountOnly', () => {
    const { card, earned } = winCard(PAR, undefined, true, { backup: true, stars: 1 });
    expect(earned).toBe(config.coins.win);
    expect(amountsShown(winMarkup(card, false))).toEqual([`+${earned}`]);
  });

  it('test_winPopup_noBreakdownNoBalance_threeSymbolButtons', () => {
    const html = winMarkup(winCard(PAR, undefined).card, false);
    expect(html).not.toContain('tf-coin-line');
    expect(html).not.toContain('tf-coin-balance');
    // Levels, Retry, Next, in that order, each a named symbol; only Next is green.
    expect([...html.matchAll(/<button type="button" id="end-(\w+)" class="([^"]*)" aria-label="(\w+)"/g)].map((m) => [m[1], m[3]])).toEqual([['levels', 'Levels'], ['retry', 'Retry'], ['next', 'Next']]);
    expect(html.split('tf-end-symbol').length - 1).toBe(3);
    expect(html.split('tf-end-go ').length - 1).toBe(1);
  });

  it('test_winPopup_lastLevel_hasLevelsAndRetryAndNoNext', () => {
    const html = winMarkup(winCard(PAR, undefined, false, { last: true }).card, false);
    expect(html).not.toContain('id="end-next"');
    expect(html.split('id="end-levels"').length - 1).toBe(1);
    expect(html).toContain('id="end-retry"');
    expect(html).toContain('that was the last level');
  });

  it('test_winPopup_retrySymbol_isTheRestartSymbolOfThePuzzleScreen', () => {
    // One symbol for "start this level again", on the pop-up and during play (owner, 2026-11-22).
    const page = readFileSync('index.html', 'utf8');
    const inGame = page.slice(page.indexOf('id="restart"'), page.indexOf('</button>', page.indexOf('id="restart"')));
    const html = winMarkup(winCard(PAR, undefined).card, false);
    const popup = html.slice(html.indexOf('id="end-retry"'), html.indexOf('</button>', html.indexOf('id="end-retry"')));
    // The same outlines; a drawn shadow repeats them and does not make it another symbol.
    const shapes = (svg: string): string[] => [...new Set([...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]))].sort();
    expect(shapes(popup).length).toBeGreaterThan(0);
    expect(shapes(popup)).toEqual(shapes(inGame));
  });

  it('test_rewardPlate_zeroOrLess_isNeverAnAmount', () => {
    expect(rewardPlate(0)).not.toContain('tf-coin-total');
    expect(rewardPlate(-5)).not.toContain('tf-coin-total');
    expect(rewardPlate(1234)).toContain(`+${formatCoins(1234)}`);
  });
});

describe('win pop-up: the one line', () => {
  it('test_winLine_eachSituation_saysWhatExplainsTheStars', () => {
    expect(winLine({ moves: 7, par: 7, backup: false, last: false })).toBe('<b>7 moves</b> · the shortest solution');
    expect(winLine({ moves: 9, par: 7, backup: false, last: false })).toBe('<b>9 moves</b> · shortest is 7');
    expect(winLine({ moves: 11, par: 7, backup: true, last: false })).toBe('<b>11 moves</b> · with extra moves');
    expect(winLine({ moves: 10, par: 10, backup: false, last: true })).toBe('<b>10 moves</b> · that was the last level');
  });
});

describe('coin flight: what the counter reads on each landing', () => {
  const COUNT = parts.coins.fly.count;

  it('test_landingAmounts_anyPayout_endsExactlyOnTheBalance', () => {
    for (const earned of [1, 2, 5, 6, 7, 10, 13, 20, 26, 30, 100, 1001]) {
      const from = 30;
      const steps = landingAmounts(from, from + earned, COUNT);
      expect(steps.at(-1)).toBe(from + earned);
      expect(steps.length).toBe(Math.min(COUNT, earned));
      steps.forEach((value, i) => expect(value).toBeGreaterThan(i === 0 ? from : steps[i - 1]));
    }
  });

  it('test_landingAmounts_nothingEarned_fliesNothing', () => {
    expect(landingAmounts(30, 30, COUNT)).toEqual([]);
    expect(landingAmounts(30, 20, COUNT)).toEqual([]);
    expect(landingAmounts(30, 56, 0)).toEqual([]);
  });

  it('test_flightData_isASmallFixedHandful', () => {
    expect(Number.isInteger(COUNT)).toBe(true);
    expect(COUNT).toBeGreaterThanOrEqual(3);
    expect(COUNT).toBeLessThanOrEqual(8);
    expect(parts.coins.fly.flightMs).toBeGreaterThan(0);
    expect(parts.coins.fly.staggerMs).toBeGreaterThanOrEqual(0);
  });
});
