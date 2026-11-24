// Parts sheet: the garden theme's backdrop, its foreground decor and the two loose props.
// Everything sits under data-theme="garden" on its own frame, so the rest of the sheet (and the
// game) keeps the harbour. Design: design/themes/garden-backdrop.md.
import '../ui/themes/garden/garden-scene.css';
import './garden-backdrop.css';
import { DECOR_PLACES, GARDEN_DECOR_ART, GARDEN_DECOR_PIECES, GARDEN_PROPS } from '../ui/themes/garden/gardenArt';
import { sceneLayout } from '../ui/themes/garden/backdropLayout';
import scenePic from '../ui/themes/garden/garden-scene.webp';
import pavingPic from '../ui/themes/garden/garden-paving.webp';

const SCREENS: [number, number][] = [[320, 568], [353, 768], [390, 844], [430, 932], [768, 1024]];
/** A decoration pixel counts from this opacity up (5%). */
const SOLID = 13;
/** Bytes of an asset; the parts page inlines every asset as a data URL. */
const bytes = (url: string): number => (url.startsWith('data:') ? Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4) : 0);
const kb = (n: number): string => `${(n / 1024).toFixed(1)} kB`;
const SCENE = '<div class="tf-bg-scene"><i class="tf-bg-glint tf-bg-far"></i><i class="tf-bg-glint tf-bg-mid"></i><i class="tf-bg-glint tf-bg-near"></i><i class="tf-bg-quay tf-bg-left"></i><i class="tf-bg-quay tf-bg-right"></i></div>';

