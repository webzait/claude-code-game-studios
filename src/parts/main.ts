import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import hintIcon from '../../assets/turnflock/ui/hint.webp';
import decorBushLarge from '../../assets/turnflock/decor/decor-bush-large.webp';
import decorBushSmall from '../../assets/turnflock/decor/decor-bush-small.webp';
import decorTuftClover from '../../assets/turnflock/decor/decor-tuft-clover.webp';
import decorSprigTop from '../../assets/turnflock/decor/decor-sprig-top.webp';
import { buildExit, buildFloorTile, buildObstacle, buildRim, buildRimCorner, buildRimEdge, buildUnderlay } from '../render/parts/board';
import { buildFlockbot } from '../render/parts/flockbot';
import './parts.css';

/**
 * The parts sheet: every game element built on its own and shown from the
 * same sides as the asset sheet (three-quarter, front, side, top), with the
 * size it actually has. Nothing here is part of the playable game yet.
 */

const PX = parts.unitPx;
/** Pixels per picture: drawn large so the parts stay sharp on a phone screen and when zoomed in. */
const SIZE = 1200;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = CONFIG.light.reflections;
scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
const sun = new THREE.DirectionalLight('#FFFFFF', CONFIG.light.sun);
sun.position.set(-4.5, 9, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: '#1F3A7A', opacity: 0.3 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

const VIEWS = {
  main: { label: '', dir: new THREE.Vector3(-0.55, 0.62, 1) },
  front: { label: 'Voorkant', dir: new THREE.Vector3(0, 0.0001, 1) },
  side: { label: 'Zijaanzicht', dir: new THREE.Vector3(1, 0.0001, 0) },
  top: { label: 'Bovenaanzicht', dir: new THREE.Vector3(0, 1, 0.0001) },
} as const;
type ViewName = keyof typeof VIEWS;

/** Draw `object` from one side into a new canvas. `reach` is half the picture's size in cells. */
function snapshot(object: THREE.Object3D, view: ViewName, reach: number, centre: THREE.Vector3, floorY: number): HTMLCanvasElement {
  scene.add(object);
  ground.position.y = floorY - 0.002;
  ground.visible = view === 'main' || view === 'top';
  const reachCam = reach * 1.12;
  camera.left = -reachCam;
  camera.right = reachCam;
  camera.top = reachCam;
  camera.bottom = -reachCam;
  camera.updateProjectionMatrix();
  camera.position.copy(centre).addScaledVector(VIEWS[view].dir.clone().normalize(), 20);
  camera.lookAt(centre);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -reach * 2.5;
  cam.right = cam.top = reach * 2.5;
  cam.updateProjectionMatrix();
  sun.target.position.copy(centre);
  renderer.render(scene, camera);
  scene.remove(object);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  return canvas;
}

const px = (cells: number): string => `${Math.round(cells * PX)} px`;

/** Add a card for one 3D part with its views and measured size. */
function card(title: string, id: string, object: THREE.Object3D, note: string, views: ViewName[] = ['main', 'front', 'side', 'top'], wide = false): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const reach = Math.max(size.x, size.y, size.z) * 0.62;
  const el = document.createElement('section');
  el.className = wide ? 'card wide' : 'card';
  el.id = id;
  el.innerHTML = `<h2>${title}</h2><p class="dims">breedte ${px(size.x)} · hoogte ${px(size.y)} · diepte ${px(size.z)}</p><div class="views"></div><p class="note">${note}</p>`;
  const holder = el.querySelector('.views')!;
  for (const view of views) {
    const figure = document.createElement('figure');
    if (view === 'main') figure.className = 'main';
    figure.appendChild(snapshot(object, view, reach, centre, box.min.y));
    if (VIEWS[view].label) figure.insertAdjacentHTML('beforeend', `<figcaption>${VIEWS[view].label}</figcaption>`);
    holder.appendChild(figure);
  }
  document.getElementById('sheet')!.appendChild(el);
}

