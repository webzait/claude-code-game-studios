import gameHtml from '../../index.html?raw';
import { CONFIG } from '../config';
import { CoinCounters, mountPricedButton, setPrice, type PriceState } from '../ui/coins';
import { END_DEFS, renderEndCard, type EndCard } from '../ui/endCard';
import '../ui/themes/garden/buttons.css';
import '../ui/style.css';
import './garden-buttons.css';
import refButtons from '../../design/reference/turnflock/garden/18-sheet-action-buttons.png';
import refPlay from '../../design/reference/turnflock/garden/19-sheet-play-and-round-buttons.png';
import refIcons from '../../design/reference/turnflock/garden/20-sheet-icons-coin-star-gem-heart.png';
import coinIcon from '../ui/themes/garden/icon-coin.svg';
import starIcon from '../ui/themes/garden/icon-star.svg';
import starOffIcon from '../ui/themes/garden/icon-star-off.svg';
import gemIcon from '../ui/themes/garden/icon-gem.svg';
import heartIcon from '../ui/themes/garden/icon-heart.svg';
import chickIcon from '../ui/themes/garden/icon-chick.svg';

/**
 * The garden theme's buttons, icons and top bar on the parts sheet (design/themes/garden-buttons.md).
 *
 * Every button here is the game's own markup: the puzzle screen's top bar, helpers and commands and the level screen's
 * head and dock are copied out of index.html, the pop-ups are drawn by the game's renderEndCard and the price tags by
 * its setPrice. A block marked data-theme="garden" shows them in the garden look (src/ui/themes/garden/buttons.css);
 * the same markup without it is the robot theme, for comparison. Nothing here changes the game.
 */

const game = new DOMParser().parseFromString(gameHtml, 'text/html');
/** A copy of an element of the game's page, ids and all. */
const part = (selector: string): HTMLElement => game.querySelector<HTMLElement>(selector)!.cloneNode(true) as HTMLElement;
const html = (node: Element): string => node.outerHTML;

const COMMANDS = ['red', 'blue', 'yellow', 'forward'] as const;
type State = '' | 'pressed' | 'disabled' | 'nudge';
const STATES: [State, string][] = [['', 'gewoon'], ['pressed', 'ingedrukt'], ['disabled', 'uit'], ['nudge', 'aanwijzing']];

/** One command button as the game has it, in `state`, at a fixed face size for the sheet. */
function command(c: (typeof COMMANDS)[number], state: State, h = 64): string {
  const b = part(`.cmd[data-cmd="${c}"]`);
  b.style.cssText = `--w:${Math.round(h * 1.32)}px;--h:${h}px;--d:${Math.round(h * 0.2)}px;--r:${Math.round(h * 0.25)}px;--press-fraction:.8`;
  if (state === 'disabled') b.setAttribute('disabled', '');
  else if (state) b.classList.add(state);
  return html(b);
}

/** A row of the puzzle screen's helpers (Undo, Restart, Hint) in one state, priced as the game prices them. */
function tools(state: State | 'short' | 'free' | 'used'): HTMLElement {
  const row = part('#tools');
  row.removeAttribute('id');
  row.style.cssText = '--tool-h:37px;--tool-w:62px;--tool-r:14px;--tool-gap:20px;--tf-depth:.2';
  const undo = row.querySelector<HTMLButtonElement>('#undo')!;
  const scan = row.querySelector<HTMLButtonElement>('#scan')!;
  mountPricedButton(undo);
  mountPricedButton(scan);
  const price: PriceState = state === 'short' || state === 'free' ? state : 'ok';
  setPrice(undo, 'Undo', CONFIG.coins.undoCost, price);
  setPrice(scan, 'Hint', CONFIG.coins.hintCost, state === 'used' ? 'used' : price);
  for (const b of Array.from(row.querySelectorAll<HTMLButtonElement>('.tf-btn'))) {
    if (state === 'disabled') b.disabled = true;
    if (state === 'pressed') b.classList.add('pressed');
    if (state === 'nudge' && b === scan) b.classList.add('nudge');
  }
  if (state === 'used') {
    scan.disabled = true;
    scan.classList.add('showing');
  }
  return row;
}

/** The game's pop-up for `card`, in a phone-wide frame. */
function popup(card: EndCard, height: number): string {
  const frame = document.createElement('div');
  frame.className = 'gb-popup tf-end-host';
  frame.style.cssText = `height:${height}px`;
  const body = document.createElement('div');
  frame.append(body);
  renderEndCard(body, card, false);
  return html(frame);
}

