import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import { payout, rewardFor } from '../../src/game/coins';
import { formatCoins, rewardPlate, type RewardView } from '../../src/ui/coins';
import { winLine, winMarkup, type WinCard } from '../../src/ui/endCard';

// Finding B5 (production/findings.md): the win pop-up shows one amount, the one really paid.

const PAR = 7;
const BUDGET = PAR + config.moveSlack;
const noop = (): void => {};

/** The win pop-up for a win in `moves`, on a level that already paid `alreadyPaid`, built the way the game builds it. */
function winCard(moves: number, alreadyPaid: number | undefined, helped = false, extra: Partial<WinCard> = {}): { card: WinCard; earned: number } {
  const reward = rewardFor(moves, PAR, BUDGET, helped);
  const earned = payout(reward.total, alreadyPaid);
  const view: RewardView = { reward, spare: Math.max(0, BUDGET - moves), earned, balance: config.coins.start + earned, helped };
  return { card: { kind: 'win', stars: 3, moves, par: PAR, backup: false, last: false, reward: view, next: noop, replay: noop, levels: noop, ...extra }, earned };
}
/** Every "+N" a player can read in the markup (tags and attributes left out). */
const amountsShown = (html: string): string[] => html.replace(/<[^>]*>/g, ' ').match(/\+\d[\d ]*/g)?.map((s) => s.trim()) ?? [];
const plates = (html: string): number => html.split('tf-coin-total').length - 1;

describe('win pop-up: the one amount shown is the real payout', () => {
  it('test_winPopup_firstWin_showsExactlyThePayout', () => {
    const { card, earned } = winCard(PAR, undefined);
    const html = winMarkup(card, false);
    expect(earned).toBe(config.coins.win + config.moveSlack * config.coins.perSpareMove + config.coins.perfect);
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

  it('test_winPopup_noBreakdownNoBalance_oneMainButton', () => {
    const html = winMarkup(winCard(PAR, undefined).card, false);
    expect(html).not.toContain('tf-coin-line');
    expect(html).not.toContain('tf-coin-balance');
    expect(html.split('tf-end-big').length - 1).toBe(1);
    expect(html).toContain('id="end-next"');
    expect(html).toContain('id="end-replay"');
    expect(html).toContain('id="end-levels"');
  });

  it('test_winPopup_lastLevel_hasLevelsAsMainAndNoNext', () => {
    const html = winMarkup(winCard(PAR, undefined, false, { last: true }).card, false);
    expect(html).not.toContain('id="end-next"');
    expect(html.split('id="end-levels"').length - 1).toBe(1);
    expect(html).toContain('that was the last level');
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
