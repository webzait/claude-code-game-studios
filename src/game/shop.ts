import { CONFIG } from '../config';

/**
 * Buying coins, behind one small interface. The game talks only to
 * `PurchaseProvider`; the single implementation in this build is the simulated
 * one, which charges nothing and contacts nobody. What a real implementation
 * would need is written down in design/shop.md and is NOT built.
 */

/** A pack of coins as the shop lists it. */
export interface CoinPack {
  readonly id: string;
  /** Plain name shown to the player. */
  readonly name: string;
  /** Coins the pack adds to the wallet. */
  readonly coins: number;
  /** Example price in euro cents. Shown as an example only: nothing is charged in this build. */
  readonly examplePriceCents: number;
}

/** How a purchase ended. Only `success` may change the wallet. */
export type PurchaseResult =
  | { readonly status: 'success'; readonly pack: CoinPack; /** Reference printed on the receipt line. */ readonly receipt: string }
  | { readonly status: 'cancelled'; readonly pack: CoinPack }
  | { readonly status: 'failed'; readonly pack: CoinPack; readonly reason: string };

/** The outcome the test lab asks the simulated shop to produce. */
export type PurchaseOutcome = PurchaseResult['status'];
/** Every outcome, in the order the test lab lists them. */
export const PURCHASE_OUTCOMES: readonly PurchaseOutcome[] = ['success', 'cancelled', 'failed'];

/**
 * The purchase layer. A real store or payment route would be a second
 * implementation of this; nothing else in the game would change.
 */
export interface PurchaseProvider {
  /** True when no money can move: the shop must then say so wherever a price is shown. */
  readonly simulated: boolean;
  /** The packs on offer, cheapest first. */
  listPacks(): Promise<readonly CoinPack[]>;
  /** Try to buy one pack. Resolves with the outcome; it never rejects. */
  buy(packId: string): Promise<PurchaseResult>;
}

/** What the simulated provider needs from outside, so tests can run it without timers. */
export interface SimulatedOptions {
  /** The outcome to produce for the next purchase (the test lab's switch). */
  readonly outcome: () => PurchaseOutcome;
  /** Waits out the "processing" moment. */
  readonly delay: (ms: number) => Promise<void>;
  /** Length of the "processing" moment in milliseconds. */
  readonly processingMs: number;
}

/**
 * The pretend shop: every purchase is simulated on the device. No request is
 * made, no money moves, and the outcome is whatever the test lab asked for.
 */
export class SimulatedProvider implements PurchaseProvider {
  readonly simulated = true;
  private serial = 0;

  /** @param packs The packs on offer, asked for each time: the test lab can change the tuning they belong to. */
  constructor(private readonly packs: () => readonly CoinPack[], private readonly options: SimulatedOptions) {}

  listPacks(): Promise<readonly CoinPack[]> {
    return Promise.resolve(this.packs());
  }

  async buy(packId: string): Promise<PurchaseResult> {
    const pack = this.packs().find((p) => p.id === packId);
    if (!pack) return { status: 'failed', pack: { id: packId, name: packId, coins: 0, examplePriceCents: 0 }, reason: 'This pack does not exist.' };
    await this.options.delay(this.options.processingMs);
    const outcome = this.options.outcome();
    if (outcome === 'cancelled') return { status: 'cancelled', pack };
    if (outcome === 'failed') return { status: 'failed', pack, reason: 'The test shop was told to fail.' };
    this.serial++;
    return { status: 'success', pack, receipt: `TEST-${String(this.serial).padStart(4, '0')}` };
  }
}

/** The packs of a tuning (the game's own by default), cheapest first. Entries that are not a whole pack are left out. */
export function configuredPacks(raw: readonly Partial<CoinPack>[] = CONFIG.shop.packs): CoinPack[] {
  return raw
    .filter((p): p is CoinPack => typeof p.id === 'string' && typeof p.name === 'string' && Number.isInteger(p.coins) && p.coins! > 0 && Number.isInteger(p.examplePriceCents) && p.examplePriceCents! > 0)
    .sort((a, b) => a.examplePriceCents - b.examplePriceCents);
}

/** An example price as the player reads it, for instance `€0.99`. */
export function formatExamplePrice(cents: number): string {
  return `€${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** The wallet after a purchase: only a success adds the pack's coins. */
export function walletAfter(coins: number, result: PurchaseResult): number {
  return result.status === 'success' ? coins + result.pack.coins : coins;
}

/** What the plus button and the "Get coins" links open: the test shop, or the explainer that says there is no shop. */
export function plusOpens(lab: { readonly shop: boolean }): 'shop' | 'explainer' {
  return lab.shop ? 'shop' : 'explainer';
}

/** The line that confirms how a purchase ended, with the balance it left. Always says what happened to the coins. */
export function receiptLine(result: PurchaseResult, balance: number): string {
  if (result.status === 'success') return `Test purchase ${result.receipt}: +${result.pack.coins} coins. You now have ${balance}. Nothing was charged.`;
  if (result.status === 'cancelled') return `Purchase cancelled. Nothing was charged and your coins did not change: ${balance}.`;
  return `Purchase failed. Nothing was charged and your coins did not change: ${balance}.`;
}
