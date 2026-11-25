import { CONFIG } from '../config';
import type { CoinRules, Reward } from '../game/coins';
import parts from '../../data/parts.json';
import extraMovesImage from '../../assets/turnflock/ui/extra-moves.webp';

/**
 * The coin controls of the game: counter with its plus button, the price tag
 * on a button, the "+N moves" offer, the reward after a win and the coin
 * explainer. Markup and sizes are the ones designed on the parts sheet
 * (`tf-coin-*`, data/parts.json); every number and label is real text.
 */

const C = parts.coins;
const F = C.fly;

/** An amount as the player reads it: thousands apart with a narrow space, never abbreviated. */
export function formatCoins(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * The coin picture: one element whose picture comes from the style sheet (tf-coins.css), so every coin in the
 * game shows the same picture.
 */
export const COIN = '<i class="tf-coin-ico" aria-hidden="true"></i>';

/** The coin picture at a size in CSS pixels. */
export const coinIcon = (size: number): string => `<i class="tf-coin-ico" aria-hidden="true" style="--s:${size}px"></i>`;

const CHECK = `<svg class="tf-coin-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.8 10 17.6 19.2 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PLUS = `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.4)"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></g><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
const sizeVars = (s: { width?: number; height: number; depth: number; radius: number }): string =>
  `--w:${s.width === undefined ? '100%' : `${s.width}px`};--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${parts.buttons.pressFraction}`;

/** How a priced button stands: affordable, too expensive, free (test lab) or already used. */
export type PriceState = 'ok' | 'short' | 'free' | 'used';

/**
 * The one price tag (finding B9): the coin over the left end of a small plate with the amount, or the word that replaces
 * them. It goes in a `tf-coin-slot`, which stands it over the bottom edge of its button; `size` only scales it.
 */
export function priceTag(cost: number, state: PriceState, size: { height: number; font: number } = C.price): string {
  const style = `style="--ph:${size.height}px;--pf:${size.font}px"`;
  if (state === 'free') return `<span class="tf-coin-price free" ${style}>Free</span>`;
  if (state === 'used') return `<span class="tf-coin-price used" ${style}>${CHECK}<span class="tf-coin-word">Used</span></span>`;
  return `<span class="tf-coin-price${state === 'short' ? ' short' : ''}" ${style}>${COIN}<span>${formatCoins(cost)}</span></span>`;
}

/** The place on a button where its price tag stands: put this last inside the button. */
export const priceSlot = (tag = ''): string => `<span class="tf-coin-slot">${tag}</span>`;

/** What a screen reader says for a priced button. */
export function spokenPrice(name: string, cost: number, state: PriceState): string {
  if (state === 'free') return `${name}, free`;
  if (state === 'used') return `${name}, already used`;
  return `${name}, ${cost} coins${state === 'short' ? ', you do not have enough coins' : ''}`;
}

/** Make a button of the tools row a priced one (Undo, Hint): it gets the slot that `setPrice` fills with the tag. */
export function mountPricedButton(button: HTMLButtonElement): void {
  button.classList.add('tf-paid');
  button.insertAdjacentHTML('beforeend', priceSlot());
}

/**
 * Show the price on a priced button of the tools row (Hint, Undo). A button that is too expensive stays a working button
 * (the game answers the tap in words and the counter shakes); a used one is switched off by the caller.
 * @param name What the button is called aloud, for example "Hint".
 */
export function setPrice(button: HTMLButtonElement, name: string, cost: number, state: PriceState): void {
  const key = `${cost}|${state}`;
  if (button.dataset.price === key) return;
  button.dataset.price = key;
  button.querySelector('.tf-coin-slot')!.innerHTML = priceTag(cost, state, C.priceSmall);
  button.classList.toggle('short', state === 'short');
  button.setAttribute('aria-label', spokenPrice(name, cost, state));
}