function card(sheet: HTMLElement, id: string, title: string, dims: string, body: string, note: string, wide = true): HTMLElement {
  const el = document.createElement('section');
  el.className = wide ? 'card wide' : 'card';
  el.id = id;
  el.dataset.theme = 'garden';
  el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p>${body}<p class="note">${note}</p>`;
  sheet.appendChild(el);
  return el;
}

/** One phone with the backdrop and grey stand-ins for the game's zones. */
function bgPhone(id: string, w: number, h: number, label: string, board: boolean): string {
  const ui = `<div class="tf-bg-ui"><div class="tf-bg-top"><i></i><i></i><i></i></div><div class="tf-bg-play">${board ? '<i></i>' : ''}</div><div class="tf-bg-controls"><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i><i></i></div></div></div>`;
  return `<figure class="tf-bg-shot"><div class="tf-bg-phone" id="${id}" style="width:${w}px;height:${h}px"><div class="tf-bg">${SCENE}</div>${ui}</div><figcaption>${label}</figcaption></figure>`;
}

/** One game screen: backdrop, the decoration layer and grey stand-ins for the controls. */
function decorScreen(w: number, h: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tf-decor-screen';
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  const pieces = DECOR_PLACES.map((place) => `<img class="tf-decor-piece tf-decor-${place}" src="${GARDEN_DECOR_ART[place]}" alt="" />`).join('');
  const utility = ['Undo', 'Restart', 'Replay'].map((t) => `<div data-kind="face"><span data-kind="label">${t}</span></div>`).join('');
  el.innerHTML = `<div class="tf-bg" style="z-index:-1">${SCENE}</div><div class="tf-decor-layer" aria-hidden="true">${pieces}</div>
  <div class="tf-decor-ui">
    <div class="tf-decor-ph-top"><div data-kind="panel"></div><div class="tf-decor-ph-title" data-kind="text">LEVEL 5<small>titel</small></div><div data-kind="panel"></div><div data-kind="panel"></div></div>
    <div class="tf-decor-ph-board" data-kind="board">bord</div>
    <div class="tf-decor-ph-hint" data-kind="text">hintregel</div>
    <div class="tf-decor-ph-utility">${utility}</div>
    <div class="tf-decor-ph-action">${'<div data-kind="face"></div>'.repeat(4)}</div>
  </div>`;
  return el;
}

function fitted(w: number, h: number, room: number): { holder: HTMLElement; el: HTMLElement } {
  const el = decorScreen(w, h);
  const scale = Math.min(1, room / w);
  const holder = document.createElement('div');
  holder.className = 'tf-decor-fit';
  holder.style.width = `${w * scale}px`;
  holder.style.height = `${h * scale}px`;
  el.style.transform = `scale(${scale})`;
  holder.appendChild(el);
  return { holder, el };
}

/** Per kind of control: decoration pixels drawn over it (covered) and under it (behind). */
interface Measure { covered: Record<string, number>; behind: Record<string, number>; shown: number; taps: boolean }

/**
 * Count decoration pixels against the controls of one screen: the pieces are redrawn on a
 * canvas exactly where the stylesheet puts them (flip included), then compared with the
 * rectangle of every control. Same rule as the robot theme's check.
 */
async function measure(el: HTMLElement): Promise<Measure> {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const layer = el.querySelector<HTMLElement>('.tf-decor-layer')!;
  const ui = el.querySelector<HTMLElement>('.tf-decor-ui')!;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  let taps = getComputedStyle(layer).pointerEvents === 'none';
  for (const img of layer.querySelectorAll('img')) {
    await img.decode();
    const style = getComputedStyle(img);
    taps &&= style.pointerEvents === 'none';
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
    const turn = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
    ctx.setTransform(new DOMMatrix().translate(img.offsetLeft + ox, img.offsetTop + oy).multiply(turn).translate(-ox, -oy));
    ctx.globalAlpha = Number(style.opacity);
    ctx.drawImage(img, 0, 0, img.offsetWidth, img.offsetHeight);
  }
  const alpha = ctx.getImageData(0, 0, w, h).data;
  const hidden = new Uint8Array(w * h);
  const behind: Record<string, number> = { board: 0, face: 0, text: 0, panel: 0, label: 0 };
  const frame = el.getBoundingClientRect();
  const scale = frame.width / w;
  for (const node of ui.querySelectorAll<HTMLElement>('[data-kind]')) {
    const r = node.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor((r.left - frame.left) / scale));
    const x1 = Math.min(w, Math.ceil((r.right - frame.left) / scale));
    const y0 = Math.max(0, Math.floor((r.top - frame.top) / scale));
    const y1 = Math.min(h, Math.ceil((r.bottom - frame.top) / scale));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (alpha[(y * w + x) * 4 + 3] < SOLID) continue;
      behind[node.dataset.kind!]++;
      hidden[y * w + x] = 1;
    }
  }
  let total = 0;
  let unseen = 0;
  for (let i = 0; i < w * h; i++) if (alpha[i * 4 + 3] >= SOLID) {
    total++;
    unseen += hidden[i];
  }
  const under = Number(getComputedStyle(layer).zIndex) < Number(getComputedStyle(ui).zIndex);
  const covered = Object.fromEntries(Object.entries(behind).map(([k, v]) => [k, under ? 0 : v]));
  return { covered, behind, shown: total ? Math.round(((total - unseen) / total) * 100) : 0, taps };
}

/** Add the garden backdrop cards to the parts sheet. */
export function addGardenBackdropCards(sheet: HTMLElement): void {
  const room = Math.max(280, Math.min(1100, document.documentElement.clientWidth) - 58);
  const bgBytes = bytes(scenePic) + bytes(pavingPic);
  const row = (prefix: string, board: boolean): string => `<div class="tf-bg-row">${SCREENS.map(([w, h]) => {
    const s = sceneLayout(w, h);
    return bgPhone(`${prefix}-${w}`, w, h, `${w} × ${h} · ${s.tiles} tegel${s.tiles === 1 ? '' : 's'} pad`, board);
  }).join('')}</div>`;

  card(sheet, 'garden-bg-zones', 'Tuinthema · achtergrond met schermzones',
    `grijze blokken: bovenbalk · bord · knoppen · 2 afbeeldingen, samen ${kb(bgBytes)} (WebP)`, row('garden-bg-zones', true),
    'Het beeld van de eigenaar, ongewijzigd en altijd schermbreed (dus nooit vervormd, nooit een lege rand opzij). Rij 700 van het beeld, het gras vlak vóór de palen van de vogelhuisjes, ligt precies op de bovenrand van het bord: vogelhuisjes, prieel en bloemenboog staan in de strook tussen bovenbalk en bord, het stenen pad loopt onder het bord en de knoppen door. Op een hoger scherm herhaalt het pad zich naar beneden (drie rijen stenen uit het beeld zelf, naadloos).');
  card(sheet, 'garden-bg-open', 'Tuinthema · achtergrond zonder bord', 'zelfde schermen, zonder grijze blokken',
    `<div class="tf-bg-row">${SCREENS.map(([w, h]) => `<figure class="tf-bg-shot"><div class="tf-bg-phone" id="garden-bg-open-${w}" style="width:${w}px;height:${h}px"><div class="tf-bg">${SCENE}</div></div><figcaption>${w} × ${h}</figcaption></figure>`).join('')}</div>`,
    'Zonder bord: wat het bord op de telefoon afdekt is het gras en de eerste rijen stenen; de naad tussen het beeld en het herhalende pad ligt achter het bord (op de tablet net ernaast).');
  card(sheet, 'garden-bg-layers', 'Tuinthema · de twee delen', `scène ${kb(bytes(scenePic))} · pad ${kb(bytes(pavingPic))}`,
    `<div class="tf-garden-pics"><figure><img src="${scenePic}" alt="" /><figcaption>1 · scène: rij 0–1412 van het beeld (941 × 1412)</figcaption></figure>
    <figure><img src="${pavingPic}" alt="" /><img src="${pavingPic}" alt="" /><img src="${pavingPic}" alt="" /><figcaption>2 · pad: rij 1180–1412, drie keer onder elkaar (941 × 232 per tegel)</figcaption></figure></div>`,
    'De bovenste 28 rijen van de padtegel lopen over in de rijen die in het beeld volgen, zodat de tegel zowel aan de scène als aan zichzelf vastzit. Het grasplukje tussen de stenen is uit de tegel gehaald (in de scène staat het nog), anders zie je de herhaling.');

  // Decor: the pieces, the props, and the safety check.
  const pieces: [string, string, string][] = [
    [GARDEN_DECOR_PIECES.bushWhite, 'Ronde struik met witte bloemen', 'uit 06 · dichtbij, rechtsonder'],
    [GARDEN_DECOR_PIECES.cornerGrowth, 'Hoekbegroeiing', 'elements/hoekbegroeiing van de eigenaar · dichtbij, linksonder, klimt langs de rand omhoog'],
    [GARDEN_DECOR_PIECES.clumpBirdhouse, 'Bloemenperkje', 'voet van 07 zonder paal · klein, rechtsboven boven het bord'],
    [GARDEN_DECOR_PIECES.rocksLeft, 'Stenen met roze bloem', 'voet van 09 links zonder palen · verder weg, links onder het bord'],
    [GARDEN_DECOR_PIECES.rocksRight, 'Stenen met roze bloem (2)', 'voet van 09 rechts zonder palen · verder weg, rechts'],
    [GARDEN_DECOR_PIECES.branch, 'Boomtak', 'linksboven uit 10 · hangt in de bovenhoek'],
  ];
  const decorBytes = pieces.reduce((n, [src]) => n + bytes(src), 0);
  card(sheet, 'garden-decor-pieces', 'Tuinthema · losse randstukken', `6 stukken, samen ${kb(decorBytes)} (WebP met transparantie)`,
    `<div class="tf-decor-pieces tf-garden-pieces">${pieces.map(([src, name, role]) => `<figure><img src="${src}" alt="" /><figcaption><b>${name}</b><br />${role}<br />${kb(bytes(src))}</figcaption></figure>`).join('')}</div>`,
    'Alles uit de eigen beelden van de eigenaar. De hoekbegroeiing kwam al los en transparant aan en is alleen bijgesneden en verkleind. Bij de andere: witte achtergrond en de geschilderde vloerschaduw weg, de houten paal van vogelhuisje en boog weggehaald, een zachte schaduw onder elk stuk ingebakken (zoals bij de struiken van het robotthema). Grassprietjes zitten in de perkjes zelf.');
  const propBytes = bytes(GARDEN_PROPS.birdhouse) + bytes(GARDEN_PROPS.flowerArch);
  card(sheet, 'garden-props', 'Tuinthema · vogelhuisje en bloemenboog los', `2 stukken, samen ${kb(propBytes)}`,
    `<div class="tf-decor-pieces tf-garden-pieces"><figure><img src="${GARDEN_PROPS.birdhouse}" alt="" /><figcaption><b>Vogelhuisje</b> (07) · ${kb(bytes(GARDEN_PROPS.birdhouse))}</figcaption></figure><figure><img src="${GARDEN_PROPS.flowerArch}" alt="" /><figcaption><b>Bloemenboog</b> (09) · ${kb(bytes(GARDEN_PROPS.flowerArch))}</figcaption></figure></div>`,
    'Voorstel: de bloemenboog levert het meest op als <b>omlijsting van de winst-pop-up</b> (de kaart staat onder de boog, de kuikentjes lopen erdoor) en als poort aan het einde van het levelpad. Het vogelhuisje past als <b>markering van de huidige stap op het levelscherm</b> of naast de titel van het levelscherm. In de achtergrond zelf zijn ze niet los nodig: daar staan ze al in het beeld, en een losse laag zou alleen zin hebben als ze moeten bewegen.');

  const safety = card(sheet, 'garden-decor-safety', 'Tuinthema · randversiering op het scherm + veiligheidscontrole',
    'Grijze blokken = bovenbalk, bord, hintregel, 3 hulpknoppen, 4 actieknoppen. De stukken liggen als eigen laag onder de bediening en vangen geen tikken af.',
    '<div class="tf-decor-row"></div>',
    '<b>Bedekt</b> = decorpixels die óver een bedieningselement getekend worden (moet 0 zijn). <b>Erachter</b> = decorpixels onder een element; voor het bord en voor losse tekst moet ook dat 0 zijn. Geteld vanaf 5% dekking, zonder wiegen.');
  const holder = safety.querySelector('.tf-decor-row')!;
  const checks: Promise<void>[] = [];
  for (const [w, h] of SCREENS) {
    const { holder: frame, el } = fitted(w, h, room);
    const cell = document.createElement('figure');
    cell.className = 'tf-decor-cell';
    cell.id = `garden-decor-${w}x${h}`;
    cell.appendChild(frame);
    const caption = document.createElement('figcaption');
    caption.textContent = `${w}×${h}: meten…`;
    cell.appendChild(caption);
    holder.appendChild(cell);
    checks.push(measure(el).then((m) => {
      const c = m.covered;
      const b = m.behind;
      const ok = c.board + c.face + c.text + c.panel + c.label === 0 && b.board === 0 && b.text === 0 && m.taps;
      cell.dataset.ok = String(ok);
      cell.dataset.result = JSON.stringify(m);
      caption.innerHTML = `<b>${w}×${h}</b> ${ok ? '✔ veilig' : '✘ NIET veilig'}<br />Bedekt: bord ${c.board} px · knopvlakken ${c.face} px · tekst ${c.text + c.label} px · bovenbalk ${c.panel} px<br />Erachter: bord ${b.board} px · losse tekst ${b.text} px · knoppen ${b.face} px · bovenbalk ${b.panel} px<br />Zichtbaar van het decor: ${m.shown}% · tikken ${m.taps ? 'gaan erdoorheen' : 'WORDEN GEBLOKKEERD'}`;
    }));
  }

  const motion = card(sheet, 'garden-motion', 'Tuinthema · optie: beweging', 'standaard uit (rustige variant) · uit bij "minder beweging"',
    '<label class="tf-decor-toggle"><input type="checkbox" id="garden-motion-toggle" /> Beweging aan</label><div class="tf-decor-row"></div>',
    'Rustig is de standaard: niets beweegt. Met het vinkje ademt het zonlicht heel langzaam (11 s) over gras en pad en wiegen de bloemen hooguit 1,2° om hun voet (6 tot 9 s, de wiegregel van het robotthema). Staat het toestel op "minder beweging", dan blijft alles stil, ook met het vinkje aan. Alleen CSS, geen extra afbeeldingen.', false);
  const live = fitted(390, 844, Math.min(room, 314));
  motion.querySelector('.tf-decor-row')!.appendChild(live.holder);
  motion.querySelector<HTMLInputElement>('#garden-motion-toggle')!.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    live.el.querySelector('.tf-bg')!.classList.toggle('tf-bg-motion', on);
    live.el.querySelector('.tf-decor-layer')!.classList.toggle('tf-decor-sway', on);
  });

  void Promise.all(checks).then(() => {
    document.body.dataset.gardenReady = 'true';
  });
}
