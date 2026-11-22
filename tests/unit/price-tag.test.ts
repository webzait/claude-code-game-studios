import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import parts from '../../data/parts.json';
import { formatCoins, offerButton, priceSlot, priceTag, spokenPrice, type PriceState } from '../../src/ui/coins';
import { lostBody, type LostCard } from '../../src/ui/endCard';

// Finding B9 (production/findings.md): one price tag, in one place, wherever a price is shown.

const STATES: PriceState[] = ['ok', 'short', 'free', 'used'];
const noop = (): void => {};
const count = (html: string, needle: string): number => html.split(needle).length - 1;
/** The out-of-moves pop-up with an offer and a priced Undo, both in `state`. */
const lost = (state: 'ok' | 'short' | 'free'): string => {
  const card: LostCard = {
    kind: 'lost',
    offer: { price: config.coins.extraMovesCost, state, coins: config.coins.start, take: noop },
    undo: noop,
    undoPrice: { cost: config.coins.undoCost, state },
    retry: noop,
  };
  return lostBody(card);
};

describe('the one price tag (finding B9)', () => {
  it('test_priceTag_everyState_isTheSameElementWithOneStateClass', () => {
    for (const state of STATES) {
      const html = priceTag(config.coins.hintCost, state);
      expect(count(html, 'class="tf-coin-price')).toBe(1);
      for (const other of ['short', 'free', 'used']) expect(html.includes(`tf-coin-price ${other}`)).toBe(other === state);
    }
  });
  it('test_priceTag_withAPrice_showsTheCoinAndTheAmountAsText', () => {
    for (const state of ['ok', 'short'] as const) {
      const html = priceTag(config.coins.hintCost, state);
      expect(count(html, 'tf-coin-ico')).toBe(1);
      expect(html).toContain(`<span>${config.coins.hintCost}</span>`);
    }
  });
  it('test_priceTag_freeAndUsed_showAWordAndNoCoin', () => {
    expect(priceTag(0, 'free')).toContain('>Free<');
    expect(priceTag(config.coins.hintCost, 'used')).toContain('Used');
    for (const state of ['free', 'used'] as const) expect(priceTag(config.coins.hintCost, state)).not.toContain('tf-coin-ico');
  });
  it('test_priceTag_fourDigitPrice_isWrittenInFullWithThousandsApart', () => {
    expect(formatCoins(1250)).toMatch(/^1\s250$/);
    expect(priceTag(1250, 'ok')).toContain(`<span>${formatCoins(1250)}</span>`);
  });
  it('test_priceTag_sizes_onlyScaleTheTag', () => {
    const small = priceTag(config.coins.undoCost, 'ok', parts.coins.priceSmall);
    const large = priceTag(config.coins.undoCost, 'ok', parts.coins.price);
    const strip = (html: string): string => html.replace(/style="[^"]*"/, '');
    expect(strip(small)).toBe(strip(large));
    expect(small).toContain(`--ph:${parts.coins.priceSmall.height}px`);
  });
  it('test_offerButton_price_standsInTheSlotAndNotInTheFace', () => {
    const html = offerButton('offer', config.coins.extraMovesCost, 'ok');
    const face = html.slice(html.indexOf('tf-face'), html.indexOf('tf-coin-slot'));
    expect(face).not.toContain('tf-coin-price');
    expect(html).toContain(priceSlot(priceTag(config.coins.extraMovesCost, 'ok')));
    expect(html).toContain(`aria-label="${spokenPrice(`+${config.extraMoves} moves`, config.coins.extraMovesCost, 'ok')}"`);
  });
  it('test_lostPopup_offerAndUndo_carryTheSameTagInTheSamePlace', () => {
    for (const state of ['ok', 'short', 'free'] as const) {
      const html = lost(state);
      expect(count(html, 'class="tf-coin-slot"')).toBe(2);
      expect(html).toContain(priceSlot(priceTag(config.coins.extraMovesCost, state)));
      expect(html).toContain(priceSlot(priceTag(config.coins.undoCost, state)));
      // Retry is free: it has no tag at all.
      const retry = html.slice(html.indexOf('id="end-retry"'));
      expect(retry.slice(0, retry.indexOf('</button>'))).not.toContain('tf-coin-price');
    }
  });
});

describe('the bottom buttons as one family (finding B9)', () => {
  it('test_parts_family_givesOneDepthAndCornerRuleAndAToolThatIsTallEnoughToTouch', () => {
    const { family, tools } = parts.buttons;
    expect(family.depth).toBeGreaterThan(0);
    expect(family.radius).toBeGreaterThan(0);
    // The footprint (face plus wall) is the touch target: at least 44 CSS px.
    expect(tools.height * (1 + family.depth)).toBeGreaterThanOrEqual(44);
  });
});
