import gemOriginal from '../../design/reference/turnflock/garden/elements/diamant.png';
import heartOriginal from '../../design/reference/turnflock/garden/elements/hart.png';
import gem from '../ui/themes/garden/gem.webp';
import heart from '../ui/themes/garden/heart.webp';
import coin from '../../assets/turnflock/ui/coin.webp';
import './garden-icons.css';

/**
 * The garden theme's loose gem and heart on the parts sheet: the owner's picture next to the game icon
 * (tools/asset-pipeline/garden-icons.py), at the sizes an icon is shown at on a phone. Neither is in the game: the
 * owner decides what they mean (design/themes/garden-buttons.md). Buttons and the coin keep the robot theme's look.
 */

/** Sizes in CSS px an icon is shown at in the game: price tag, counter, coin explainer, win pop-up. */
const SIZES = [18, 24, 32, 48, 64];

const piece = (name: string, original: string, icon: string, kb: string): string => `
  <div class="gi-piece">
    <figure><img class="gi-original" src="${original}" alt="${name}, origineel" /><figcaption>origineel van de eigenaar</figcaption></figure>
    <figure><img src="${icon}" width="128" height="128" alt="${name}, spelicoon" /><figcaption>spelicoon · 128 × 128 px WebP · ${kb}</figcaption></figure>
    <figure><span class="gi-sizes">${SIZES.map((s) => `<img src="${icon}" width="${s}" height="${s}" alt="" />`).join('')}</span><figcaption>op spelgrootte: ${SIZES.join(', ')} px</figcaption></figure>
  </div>`;

/** Add the gem and heart card to the sheet. */
export function addGardenIconCards(sheet: HTMLElement): void {
  const el = document.createElement('section');
  el.className = 'card wide gi';
  el.id = 'garden-icons';
  const coins = (icon: string): string => `<span class="gi-plate"><img src="${coin}" width="24" height="24" alt="" />120</span><span class="gi-plate"><img src="${icon}" width="24" height="24" alt="" />3</span>`;
  el.innerHTML = `<h2>Tuinthema · diamant en hart (los, nog geen spelelement)</h2>
  <p class="dims">Het beeld van de eigenaar is het onderdeel: losse spikkels weg, bijgesneden, premultiplied verkleind naar 128 px (twee keer de grootste weergave van 64 px). Knoppen en munt blijven die van het robotthema.</p>
  ${piece('Diamant', gemOriginal, gem, '4,6 kB')}
  ${piece('Hart', heartOriginal, heart, '4,3 kB')}
  <h3 class="btn-title">Naast de munt van het spel (24 px), op licht en donker</h3>
  <div class="gi-context"><div class="gi-light">${coins(gem)}${coins(heart)}</div><div class="gi-dark">${coins(gem)}${coins(heart)}</div></div>
  <p class="note"><b>Voorstel, niet ingebouwd.</b> Diamant: een zeldzame beloning voor een volmaakte reeks of een mijlpaal op het levelpad, te ruilen voor iets voor de sier (een kuikenkleurtje, een tuinversiering), nooit voor hulp in een puzzel. Hart: geen levens, maar "favoriet" op een level, of een bedankje na een puzzel die zonder hulp is opgelost. De eigenaar beslist; de munteneconomie loopt in een andere sessie.</p>`;
  sheet.appendChild(el);
}
