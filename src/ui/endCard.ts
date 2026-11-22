import { CONFIG } from '../config';
import { formatCoins, offerButton, priceSlot, priceTag, rewardPlate, spokenPrice, type PriceState, type RewardView } from './coins';

/**
 * The end-of-round pop-up: a sheet resting near the bottom edge, as designed
 * on the parts sheet (`tf-end-*`). One function per situation builds the
 * dialog; the buttons are the shared `tf-btn` blocks and every number and
 * label is real text. Each situation says one thing: a win is its stars, one
 * line, the coins really earned and one main button (finding B5).
 */

const STAR = 'M32 8 38.6 23.2 55 24.7 42.6 35.6 46.2 51.7 32 43.2 17.8 51.7 21.4 35.6 9 24.7 25.4 23.2Z';
const starPath = (fill: string, width: number, extra = ''): string => `<path d="${STAR}" fill="${fill}" stroke="${fill}" stroke-width="${width}" stroke-linejoin="round" ${extra}/>`;
/** The star: a gold block with a darker wall under it when earned, a sunk slot in the panel tones when not. */
const star = (on: boolean): string => `<svg class="tf-end-star ${on ? 'on' : 'off'}" viewBox="0 0 64 64" aria-hidden="true">${
  on
    ? starPath('#C9961A', 10, 'transform="translate(0 3.5)"') + starPath('#C9961A', 10) + starPath('url(#tf-end-gold)', 6.5) + starPath('#FFE48A', 5, 'transform="translate(32 29.5) scale(.46) translate(-32 -31)"') + '<path d="M16.5 24.6c3.4-.9 6.6-1.3 9.6-1.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".85"/>'
    : starPath('#C9D2E3', 11) + starPath('#E6EBF5', 5, 'transform="translate(0 2.2)"')
}</svg>`;
/** The gold gradient the earned stars are filled with; the page needs it once. */
export const END_DEFS =
  '<svg class="tf-end-defs" aria-hidden="true"><defs><linearGradient id="tf-end-gold" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="56"><stop offset="0" stop-color="#FFE48A"/><stop offset=".45" stop-color="#F6C542"/><stop offset="1" stop-color="#EDB52C"/></linearGradient></defs></svg>';

const icon = (shape: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.3)">${shape}</g><g>${shape}</g></svg>`;
const stroke = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ICONS = {
  undo: icon(`<path d="M9.4 4.2 3.6 9.3l5.8 5.1z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>` + stroke('M9 9.3h5.4a5.3 5.3 0 0 1 0 10.6H9.6', 3.5)),
  retry: icon(stroke('M17.1 16.9A7 7 0 1 1 15.5 8', 3.5) + stroke('M18.4 3.2v6h-6', 3.5)),
  replay: icon('<path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'),
  next: icon(stroke('M4.5 12h13.5M12.4 5.4 19 12l-6.6 6.6', 3.8)),
  levels: icon('<rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/>'),
  hint: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 15.4a5.9 5.9 0 1 1 6.6 0v1.9H8.7z" fill="#f4c62f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.9 20.6h4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 .9v1.4M4.3 3.6l1 1M19.7 3.6l-1 1M1.4 10.4h1.5M22.6 10.4h-1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  none: '',
};
type Glyph = keyof typeof ICONS;

/** One button of the family. Its element id is `end-<act>`; `after` puts the icon behind the label. */
const button = (act: string, kind: string, text: string, glyph: Glyph, after = false): string => {
  const label = `<span class="tf-label">${text}</span>`;
  return `<button type="button" id="end-${act}" class="tf-btn ${kind}"><span class="tf-clip"><span class="tf-face">${after ? label + ICONS[glyph] : ICONS[glyph] + label}</span></span></button>`;
};
const utility = (act: string, text: string, glyph: Glyph, size = 'tf-end-small'): string => button(act, `tf-utility ${size}`, text, glyph);
/** A quiet secondary action: icon and label, no block, so it never competes with the main button. */
const link = (act: string, text: string, glyph: Glyph): string => `<button type="button" id="end-${act}" class="tf-end-link">${ICONS[glyph]}<span>${text}</span></button>`;

const FLECKS = ['#F1454B', '#2E84F1', '#F4C62F', '#39E85C', '#7E6BFF', '#FFE48A'];
/** A few flecks that fly up from the stars once. */
function confetti(): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    const angle = Math.PI * (1.08 + (0.84 * i) / 15);
    const reach = 92 + ((i * 37) % 60);
    out += `<i style="--c:${FLECKS[i % FLECKS.length]};--x:${Math.round(Math.cos(angle) * reach * 1.25)}px;--y:${Math.round(Math.sin(angle) * reach + 46)}px;--r:${(i % 2 ? 1 : -1) * (160 + i * 23)}deg;--dl:${((i * 53) % 220) / 1000}s"></i>`;
  }
  return `<div class="tf-end-confetti" aria-hidden="true">${out}</div>`;
}

const escape = (text: string): string => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A level was won. */
export interface WinCard {
  readonly kind: 'win';
  readonly stars: 1 | 2 | 3;
  readonly moves: number;
  /** Shortest solution under the rules in play. */
  readonly par: number;
  /** Extra moves were used. */
  readonly backup: boolean;
  /** This was the last level: there is no Next. */
  readonly last: boolean;
  readonly reward: RewardView;
  readonly next: () => void;
  readonly replay: () => void;
  readonly levels: () => void;
}