/** The "+N moves" offer: one wide button with its price tag over its bottom edge. Too expensive stays tappable, so the counter can answer. */
export function offerButton(id: string, cost: number, state: Exclude<PriceState, 'used'>): string {
  const name = `+${CONFIG.extraMoves} moves`;
  return `<button type="button" id="${id}" class="tf-btn tf-coin-buy boost offer${state === 'short' ? ' short' : ''}" style="${sizeVars(C.offer)}" aria-label="${spokenPrice(name, cost, state)}"><span class="tf-clip"><span class="tf-face"><img class="tf-coin-art" src="${extraMovesImage}" alt="" /><span class="tf-label">${name}</span></span></span>${priceSlot(priceTag(cost, state))}</button>`;
}

/** What the reward display needs to know about a win. */
export interface RewardView {
  /** The reward this win is worth, in its parts. */
  readonly reward: Reward;
  /** Moves left unused. */
  readonly spare: number;
  /** Coins really paid out now: the reward minus what the level paid before. */
  readonly earned: number;
  /** The wallet after the payout. */
  readonly balance: number;
  /** Paid help was used and only the base amount was paid for it. */
  readonly helped: boolean;
}

/**
 * The reward on the win pop-up: the one amount really paid out now, on a gold plate. A win that pays nothing (the
 * level already paid its best reward) gets a plain line instead of a plate, never a made-up amount.
 */
export function rewardPlate(earned: number): string {
  if (earned <= 0) return `<p class="tf-coin-paid">${CHECK}Best reward already paid</p>`;
  return `<p class="tf-coin-total" aria-label="${earned} coins earned" style="--rf:${C.reward.font}px">${coinIcon(C.reward.icon)}<span class="tf-coin-sum" data-earned="${earned}">+${formatCoins(earned)}</span></p>`;
}

/**
 * What the counter reads after each coin of a flight lands, going from `from` to `to` with at most `count` coins.
 * Never more coins than were earned, always rising, and the last landing is exactly `to`. Empty when nothing was earned.
 */
export function landingAmounts(from: number, to: number, count: number): number[] {
  const coins = Math.max(0, Math.min(Math.floor(count), to - from));
  return Array.from({ length: coins }, (_, i) => (i === coins - 1 ? to : from + Math.round(((to - from) * (i + 1)) / coins)));
}

/** The honest stand-in for a shop: what coins are, how they are earned and what they cost, in the amounts in play. */
export function coinInfo(titleId: string, COINS: CoinRules = CONFIG.coins): string {
  const small = coinIcon(C.reward.lineIcon);
  const line = (name: string, amount: string, spend = false): string => `<div class="tf-coin-line${spend ? ' spend' : ''}"><dt>${name}</dt><dd>${amount}${small}</dd></div>`;
  return `<h4 id="${titleId}">${coinIcon(24)}Coins</h4>
    <dl class="tf-coin-lines">
      ${line('Level won', `+${COINS.win}`)}
      ${line('Two stars', `+${COINS.win + COINS.twoStars}`)}
      ${line('Three stars', `+${COINS.win + COINS.perfect}`)}
      ${COINS.perSpareMove > 0 ? line('Each move left over', `+${COINS.perSpareMove}`) : ''}
      ${line('Hint: the next move', String(COINS.hintCost), true)}
      ${line(`+${CONFIG.extraMoves} moves`, String(COINS.extraMovesCost), true)}
      ${COINS.undoCost > 0 ? line('Undo: one step back', String(COINS.undoCost), true) : ''}
    </dl>
    <p>${COINS.undoCost > 0 ? 'Restart is always free' : 'Undo and Restart are always free'}. You earn coins by playing; there is nothing to buy.</p>`;
}

