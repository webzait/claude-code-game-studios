import indexHtml from '../../index.html?raw';
import logoUrl from '../../assets/turnflock/brand/logo.webp';
import { CoinCounters } from '../ui/coins';
import { drawTrailIn, renderLevels, type LevelsModel, type MapNode } from '../ui/screens';
import { improvableLevels } from '../ui/levelPath';
import { applyGardenLevels, GARDEN_LEVELS } from '../ui/themes/garden/levels';
import '../ui/themes/garden/tf-levels-garden.css';
import './gardenLevels.css';

/**
 * The garden theme's level selection on the parts sheet. Every phone is the game's own screen:
 * the `#map` section copied from index.html and filled by the game's own renderLevels, with
 * made-up progress. Only the page's theme differs ([data-theme="garden"] on the cards).
 * Nothing here is wired into the game.
 */

const TOTAL = 100;
const NAMES = ['First Steps', 'Two by Two', 'The Gate', 'Round the Bend', 'Hedge Row', 'Clover Patch', 'Fence Line', 'Birdhouse', 'Daisy Chain', 'The Arch'];

/** Made-up but fixed results: the same mix in every screenshot. */
const starsFor = (index: number): number => {
  const h = (index * 7919 + 13) % 10;
  return h < 6 ? 3 : h < 9 ? 2 : 1;
};

type Situation = { view: LevelsModel['view']; solved: number; coins: number; replayAll?: boolean };

/** The model the game would build for `solved` completed levels (in play order) and the given view. */
function model(s: Situation): LevelsModel {
  const complete = s.solved >= TOTAL;
  const current = complete ? null : s.solved;
  const nodes: MapNode[] = Array.from({ length: TOTAL }, (_, i) => ({
    number: i + 1,
    name: NAMES[i % NAMES.length],
    unlocked: i <= s.solved,
    solved: i < s.solved,
    stars: i < s.solved ? starsFor(i) : 0,
    target: i === (current ?? 0),
  }));
  const replayAll = complete;
  const improvable = (replayAll ? nodes.map((_, i) => i) : improvableLevels(nodes.map((n) => n.stars))).map((i) => ({ ...nodes[i], target: false }));
  const playLabel = s.view === 'improve' ? (complete ? 'Back' : `Back to level ${s.solved + 1}`) : complete ? 'Choose a level' : `Play level ${s.solved + 1}`;
  return {
    view: s.view,
    nodes,
    improvable,
    replayAll,
    onImprove: () => undefined,
    playIcon: s.view === 'improve' ? 'back' : 'play',
    current,
    ahead: 5,
    chapter: GARDEN_LEVELS.chapter,
    behind: GARDEN_LEVELS.behind,
    layout: 'winding',
    page: 0,
    pageSize: 20,
    playLabel,
    gridNote: s.view === 'improve' ? (replayAll ? 'Play a level again' : 'Improve your stars') : 'Test view · grid',
    onPick: () => undefined,
    onPage: () => undefined,
  };
}

/** The game's level screen, exactly as index.html has it. */
const SCREEN = (() => {
  const start = indexHtml.indexOf('<section class="screen tf-levels-phone');
  const end = indexHtml.indexOf('</section>', start) + '</section>'.length;
  return indexHtml.slice(start, end).replace('./assets/turnflock/brand/logo.webp', logoUrl);
})();

let made = 0;
const phones: HTMLElement[] = [];

/**
 * One phone: the game's screen at `w`×`h`, rendered by the game's own code, then its ids
 * renamed so the next phone can be rendered the same way.
 */
function phone(host: HTMLElement, s: Situation, w: number, h: number): void {
  host.insertAdjacentHTML('beforeend', SCREEN);
  const screen = host.lastElementChild as HTMLElement;
  screen.classList.remove('screen');
  screen.style.width = `${w}px`;
  screen.style.height = `${h}px`;
  applyGardenLevels(screen);
  // Sizes the game sets in style.css for #map, which the sheet does not load.
  for (const b of Array.from(screen.querySelectorAll<HTMLElement>('.tf-levels-head .tf-btn, .tf-levels-pager .tf-btn'))) b.setAttribute('style', '--w:46px;--h:40px;--d:6px;--r:15px');
  screen.querySelector<HTMLElement>('.tf-levels-play')!.setAttribute('style', '--w:100%;--h:var(--tl-play-h);--d:var(--tl-play-d);--r:22px');
  new CoinCounters([screen.querySelector<HTMLElement>('#mapCoins')!], () => true, () => undefined).set(s.coins);
  renderLevels(model(s));
  made += 1;
  for (const node of Array.from(screen.querySelectorAll<HTMLElement>('[id]'))) node.id = `garden-${made}-${node.id}`;
  screen.id = `garden-levels-${made}`;
  phones.push(screen);
}

