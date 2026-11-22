import { CONFIG } from '../config';
import type { Reward } from '../game/coins';
import parts from '../../data/parts.json';
import coinImage from '../../assets/turnflock/ui/coin.webp';
import extraMovesImage from '../../assets/turnflock/ui/extra-moves.webp';

/**
 * The coin controls of the game: counter with its plus button, the price tag
 * on a button, the "+N moves" offer, the reward after a win and the coin
 * explainer. Markup and sizes are the ones designed on the parts sheet
 * (`tf-coin-*`, data/parts.json); every number and label is real text.
 */

const C = parts.coins;
const COINS = CONFIG.coins;

/** An amount as the player reads it: thousands apart with a narrow space, never abbreviated. */
export function formatCoins(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** The coin picture at a size in CSS pixels. */
export const coinIcon = (size: number): string => `<img class="tf-coin-ico" src="${coinImage}" alt="" style="--s:${size}px" />`;

const CHECK = `<svg class="tf-coin-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.8 10 17.6 19.2 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const PLUS = `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.4)"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></g><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
const BULB = `<svg class="tf-coin-bulb" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 15.4a5.9 5.9 0 1 1 6.6 0v1.9H8.7z" fill="#f4c62f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.9 20.6h4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 .9v1.4M4.3 3.6l1 1M19.7 3.6l-1 1M1.4 10.4h1.5M22.6 10.4h-1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.6 9.6a2.6 2.6 0 0 1 2-2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

const sizeVars = (s: { width?: number; height: number; depth: number; radius: number }): string =>
  `--w:${s.width === undefined ? '100%' : `${s.width}px`};--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${parts.buttons.pressFraction}`;

/** How a priced button stands: affordable, too expensive, free (test lab) or already used. */
export type PriceState = 'ok' | 'short' | 'free' | 'used';

/** The price tag that sits on a button: coin and number, or the word that replaces them. */
export function priceTag(cost: number, state: PriceState, size: { height: number; icon: number; font: number } = C.price): string {
  const style = `style="--ph:${size.height}px;--pf:${size.font}px"`;
  if (state === 'free') return `<span class="tf-coin-price free" ${style}>Free</span>`;
  if (state === 'used') return `<span class="tf-coin-price used" ${style}>${CHECK}<span class="tf-coin-word">Used</span></span>`;
  return `<span class="tf-coin-price${state === 'short' ? ' short' : ''}" ${style}>${coinIcon(size.icon)}<span>${formatCoins(cost)}</span></span>`;
}

/** What a screen reader says for a priced button. */
export function spokenPrice(name: string, cost: number, state: PriceState): string {
  if (state === 'free') return `${name}, free`;
  if (state === 'used') return `${name}, already used`;
  return `${name}, ${cost} coins${state === 'short' ? ', you do not have enough coins' : ''}`;
}

/** Turn the Undo button of the tools row into a priced button: its arrow, then the price tag `setPrice` fills in. */
export function mountUndoButton(button: HTMLButtonElement): void {
  button.classList.add('tf-coin-buy', 'undo', 'compact');
  button.querySelector('.tf-label')?.remove();
  button.querySelector('.tf-face')!.insertAdjacentHTML('beforeend', '<span class="tf-coin-slot"></span>');
}

/** Turn the Hint button of the tools row into the compact priced button, sized by that row; `setPrice` fills in the tag. */
export function mountHintButton(button: HTMLButtonElement): void {
  button.className = 'tf-btn tf-coin-buy hint compact';
  button.innerHTML = `<span class="tf-clip"><span class="tf-face">${BULB}<span class="tf-coin-slot"></span></span></span>`;
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

/** The "+N moves" offer: one wide button with its price on it. Too expensive stays tappable, so the counter can answer. */
export function offerButton(id: string, cost: number, state: Exclude<PriceState, 'used'>): string {
  const name = `+${CONFIG.extraMoves} moves`;
  return `<button type="button" id="${id}" class="tf-btn tf-coin-buy boost offer${state === 'short' ? ' short' : ''}" style="${sizeVars(C.offer)}" aria-label="${spokenPrice(name, cost, state)}"><span class="tf-clip"><span class="tf-face"><img class="tf-coin-art" src="${extraMovesImage}" alt="" /><span class="tf-label">${name}</span>${priceTag(cost, state)}</span></span></button>`;
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
  /** A paid hint or extra moves were used, so only the base amount counts. */
  readonly helped: boolean;
}

/** The reward after a win: the amount paid on a gold plate, the sum it comes from, and the new balance. */
export function rewardBlock(v: RewardView): string {
  const small = coinIcon(C.reward.lineIcon);
  if (v.earned <= 0) {
    return `<div class="tf-coin-reward paid"><p class="tf-coin-paid">${CHECK}Best reward already paid</p><p class="tf-coin-balance">You have ${small}<b>${formatCoins(v.balance)}</b></p></div>`;
  }
  const line = (name: string, amount: number): string =>
    `<div class="tf-coin-line${amount === 0 ? ' none' : ''}"><dt>${name}</dt><dd>${amount === 0 ? '–' : `+${formatCoins(amount)}${small}`}</dd></div>`;
  const before = v.reward.total - v.earned;
  const earlier = before > 0 ? `<div class="tf-coin-line spend"><dt>Paid for this level before</dt><dd>−${formatCoins(before)}${small}</dd></div>` : '';
  return `<div class="tf-coin-reward">
    <p class="tf-coin-total" aria-label="${v.earned} coins earned" style="--rf:${C.reward.font}px">${coinIcon(C.reward.icon)}<span class="tf-coin-sum" data-to="${v.earned}">+${formatCoins(v.earned)}</span></p>
    <dl class="tf-coin-lines">${line('Level won', v.reward.base)}${line(v.spare === 1 ? '1 move left over' : `${v.spare} moves left over`, v.reward.spareMoves)}${line('Shortest solution', v.reward.perfect)}${earlier}</dl>
    ${v.helped ? '<p class="tf-coin-why">A hint or extra moves were used, so only the base reward counts.</p>' : ''}
    <p class="tf-coin-balance">Now ${small}<b>${formatCoins(v.balance)}</b></p>
  </div>`;
}

/** The honest stand-in for a shop: what coins are, how they are earned and what they cost. */
export function coinInfo(titleId: string): string {
  const small = coinIcon(C.reward.lineIcon);
  const line = (name: string, amount: string, spend = false): string => `<div class="tf-coin-line${spend ? ' spend' : ''}"><dt>${name}</dt><dd>${amount}${small}</dd></div>`;
  return `<h4 id="${titleId}">${coinIcon(24)}Coins</h4>
    <dl class="tf-coin-lines">
      ${line('Level won', `+${COINS.win}`)}
      ${line('Each move left over', `+${COINS.perSpareMove}`)}
      ${line('Shortest solution', `+${COINS.perfect}`)}
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
 * and a price the wallet cannot pay is answered with a short shake.
 */