const none = (): void => {};
const reward = { reward: { stars: 3 as const, base: 10, starBonus: 6, spareMoves: 0, total: 16 }, spare: 0, earned: 16, balance: 1250, helped: false };
const WIN: EndCard = { kind: 'win', stars: 2, moves: 9, par: 8, backup: false, last: false, reward, next: none, retry: none, levels: none };
const LOST: EndCard = { kind: 'lost', offer: { price: CONFIG.coins.extraMovesCost, state: 'ok', coins: 120, take: none }, undo: none, undoPrice: { cost: CONFIG.coins.undoCost, state: 'ok' }, retry: none };
const LOST_SHORT: EndCard = { kind: 'lost', offer: { price: CONFIG.coins.extraMovesCost, state: 'short', coins: 12, take: none }, undo: none, undoPrice: { cost: CONFIG.coins.undoCost, state: 'short' }, retry: none };

/** A cloud button of the sheet only (sound, home): the round buttons of reference 19 that the game does not have yet. */
const cloud = (kind: string, name: string, state: State = ''): string =>
  `<button type="button" class="tf-btn tf-utility gb-round gb-${kind}${state && state !== 'disabled' ? ` ${state}` : ''}"${state === 'disabled' ? ' disabled' : ''} aria-label="${name}"><span class="tf-clip"><span class="tf-face"><svg viewBox="0 0 24 24" aria-hidden="true"></svg></span></span></button>`;

/** The gear button of the level screen, in `state`. */
function settings(state: State): string {
  const b = part('#toSettings');
  b.style.cssText = HEAD_SIZE;
  if (state === 'disabled') b.setAttribute('disabled', '');
  else if (state) b.classList.add(state);
  return html(b);
}

/** The level screen's Play button (or its Back form), at phone width. */
function play(state: State, back = false): string {
  const b = part('#continue');
  b.style.cssText = '--w:300px;--h:60px;--d:10px;--r:22px;--press-fraction:.8';
  if (back) {
    b.classList.add('tf-levels-backbtn');
    b.querySelector('.tf-label')!.textContent = 'Back';
  } else b.querySelector('.tf-label')!.textContent = 'Play level 6';
  if (state === 'disabled') b.setAttribute('disabled', '');
  else if (state) b.classList.add(state);
  return html(b);
}

/** The game's coin counter with its plus button, as CoinCounters builds it, showing 1 234. */
const COUNTER = ((): string => {
  const host = document.createElement('span');
  new CoinCounters([host], () => true, () => {}).set(1234);
  return host.outerHTML;
})();

/** The size the level screen gives the buttons of its head (src/ui/style.css, #map .tf-levels-head .tf-btn). */
const HEAD_SIZE = '--w:46px;--h:40px;--d:6px;--r:15px;--press-fraction:.8';
/** A head or paging button of the level screen at its game size. */
const headButton = (selector: string): string => {
  const b = part(selector);
  b.style.cssText = HEAD_SIZE;
  return html(b);
};

/** The level screen's head with game values: coin counter, stars and the settings button (the logo is left out). */
function levelHead(): string {
  const head = part('#map .tf-levels-head');
  head.querySelector('.tf-levels-brand')?.remove();
  head.querySelector('#mapCoins')!.outerHTML = COUNTER;
  head.querySelector('#starSum')!.textContent = '15';
  head.querySelector('#starMax')!.textContent = '/300';
  head.querySelector('#mapProgress')?.remove();
  head.querySelector<HTMLElement>('#toSettings')!.style.cssText = HEAD_SIZE;
  return html(head);
}

const cell = (inner: string, label: string, cls = ''): string => `<figure class="gb-cell ${cls}">${inner}<figcaption>${label}</figcaption></figure>`;
const img = (src: string, size: number, alt = ''): string => `<img src="${src}" width="${size}" height="${size}" alt="${alt}" />`;

/** The puzzle screen's top bar and bottom area with game values filled in, at `width`. */
function puzzleScreen(width: number, colours: readonly (typeof COMMANDS)[number][]): string {
  const top = part('#level .top');
  top.querySelector('#levelNo')!.textContent = '12';
  top.querySelector('#moves')!.textContent = '7';
  top.querySelector('#collected')!.textContent = '1/3';
  top.querySelector('#levelCoins')!.outerHTML = COUNTER;
  const controls = part('#level .controls');
  controls.style.cssText = '--tf-depth:.2;--tf-round:.25;--tools-clear:24px';
  const row = tools('');
  controls.querySelector('#tools')!.replaceWith(row);
  for (const b of Array.from(controls.querySelectorAll<HTMLButtonElement>('.cmd'))) if (!colours.includes(b.dataset.cmd as (typeof COMMANDS)[number])) b.hidden = true;
  controls.querySelector('.cmd[data-cmd="blue"]')?.classList.add('nudge');
  return `<div class="gb-screen" style="width:${width}px"><div id="level" class="screen">${html(top)}<div class="gb-board">bord</div>${html(controls)}</div></div>`;
}