/** The moves ran out. */
export interface LostCard {
  readonly kind: 'lost';
  /** The checked "+N moves" offer; absent when it was not proven to help. */
  readonly offer?: { readonly price: number; readonly state: Exclude<PriceState, 'used'>; readonly coins: number; readonly take: () => void };
  /** Why there is no offer: the card's one sentence. */
  readonly note?: string;
  readonly undo: () => void;
  /** What that Undo costs; its tag is set on the button. */
  readonly undoPrice: { readonly cost: number; readonly state: Exclude<PriceState, 'used'> };
  readonly retry: () => void;
  /** Ask for a hint from here; offered when there is no paid offer. */
  readonly hint?: () => void;
}

/** A plain card of the test lab. */
export interface InfoCard {
  readonly kind: 'info';
  readonly title: string;
  readonly text: string;
  readonly second: { readonly label: string; readonly action: () => void };
  readonly levels: () => void;
}

/** Every situation the pop-up can show. */
export type EndCard = WinCard | LostCard | InfoCard;

/**
 * The one line of a win: the move count against the shortest solution. It stays because it is what explains the stars
 * (and how to earn the missing ones); the level's name does not, since the top bar behind the sheet still shows it.
 */
export function winLine(w: Pick<WinCard, 'moves' | 'par' | 'backup' | 'last'>): string {
  const moves = `<b>${w.moves} moves</b>`;
  if (w.last) return `${moves} · that was the last level`;
  if (w.backup) return `${moves} · with extra moves`;
  return w.moves <= w.par ? `${moves} · the shortest solution` : `${moves} · shortest is ${w.par}`;
}

/** The markup of the win pop-up. `flecks` adds the confetti of the entrance. */
export function winMarkup(w: WinCard, flecks: boolean): string {
  const actions = w.last ? button('levels', 'tf-end-main tf-end-big wide', 'Levels', 'levels') : button('next', 'tf-end-go tf-end-big wide', 'Next', 'next', true);
  return `${flecks ? confetti() : ''}<div class="tf-end-stars" role="img" aria-label="${w.stars} of 3 stars">${[0, 1, 2].map((i) => `<span class="tf-end-slot${i < w.stars ? ' won' : ''}" style="--i:${i}">${star(false)}${i < w.stars ? star(true) : ''}</span>`).join('')}</div>
    <h2 class="tf-end-title tf-end-line" id="end-title">${winLine(w)}</h2>
    <div class="tf-end-coins" id="end-result">${rewardPlate(w.reward.earned)}</div>
    <div class="tf-end-actions">${actions}</div>
    <div class="tf-end-more">${link('replay', 'Replay', 'replay')}${w.last ? '' : link('levels', 'Levels', 'levels')}</div>`;
}

/** The markup of the out-of-moves pop-up. */
export function lostBody(l: LostCard): string {
  let offer = '';
  let why = l.note ?? '';
  if (l.offer) {
    const o = l.offer;
    why = o.state === 'short' ? `You have ${formatCoins(o.coins)} coins: ${formatCoins(o.price - o.coins)} short. Retry is free.` : `Checked: ${CONFIG.extraMoves} more moves are enough from here.`;
    offer = offerButton('end-offer', o.price, o.state);
  }
  // Undo carries the same price tag in the same place as on the puzzle screen and on the offer: over its bottom edge.
  const u = l.undoPrice;
  const undo = utility('undo', 'Undo', 'undo', `tf-end-mid tf-paid${u.state === 'short' ? ' short' : ''}`)
    .replace('<button ', `<button aria-label="${spokenPrice('Undo', u.cost, u.state)}" `)
    .replace('</span></span></button>', `</span></span>${priceSlot(priceTag(u.cost, u.state))}</button>`);
  return `<div class="tf-end-head"><h2 class="tf-end-title" id="end-title">Out of moves</h2></div>
    <p class="tf-end-note" id="end-result">${why}</p>
    ${offer}
    <div class="tf-end-actions lead">${undo}${button('retry', 'tf-end-main tf-end-mid', 'Retry', 'retry')}</div>
    ${l.hint ? `<div class="tf-end-more">${link('hint', 'Hint', 'hint')}</div>` : ''}`;
}

function infoBody(c: InfoCard): string {
  return `<span class="tf-end-tag">Test lab</span><div class="tf-end-head"><h2 class="tf-end-title" id="end-title">${escape(c.title)}</h2></div><p class="tf-end-note" id="end-result">${escape(c.text)}</p>
    <div class="tf-end-actions lead">${utility('second', escape(c.second.label), 'none', 'tf-end-mid')}${button('levels', 'tf-end-main tf-end-mid', 'Levels', 'levels')}</div>`;
}

/**
 * Put the pop-up for `card` into `host` and wire its buttons.
 * @param animate Play the entrance once (card rises, stars land); false shows the end state at once.
 */
export function renderEndCard(host: HTMLElement, card: EndCard, animate: boolean): void {
  const body = card.kind === 'win' ? winMarkup(card, animate) : card.kind === 'lost' ? lostBody(card) : infoBody(card);
  host.innerHTML = `<section class="tf-end-card sheet ${card.kind}" role="dialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-result" tabindex="-1">${body}</section>`;
  const on = (act: string, action: (() => void) | undefined): void => {
    const node = host.querySelector<HTMLButtonElement>(`#end-${act}`);
    if (node && action) node.addEventListener('click', action);
  };
  if (card.kind === 'win') {
    on('next', card.next);
    on('replay', card.replay);
    on('levels', card.levels);
  } else if (card.kind === 'lost') {
    on('offer', card.offer?.take);
    on('undo', card.undo);
    on('retry', card.retry);
    on('hint', card.hint);
  } else {
    on('second', card.second.action);
    on('levels', card.levels);
  }
  // Focus goes to the dialog, not to a button: a key still held from the last move must not press one.
  host.querySelector<HTMLElement>('.tf-end-card')!.focus({ preventScroll: true });
}