const NAMES: Record<Color, string> = { red: 'Rode Flockbot', blue: 'Blauwe Flockbot', yellow: 'Gele Flockbot' };
for (const color of ['red', 'blue', 'yellow'] as const) {
  card(NAMES[color], `bot-${color}`, buildFlockbot(color).root, 'Bovenschaal met symbool · gezichtsmodule · romp · 2 pootjes. Het symbool draait mee met de richting.');
}

// Exploded Flockbot, as in the sheet's construction drawing.
{
  const bot = buildFlockbot('red');
  const lift = (node: THREE.Object3D, by: number): void => {
    node.position.y += by;
  };
  lift(bot.shell, 0.55);
  lift(bot.symbol, 0.55);
  lift(bot.face, 0.2);
  bot.face.position.z += 0.25;
  lift(bot.feet, -0.3);
  card('3D-constructie (Flockbot)', 'bot-exploded', bot.root, 'Uit elkaar getrokken: bovenschaal, gezichtsmodule, romp en pootjes zijn losse delen.', ['main', 'front']);
}

card('Obstakelblok', 'obstacle', buildObstacle(), 'Laag afgerond blok met vier ronde noppen.');
card('Groene uitgang (doel)', 'exit', buildExit(), 'Tegelhoog groen vak met opstaande rand, verdiept vlak en vinkje in reliëf.');
card('Vloertegel', 'floor', buildFloorTile(), 'Eén herhaalbare tegel met vier pennen aan de onderkant.');
card('Randstuk (recht)', 'rim-edge', buildRimEdge(1), 'Eén stuk per vak langs elke zijde; 0°, 90°, 180° of 270° gedraaid.');
card('Hoekstuk', 'rim-corner', buildRimCorner(), 'Kwartboog; dezelfde vorm op alle vier de hoeken.');
card('Onderplaat', 'underlay', buildUnderlay(6, 6, CONFIG.board.grid.gap, true), 'Eén plaat onder het hele bord; breedte en diepte volgen het raster (hier 6×6).', ['main', 'top']);

// Everything together on a 6x6 board, only to check that the separate parts fit each other.
{
  const gap = CONFIG.board.grid.gap;
  const board = new THREE.Group();
  board.add(buildUnderlay(6, 6, gap), buildRim(6, 6, gap));
  const pitch = parts.floorTile.size + gap;
  const at = (i: number): number => (i - 2.5) * pitch;
  const walls = new Set(['1,1', '3,1', '4,3', '0,4', '2,5']);
  const bots: [number, number, Color, number][] = [[1, 0, 'red', 0], [2, 0, 'yellow', 0], [3, 0, 'blue', 1], [4, 0, 'blue', 1], [2, 1, 'red', 0], [5, 1, 'yellow', 0], [4, 2, 'red', 0], [0, 3, 'yellow', 3], [2, 4, 'blue', 0], [3, 4, 'yellow', 3], [4, 4, 'red', 3], [5, 4, 'blue', 0]];
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) {
    const tile = x === 5 && z === 0 ? buildExit() : buildFloorTile((x + z) % 2 === 1, false);
    tile.position.set(at(x), 0, at(z));
    board.add(tile);
    if (walls.has(`${x},${z}`)) {
      const wall = buildObstacle();
      wall.position.set(at(x), parts.floorTile.height, at(z));
      board.add(wall);
    }
  }
  for (const [x, z, color, heading] of bots) {
    const bot = buildFlockbot(color);
    bot.symbol.rotation.y = (-heading * Math.PI) / 2;
    bot.root.scale.setScalar(CONFIG.board.grid.robotFill);
    bot.root.position.set(at(x), parts.floorTile.height, at(z));
    board.add(bot.root);
  }
  card('Passing: alle losse delen samen (6×6)', 'assembly', board, 'Alleen een pascontrole van de losse onderdelen; dit is nog niet het speelbord van de game.', ['main', 'top'], true);
}

