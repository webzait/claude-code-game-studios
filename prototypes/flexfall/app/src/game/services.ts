// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Where the business side plugs in later: ads, purchases, analytics, cosmetics. The game only
// ever talks to these interfaces; today every one is a stand-in that does nothing. Swapping in
// a real SDK (through Capacitor, say) changes this file's wiring and nothing in the gameplay.

export type RewardPlacement = 'extra_moves' | 'booster';

export interface AdsService {
  /** Whether a rewarded ad can be offered now. The stand-in never offers one. */
  rewardedReady(placement: RewardPlacement): boolean;
  /** Show it; resolves true when the reward was earned. */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
}
export interface StoreService {
  /** Whether the player owns a product (a skin, a booster pack, a season pass). */
  owns(productId: string): boolean;
  purchase(productId: string): Promise<boolean>;
}
export interface AnalyticsService { track(event: string, props?: Record<string, string | number>): void }
export interface SkinService { marblePalette(): number[] }

export interface Services { ads: AdsService; store: StoreService; analytics: AnalyticsService; skins: SkinService }

/** Taps granted by one rewarded ad after a loss. */
export const EXTRA_MOVES_REWARD = 2;

/** The stand-ins: no ads, no store, events kept in memory, the default marble colours. */
export function createStandInServices(): Services & { events: { event: string; props?: Record<string, string | number> }[] } {
  const events: { event: string; props?: Record<string, string | number> }[] = [];
  return {
    events,
    ads: { rewardedReady: () => false, showRewarded: () => Promise.resolve(false) },
    store: { owns: () => false, purchase: () => Promise.resolve(false) },
    analytics: { track: (event, props) => { if (events.length < 500) events.push({ event, props }); } },
    skins: { marblePalette: () => [0xf06a55, 0xf4b548, 0xf6eee0] },
  };
}
