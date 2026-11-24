import robotTouchUrl from '../../assets/turnflock/brand/icon-180.png';
import robotTabUrl from '../../assets/turnflock/brand/favicon-64.png';
import gardenTouchUrl from '../../assets/turnflock/garden/icon/icon-180-garden.png';
import gardenTabUrl from '../../assets/turnflock/garden/icon/favicon-64-garden.png';
import './gardenIcon.css';

/**
 * The garden app icon on the parts sheet (design/themes/garden-icon.md): the home-screen icon
 * and the tab icon of the garden theme next to the robot ones, at 180, 64, 32 and 16 px, and as
 * they look on a phone's home screen and in a browser tab. The game uses the garden icons for the
 * whole app (index.html; the owner's choice, design/themes/garden-icon.md).
 */

/** Bytes of an asset when the build inlined it as a data URL (the parts build does); otherwise null. */
export function dataUrlBytes(url: string): number | null {
  const comma = url.indexOf(',');
  if (!url.startsWith('data:') || comma < 0 || !url.slice(0, comma).endsWith(';base64')) return null;
  const b64 = url.slice(comma + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length * 3) / 4 - pad;
}

const kb = (url: string): string => {
  const bytes = dataUrlBytes(url);
  return bytes === null ? '' : `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
};

type Theme = { name: string; touch: string; tab: string };
const THEMES: Theme[] = [
  { name: 'Tuin', touch: gardenTouchUrl, tab: gardenTabUrl },
  { name: 'Robot', touch: robotTouchUrl, tab: robotTabUrl },
];

/** One icon at `css` CSS pixels, with extra classes (`tgi-ios`: the rounded square a home screen cuts it to). */
const img = (url: string, css: number, cls = ''): string =>
  `<img class="tgi-img ${cls}" src="${url}" alt="" width="${css}" height="${css}">`;

/** Add the garden icon's cards to the sheet. */
export function addGardenIconCards(sheet: HTMLElement): void {
  const card = (id: string, title: string, dims: string, body: string, note: string): void => {
    const el = document.createElement('section');
    el.className = 'card wide tf-garden-icon';
    el.id = id;
    el.dataset.theme = 'garden';
    el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p>${body}<p class="note">${note}</p>`;
    sheet.appendChild(el);
  };

  const rows = THEMES.map((t) => `<div class="tgi-row">
      <span class="tgi-name">${t.name}</span>
      <figure>${img(t.touch, 180)}<figcaption>180 · aanraak · ${kb(t.touch)}</figcaption></figure>
      <figure>${img(t.tab, 64)}<figcaption>64 · tabblad · ${kb(t.tab)}</figcaption></figure>
      <figure>${img(t.tab, 32)}<figcaption>32</figcaption></figure>
      <figure>${img(t.tab, 16)}<figcaption>16</figcaption></figure>
      <figure class="tgi-pixel">${img(t.tab, 16, 'tgi-1x')}<figcaption>16 op 1×-scherm, vergroot</figcaption></figure>
    </div>`).join('');
  card('garden-icon', 'Tuinthema · app-pictogram en favicon', '180×180 aanraakpictogram (vierkant, zonder transparantie) · 64×64 favicon (afgeronde hoeken) — naast de robotpictogrammen',
    `<div class="tgi-sizes">${rows}</div>`,
    'Jouw pictogrambeeld (27-app-icon-garden, 1254×1254), niet nagetekend: alleen uitgesneden, verkleind en voor het tabblad de hoeken afgerond. Het aanraakpictogram is het hele beeld; het tabblad-pictogram een kleiner vierkant rond het rode kuiken, met wat lucht eromheen, zodat het op 16 px nog leest als rode bol met witte driehoek. Gemaakt met assets/turnflock/garden/icon/build-icon-garden.py. Jouw keuze: dit tuinpictogram is het pictogram van de hele app, in elk thema (index.html).');

  const home = THEMES.map((t) => `<div class="tgi-app">${img(t.touch, 60, 'tgi-ios')}<span>Turnflock</span></div>`).join('');
  const tabs = (dark: boolean): string => `<div class="tgi-tabs${dark ? ' tgi-dark' : ''}">${THEMES.map((t, i) =>
    `<div class="tgi-tab${i === 0 ? ' tgi-on' : ''}">${img(t.tab, 16)}<span>TURNFLOCK · ${t.name.toLowerCase()}</span></div>`).join('')}<div class="tgi-tab"><i></i><span>Andere site</span></div></div>`;
  card('garden-icon-in-use', 'Tuinthema · pictogram in gebruik', 'beginscherm 60 px met afgeronde hoeken (zoals iOS ze snijdt) · tabblad 16 px, licht en donker',
    `<div class="tgi-use">
      <figure><div class="tgi-home tgi-wall-light">${home}</div><figcaption>Beginscherm, lichte achtergrond</figcaption></figure>
      <figure><div class="tgi-home tgi-wall-dark">${home}</div><figcaption>Beginscherm, donkere achtergrond</figcaption></figure>
      <figure class="tgi-tabfig">${tabs(false)}${tabs(true)}<figcaption>Tabbladen, licht en donker</figcaption></figure>
    </div>`,
    'Links telkens tuin, rechts robot. Op het beginscherm snijdt de telefoon de hoeken zelf af; daar valt alleen lucht en gras weg. In het tabblad is het rode kuiken met de witte driehoek nog te herkennen, de pijl wordt een gele veeg.');
}