// Buttons: plain HTML and CSS, each on its own at the sheet's size.
{
  const turn = '<svg viewBox="0 0 24 24"><path d="M19.2 12a7.2 7.2 0 1 1-2.4-5.4" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M20 3.2v5h-5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const up = '<svg viewBox="0 0 24 24"><path d="M12 20V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const undo = '<svg viewBox="0 0 24 24"><path d="M9 7 4.5 11.5 9 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 11.5h9a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  const restart = '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.3-5.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M19.5 3.5v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const replay = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const b = parts.buttons;
  const cell = (html: string, label: string): string => `<div class="btn-cell">${html}<span>${label}</span></div>`;
  const el = document.createElement('section');
  el.className = 'card wide';
  el.id = 'buttons';
  el.innerHTML = `<h2>Knoppen</h2><p class="dims">utility ${b.utility.width}×${b.utility.height} px, ${b.utility.depth} px diep · actie ${b.action.width}×${b.action.height} px, ${b.action.depth} px diep · hint ${b.hint.width}×${b.hint.height} px, ${b.hint.depth} px diep</p>
  <div class="btn-row">
    ${cell(`<button class="tf-btn tf-utility" id="btn-undo">${undo}Undo</button>`, 'Kleine utility-knop')}
    ${cell(`<button class="tf-btn tf-utility" id="btn-restart">${restart}Restart</button>`, 'Utility: Restart')}
    ${cell(`<button class="tf-btn tf-utility" id="btn-replay">${replay}Replay</button>`, 'Utility: Replay')}
    ${cell(`<button class="tf-btn tf-utility tf-hint" id="btn-hint"><img src="${hintIcon}" alt="" />Hint</button>`, 'Hint-knop')}
    ${cell(`<button class="tf-btn tf-action red" id="btn-red">${turn}</button>`, 'Grote actieknop · rood')}
    ${cell(`<button class="tf-btn tf-action blue">${turn}</button>`, 'blauw')}
    ${cell(`<button class="tf-btn tf-action yellow">${turn}</button>`, 'geel')}
    ${cell(`<button class="tf-btn tf-action forward" id="btn-forward">${up}</button>`, 'vooruit')}
  </div><p class="note">Echte HTML-knoppen: indrukbaar, tekst blijft tekst. De "diepte" is de zichtbare zijkant onder het vlak.</p>`;
  document.getElementById('sheet')!.appendChild(el);
}

