import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import hintIcon from '../../assets/turnflock/ui/hint.webp';
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

// Buttons: plain HTML and CSS, each one solid block. Sizes come from data/parts.json and reach the CSS as custom properties.
{
  type Size = { width: number; height: number; depth: number; radius: number };
  /** One icon: the shape drawn twice, a soft offset copy under the real one, so it sits embossed on the cap. */
  const icon = (shape: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.3)">${shape}</g><g>${shape}</g></svg>`;
  const stroke = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const turnShape = (width: number): string => stroke('M17.1 16.9A7 7 0 1 1 15.5 8', width) + stroke('M18.4 3.2v6h-6', width);
  const turn = icon(turnShape(3.6));
  const up = icon(stroke('M12 20.6V6M5.2 11.4 12 4.6l6.8 6.8', 4));
  const undo = icon(`<path d="M9.4 4.2 3.6 9.3l5.8 5.1z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>` + stroke('M9 9.3h5.4a5.3 5.3 0 0 1 0 10.6H9.6', 3.5));
  const restart = icon(turnShape(3.5));
  const replay = icon('<path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>');
  const bulb = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 15.4a5.9 5.9 0 1 1 6.6 0v1.9H8.7z" fill="#f4c62f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.9 20.6h4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 .9v1.4M4.3 3.6l1 1M19.7 3.6l-1 1M1.4 10.4h1.5M22.6 10.4h-1.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.6 9.6a2.6 2.6 0 0 1 2-2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const b = parts.buttons;
  const p = b.phone;
  const vars = (s: Size): string => `--w:${s.width}px;--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${b.pressFraction}`;
  type State = '' | 'pressed' | 'disabled' | 'nudge';
  /** One button. `state` only fixes a look for the sheet; in the game :active and the disabled attribute do it. */
  const button = (kind: string, s: Size, inner: string, name: string, state: State = '', extra = ''): string =>
    `<button type="button" class="tf-btn ${kind}${state === 'pressed' || state === 'nudge' ? ` ${state}` : ''}" style="${vars(s)}${extra}" aria-label="${name}"${state === 'disabled' ? ' disabled' : ''}><span class="tf-clip"><span class="tf-face">${inner}</span></span></button>`;
  const label = (text: string): string => `<span class="tf-label">${text}</span>`;
  const utility = (s: Size, glyph: string, text: string, state: State = '', extra = ''): string => button('tf-utility', s, glyph + label(text), text, state, extra);
  const hint = (s: Size, state: State = '', kind = 'tf-hint'): string => button(kind, s, bulb + label('Hint'), 'Hint', state);
  const action = (s: Size, color: string, state: State = ''): string => button(`tf-action ${color}`, s, color === 'forward' ? up : turn, color === 'forward' ? 'Vooruit' : `Draai ${color}`, state);
  const cell = (html: string, text: string): string => `<div class="btn-cell">${html}<span>${text}</span></div>`;
  const STATES: [State, string][] = [['', 'rust'], ['pressed', 'ingedrukt'], ['disabled', 'uit']];
  const ACTION_STATES: [State, string][] = [...STATES, ['nudge', 'nudge']];
  const COLORS = ['red', 'blue', 'yellow', 'forward'] as const;
  const COLOR_NAMES = { red: 'rood', blue: 'blauw', yellow: 'geel', forward: 'vooruit' } as const;

  const utilityRow = `<div class="tf-line">${utility(p.utility, undo, 'Undo')}${utility(p.utility, restart, 'Restart')}${utility(p.utility, replay, 'Replay')}</div>`;
  const actionRow = `<div class="tf-line">${COLORS.map((c) => action(p.action, c, c === 'blue' ? 'nudge' : '')).join('')}</div>`;
  const phone = `<div class="tf-phone" id="buttons-phone">
      <div class="tf-bar"><span class="tf-pill grow">Level 5</span><span class="tf-pill">0 / 12</span><span class="tf-pill">12 zetten</span>${hint(p.hintCompact, '', 'tf-hint compact')}</div>
      <div class="tf-board">speelbord</div>
      <div class="tf-controls">${utilityRow}${actionRow}</div>
    </div>`;

  const el = document.createElement('section');
  el.className = 'card wide';
  el.id = 'buttons';
  el.innerHTML = `<h2>Knoppen</h2><p class="dims">utility ${b.utility.width}×${b.utility.height} px, ${b.utility.depth} px diep · actie ${b.action.width}×${b.action.height} px, ${b.action.depth} px diep · hint ${b.hint.width}×${b.hint.height} px, ${b.hint.depth} px diep</p>
  <h3 class="btn-title">Op bladmaat</h3>
  <div class="btn-row" id="buttons-sheet">
    ${cell(utility(b.utility, undo, 'Undo'), 'Utility: Undo')}
    ${cell(utility(b.utility, restart, 'Restart'), 'Utility: Restart')}
    ${cell(utility(b.utility, replay, 'Replay'), 'Utility: Replay')}
    ${cell(hint(b.hint), 'Hint-knop')}
    ${COLORS.map((c) => cell(action(b.action, c), `Actie · ${COLOR_NAMES[c]}`)).join('')}
  </div>
  <h3 class="btn-title">Toestanden · utility en hint</h3>
  <div class="tf-states three" id="buttons-states-utility">
    ${STATES.map(([, n]) => `<span>${n}</span>`).join('')}
    ${STATES.map(([s]) => utility(b.utility, undo, 'Undo', s)).join('')}
    ${STATES.map(([s]) => hint(b.hint, s)).join('')}
    ${button('tf-hint', b.hint, `<img src="${hintIcon}" alt="" />` + label('Hint'), 'Hint')}<span class="wide">← alternatief met hint.webp</span>
  </div>
  <h3 class="btn-title">Toestanden · actieknop (telefoonmaat)</h3>
  <div class="tf-states four" id="buttons-states-action">
    ${ACTION_STATES.map(([, n]) => `<span>${n}</span>`).join('')}
    ${COLORS.map((c) => ACTION_STATES.map(([s]) => action(p.action, c, s)).join('')).join('')}
  </div>
  <h3 class="btn-title">Telefoon ${p.stripWidth} px · Hint compact in de bovenbalk</h3>
  ${phone}
  <p class="note">Echte HTML-knoppen met CSS: tekst blijft tekst, maten komen uit <code>--w --h --d --r</code>. Elke knop is één gegoten blok met een bovenvlak, een ronde rand en schuine flanken: bij indrukken zakt het hele blok ${Math.round(b.pressFraction * 100)}% van de diepte weg; de voetafdruk en het raakvlak blijven gelijk. Blauw toont in de telefoonstroken de nudge.</p>`;
  document.getElementById('sheet')!.appendChild(el);
}