/** Draw every phone's rail again once the page has its final layout. */
function redrawTrails(): void {
  for (const p of phones) {
    const view = p.querySelector<HTMLElement>('.tf-levels-path');
    if (view && !view.hidden) drawTrailIn(view);
  }
}

/** Add the garden level screen's cards to the sheet. */
export function addGardenLevelCards(sheet: HTMLElement): void {
  const card = (id: string, title: string, dims: string, note: string): HTMLElement => {
    const el = document.createElement('section');
    el.className = 'card wide tf-garden-levels';
    el.id = id;
    el.dataset.theme = 'garden';
    el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p><div class="tf-levels-row"></div><p class="note">${note}</p>`;
    sheet.appendChild(el);
    return el.querySelector('.tf-levels-row')!;
  };
  const fig = (row: HTMLElement, caption: string, s: Situation, w = 390, h = 844): void => {
    const figure = document.createElement('figure');
    figure.className = 'tf-levels-fig';
    row.appendChild(figure);
    phone(figure, s, w, h);
    figure.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
  };

  const states = card('garden-levels', 'Tuinthema · levelscherm (het pad)', 'tuinen van 20 levels · huidig + 5 vooruit · 2 gehaalde levels eronder · prieel aan het eind van een tuin',
    'Dezelfde HTML en code als het spel (index.html + renderLevels); alleen het thema verschilt. Groen met vinkje = gehaald, geel = nu spelen (de enige knop op het pad), grijs met slot = komt nog. Het prieel sluit elke tuin van 20 levels af en verschijnt zodra het einde in zicht is. Achtergrond: eenvoudige tuinkleur (lucht, haag, gazon); de volledige tuinachtergrond van de achtergrondsessie kan erin via --tg-backdrop.');
  fig(states, 'Nieuwe speler · level 1', { view: 'path', solved: 0, coins: 30 });
  fig(states, 'Onderweg · level 9', { view: 'path', solved: 8, coins: 240 });
  fig(states, 'Einde tuin in zicht · level 17', { view: 'path', solved: 16, coins: 485 });
  fig(states, 'Laatste level van de tuin · 20', { view: 'path', solved: 19, coins: 560 });

  const modes = card('garden-levels-modes', 'Tuinthema · levelscherm (de andere standen)', 'nieuwe tuin · sterren verbeteren · alles gehaald · zelf een level kiezen',
    'De sterknop opent de levels onder drie sterren (raster op een gazonbak); is alles gehaald, dan kiest de speler zelf een level. Zelfde gedrag als het robotthema.');
  fig(modes, 'Nieuwe tuin · level 21', { view: 'path', solved: 20, coins: 610 });
  fig(modes, 'Sterren verbeteren', { view: 'improve', solved: 37, coins: 885 });
  fig(modes, 'Alles gehaald', { view: 'path', solved: TOTAL, coins: 2640 });
  fig(modes, 'Alles gehaald · zelf kiezen', { view: 'improve', solved: TOTAL, coins: 2640 });

  const sizes = card('garden-levels-sizes', 'Tuinthema · levelscherm op vier schermmaten', '320×568 · 390×844 · 430×932 · 768×1024',
    'De bolletjes volgen de schermhoogte; op het kleinste scherm worden ze kleiner, maar het gele bolletje blijft ruim boven 44 px.');
  for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) fig(sizes, `${w}×${h} · level 17`, { view: 'path', solved: 16, coins: 485 }, w, h);

  // Every phone was drawn during building; the rails follow once fonts and pictures are in.
  window.addEventListener('load', redrawTrails);
  void document.fonts?.ready.then(redrawTrails);
  requestAnimationFrame(redrawTrails);
}