// Foreground decoration: bushes cut from the owner's one original, as their own layer.
// Not in the playable game yet. Sizes and positions live in parts.css (.tf-decor-*).
{
  const ART = {
    large: { src: decorBushLarge, name: 'Grote hoekstruik', role: 'dichtbij: scherp, stevige schaduw' },
    small: { src: decorBushSmall, name: 'Kleine struik', role: 'dichtbij, lichtere tint' },
    clover: { src: decorTuftClover, name: 'Klavertuf', role: 'verder weg: kleiner, zachter' },
    sprig: { src: decorSprigTop, name: 'Bladtakje (bovenhoek)', role: 'hangt in de bovenhoek, zacht' },
  } as const;
  type Art = keyof typeof ART;
  /** Where each piece goes; the class decides its place and size. Back pieces first. */
  const PLACED: [string, Art][] = [['sprig-tl', 'sprig'], ['tuft-tr', 'clover'], ['back-l', 'large'], ['back-r', 'clover'], ['front-l', 'small'], ['front-r', 'large']];
  const SCREENS: [number, number][] = [[320, 568], [353, 768], [390, 844], [430, 932], [768, 1024]];
  /** A decoration pixel counts from this opacity up (5%). */
  const SOLID = 13;
  /** Bytes of an asset; the parts page inlines every asset as a data URL. */
  const bytes = (url: string): number => (url.startsWith('data:') ? Math.floor(((url.length - url.indexOf(',') - 1) * 3) / 4) : 0);

  /** One phone screen: the decoration layer with grey stand-ins for the game's controls on top. */
  const screen = (w: number, h: number): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'tf-decor-screen';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    const pieces = PLACED.map(([place, art]) => `<img class="tf-decor-piece tf-decor-${place}" src="${ART[art].src}" alt="" />`).join('');
    const utility = ['Undo', 'Restart', 'Replay'].map((t) => `<div data-kind="face"><span data-kind="label">${t}</span></div>`).join('');
    el.innerHTML = `<div class="tf-decor-layer" aria-hidden="true">${pieces}</div>
    <div class="tf-decor-ui">
      <div class="tf-decor-ph-top"><div data-kind="panel"></div><div class="tf-decor-ph-title" data-kind="text">LEVEL 5<small>titel</small></div><div data-kind="panel"></div><div data-kind="panel"></div></div>
      <div class="tf-decor-ph-board" data-kind="board">bord</div>
      <div class="tf-decor-ph-hint" data-kind="text">hintregel</div>
      <div class="tf-decor-ph-utility">${utility}</div>
      <div class="tf-decor-ph-action">${'<div data-kind="face"></div>'.repeat(4)}</div>
    </div>`;
    return el;
  };

  /** The screen at its real size, shrunk as a whole only when the card is narrower than it. */
  const fitted = (w: number, h: number, room: number): { holder: HTMLElement; el: HTMLElement } => {
    const el = screen(w, h);
    const scale = Math.min(1, room / w);
    const holder = document.createElement('div');
    holder.className = 'tf-decor-fit';
    holder.style.width = `${w * scale}px`;
    holder.style.height = `${h * scale}px`;
    el.style.transform = `scale(${scale})`;
    holder.appendChild(el);
    return { holder, el };
  };

  /**
   * Count decoration pixels against the controls of one screen. The pieces are
   * redrawn on a canvas exactly where the stylesheet puts them (flip and turn
   * included), then compared with the rectangle of every control.
   */
  const measure = async (el: HTMLElement): Promise<{ covered: Record<string, number>; behind: Record<string, number>; shown: number; taps: boolean }> => {
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
      const m = new DOMMatrix().translate(img.offsetLeft + ox, img.offsetTop + oy).multiply(turn).translate(-ox, -oy);
      ctx.setTransform(m);
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
    // The layer is drawn under the controls. Only if that order were ever broken would "behind" become "covered".
    const under = Number(getComputedStyle(layer).zIndex) < Number(getComputedStyle(ui).zIndex);
    const covered = Object.fromEntries(Object.entries(behind).map(([k, v]) => [k, under ? 0 : v]));
    return { covered, behind, shown: total ? Math.round(((total - unseen) / total) * 100) : 0, taps };
  };

  const sheet = document.getElementById('sheet')!;
  const room = Math.max(280, Math.min(1100, document.documentElement.clientWidth) - 58);

  // Card 1: the separate pieces.
  const total = Object.values(ART).reduce((sum, a) => sum + bytes(a.src), 0);
  const piecesCard = document.createElement('section');
  piecesCard.className = 'card wide';
  piecesCard.id = 'decor-pieces';
  piecesCard.innerHTML = `<h2>Decor: losse struikstukken</h2><p class="dims">4 stukken uit het ene origineel · samen <span id="decor-total">${(total / 1024).toFixed(1)}</span> kB (WebP met transparantie; doel onder 80 kB)</p>
  <div class="tf-decor-pieces">${Object.values(ART).map((a) => `<figure><img src="${a.src}" alt="" /><figcaption><b>${a.name}</b><br />${a.role}<br /><span data-size></span> · ${(bytes(a.src) / 1024).toFixed(1)} kB</figcaption></figure>`).join('')}</div>
  <p class="note">Alles is uit de eigen struikafbeelding gesneden (grote groep, kleine groep, de drie voorste bollen, twee grassprieten als blaadjes), bijgekleurd naar het struikenpalet (#92EA73 / #63C94D / #429B37 en de tweede reeks) en voorzien van een donkere voet en een ingebakken schaduw. Geen beelden van buiten.</p>`;
  sheet.appendChild(piecesCard);
  for (const img of piecesCard.querySelectorAll('img')) {
    void img.decode().then(() => {
      img.parentElement!.querySelector('[data-size]')!.textContent = `${img.naturalWidth}×${img.naturalHeight} px`;
    });
  }

  // Card 2: the layer on five screens, with the safety check.
  const safety = document.createElement('section');
  safety.className = 'card wide';
  safety.id = 'decor-safety';
  safety.innerHTML = `<h2>Decor: laag op het scherm + veiligheidscontrole</h2><p class="dims">Grijze blokken = bovenbalk, bord, hintregel, 3 utility-knoppen, 4 actieknoppen. De struiken liggen als eigen laag onder de bediening en vangen geen tikken af.</p><div class="tf-decor-row"></div>
  <p class="note"><b>Bedekt</b> = decorpixels die óver een bedieningselement getekend worden (moet 0 zijn). <b>Erachter</b> = decorpixels die onder een element schuilgaan; voor het bord en voor losse tekst (titel, hintregel) is ook dat 0, zodat er zelfs bij een fout in de laagvolgorde niets leesbaars geraakt wordt. Geteld vanaf 5% dekking, zonder wiegen. De hemel is een tijdelijke egale achtergrond; haven en lucht komen van een ander onderdeel.</p>`;
  sheet.appendChild(safety);
  const row = safety.querySelector('.tf-decor-row')!;
  const checks: Promise<void>[] = [];
  for (const [w, h] of SCREENS) {
    const { holder, el } = fitted(w, h, room);
    const cell = document.createElement('figure');
    cell.className = 'tf-decor-cell';
    cell.id = `decor-${w}x${h}`;
    cell.appendChild(holder);
    const caption = document.createElement('figcaption');
    caption.textContent = `${w}×${h}: meten…`;
    cell.appendChild(caption);
    row.appendChild(cell);
    checks.push(measure(el).then((m) => {
      const c = m.covered;
      const b = m.behind;
      const ok = c.board + c.face + c.text + c.panel + c.label === 0 && b.board === 0 && b.text === 0 && m.taps;
      cell.dataset.ok = String(ok);
      cell.dataset.result = JSON.stringify(m);
      caption.innerHTML = `<b>${w}×${h}</b> ${ok ? '✔ veilig' : '✘ NIET veilig'}<br />Bedekt: bord ${c.board} px · knopvlakken ${c.face} px · tekst ${c.text + c.label} px · bovenbalk ${c.panel} px<br />Erachter: bord ${b.board} px · losse tekst ${b.text} px · knoppen ${b.face} px · bovenbalk ${b.panel} px<br />Zichtbaar van het decor: ${m.shown}% · tikken ${m.taps ? 'gaan erdoorheen' : 'WORDEN GEBLOKKEERD'}`;
    }));
  }

  // Card 3: the optional sway, off unless switched on here.
  const swayCard = document.createElement('section');
  swayCard.className = 'card';
  swayCard.id = 'decor-sway';
  swayCard.innerHTML = `<h2>Decor, optie: zacht wiegen</h2><p class="dims">Standaard uit · alleen CSS · uit bij "minder beweging"</p><label class="tf-decor-toggle"><input type="checkbox" id="decor-sway-toggle" /> Wiegen aan</label><div class="tf-decor-row"></div><p class="note">Elk stuk draait hooguit 1,2° om zijn voet, elk in een eigen tempo (6 tot 9 s). Staat het toestel op "minder beweging", dan blijft alles stil, ook met het vinkje aan.</p>`;
  sheet.appendChild(swayCard);
  const sway = fitted(390, 844, Math.min(room, 314));
  swayCard.querySelector('.tf-decor-row')!.appendChild(sway.holder);
  swayCard.querySelector<HTMLInputElement>('#decor-sway-toggle')!.addEventListener('change', (e) => {
    sway.el.querySelector('.tf-decor-layer')!.classList.toggle('tf-decor-sway', (e.target as HTMLInputElement).checked);
  });

  void Promise.all(checks).then(() => {
    document.body.dataset.decorReady = 'true';
  });
}

document.body.dataset.ready = 'true';
