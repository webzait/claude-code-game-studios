import indexHtml from '../../index.html?raw';
import robotLogoUrl from '../../assets/turnflock/brand/logo.webp';
import { CoinCounters } from '../ui/coins';
import { drawTrailIn, renderLevels, type LevelsModel, type MapNode } from '../ui/screens';
import { improvableLevels } from '../ui/levelPath';
import { applyGardenLevels, GARDEN_LEVELS } from '../ui/themes/garden/levels';
import { GARDEN_LOGO, GARDEN_LOGO_URL, logoGrow, showGardenLogo } from '../ui/themes/garden/logo';
import '../ui/themes/garden/tf-levels-garden.css';
import '../ui/themes/garden/tf-logo-garden.css';
import './gardenLogo.css';

/**
 * The garden logo on the parts sheet: the picture itself, the garden level screen with it on
 * every phone size (the game's own #map markup and renderLevels, as in gardenLevels.ts).
 * Nothing here is wired into the game.
 */

const TOTAL = 100;
const starsFor = (index: number): number => {
  const h = (index * 7919 + 13) % 10;
  return h < 6 ? 3 : h < 9 ? 2 : 1;
};

type Situation = { view: LevelsModel['view']; solved: number; coins: number };

/** The model the game would build for `solved` completed levels. */
function model(s: Situation): LevelsModel {
  const nodes: MapNode[] = Array.from({ length: TOTAL }, (_, i) => ({
    number: i + 1, name: `Level ${i + 1}`, unlocked: i <= s.solved, solved: i < s.solved, stars: i < s.solved ? starsFor(i) : 0, target: i === s.solved,
  }));
  const improvable = improvableLevels(nodes.map((n) => n.stars)).map((i) => ({ ...nodes[i], target: false }));
  return {
    view: s.view, nodes, improvable, replayAll: false, onImprove: () => undefined,
    playIcon: s.view === 'improve' ? 'back' : 'play', current: s.solved, ahead: 5,
    chapter: GARDEN_LEVELS.chapter, behind: GARDEN_LEVELS.behind, layout: 'winding', page: 0, pageSize: 20,
    playLabel: s.view === 'improve' ? `Back to level ${s.solved + 1}` : `Play level ${s.solved + 1}`,
    gridNote: 'Improve your stars', onPick: () => undefined, onPage: () => undefined,
  };
}

const SCREEN = (() => {
  const start = indexHtml.indexOf('<section class="screen tf-levels-phone');
  const end = indexHtml.indexOf('</section>', start) + '</section>'.length;
  return indexHtml.slice(start, end).replace('./assets/turnflock/brand/logo.webp', robotLogoUrl);
})();

let made = 0;
const phones: HTMLElement[] = [];

/** One phone: the game's level screen at w×h in the garden theme, with the garden logo (or the robot logo, for comparison). */
function phone(host: HTMLElement, s: Situation, w: number, h: number, garden = true): void {
  host.insertAdjacentHTML('beforeend', SCREEN);
  const screen = host.lastElementChild as HTMLElement;
  screen.classList.remove('screen');
  screen.style.width = `${w}px`;
  screen.style.height = `${h}px`;
  applyGardenLevels(screen);
  if (garden) showGardenLogo(screen.querySelector('.tf-levels-logo')!, screen);
  else {
    // For comparison: the robot logo at its own size and shape, on the same garden screen.
    screen.style.setProperty('--tg-logo-grow', '1');
    screen.querySelector<HTMLElement>('.tf-levels-logo')!.style.aspectRatio = '768 / 360';
  }
  for (const b of Array.from(screen.querySelectorAll<HTMLElement>('.tf-levels-head .tf-btn, .tf-levels-pager .tf-btn'))) b.setAttribute('style', '--w:46px;--h:40px;--d:6px;--r:15px');
  screen.querySelector<HTMLElement>('.tf-levels-play')!.setAttribute('style', '--w:100%;--h:var(--tl-play-h);--d:var(--tl-play-d);--r:22px');
  new CoinCounters([screen.querySelector<HTMLElement>('#mapCoins')!], () => true, () => undefined).set(s.coins);
  renderLevels(model(s));
  made += 1;
  for (const node of Array.from(screen.querySelectorAll<HTMLElement>('[id]'))) node.id = `glogo-${made}-${node.id}`;
  screen.id = `garden-logo-phone-${made}`;
  phones.push(screen);
}