/** Count the text of `el` from `from` to `to`, written through `format`. */
export function countUp(el: HTMLElement, from: number, to: number, ms: number, format: (n: number) => string, delay = 0): void {
  const start = performance.now() + delay;
  const step = (now: number): void => {
    if (!el.isConnected) return;
    const t = Math.min(1, Math.max(0, (now - start) / ms));
    el.textContent = format(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * The coin counters of the top bars (one per screen), each with its plus
 * button. They all show the same wallet: earning counts up with a gold rim,
 * and a price the wallet cannot pay is answered with a short shake. After a
 * win the coins fly from the pop-up to the counter (finding B6): `hold`, then
 * `pour`; `settle` ends it at once on the true amount.
 */
export class CoinCounters {
  private counters: HTMLElement[] = [];
  private shown: number | null = null;
  private timer = 0;
  /** The true wallet while a win's coins are still on their way; null when the counters simply show it. */
  private held: number | null = null;
  private flightTimers: number[] = [];
  private layer: HTMLElement | null = null;
  private plusButtons: HTMLButtonElement[] = [];

  /**
   * @param hosts Elements that each get a counter and a plus button; a host marked `data-no-plus` gets the counter only.
   * @param reduced True when motion is reduced: amounts jump instead of counting.
   * @param onPlus The plus button was tapped.
   */
  constructor(hosts: readonly HTMLElement[], private reduced: () => boolean, onPlus: (button: HTMLButtonElement) => void) {
    const s = C.counter.compact;
    for (const host of hosts) {
      host.classList.add('tf-coin-group');
      const plus = host.dataset.noPlus === undefined;
      host.innerHTML = `<span class="tf-coin-counter compact" role="status" style="--ch:${s.height}px;--cd:${s.depth}px;--cr:${s.radius}px;--cf:${s.font}px">${coinIcon(s.icon)}<span class="tf-coin-amount">0</span></span>${plus ? `<button type="button" class="tf-btn tf-coin-plus" style="${sizeVars(C.plus)}" aria-label="About coins" aria-haspopup="dialog"><span class="tf-clip"><span class="tf-face">${PLUS}</span></span></button>` : ''}`;
      const button = host.querySelector<HTMLButtonElement>('button');
      button?.addEventListener('click', () => onPlus(button));
      if (button) this.plusButtons.push(button);
      this.counters.push(host.querySelector<HTMLElement>('.tf-coin-counter')!);
    }
  }

  /** Say aloud what the plus buttons open, for example "Get coins, test shop". */
  setPlusLabel(label: string): void {
    for (const button of this.plusButtons) button.setAttribute('aria-label', label);
  }

  /** Show the wallet. A higher amount than the one on show is celebrated on the counters that are visible. */
  set(amount: number): void {
    if (this.held !== null) {
      if (amount === this.held) return;
      this.settle();
    }
    const before = this.shown;
    if (before === amount) return;
    this.shown = amount;
    for (const counter of this.counters) {
      const text = counter.querySelector<HTMLElement>('.tf-coin-amount')!;
      counter.setAttribute('aria-label', `${amount} coins`);
      counter.querySelector('.tf-coin-gain')?.remove();
      const visible = counter.offsetParent !== null;
      if (before === null || amount < before || !visible) {
        text.textContent = formatCoins(amount);
        continue;
      }
      counter.insertAdjacentHTML('beforeend', `<span class="tf-coin-gain" aria-hidden="true">+${formatCoins(amount - before)}</span>`);
      if (this.reduced()) text.textContent = formatCoins(amount);
      else countUp(text, before, amount, C.countUpMs, formatCoins);
      this.flash(counter, 'earn', C.countUpMs + 500);
    }
  }

  /**
   * The wallet just grew to `amount`, and the counters keep showing the old amount until `pour` brings the coins over.
   * The saved game already holds `amount`; this only delays showing it.
   */
  hold(amount: number): void {
    if (this.shown === null || amount <= this.shown) return this.set(amount);
    this.settle();
    this.held = amount;
  }

  /**
   * Fly the held coins from `from` (the coin on the pop-up) to the counter on screen, which counts up and bumps on
   * each landing. Nothing waits for it. Under reduced motion, or when there is nothing to fly between, the counter
   * shows the new amount at once with a brief gold rim. Does nothing when no amount is held.
   * @param onLand Called for every coin that lands (for its sound).
   */
  pour(from: HTMLElement | null, onLand: () => void = () => {}): void {
    if (this.held === null) return;
    const to = this.held;
    const counter = this.counters.find((c) => c.offsetParent !== null);
    const amounts = landingAmounts(this.shown ?? to, to, F.count);
    if (this.reduced() || !from || !counter || amounts.length === 0) {
      this.settle();
      if (counter) this.flash(counter, 'earn', F.highlightMs);
      return;
    }
    const plate = from.closest<HTMLElement>('.tf-coin-total');
    this.flightTimers.push(
      window.setTimeout(() => {
        const target = counter.querySelector<HTMLElement>('.tf-coin-ico')!;
        const text = counter.querySelector<HTMLElement>('.tf-coin-amount')!;
        const host = counter.closest<HTMLElement>('#app') ?? document.body;
        if (!from.isConnected) return this.settle();
        // Measured once, when the flight starts: nothing is laid out again while the coins are in the air.
        const layer = document.createElement('div');
        layer.className = 'tf-coin-flight';
        layer.setAttribute('aria-hidden', 'true');
        host.append(layer);
        this.layer = layer;
        const base = layer.getBoundingClientRect();
        const a = from.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        const x0 = a.left + a.width / 2 - base.left - F.size / 2;
        const y0 = a.top + a.height / 2 - base.top - F.size / 2;
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const last = amounts.length - 1;
        plate?.style.setProperty('--fade', `${last * F.staggerMs + F.flightMs / 2}ms`);
        plate?.classList.add('sent');
        amounts.forEach((amount, i) => {
          // A fixed fan around the pop-up's coin, so the handful reads as several coins and not as one.
          const angle = i * 2.4;
          const sx = Math.round(Math.cos(angle) * F.scatter);
          const sy = Math.round(Math.sin(angle) * F.scatter);
          const coin = document.createElement('i');
          coin.className = 'tf-coin-fly';
          coin.style.cssText = `--s:${F.size}px;--x0:${x0 + sx}px;--y0:${y0 + sy}px;--dx:${dx - sx}px;--dy:${dy - sy}px;--k:${(b.width / F.size).toFixed(3)};--ms:${F.flightMs}ms;--dl:${i * F.staggerMs}ms`;
          coin.innerHTML = COIN;
          coin.addEventListener('animationend', (e) => {
            if (e.target !== coin) return;
            coin.remove();
            text.textContent = formatCoins(amount);
            counter.setAttribute('aria-label', `${amount} coins`);
            if (i === 0) counter.classList.add('earn');
            counter.animate?.([{ transform: 'none' }, { transform: 'scale(1.12)' }, { transform: 'none' }], { duration: F.bumpMs, easing: 'ease-out' });
            onLand();
            if (i === last) {
              this.settle();
              this.flash(counter, 'earn', F.highlightMs);
            }
          });
          layer.append(coin);
        });
        // Should the animation never report back (a hidden page, a browser without it), the amount still lands.
        this.flightTimers.push(window.setTimeout(() => this.settle(), last * F.staggerMs + F.flightMs + 1500));
      }, F.delayMs),
    );
  }

  /** End a hold or a flight at once: every counter shows the true wallet, and no coin is left in the air. */
  settle(): void {
    for (const timer of this.flightTimers) window.clearTimeout(timer);
    this.flightTimers = [];
    this.layer?.remove();
    this.layer = null;
    if (this.held === null) return;
    const amount = this.held;
    this.held = null;
    this.shown = amount;
    for (const counter of this.counters) {
      counter.classList.remove('earn');
      counter.setAttribute('aria-label', `${amount} coins`);
      counter.querySelector<HTMLElement>('.tf-coin-amount')!.textContent = formatCoins(amount);
    }
  }

  /** The wallet cannot pay: shake and turn red for a moment. */
  short(): void {
    for (const counter of this.counters) this.flash(counter, 'short', C.shortMs);
  }

  private flash(counter: HTMLElement, state: 'earn' | 'short', ms: number): void {
    counter.classList.remove('earn', 'short');
    void counter.offsetWidth;
    counter.classList.add(state);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      for (const c of this.counters) {
        c.classList.remove('earn', 'short');
        c.querySelector('.tf-coin-gain')?.remove();
      }
    }, ms);
  }
}