/** Add the garden buttons card to the sheet. */
export function addGardenButtonCards(sheet: HTMLElement): void {
  const el = document.createElement('section');
  el.className = 'card wide gb';
  el.id = 'garden-buttons';
  const actionStates = COMMANDS.map((c) => STATES.map(([s]) => command(c, s)).join('')).join('');
  const toolStates: [Parameters<typeof tools>[0], string][] = [['', 'gewoon'], ['pressed', 'ingedrukt'], ['disabled', 'uit (niets terug te nemen)'], ['short', 'te duur (te weinig munten)'], ['used', 'hint staat op het bord'], ['free', 'gratis (testlab)']];
  el.innerHTML = `${END_DEFS}<h2>Tuinthema · knoppen, iconen en bovenbalk</h2>
  <p class="dims">Dezelfde HTML als het spel; alleen de stijl verschilt, onder <code>[data-theme="garden"]</code>. Kleuren en maten: <code>data/themes/garden/buttons.json</code>.</p>

  <h3 class="btn-title">Naast het voorbeeld · actieknoppen (beeld 18)</h3>
  <div class="gb-compare">
    ${cell(`<img class="gb-ref" src="${refButtons}" alt="Voorbeeld: vier blauwe actieknoppen" />`, 'voorbeeld 18 (129 × 134 px, vergroot)')}
    ${cell(`<div class="gb-grid2" data-theme="garden">${COMMANDS.map((c) => command(c, '', 72)).join('')}</div>`, 'tuin: ROOD, BLAUW, GEEL, VOORUIT in hun eigen kleur')}
    ${cell(`<div class="gb-grid2">${COMMANDS.map((c) => command(c, '', 72)).join('')}</div>`, 'robotthema (ongewijzigd)')}
  </div>

  <h3 class="btn-title">Naast het voorbeeld · Play en ronde knoppen (beeld 19)</h3>
  <div class="gb-compare">
    ${cell(`<img class="gb-ref" src="${refPlay}" alt="Voorbeeld: gele Play-knop en drie ronde knoppen" />`, 'voorbeeld 19 (197 × 129 px, vergroot)')}
    ${cell(`<div class="gb-stack" data-theme="garden">${play('')}<div class="gb-line">${settings('')}${cloud('sound', 'Sound')}${cloud('home', 'Home')}</div></div>`, 'tuin: Play van het levelscherm; instellingen, en (los) geluid en home')}
  </div>

  <h3 class="btn-title">Naast het voorbeeld · iconen (beeld 20)</h3>
  <div class="gb-compare">
    ${cell(`<img class="gb-ref" src="${refIcons}" alt="Voorbeeld: munt, ster, diamant, hart" />`, 'voorbeeld 20 (191 × 70 px, vergroot)')}
    ${cell(`<div class="gb-line gb-icons">${img(coinIcon, 72, 'munt')}${img(starIcon, 72, 'ster')}${img(gemIcon, 72, 'diamant')}${img(heartIcon, 72, 'hart')}</div>`, 'tuin: getekend als SVG, scherp op elke maat')}
  </div>
  <div class="gb-line gb-sizes">${[16, 20, 24, 32, 48].map((s) => `<span>${img(coinIcon, s)}${img(starIcon, s)}${img(gemIcon, s)}${img(heartIcon, s)}<small>${s} px</small></span>`).join('')}<span>${img(starOffIcon, 32)}${img(chickIcon, 32)}<small>lege ster · kuiken (bovenbalk)</small></span></div>

  <h3 class="btn-title">Actieknoppen · elke kleur in elke stand</h3>
  <div class="gb-states four" data-theme="garden">${STATES.map(([, n]) => `<span>${n}</span>`).join('')}${actionStates}</div>

  <h3 class="btn-title">Hulpknoppen · Undo, Restart, Hint met prijskaartjes</h3>
  <div class="gb-tools" data-theme="garden">${toolStates.map(([s, n]) => cell(html(tools(s)), n)).join('')}</div>
  <div class="gb-tools">${cell(html(tools('')), 'robotthema, ter vergelijking')}${cell(html(tools('short')), 'robot: te duur')}</div>

  <h3 class="btn-title">Winst- en verlies-pop-up</h3>
  <div class="gb-popups" data-theme="garden">${cell(popup(WIN, 330), 'gewonnen: Levels, Retry, Next')}${cell(popup(LOST, 330), 'zetten op: +3 zetten, Undo, Retry')}${cell(popup(LOST_SHORT, 330), 'zetten op, te weinig munten: te duur')}</div>

  <h3 class="btn-title">Levelscherm · Play, terug en de knoppen van de kop</h3>
  <div class="gb-states three" data-theme="garden"><span>gewoon</span><span>ingedrukt</span><span>uit</span>${(['', 'pressed', 'disabled'] as State[]).map((s) => play(s)).join('')}${(['', 'pressed', 'disabled'] as State[]).map((s) => play(s, true)).join('')}</div>
  <div class="gb-line gb-panel" data-theme="garden">${(['', 'pressed', 'disabled'] as State[]).map((s) => cell(settings(s), `instellingen · ${s ? STATES.find(([x]) => x === s)![1] : 'gewoon'}`)).join('')}${cell(headButton('#pagePrev') + headButton('#pageNext'), 'bladeren')}${cell(cloud('sound', 'Sound') + cloud('home', 'Home'), 'geluid · home (los)')}</div>
  <div class="gb-head" data-theme="garden">${levelHead()}</div>

  <h3 class="btn-title">Instellingen en winkel</h3>
  <div class="gb-line gb-panel" data-theme="garden">
    ${cell(`<button type="button" class="tf-btn tf-utility" style="--w:48px;--h:42px;--d:6px;--r:15px;--press-fraction:.8" aria-label="Back"><span class="tf-clip"><span class="tf-face"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></button>`, 'terug', 'gb-settop tf-set-top')}
    ${cell(`<button type="button" class="tf-btn tf-utility" style="--w:120px;--h:44px;--d:9px;--r:17px;--press-fraction:.8"><span class="tf-clip"><span class="tf-face"><span class="tf-label">Keep</span></span></span></button>`, 'Keep')}
    ${cell(`<button type="button" class="tf-btn tf-action red tf-set-erase" style="--w:120px;--h:44px;--d:9px;--r:17px;--press-fraction:.8"><span class="tf-clip"><span class="tf-face"><span class="tf-label">Erase</span></span></span></button>`, 'Erase')}
    ${cell(`<button type="button" class="tf-btn tf-end-main" style="--w:150px;--h:44px;--d:9px;--r:17px;--press-fraction:.8"><span class="tf-clip"><span class="tf-face"><span class="tf-label">Get coins</span></span></span></button>`, 'winkel: hoofdknop')}
    ${cell(`<button type="button" class="tf-btn tf-utility" style="--w:120px;--h:44px;--d:9px;--r:17px;--press-fraction:.8" disabled><span class="tf-clip"><span class="tf-face"><span class="tf-label">Close</span></span></span></button>`, 'Close · uit')}
  </div>

  <h3 class="btn-title">Bovenbalk en puzzelscherm · tuin naast robot (390 px; 320 × 568 en 390 × 844 in het echte spel: production/qa/evidence/garden-buttons/)</h3>
  <div class="gb-screens">
    ${cell(`<div data-theme="garden">${puzzleScreen(390, COMMANDS)}</div>`, 'tuin · 390 px · vier opdrachten, BLAUW met aanwijzing')}
    ${cell(puzzleScreen(390, COMMANDS), 'robot · 390 px')}
  </div>

  <h3 class="btn-title">Los: diamant en hart (nog geen spelelement)</h3>
  <div class="gb-line gb-panel">${cell(img(gemIcon, 64, 'diamant'), 'diamant')}${cell(img(heartIcon, 64, 'hart'), 'hart')}</div>
  <p class="note"><b>Voorstel, niet ingebouwd.</b> Diamant: een zeldzame beloning voor een volmaakte reeks (bijvoorbeeld tien levels op rij met drie sterren) of een mijlpaal op het levelpad; ruilen tegen een nieuw kuikenkleurtje of een tuinversiering, nooit tegen hulp in een puzzel. Hart: geen levens, maar "favoriet": een hartje op een level dat de speler wil bewaren of opnieuw wil spelen, of een bedankje na een puzzel die je zonder hulp oploste. Beide raken de kernregels niet; de eigenaar beslist, en de munteneconomie loopt in een andere sessie.</p>
  <p class="note">De opdrachtknoppen houden de kleuren van het spel (de kleur van de kuikens): van beeld 18 komen de vorm (ronder), de kussenrand, de glans, de donkere omlijning en de dikke witte symbolen. Op geel staat het symbool wit met een marineblauwe rand, zoals de Play-knop van beeld 19, zodat het leesbaar blijft. VOORUIT blijft het donkere leisteen van het robotthema, zodat het nooit met BLAUW verward wordt. Hulpknoppen zijn de witte ronde knoppen van beeld 19 met een blauwe rand en een marineblauw symbool. Maten, raakvlakken en de ruimte tussen hulp- en actieknoppen (B11) zijn die van het spel.</p>`;
  sheet.appendChild(el);
}