function redrawTrails(): void {
  for (const p of phones) {
    const view = p.querySelector<HTMLElement>('.tf-levels-path');
    if (view && !view.hidden) drawTrailIn(view);
  }
}

/** Add the garden logo's cards to the sheet. */
export function addGardenLogoCards(sheet: HTMLElement): void {
  const card = (id: string, title: string, dims: string, body: string, note: string): HTMLElement => {
    const el = document.createElement('section');
    el.className = 'card wide tf-garden-logo';
    el.id = id;
    el.dataset.theme = 'garden';
    el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p>${body}<p class="note">${note}</p>`;
    sheet.appendChild(el);
    return el;
  };
  const { width, height } = GARDEN_LOGO.picture;

  card('garden-logo', 'Tuinthema · logo', `${width}×${height} px · WebP met transparantie · 38 KB (robotlogo: 768×360, 44 KB)`,
    `<div class="tg-logo-row">
      <figure><div class="tg-logo-bg tg-check"><img src="${GARDEN_LOGO_URL}" alt="Turnflock" width="${width}" height="${height}"></div><figcaption>Transparant</figcaption></figure>
      <figure><div class="tg-logo-bg tg-sky"><img src="${GARDEN_LOGO_URL}" alt="" width="${width}" height="${height}"></div><figcaption>Op de lucht</figcaption></figure>
      <figure><div class="tg-logo-bg tg-lawn"><img src="${GARDEN_LOGO_URL}" alt="" width="${width}" height="${height}"></div><figcaption>Op het gras (rand: geen halo)</figcaption></figure>
      <figure><div class="tg-logo-bg tg-sky tg-small"><img src="${GARDEN_LOGO_URL}" alt="" style="width:107px"><img src="${robotLogoUrl}" alt="" style="width:107px"></div><figcaption>Kleinste maat (320×568), naast het robotlogo</figcaption></figure>
    </div>`,
    `Jouw logo, niet hertekend: alleen de waas en 186 losse puntjes rond de uitsnede weg, de 99%-dekking van het beeld naar 100%, de lege rand eraf en verkleind. Gemaakt met assets/turnflock/garden/logo/build-logo-garden.py. Het logo is overal even breed als het robotlogo, dus het woord is even groot; door de kuikentjes is het ${Math.round((logoGrow() - 1) * 100)}% hoger.`);

  const screens = card('garden-logo-screens', 'Tuinthema · logo op het levelscherm', '320×568 · 390×844 · 430×932 · 768×1024 · level 17',
    '<div class="tf-levels-row" id="garden-logo-sizes"></div>',
    'Het tuin-levelscherm van de sessie <i>garden-levels</i> (jouw levelpad-achtergrond 25-backdrop-level-path), met het tuinlogo in plaats van het robotlogo. Het pad schuift iets naar beneden; logo, sterrenknop, pad en Play-knop raken elkaar nergens.');
  const row = screens.querySelector<HTMLElement>('#garden-logo-sizes')!;
  const fig = (target: HTMLElement, caption: string, s: Situation, w: number, h: number, garden = true): void => {
    const figure = document.createElement('figure');
    figure.className = 'tf-levels-fig';
    target.appendChild(figure);
    phone(figure, s, w, h, garden);
    figure.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
  };
  for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) fig(row, `${w}×${h}`, { view: 'path', solved: 16, coins: 485 }, w, h);

  const compare = card('garden-logo-compare', 'Tuinthema · tuinlogo naast robotlogo, en de sterrenlijst', '390×844 en 320×568',
    '<div class="tf-levels-row" id="garden-logo-compare-row"></div>',
    'Links het tuinlogo, rechts hetzelfde scherm met het robotlogo. Onderaan het raster voor sterren verbeteren op het kleinste scherm: ook dat past met het hogere logo.');
  const crow = compare.querySelector<HTMLElement>('#garden-logo-compare-row')!;
  fig(crow, '390×844 · tuinlogo', { view: 'path', solved: 16, coins: 485 }, 390, 844);
  fig(crow, '390×844 · robotlogo', { view: 'path', solved: 16, coins: 485 }, 390, 844, false);
  fig(crow, '320×568 · sterren verbeteren', { view: 'improve', solved: 37, coins: 885 }, 320, 568);

  window.addEventListener('load', redrawTrails);
  void document.fonts?.ready.then(redrawTrails);
  requestAnimationFrame(redrawTrails);
}