export class CoinCounters {
  private counters: HTMLElement[] = [];
  private shown: number | null = null;
  private timer = 0;

  /**
   * @param hosts Elements that each get a counter and a plus button.
   * @param reduced True when motion is reduced: amounts jump instead of counting.
   * @param onPlus The plus button was tapped.
   */
  constructor(hosts: readonly HTMLElement[], private reduced: () => boolean, onPlus: (button: HTMLButtonElement) => void) {
    const s = C.counter.compact;
    for (const host of hosts) {
      host.classList.add('tf-coin-group');
      host.innerHTML = `<span class="tf-coin-counter compact" role="status" style="--ch:${s.height}px;--cd:${s.depth}px;--cr:${s.radius}px;--cf:${s.font}px">${coinIcon(s.icon)}<span class="tf-coin-amount">0</span></span><button type="button" class="tf-btn tf-coin-plus" style="${sizeVars(C.plus)}" aria-label="About coins" aria-haspopup="dialog"><span class="tf-clip"><span class="tf-face">${PLUS}</span></span></button>`;
      const button = host.querySelector<HTMLButtonElement>('button')!;
      button.addEventListener('click', () => onPlus(button));
      this.counters.push(host.querySelector<HTMLElement>('.tf-coin-counter')!);
    }
  }

  /** Show the wallet. A higher amount than the one on show is celebrated on the counters that are visible. */
  set(amount: number): void {
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