// Perks: a proposal (design/perks-proposal.md). Icons, buttons and placement only; none of this is in the game.
{
  type Size = { width: number; height: number; depth: number; radius: number };
  type Tone = 'cyan' | 'purple' | 'green';
  type PerkState = 'available' | 'poor' | 'idle' | 'used' | 'armed';
  interface Perk { id: string; name: string; label: string; tone: Tone; price: number; glyph: string; promise: string }

  /** A glyph drawn twice: a soft dark copy under the white one, so it stays readable at 24 px. */
  const glyph = (d: string, width: number, extra = ''): string =>
    `<path class="tf-perk-glyph-shadow" d="${d}" stroke-width="${width}" transform="translate(0 1)"/><path class="tf-perk-glyph" d="${d}" stroke-width="${width}"/>${extra}`;
  /** One perk icon: a moulded tile in the family tone with a white glyph, on a 24 grid. */
  const perkIcon = (tone: Tone, shape: string, size?: number): string =>
    `<svg class="tf-perk-icon tf-perk-${tone}" viewBox="0 0 24 24"${size ? ` width="${size}" height="${size}"` : ''} aria-hidden="true"><rect class="tf-perk-base" x="1.5" y="3" width="21" height="20" rx="6.5"/><rect class="tf-perk-tile" x="1.5" y="1" width="21" height="20" rx="6.5"/><path class="tf-perk-shine" d="M4 7.5A4.5 4.5 0 0 1 8.5 3h7A4.500 4.500 0 0 1 20 7.500 12 12 0 0 0 4 7.500z"/>${shape}</svg>`;
  const coin = (size: number): string =>
    `<svg class="tf-perk-coin" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#f6c542" stroke="#c9961a" stroke-width="1.6"/><circle cx="8" cy="8" r="4" fill="none" stroke="#ffe48a" stroke-width="1.6"/></svg>`;
  const tick = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.9 9l5-5.800" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const PERKS: Perk[] = [
    { id: 'waypoint', name: 'Wegwijzer', label: 'Waypoint', tone: 'cyan', price: 15, promise: 'Toont waar de kudde over 3 zetten moet staan', glyph: glyph('M9.6 5.5h4.800a3.100 3.100 0 0 1 3.100 3.100v4.800a3.100 3.100 0 0 1-3.100 3.100H9.600a3.100 3.100 0 0 1-3.100-3.100V8.600a3.100 3.100 0 0 1 3.100-3.100z', 1.9, '<circle class="tf-perk-dot" cx="10" cy="11.200" r="1.250"/><circle class="tf-perk-dot" cx="14" cy="11.200" r="1.250"/>').replaceAll('stroke-width="1.9"', 'stroke-width="1.9" stroke-dasharray="3.300 2.500"') },
    { id: 'leftturn', name: 'Linksom', label: 'Left turn', tone: 'purple', price: 30, promise: 'Eén kleur draait één keer linksom', glyph: `<g transform="translate(12 11.300) scale(-.6 .6) translate(-12 -11.500)">${glyph('M17.1 16.9A7 7 0 1 1 15.5 8M18.4 3.2v6h-6', 3.6)}</g>` },
    { id: 'moves', name: 'Zetten op maat', label: 'Moves', tone: 'green', price: 10, promise: 'Precies de zetten die je tekortkomt', glyph: glyph('M12 5.800v10.400M6.800 11h10.400', 3.300) },
    { id: 'rewind', name: 'Terugspoelen', label: 'Rewind', tone: 'cyan', price: 0, promise: 'Terug naar de laatste stand die nog kan', glyph: glyph('M11.600 6.300 6.800 11l4.800 4.700M17.200 6.300 12.400 11l4.800 4.700', 2.600) },
  ];
  const perk = (id: string): Perk => PERKS.find((p) => p.id === id)!;

  const chip = (p: Perk, state: PerkState, priceText?: string, compact = false): string => {
    if (state === 'idle') return `<span class="tf-perk-chip tf-perk-idle">${compact ? '–' : 'niet nodig'}</span>`;
    if (state === 'used') return `<span class="tf-perk-chip tf-perk-done">${tick}</span>`;
    if (p.price === 0) return '<span class="tf-perk-chip tf-perk-free">gratis</span>';
    return `<span class="tf-perk-chip">${coin(13)}${priceText ?? p.price}</span>`;
  };
  const STATE_TEXT: Record<PerkState, string> = { available: '', poor: ', te weinig munten', idle: ', nu niet nodig', used: ', gebruikt', armed: ', gekozen' };
  /** A perk button in the existing family: .tf-btn carries shape and press, .tf-perk-btn the tone and the chip. */
  const perkButton = (p: Perk, s: Size, state: PerkState, compact = false, priceText?: string): string => {
    const off = state === 'idle' || state === 'used';
    const classes = ['tf-btn', 'tf-perk-btn', `tf-perk-${p.tone}`, compact ? 'tf-perk-compact' : '', state === 'poor' ? 'tf-perk-poor' : '', state === 'armed' ? 'tf-perk-armed pressed' : ''].filter(Boolean).join(' ');
    const price = p.price === 0 ? 'gratis' : `${priceText ?? p.price} munten`;
    return `<button type="button" class="${classes}" style="--w:${s.width}px;--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${parts.buttons.pressFraction}" aria-label="${p.label}, ${price}${STATE_TEXT[state]}"${off ? ' disabled' : ''}${state === 'poor' ? ' aria-disabled="true"' : ''}><span class="tf-clip"><span class="tf-face">${perkIcon(p.tone, p.glyph)}<span class="tf-label">${p.label}</span></span></span>${chip(p, state, priceText, compact)}</button>`;
  };
  const note = (html: string, title: string, text = ''): string => `<div class="tf-perk-cellnote">${html}<span>${title}${text ? `<small>${text}</small>` : ''}</span></div>`;

  const SHEET: Size = { width: 136, height: 48, depth: 16, radius: 22 };
  const COMPACT: Size = { width: 52, height: 40, depth: 8, radius: 15 };
  const STATES: [PerkState, string, string][] = [
    ['available', 'beschikbaar', 'de solver bewijst dat het helpt'],
    ['poor', 'te weinig munten', 'helpt wel; tik toont je saldo, geen afschrijving'],
    ['idle', 'nu niet nodig', 'geen prijs zichtbaar, geen betaling mogelijk'],
    ['used', 'gebruikt', 'één keer per poging'],
  ];

  const iconCells = PERKS.map((p) =>
    `<div class="tf-perk-icon-cell">${perkIcon(p.tone, p.glyph, 24)}${perkIcon(p.tone, p.glyph, 48)}<span>${p.name}<small>24 en 48 px</small></span></div>` +
    `<div class="tf-perk-icon-cell tf-perk-on-blue">${perkIcon(p.tone, p.glyph, 24)}${perkIcon(p.tone, p.glyph, 48)}<span>${p.name}<small>op bordblauw</small></span></div>`).join('');

  const stateRows = PERKS.filter((p) => p.price > 0).map((p) =>
    STATES.map(([s, title, text]) => note(perkButton(p, SHEET, s, false, p.id === 'moves' ? '10' : undefined), `${p.name} · ${title}`, text)).join('')).join('') +
    note(perkButton(perk('leftturn'), SHEET, 'armed'), 'Linksom · gekozen', 'wacht op de kleur; betaald wordt pas bij de zet') +
    note(perkButton(perk('moves'), SHEET, 'available', false, '18'), 'Zetten op maat · +2', 'prijs volgt het aantal zetten') +
    note(perkButton(perk('moves'), SHEET, 'available', false, '25'), 'Zetten op maat · +3', 'gelijk aan de huidige +3') +
    note(perkButton(perk('rewind'), SHEET, 'available'), 'Terugspoelen', 'altijd gratis, alleen bij een doodlopende stand');
  const compactRows = ['waypoint', 'leftturn'].map((id) => STATES.map(([s, title]) => note(perkButton(perk(id), COMPACT, s, true), title)).join('')).join('');

  // Phone strips. The existing bulb stays the Hint; drawn here as in the buttons card.
  const bulb = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 15.4a5.9 5.9 0 1 1 6.6 0v1.9H8.7z" fill="#f4c62f" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9.9 20.6h4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M12 .9v1.4M4.3 3.6l1 1M19.7 3.6l-1 1M1.4 10.400h1.500M22.600 10.400h-1.500" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  const p = parts.buttons.phone;
  const vars = (s: Size): string => `--w:${s.width}px;--h:${s.height}px;--d:${s.depth}px;--r:${s.radius}px;--press-fraction:${parts.buttons.pressFraction}`;
  const plain = (kind: string, s: Size, inner: string, name: string, extra = ''): string => `<button type="button" class="tf-btn ${kind}" style="${vars(s)}" aria-label="${name}"><span class="tf-clip"><span class="tf-face">${inner}</span></span>${extra}</button>`;
  const stroke = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const svg = (shape: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${shape}</svg>`;
  const turnShape = stroke('M17.1 16.9A7 7 0 1 1 15.5 8', 3.6) + stroke('M18.4 3.2v6h-6', 3.6);
  const utilityRow = `<div class="tf-line">${[
    ['Undo', `<path d="M9.4 4.2 3.6 9.3l5.8 5.1z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>` + stroke('M9 9.3h5.4a5.3 5.3 0 0 1 0 10.6H9.6', 3.5)],
    ['Restart', turnShape],
    ['Replay', '<path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'],
  ].map(([text, shape]) => plain('tf-utility', p.utility, svg(shape) + `<span class="tf-label">${text}</span>`, text)).join('')}</div>`;
  const actionRow = `<div class="tf-line">${(['red', 'blue', 'yellow', 'forward'] as const).map((c) => plain(`tf-action ${c}`, p.action, svg(c === 'forward' ? stroke('M12 20.6V6M5.2 11.4 12 4.6l6.8 6.8', 4) : turnShape), c)).join('')}</div>`;
  const controls = `<div class="tf-controls">${utilityRow}${actionRow}</div>`;
  const wallet = (n: number): string => `<span class="tf-perk-wallet">${coin(18)}${n}</span>`;
  const hintCompact = (price: boolean): string => plain('tf-hint compact', p.hintCompact, bulb + '<span class="tf-label">Hint</span>', 'Hint', price ? `<span class="tf-perk-chip">${coin(13)}10</span>` : '');
  const helpButton = (open: boolean): string => `<button type="button" class="tf-btn tf-hint compact${open ? ' pressed' : ''}" style="${vars(p.hintCompact)}" aria-label="Hulp" aria-expanded="${open}"><span class="tf-clip"><span class="tf-face">${bulb}</span></span></button>`;
  const bar = (right: string): string => `<div class="tf-bar"><span class="tf-pill grow">Level 5</span><span class="tf-pill">0 / 12</span><span class="tf-pill">12 zetten</span>${right}</div>`;
  const item = (icon: string, name: string, text: string, chipHtml: string, off = false): string => `<button type="button" class="tf-perk-item"${off ? ' disabled' : ''}>${icon}<span><b>${name}</b><small>${text}</small></span>${chipHtml}</button>`;
  const hintTile = perkIcon('cyan', '', 30).replace('</svg>', `<g transform="translate(5.400 4) scale(.55)" color="#24314f">${bulb.replace(/<\/?svg[^>]*>/g, '')}</g></svg>`);
  const tray = `<div class="tf-perk-tray"><div class="tf-perk-trayhead">Hulp<span>${coin(14)}42</span></div>
      ${item(hintTile, 'Hint', 'Volgende zet van een oplossing', chip(perk('waypoint'), 'available', '10'))}
      ${item(perkIcon('cyan', perk('waypoint').glyph, 30), 'Waypoint', 'Waar de kudde over 3 zetten staat', chip(perk('waypoint'), 'available'))}
      ${item(perkIcon('purple', perk('leftturn').glyph, 30), 'Left turn', 'Alleen als je vastzit: nu niet nodig', chip(perk('leftturn'), 'idle'), true)}
    </div>`;

  const stripA = `<div class="tf-perk-strip" id="perks-layout-a"><h4>Optie A · hulprij boven de knoppen</h4><div class="tf-phone">
      ${bar(wallet(42))}
      <div class="tf-perk-board tf-perk-short">speelbord</div>
      <div class="tf-perk-row"><span class="tf-perk-rowlabel">Hulp</span>${hintCompact(true)}${perkButton(perk('waypoint'), COMPACT, 'available', true)}${perkButton(perk('leftturn'), COMPACT, 'idle', true)}</div>
      ${controls}</div>
    <p>Altijd zichtbaar: drie compacte knoppen met prijs. Kost het bord ongeveer 56 px hoogte; Hint verhuist uit de bovenbalk, daar komt het muntensaldo.</p></div>`;
  const stripB = `<div class="tf-perk-strip" id="perks-layout-b"><h4>Optie B · één Hulp-knop, lade open (aanbevolen)</h4><div class="tf-phone">
      ${bar(helpButton(true))}
      <div class="tf-perk-board tf-perk-tall">speelbord${tray}</div>
      ${controls}</div>
    <p>Gesloten is het scherm gelijk aan vandaag: geen enkele knop erbij. De lade toont naam, belofte, prijs en saldo, en zegt waarom iets nu niet kan.</p></div>`;
  const stripC = `<div class="tf-perk-strip" id="perks-moments"><h4>Zonder eigen knop · Terugspoelen en Zetten op maat</h4><div class="tf-phone">
      ${bar(helpButton(false))}
      <div class="tf-perk-note"><span>Doodlopend. De laatste stand die nog kan is 3 zetten terug.</span>${perkButton(perk('rewind'), { width: 112, height: 40, depth: 8, radius: 15 }, 'available')}</div>
      <div class="tf-perk-card"><b>Geen zetten meer</b><small>Gecontroleerd: met 1 zet extra is deze stand op te lossen. Je hebt 42 munten.</small>
        <div class="tf-perk-cardrow">${plain('tf-utility', p.utility, svg(turnShape) + '<span class="tf-label">Retry</span>', 'Retry')}${perkButton({ ...perk('moves'), label: '+1 move' }, { width: 128, height: 44, depth: 12, radius: 20 }, 'available', false, '10')}</div></div></div>
    <p>Terugspoelen verschijnt in de hintregel, Zetten op maat op de kaart die er al is. Opnieuw proberen blijft de eerste, gratis keuze.</p></div>`;

  const el = document.createElement('section');
  el.className = 'card wide';
  el.id = 'perks';
  el.innerHTML = `<h2>Perks (voorstel)</h2><p class="dims">Aanbevolen set uit design/perks-proposal.md · knop ${SHEET.width}×${SHEET.height} px, compact ${COMPACT.width}×${COMPACT.height} px · prijzen zijn een voorstel</p>
  <h3 class="btn-title">Iconen · 24 en 48 px</h3>
  <div class="tf-perk-icons" id="perks-icons">${iconCells}</div>
  <h3 class="btn-title">Perk-knop · toestanden</h3>
  <div class="tf-perk-states" id="perks-states">${stateRows}</div>
  <h3 class="btn-title">Compact (telefoon, alleen icoon en prijs)</h3>
  <div class="tf-perk-states tf-perk-compact-states" id="perks-states-compact">${compactRows}</div>
  <h3 class="btn-title">Plaats op het puzzelscherm · telefoon ${p.stripWidth} px</h3>
  <div class="tf-perk-strips" id="perks-phone">${stripA}${stripB}${stripC}</div>
  <p class="note">Alleen mock-ups: geen van deze perks zit in de game. Tonen: hint-cyaan voor informatie, booster-paars voor de regelbuiger, plus-groen voor zetten, munt-goud voor de prijs. Linksom verandert de kernregel (altijd rechtsom) voor één zet en wacht op een besluit van de eigenaar.</p>`;
  document.getElementById('sheet')!.appendChild(el);
}

document.body.dataset.ready = 'true';
