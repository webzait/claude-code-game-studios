import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import parts from '../../data/parts.json';
import { coinIcon, coinInfo, offerButton, priceTag, rewardPlate } from '../../src/ui/coins';
import { lostBody } from '../../src/ui/endCard';
import { confirmMarkup, packMarkup } from '../../src/ui/shopView';
import { slotStatus, themeSources } from '../../src/render/themes';
import type { CoinPack } from '../../src/game/shop';

// The garden theme's star coin (design/themes/garden-coin.md). Every coin in the game is one
// <i class="tf-coin-ico"> whose picture the style sheets set: the robot coin in tf-coins.css, the star
// coin under [data-theme="garden"] in src/ui/themes/garden/coin.css. These checks keep every coin place
// on that one element; tests/integration/garden-coin.spec.ts checks the picture each place really draws.

const COIN_TAG = '<i class="tf-coin-ico" aria-hidden="true"';
const noop = (): void => {};
const pack: CoinPack = config.shop.packs[0] as unknown as CoinPack;
const gardenCss = readFileSync('src/ui/themes/garden/coin.css', 'utf8');
/** Game source files (not the parts sheet, which shows the robot coin's pictures side by side on purpose). */
const gameSources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === join('src', 'parts') ? [] : gameSources(path);
    return /\.(ts|css)$/.test(name) ? [path] : [];
  });

describe('garden star coin: every coin place is the one themeable coin element', () => {
  it.each([
    ['counter and coin icons', coinIcon(26)],
    ['price tag', priceTag(config.coins.hintCost, 'ok')],
    ['price tag, too expensive', priceTag(config.coins.hintCost, 'short')],
    ['extra-moves offer', offerButton('end-offer', config.coins.extraMovesCost, 'ok')],
    ['win reward', rewardPlate(30)],
    ['coin explainer', coinInfo('t')],
    ['test shop pack', packMarkup(pack)],
    ['test shop confirm', confirmMarkup(pack)],
    [
      'out-of-moves pop-up with get-coins link',
      lostBody({ kind: 'lost', offer: { price: config.coins.extraMovesCost, state: 'short', coins: 0, take: noop }, undo: noop, undoPrice: { cost: config.coins.undoCost, state: 'short' }, retry: noop, getCoins: noop }),
    ],
  ])('%s draws its coin as the themeable element and never as an <img>', (_, html) => {
    expect(html).toContain(COIN_TAG);
    expect(html).not.toMatch(/<img[^>]*tf-coin-ico/);
  });

  it('no game file but tf-coins.css names the robot coin picture, so no coin place can bypass the theme', () => {
    const naming = gameSources('src').filter((file) => readFileSync(file, 'utf8').includes('turnflock/ui/coin.webp'));
    expect(naming).toEqual([join('src', 'ui', 'tf-coins.css')]);
  });

  it('the garden sheet swaps every coin for the star coin and the Undo and Hint price tags for its small cut, in the garden theme only', () => {
    const rules = gardenCss.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter(Boolean);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.startsWith('[data-theme="garden"]')).toBe(true);
    expect(gardenCss).toMatch(/\[data-theme="garden"\] i\.tf-coin-ico \{ background-image: url\('[^']*\/garden\/coin\/star-coin\.webp'\)/);
    expect(gardenCss).toMatch(/\[data-theme="garden"\] \.tf-paid \.tf-coin-price i\.tf-coin-ico \{ background-image: url\('[^']*\/garden\/coin\/star-coin-small\.webp'\)/);
  });

  it('the coin is a slot the garden supplies and the robot theme keeps', () => {
    expect(slotStatus(themeSources('garden')).coin).toBe('own');
    expect(slotStatus(themeSources('robot')).coin).toBe('robot');
  });

  it('the star coin pictures are square, about twice the largest coin on screen, and small', () => {
    const largest = Math.max(parts.coins.reward.icon, parts.coins.fly.size, parts.coins.counter.wide.icon);
    for (const [file, side] of [['star-coin.webp', 96], ['star-coin-small.webp', 48]] as const) {
      const bytes = readFileSync(`assets/turnflock/garden/coin/${file}`);
      // VP8X header: canvas width-1 and height-1 as 24-bit little-endian at bytes 24 and 27.
      const w = bytes.readUIntLE(24, 3) + 1;
      const h = bytes.readUIntLE(27, 3) + 1;
      expect([w, h]).toEqual([side, side]);
      expect(bytes.length).toBeLessThan(8 * 1024);
    }
    expect(96 / largest).toBeGreaterThanOrEqual(2);
  });
});
