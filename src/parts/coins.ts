import { CONFIG } from '../config';
import { NO_HELP, rewardFor } from '../game/coins';
import parts from '../../data/parts.json';
import coinImage from '../../assets/turnflock/ui/coin.webp';
import plusImage from '../../assets/turnflock/ui/plus.webp';
import extraMovesImage from '../../assets/turnflock/ui/extra-moves.webp';

/**
 * The coin controls on the parts sheet: counter, plus button, price tags,
 * reward display and the coin icon at small sizes. Plain HTML and CSS in the
 * same family as the buttons (`tf-btn`); every number and label is real text.
 * The game uses the same styles (src/ui/tf-coins.css) with its own English markup (src/ui/coins.ts).
 */

const C = parts.coins;
const COINS = CONFIG.coins;

/** An amount as the player reads it: thousands apart with a narrow space, never abbreviated. */
export function formatCoins(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A five-pointed star as an SVG path around (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** The owner's coin picture. */
const coinPhoto = (size: number): string => `<img class="tf-coin-ico" src="${coinImage}" alt="" style="--s:${size}px" />`;

/** The drawn coin: a flat-on coin in the owner's three gold tones, made to stay readable at 16 px. */
const coinDrawn = (size: number): string =>
  `<svg class="tf-coin-ico drawn" viewBox="0 0 24 24" aria-hidden="true" style="--s:${size}px"><defs><radialGradient id="tf-coin-face" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#ffe48a"/><stop offset=".55" stop-color="#f6c542"/><stop offset="1" stop-color="#eab52c"/></radialGradient></defs><circle cx="12" cy="12.7" r="11" fill="#9a6c08"/><circle cx="12" cy="11.3" r="10.7" fill="#c9961a"/><circle cx="12" cy="11.3" r="8.9" fill="url(#tf-coin-face)"/><path d="M4.9 9a7.4 7.4 0 0 1 8.6-5" fill="none" stroke="#fff6cf" stroke-width="1.5" stroke-linecap="round"/><path d="${starPath(12, 12.5, 5.5, 2.6)}" fill="#b98408" stroke="#b98408" stroke-width="2" stroke-linejoin="round"/><path d="${starPath(12, 11.4, 5.5, 2.6)}" fill="#fff1b0" stroke="#fff1b0" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

/** The coin used inside the controls: the owner's picture at every size (`drawnIconBelow` is 0); the drawn one stays as a fallback. */
const coin = (size: number): string => (size < C.drawnIconBelow ? coinDrawn(size) : coinPhoto(size));

type CounterSize = 'compact' | 'wide';
type CounterState = '' | 'earn' | 'short';

/** The coin counter for the top bar. */
function counter(amount: number, size: CounterSize = 'compact', state: CounterState = '', gain = 0): string {
  const s = C.counter[size];
  const min = size === 'wide' ? `;--cw:${C.counter.wide.minWidth}px` : '';
  const float = gain > 0 ? `<span class="tf-coin-gain" aria-hidden="true">+${formatCoins(gain)}</span>` : '';
  return `<span class="tf-coin-counter ${size}${state ? ` ${state}` : ''}" role="status" aria-label="${amount} munten" style="--ch:${s.height}px;--cd:${s.depth}px;--cr:${s.radius}px;--cf:${s.font}px${min}">${coin(s.icon)}<span class="tf-coin-amount">${formatCoins(amount)}</span>${float}</span>`;
}

const sizeVars = (s: { width?: number; height: number; depth: number; radius: number }, width = s.width === undefined ? '100%' : `${s.width}px`): string =>
  `--w:${width};--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${parts.buttons.pressFraction}`;

const plusGlyph = `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.4)"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></g><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;

/** The plus button beside the counter. Built on the shared button block, in the owner's plus green. */
const plus = (state: '' | 'pressed' = ''): string =>
  `<button type="button" class="tf-btn tf-coin-plus${state ? ` ${state}` : ''}" style="${sizeVars(C.plus)}" aria-label="Meer munten"><span class="tf-clip"><span class="tf-face">${plusGlyph}</span></span></button>`;

/** Counter and plus button as one unit. */
const counterWithPlus = (amount: number, size: CounterSize = 'compact'): string => `<span class="tf-coin-group">${counter(amount, size)}${plus()}</span>`;

type PriceState = 'ok' | 'short' | 'free' | 'used';
const PRICE_LABEL: Record<PriceState, string> = { ok: 'betaalbaar', short: 'te weinig munten', free: 'gratis', used: 'al gebruikt' };
const check = `<svg class="tf-coin-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.8 10 17.6 19.2 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The price tag that sits on a button: coin and number, or the word that replaces them. */
function price(cost: number, state: PriceState): string {
  const style = `style="--ph:${C.price.height}px;--pf:${C.price.font}px"`;
  if (state === 'free') return `<span class="tf-coin-price free" ${style}>Gratis</span>`;
  if (state === 'used') return `<span class="tf-coin-price used" ${style}>${check}<span class="tf-coin-word">Gebruikt</span></span>`;
  return `<span class="tf-coin-price${state === 'short' ? ' short' : ''}" ${style}>${coin(C.price.icon)}<span>${formatCoins(cost)}</span></span>`;
}

const bulb = `<svg class="tf-coin-bulb" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 15.4a5.9 5.9 0 1 1 6.6 0v1.9H8.7z" fill="#f4c62f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.9 20.6h4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 .9v1.4M4.3 3.6l1 1M19.7 3.6l-1 1M1.4 10.4h1.5M22.6 10.4h-1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.6 9.6a2.6 2.6 0 0 1 2-2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

/** What a screen reader says for a priced button. */
function spoken(name: string, cost: number, state: PriceState): string {
  if (state === 'free') return `${name}, gratis`;
  if (state === 'used') return `${name}, al gebruikt`;
  return `${name}, ${cost} munten${state === 'short' ? ', je hebt te weinig munten' : ''}`;
}

/** A button that costs coins. `short` stays tappable (the counter answers with its shake); `used` is really disabled. */
function buy(kind: 'hint' | 'boost', size: string, inner: string, name: string, cost: number, state: PriceState, extra = ''): string {
  const attrs = state === 'used' ? ' disabled' : state === 'short' ? ' aria-disabled="true"' : '';
  return `<button type="button" class="tf-btn tf-coin-buy ${kind}${state === 'short' ? ' short' : ''}${extra}" style="${size}" aria-label="${spoken(name, cost, state)}"${attrs}><span class="tf-clip"><span class="tf-face">${inner}${price(cost, state)}</span></span></button>`;
}

const label = (text: string): string => `<span class="tf-label">${text}</span>`;
const hintButton = (state: PriceState): string => buy('hint', sizeVars(C.hint), bulb + label('Hint'), 'Hint', COINS.hintCost, state);
const hintCompact = (state: PriceState): string => buy('hint', sizeVars(C.hintCompact), bulb, 'Hint', COINS.hintCost, state, ' compact');
const offerName = `+${CONFIG.extraMoves} zetten`;
const offer = (state: PriceState, width = '100%'): string =>
  buy('boost', sizeVars(C.offer, width), `<img class="tf-coin-art" src="${extraMovesImage}" alt="" />` + label(offerName), offerName, COINS.extraMovesCost, state, ' offer');

/** The reward after a win: the total on a gold plate, the parts it adds up to, and the new balance. */
function reward(moves: number, par: number, budget: number, balanceBefore: number, alreadyPaid = false): string {
  const r = rewardFor(moves, par, budget, NO_HELP);
  const spare = Math.max(0, budget - moves);
  const line = (name: string, amount: number): string =>
    `<div class="tf-coin-line${amount === 0 ? ' none' : ''}"><dt>${name}</dt><dd>${amount === 0 ? '–' : `+${formatCoins(amount)}${coin(C.reward.lineIcon)}`}</dd></div>`;
  if (alreadyPaid) {
    return `<div class="tf-coin-reward paid"><p class="tf-coin-paid">${check}Beste beloning al uitbetaald</p><p class="tf-coin-balance">Je hebt ${coin(C.reward.lineIcon)}<b>${formatCoins(balanceBefore)}</b></p></div>`;
  }
  return `<div class="tf-coin-reward">
    <p class="tf-coin-total" aria-label="${r.total} munten verdiend" style="--rf:${C.reward.font}px">${coinPhoto(C.reward.icon)}<span>+${formatCoins(r.total)}</span></p>
    <dl class="tf-coin-lines">${line('Level gehaald', r.base)}${line(spare === 1 ? '1 zet over' : `${spare} zetten over`, r.spareMoves)}${line(r.stars === 3 ? 'Drie sterren' : 'Twee sterren', r.starBonus)}</dl>
    <p class="tf-coin-balance">Nu ${coin(C.reward.lineIcon)}<b>${formatCoins(balanceBefore + r.total)}</b></p>
  </div>`;
}

/** The honest stand-in for a shop: what coins are, how they are earned and what they cost. */
const info = (): string => `<div class="tf-coin-info" role="dialog" aria-label="Munten">
    <h4>${coinPhoto(24)}Munten</h4>
    <dl class="tf-coin-lines">
      <div class="tf-coin-line"><dt>Level gehaald</dt><dd>+${COINS.win}${coin(C.reward.lineIcon)}</dd></div>
      <div class="tf-coin-line"><dt>Twee sterren</dt><dd>+${COINS.win + COINS.twoStars}${coin(C.reward.lineIcon)}</dd></div>
      <div class="tf-coin-line"><dt>Drie sterren</dt><dd>+${COINS.win + COINS.perfect}${coin(C.reward.lineIcon)}</dd></div>
      <div class="tf-coin-line spend"><dt>Hint: de volgende zet</dt><dd>${COINS.hintCost}${coin(C.reward.lineIcon)}</dd></div>
      <div class="tf-coin-line spend"><dt>${offerName}</dt><dd>${COINS.extraMovesCost}${coin(C.reward.lineIcon)}</dd></div>
    </dl>
    <p>Undo en Restart zijn altijd gratis. Munten verdien je met spelen.</p>
  </div>`;

const cell = (html: string, text: string): string => `<div class="btn-cell">${html}<span>${text}</span></div>`;
const AMOUNTS = [0, 7, 30, 1250, 99999];
const PRICE_STATES: PriceState[] = ['ok', 'short', 'free', 'used'];

/** One phone strip: top bar with the counter, the out-of-moves offer and the win card, at the given width. */
function phone(width: number, amount: number, withPlus: boolean): string {
  const short = amount < COINS.extraMovesCost;
  return `<div class="tf-coin-phone" style="--pw:${width}px;--pp:${C.phone.padding}px;--pg:${C.phone.gap}px" data-width="${width}">
    <div class="tf-coin-top">
      <div class="tf-coin-bar"><span class="tf-coin-pill grow">Level 5</span>${withPlus ? counterWithPlus(amount) : counter(amount)}</div>
      <div class="tf-coin-bar"><span class="tf-coin-pill">0 / 12</span><span class="tf-coin-pill grow">12 zetten</span>${hintCompact(amount < COINS.hintCost ? 'short' : 'ok')}</div>
    </div>
    <div class="tf-coin-sheet">
      <h4>Geen zetten meer</h4>
      <div class="tf-coin-bar"><span class="tf-coin-stub">Undo</span><span class="tf-coin-stub main">Opnieuw</span></div>
      ${offer(short ? 'short' : 'ok')}
      <p class="tf-coin-sub">${short ? `Je hebt ${formatCoins(amount)} munten: ${formatCoins(COINS.extraMovesCost - amount)} te weinig. Opnieuw is gratis.` : 'Nagerekend: hiermee is deze stand op te lossen.'}</p>
    </div>
    <div class="tf-coin-sheet">
      <h4>Allemaal thuis</h4>
      ${reward(10, 8, 12, amount)}
    </div>
  </div>`;
}

/** Count the amount in `el` up from `from` to `to`; jumps straight to the end when motion is reduced. */
function countUp(el: HTMLElement, from: number, to: number, ms: number): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = formatCoins(to);
    return;
  }
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = formatCoins(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Add the coin cards to the parts sheet. */
export function addCoinCards(sheet: HTMLElement): void {
  const add = (id: string, html: string): HTMLElement => {
    const el = document.createElement('section');
    el.className = 'card wide tf-coin-card';
    el.id = id;
    el.innerHTML = html;
    sheet.appendChild(el);
    return el;
  };
  const utility = (text: string, id: string): string =>
    `<button type="button" class="tf-btn tf-utility" id="${id}" style="${sizeVars({ width: 176, height: 44, depth: 10, radius: 20 })};--fs:14px"><span class="tf-clip"><span class="tf-face">${label(text)}</span></span></button>`;

  // 1. The counter.
  const cc = C.counter;
  const counterCard = add(
    'coins-counter',
    `<h2>Muntenteller</h2><p class="dims">compact ${cc.compact.height} px hoog, munt ${cc.compact.icon} px · breed ${cc.wide.height} px hoog, munt ${cc.wide.icon} px, minstens ${cc.wide.minWidth} px breed</p>
    <h3 class="btn-title">Compact · op de blauwe achtergrond en op een wit paneel</h3>
    <div class="btn-row" id="coins-counter-compact">${AMOUNTS.map((a) => counter(a)).join('')}</div>
    <div class="btn-row panel">${AMOUNTS.map((a) => counter(a)).join('')}</div>
    <h3 class="btn-title">Breed</h3>
    <div class="btn-row" id="coins-counter-wide">${AMOUNTS.map((a) => counter(a, 'wide')).join('')}</div>
    <div class="btn-row panel">${AMOUNTS.map((a) => counter(a, 'wide')).join('')}</div>
    <h3 class="btn-title">Toestanden</h3>
    <div class="btn-row" id="coins-counter-states">
      ${cell(counter(30), 'rust')}
      ${cell(counter(38, 'compact', 'earn', 16), 'munten erbij: telt op')}
      ${cell(counter(7, 'compact', 'short'), 'te weinig: schudt, rood')}
      ${cell(counter(38, 'wide', 'earn', 16), 'breed · erbij')}
      ${cell(counter(7, 'wide', 'short'), 'breed · te weinig')}
    </div>
    <h3 class="btn-title">Zelf proberen</h3>
    <div class="btn-row panel" id="coins-counter-live">
      <span id="coins-live">${counter(30, 'wide')}</span>
      ${utility('+16 verdienen', 'coins-live-earn')}
      ${utility('Hint zonder munten', 'coins-live-short')}
    </div>
    <p class="note">Altijd het hele bedrag, nooit afgekort: 99 999 past in beide maten. De teller is geen knop. Bij verdienen telt het bedrag in ${C.countUpMs} ms op, krijgt de teller een gouden rand en stijgt het verdiende bedrag even op; bij te weinig munten schudt hij kort en kleurt hij ${C.shortMs} ms rood. Met "minder beweging" aan vervallen het schudden en het optellen: het bedrag springt en de kleur blijft.</p>`,
  );
  {
    const live = counterCard.querySelector<HTMLElement>('#coins-live .tf-coin-counter')!;
    const amountEl = live.querySelector<HTMLElement>('.tf-coin-amount')!;
    let balance = 30;
    const flash = (state: CounterState, ms: number): void => {
      live.classList.remove('earn', 'short');
      void live.offsetWidth;
      live.classList.add(state);
      window.setTimeout(() => live.classList.remove(state), ms);
    };
    counterCard.querySelector('#coins-live-earn')!.addEventListener('click', () => {
      live.querySelector('.tf-coin-gain')?.remove();
      live.insertAdjacentHTML('beforeend', '<span class="tf-coin-gain" aria-hidden="true">+16</span>');
      countUp(amountEl, balance, balance + 16, C.countUpMs);
      balance += 16;
      live.setAttribute('aria-label', `${balance} munten`);
      flash('earn', C.countUpMs + 500);
    });
    counterCard.querySelector('#coins-live-short')!.addEventListener('click', () => flash('short', C.shortMs));
  }

  // 2. The plus button.
  add(
    'coins-plus',
    `<h2>Plusknop bij de teller</h2><p class="dims">${C.plus.width}×${C.plus.height} px, ${C.plus.depth} px diep · raakvlak ${C.plus.width}×${C.plus.height + C.plus.depth} px</p>
    <div class="btn-row" id="coins-plus-row">
      ${cell(counterWithPlus(30), 'met plus (gekozen)')}
      ${cell(counter(30), 'zonder plus')}
      ${cell(`<span class="tf-coin-group">${counter(30)}${plus('pressed')}</span>`, 'ingedrukt')}
      ${cell(counterWithPlus(99999, 'wide'), 'breed · met plus')}
      ${cell(`<button type="button" class="tf-btn tf-coin-plus" style="${sizeVars(C.plus)}" aria-label="Meer munten"><span class="tf-clip"><span class="tf-face"><img src="${plusImage}" alt="" /></span></span></button>`, 'alternatief met plus.webp')}
    </div>
    <div class="btn-row panel">
      ${cell(counterWithPlus(30), 'met plus (gekozen)')}
      ${cell(counter(30), 'zonder plus')}
      ${cell(counterWithPlus(1250, 'wide'), 'breed · met plus')}
    </div>
    <h3 class="btn-title">Wat de plus opent tot de winkel er is</h3>
    <div class="btn-row panel" id="coins-info">${info()}</div>
    <p class="note">Gekozen: de plus staat bij de teller, want de winkel komt er. Tot die er is opent hij alleen dit uitlegpaneel: hoe je munten verdient en wat ze kosten, zonder iets te verkopen.</p>`,
  );

  // 3. Price tags.
  add(
    'coins-price',
    `<h2>Prijskaartje op een knop</h2><p class="dims">kaartje ${C.price.height} px hoog, munt ${C.price.icon} px · hint ${C.hint.width}×${C.hint.height} px · hint compact ${C.hintCompact.width}×${C.hintCompact.height} px · aanbod ${C.offer.height} px hoog, vult de breedte</p>
    <h3 class="btn-title">Hint · ${COINS.hintCost} munten</h3>
    <div class="btn-row" id="coins-price-hint">${PRICE_STATES.map((s) => cell(hintButton(s), PRICE_LABEL[s])).join('')}</div>
    <h3 class="btn-title">Hint compact, voor de bovenbalk</h3>
    <div class="btn-row panel" id="coins-price-compact">${PRICE_STATES.map((s) => cell(hintCompact(s), PRICE_LABEL[s])).join('')}</div>
    <h3 class="btn-title">${offerName} · ${COINS.extraMovesCost} munten</h3>
    <div class="btn-row panel tf-coin-offers" id="coins-price-offer">${PRICE_STATES.map((s) => cell(offer(s, '290px'), PRICE_LABEL[s])).join('')}</div>
    <p class="note">De prijs staat altijd op de knop zelf, vóór het tikken: munt en getal in een verzonken kaartje. De Hint-knop is dezelfde witte knop als op de knoppenkaart, met het prijskaartje erbij. Te weinig munten: het kaartje wordt rood en de knop dof, maar hij blijft tikbaar en de teller antwoordt met zijn schudje. Gratis (testlab): het woord "Gratis" in groen, zonder munt. Al gebruikt: de knop is echt uit, met een vinkje; in de compacte knop alleen het vinkje.</p>`,
  );

  // 4. The reward.
  add(
    'coins-reward',
    `<h2>Beloning na een level</h2><p class="dims">totaal ${C.reward.font} px met munt ${C.reward.icon} px · regels met munt ${C.reward.lineIcon} px</p>
    <div class="btn-row panel tf-coin-rewards" id="coins-reward-row">
      ${cell(reward(10, 8, 12, 30), 'gewonnen, 2 zetten over')}
      ${cell(reward(8, 8, 10, 30), 'kortste oplossing')}
      ${cell(reward(12, 8, 12, 30), 'precies op')}
      ${cell(reward(10, 8, 12, 46, true), 'opnieuw gespeeld, niets nieuws')}
    </div>
    <p class="note">Het totaal groot op een gouden plaat, eronder de optelsom uit de echte regels (${COINS.win} per level, ${COINS.perSpareMove} per zet over, ${COINS.perfect} voor de kortste oplossing) en het nieuwe saldo. Een regel die niets opleverde blijft grijs staan, zodat te zien is wat er te halen viel.</p>`,
  );

  // 5. The icon at small sizes.
  const iconRow = (make: (size: number) => string): string => C.iconSizes.map((s) => cell(make(s), `${s} px`)).join('');
  add(
    'coins-icon',
    `<h2>Munt-icoon op kleine maten</h2><p class="dims">${C.iconSizes.join(' · ')} px</p>
    <h3 class="btn-title">Afbeelding van de eigenaar (coin.webp)</h3>
    <div class="btn-row tf-coin-icons" id="coins-icon-photo">${iconRow(coinPhoto)}</div>
    <div class="btn-row panel tf-coin-icons">${iconRow(coinPhoto)}</div>
    <h3 class="btn-title">Getekende versie in de goudtinten</h3>
    <div class="btn-row tf-coin-icons" id="coins-icon-drawn">${iconRow(coinDrawn)}</div>
    <div class="btn-row panel tf-coin-icons">${iconRow(coinDrawn)}</div>
    <h3 class="btn-title">Vier keer vergroot, zoals het scherm ze tekent</h3>
    <div class="btn-row panel tf-coin-icons zoom" id="coins-icon-zoom">${C.iconSizes.map((s) => cell(`<span class="tf-coin-zoom" style="--s:${s}px">${coinPhoto(s)}</span>`, `afbeelding ${s}`)).join('')}${C.iconSizes.map((s) => cell(`<span class="tf-coin-zoom" style="--s:${s}px">${coinDrawn(s)}</span>`, `getekend ${s}`)).join('')}</div>
    <p class="note">Gekozen: overal de afbeelding van de eigenaar, ook op 16 px. De getekende versie blijft hier alleen ter vergelijking staan.</p>`,
  );

  // Everything together on a phone, at both widths.
  add(
    'coins-phone',
    `<h2>Munten op de telefoon</h2><p class="dims">${C.phone.widths.join(' px en ')} px breed</p>
    ${C.phone.widths.map((w, i) => `<h3 class="btn-title">${w} px · ${i === 0 ? 'genoeg munten' : 'te weinig munten'}</h3>${phone(w, i === 0 ? 30 : 7, true)}`).join('')}
    <h3 class="btn-title">320 px · krapste geval: hoogste bedrag met plus</h3>
    <div class="tf-coin-phone bar-only" id="coins-phone-tight" style="--pw:320px;--pp:${C.phone.padding}px;--pg:${C.phone.gap}px"><div class="tf-coin-top"><div class="tf-coin-bar"><span class="tf-coin-pill grow">Level 48</span>${counterWithPlus(99999)}</div><div class="tf-coin-bar"><span class="tf-coin-pill">0 / 12</span><span class="tf-coin-pill grow">12 zetten</span>${hintCompact('ok')}</div></div></div>
    <p class="note">De teller staat rechts in een eigen bovenregel naast het level; doel, zetten en Hint staan eronder. Zo past ook 99 999 op 320 px. Het bord is weggelaten.</p>`,
  );
}

