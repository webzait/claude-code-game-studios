import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import hintIcon from '../../assets/turnflock/ui/hint.webp';
import { boardPixels, buildExit, buildFloorTile, buildObstacle, buildRim, buildRimCorner, buildRimEdge, buildUnderlay, rimLayout } from '../render/parts/board';
import { buildFlockbot } from '../render/parts/flockbot';
import '../ui/tf-buttons.css';
import '../ui/tf-coins.css';
import '../ui/tf-levels.css';
import '../ui/tf-end.css';
import '../ui/tf-settings.css';
import '../ui/tf-scene.css';
import './parts.css';
import decorBushLarge from '../../assets/turnflock/decor/decor-bush-large.webp';
import decorBushSmall from '../../assets/turnflock/decor/decor-bush-small.webp';
import decorTuftClover from '../../assets/turnflock/decor/decor-tuft-clover.webp';
import decorSprigTop from '../../assets/turnflock/decor/decor-sprig-top.webp';
import { addCoinCards } from './coins';
import coinIcon from '../../assets/turnflock/ui/coin.webp';
import extraMovesIcon from '../../assets/turnflock/ui/extra-moves.webp';
import { addSettingsCards } from './settings';

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
  quarter: { label: 'Driekwart', dir: new THREE.Vector3(-0.55, 0.62, 1) },
  tilt: { label: `Bijna recht van boven (spelcamera, ${CONFIG.board.roomy.tilt}°)`, dir: new THREE.Vector3(0, 1, Math.tan((CONFIG.board.roomy.tilt * Math.PI) / 180)) },
  drawing: { label: '', dir: new THREE.Vector3(0, 0.6, 1) },
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
/** Small-size check for a Flockbot card: the bot as seen on the board (from above, tilted), at the widths it gets in the game, once per heading. */
function smallPreviews(id: string, color: Color): void {
  const row = document.createElement('div');
  row.className = 'bot-small';
  const boardView = VIEWS.main.dir.clone();
  VIEWS.main.dir.set(0, 1, 0.5);
  // One picture per heading, shown at both widths.
  const shots = [0, 1, 2, 3].map((heading) => {
    const bot = buildFlockbot(color);
    bot.symbol.rotation.y = (-heading * Math.PI) / 2;
    return snapshot(bot.root, 'main', 0.56, new THREE.Vector3(0, 0.5, 0), 0);
  });
  for (const width of [46, 42]) {
    for (const shot of shots) {
      // Scale down on a 2D canvas to three times the shown width, as a phone screen would show it.
      const small = document.createElement('canvas');
      small.width = small.height = width * 3;
      const ctx = small.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(shot, 0, 0, small.width, small.height);
      small.style.width = small.style.height = `${width}px`;
      row.appendChild(small);
    }
    row.insertAdjacentHTML('beforeend', `<span>${width} px</span><i></i>`);
  }
  VIEWS.main.dir.copy(boardView);
  document.getElementById(id)!.querySelector('.views')!.insertAdjacentElement('afterend', row);
}

for (const color of ['red', 'blue', 'yellow'] as const) {
  card(NAMES[color], `bot-${color}`, buildFlockbot(color).root, 'Bovenschaal met symbool · gezichtsmodule · romp · 4 pootjes. Het symbool draait mee met de richting.');
  smallPreviews(`bot-${color}`, color);
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

card('Obstakelblok', 'obstacle', buildObstacle(), 'Dicht afgerond blok: lichte bovenkant met verzonken plaat, donkere zijkanten, vier ronde noppen in de eigen kleur.');
card('Groene uitgang (doel)', 'exit', buildExit(), 'Tegelhoog groen vak (robots rijden erop) met afgeronde opstaande rand, helder verdiept vlak, dik rond vinkje in reliëf en een zachte gloed eromheen.');
// The exit among its neighbours, seen as the game camera sees it: almost straight
// from above, with a robot on the next cell, large and at the smallest cell size.
{
  const view = parts.exit.fieldView;
  const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
  const field = new THREE.Group();
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
    const tile = x === 0 && z === 0 ? buildExit() : buildFloorTile((x + z) % 2 !== 0, false);
    tile.position.set(x * pitch, 0, z * pitch);
    field.add(tile);
  }
  const neighbours: [number, number, Color][] = [[-1, 0, 'blue'], [0, 1, 'yellow']];
  for (const [x, z, color] of neighbours) {
    const bot = buildFlockbot(color);
    bot.root.scale.setScalar(CONFIG.board.grid.robotFill);
    bot.root.position.set(x * pitch, parts.floorTile.height, z * pitch);
    field.add(bot.root);
  }
  field.rotation.x = THREE.MathUtils.degToRad(view.tilt);
  const reach = 1.5 * pitch;
  const holder = document.querySelector('#exit .views')!;
  const shot = snapshot(field, 'top', reach, new THREE.Vector3(0, parts.floorTile.height, 0), -1);
  const large = document.createElement('figure');
  large.className = 'main';
  large.id = 'exit-field';
  large.appendChild(shot);
  large.insertAdjacentHTML('beforeend', '<figcaption>In het veld, bijna recht van boven (spelcamera), met robots op de buurvakken</figcaption>');
  const small = document.createElement('figure');
  small.className = 'main';
  small.id = 'exit-field-small';
  const tiny = document.createElement('canvas');
  // The picture spans 2 × reach × 1.12 cells; scale it so one cell is `cellPx` CSS pixels (drawn at 3× for sharp phones).
  const cssSize = Math.round(2 * reach * 1.12 * view.cellPx);
  tiny.width = tiny.height = cssSize * 3;
  tiny.style.width = tiny.style.height = `${cssSize}px`;
  tiny.style.margin = '0 auto';
  const pen = tiny.getContext('2d')!;
  pen.imageSmoothingQuality = 'high';
  pen.drawImage(shot, 0, 0, tiny.width, tiny.height);
  small.appendChild(tiny);
  small.insertAdjacentHTML('beforeend', `<figcaption>Hetzelfde op ware grootte bij een vak van ${view.cellPx} px</figcaption>`);
  holder.append(large, small);
}
card('Vloertegel', 'floor', buildFloorTile(), 'Eén herhaalbare tegel: heldere bovenkant, zichtbare afgeronde rand, iets donkerdere zijkant, vier pennen aan de onderkant.');
card('Vloertegel (tweede tint)', 'floor-alt', buildFloorTile(true), 'Dezelfde tegel in de tweede, subtiel afwijkende tint voor het dambordpatroon.', ['main', 'top']);
card('Randstuk (recht)', 'rim-edge', buildRimEdge(1, true), 'Eén stuk per vak langs elke zijde; 0°, 90°, 180° of 270° gedraaid. Lichte binnenrand, dunne gloedlijn, donkere schuine buitenkant.');
card('Hoekstuk', 'rim-corner', buildRimCorner(true), 'Kwartboog met dezelfde doorsnede als het rechte stuk; dezelfde vorm op alle vier de hoeken.');
card('Onderplaat', 'underlay', buildUnderlay(6, 6, CONFIG.board.grid.gap, true), 'Eén bak onder het hele bord met een lage opstaande rand en één pen per tegel; breedte en diepte volgen het raster (hier 6×6).', ['main', 'top']);

/** An empty board from the modules alone: underlay, rim and tiles. */
function emptyBoard(cols: number, rows: number): THREE.Group {
  const gap = CONFIG.board.grid.gap;
  const pitch = parts.floorTile.size + gap;
  const board = new THREE.Group();
  board.add(buildUnderlay(cols, rows, gap), buildRim(cols, rows, gap));
  for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
    const tile = buildFloorTile((x + z) % 2 === 1, false);
    tile.position.set((x - (cols - 1) / 2) * pitch, 0, (z - (rows - 1) / 2) * pitch);
    board.add(tile);
  }
  return board;
}

// Empty boards at several sizes: the same modules repeated, never stretched.
const PHONE = 390;
for (const [cols, rows] of [[5, 5], [6, 6], [8, 8], [4, 7]] as const) {
  const px = boardPixels(cols, rows, CONFIG.board.grid.gap, PHONE - 2 * CONFIG.camera.marginX);
  const one = (n: number): string => n.toFixed(1);
  const count = `${cols * rows} tegels · ${2 * (cols + rows)} randstukken · 4 hoekstukken · 1 onderplaat`;
  const phone = `Op een telefoon van ${PHONE} px breed: bord ${one(px.width)} × ${one(px.height)} px, tegel ${one(px.tile)} px, voeg ${one(px.gap)} px, rand ${one(px.frame)} px.`;
  card(`Leeg bord ${cols}×${rows}`, `board-${cols}x${rows}`, emptyBoard(cols, rows), `${count}. ${phone}`, ['top', 'quarter', 'tilt'], true);
}

// Exploded board, laid out like the assembly drawing: rim pieces pulled outward, tiles lifted off the underlay.
{
  const gap = CONFIG.board.grid.gap;
  const pitch = parts.floorTile.size + gap;
  const exploded = new THREE.Group();
  const lifted = new THREE.Group();
  exploded.add(buildUnderlay(6, 6, gap, true), lifted);
  lifted.position.y = 5;
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) {
    const tile = buildFloorTile((x + z) % 2 === 1, true);
    tile.position.set((x - 2.5) * pitch * 1.07, 0, (z - 2.5) * pitch * 1.07);
    lifted.add(tile);
  }
  for (const place of rimLayout(6, 6, gap)) {
    const piece = place.kind === 'edge' ? buildRimEdge(place.length, true) : buildRimCorner(true);
    const corner = place.kind === 'corner';
    // Straight pieces move straight out from their side, corners diagonally, and each keeps a little air to its neighbour.
    const out = new THREE.Vector3(corner ? Math.sign(place.x) : Math.round(Math.sin(place.turn)), 0, corner ? Math.sign(place.z) : Math.round(Math.cos(place.turn)));
    const along = corner ? new THREE.Vector3() : new THREE.Vector3(place.x * Math.abs(out.z), 0, place.z * Math.abs(out.x)).multiplyScalar(0.07);
    piece.position.set(place.x, 0, place.z).addScaledVector(out, corner ? 0.75 : 0.9).add(along);
    piece.rotation.y = place.turn;
    lifted.add(piece);
  }
  // The lifted parts float: their shadows on the underlay would only confuse the picture.
  lifted.traverse((n) => {
    n.castShadow = false;
  });
  card('Bordopbouw uit elkaar (6×6)', 'board-exploded', exploded, 'Zoals de bouwtekening: hoekstukken en randstukken boven, tegels met pennen in het midden, onderplaat met opstaande rand onder.', ['drawing', 'quarter'], true);
}

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

// Backdrop: the sunny harbour in layers, shown in phone frames with grey blocks where the game's zones are.
{
  const scene = '<div class="tf-bg-scene"><i class="tf-bg-glint tf-bg-far"></i><i class="tf-bg-glint tf-bg-mid"></i><i class="tf-bg-glint tf-bg-near"></i><i class="tf-bg-quay tf-bg-left"></i><i class="tf-bg-quay tf-bg-right"></i></div>';
  const ui = (board: boolean): string => `<div class="tf-bg-ui"><div class="tf-bg-top"><i></i><i></i><i></i></div><div class="tf-bg-play">${board ? '<i></i>' : ''}</div><div class="tf-bg-controls"><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i><i></i></div></div></div>`;
  /** One phone frame at its real size in CSS pixels. `inner` goes on top of the backdrop. */
  const phone = (id: string, w: number, h: number, inner: string, label: string, variant = ''): string =>
    `<figure class="tf-bg-shot"><div class="tf-bg-phone" id="${id}" style="width:${w}px;height:${h}px"><div class="tf-bg ${variant}">${scene}</div>${inner}</div><figcaption>${label}</figcaption></figure>`;
  const SCREENS: [number, number][] = [[320, 568], [353, 768], [390, 844], [430, 932], [768, 1024]];
  const add = (id: string, title: string, dims: string, body: string, note: string): HTMLElement => {
    const el = document.createElement('section');
    el.className = 'card wide';
    el.id = id;
    el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p>${body}<p class="note">${note}</p>`;
    document.getElementById('sheet')!.appendChild(el);
    return el;
  };
  const row = (prefix: string, inner: string): string => `<div class="tf-bg-row">${SCREENS.map(([w, h]) => phone(`${prefix}-${w}`, w, h, inner, `${w} × ${h}`)).join('')}</div>`;

  add('bg-zones', 'Achtergrond · zonnige haven met schermzones', 'grijze blokken: bovenbalk 96 px · bord tot 366 px · knoppen 180 px', row('bg-zones', ui(true)),
    'De horizon ligt op 22% van de hoogte: in de strook tussen bovenbalk en bord. Huisjes en kranen staan alleen links en rechts; achter bord en knoppen is het alleen rustig water. Onderhoeken blijven vrij voor de struiken.');
  add('bg-open', 'Achtergrond · bordvlak leeg', 'zelfde schermen, zonder bord', row('bg-open', ui(false)),
    'Zonder bord: het midden is water met zachte glans, zonder voorwerpen.');
  add('bg-layers', 'Achtergrond · lagen', 'lucht en water zijn CSS-kleurverlopen · 3 kleine afbeeldingen uit het origineel', `<div class="tf-bg-row">
    ${phone('bg-layer-all', 390, 844, '', 'alles samen')}
    ${phone('bg-layer-base', 390, 844, '', '1 · lucht, horizon en water (CSS)', 'tf-bg-only-base')}
    ${phone('bg-layer-quays', 390, 844, '', '2 · kades links en rechts', 'tf-bg-only-quays')}
    ${phone('bg-layer-glints', 390, 844, '', '3 · glans op het water', 'tf-bg-only-glints')}
    <figure class="tf-bg-shot"><div class="tf-bg-phone" id="bg-layer-old" style="width:390px;height:844px"><div class="tf-bg-old"></div></div><figcaption>ter vergelijking: de achtergrond van nu</figcaption></figure>
  </div>`, 'De kades zijn uit het originele beeld gesneden, licht onscherp gemaakt en lopen aan de randen doorzichtig uit, zodat ze op elk schermformaat aan de zijkant blijven staan.');
  const motion = add('bg-motion', 'Achtergrond · optie: trage waterglans', 'staat standaard uit · uit bij "minder beweging" in de systeeminstellingen', `<label class="tf-bg-toggle"><input type="checkbox" id="bg-motion-toggle" /> Beweging aan</label><div class="tf-bg-row">${phone('bg-motion-390', 390, 844, ui(true), '390 × 844')}</div>`,
    'Alleen de glans op het water schuift en ademt heel langzaam (38 s en 9 s). Alleen CSS, geen extra afbeeldingen.');
  motion.querySelector<HTMLInputElement>('#bg-motion-toggle')!.addEventListener('change', (event) => {
    motion.querySelector('.tf-bg')!.classList.toggle('tf-bg-motion', (event.target as HTMLInputElement).checked);
  });
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

// Coin controls: counter, plus button, price tags, reward and the icon at small sizes.
addCoinCards(document.getElementById('sheet')!);

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

// Level selection screen: the paged grid as a standalone mock-up. Plain HTML and CSS (tf-levels-*),
// with made-up progress; nothing here reads the save or is wired into the game.
{
  type Situation = 'new' | 'mid' | 'all' | 'perfect';
  const TOTAL = 200;
  const PER_PAGE = CONFIG.levelsPerPage;
  const DONE: Record<Situation, number> = { new: 0, mid: 37, all: TOTAL, perfect: TOTAL };
  const SITUATIONS: [Situation, string][] = [['new', 'Nieuwe speler'], ['mid', 'Halverwege · 37 van 200'], ['all', 'Alles uitgespeeld'], ['perfect', 'Alles met drie sterren']];
  /** Made-up but fixed star results, so every screenshot shows the same mix. */
  const starsFor = (level: number, s: Situation): number => {
    const h = (level * 7919 + 13) % 10;
    if (s === 'perfect') return 3;
    return s === 'all' ? (h < 9 ? 3 : 2) : h < 6 ? 3 : h < 9 ? 2 : 1;
  };
  type Model = { s: Situation; done: number; target: number; stars: number; label: string };
  const model = (s: Situation): Model => {
    const done = DONE[s];
    let stars = 0;
    let improve = 0;
    for (let i = done; i >= 1; i--) {
      stars += starsFor(i, s);
      if (starsFor(i, s) < 3) improve = i;
    }
    // Everything played: point at the first level without three stars; with nothing left to improve, start over.
    const target = done < TOTAL ? done + 1 : improve || 1;
    return { s, done, target, stars, label: done < TOTAL ? `Play level ${target}` : improve ? `Improve level ${target}` : 'Play again' };
  };

  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/></svg>';
  const gearIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="8" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
  const chevron = (d: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /** A button from the existing family (tf-btn), sized through its custom properties. */
  const famButton = (kind: string, size: string, inner: string, name: string, disabled = false): string =>
    `<button type="button" class="tf-btn ${kind}" style="${size}" aria-label="${name}"${disabled ? ' disabled' : ''}><span class="tf-clip"><span class="tf-face">${inner}</span></span></button>`;
  const SMALL = '--w:46px;--h:40px;--d:6px;--r:15px';

  /** One level tile. `extra` adds a class, only to fix a look on the sheet. */
  const tile = (level: number, m: Model, extra = ''): string => {
    if (level > m.done + 1) return `<button type="button" class="tf-levels-tile is-locked ${extra}" aria-label="Level ${level}, locked" disabled>${level}<span class="tf-levels-mark"></span></button>`;
    if (level === m.done + 1) return `<button type="button" class="tf-levels-tile is-next ${extra}" aria-label="Level ${level}, play next" aria-current="true">${level}<span class="tf-levels-mark"></span></button>`;
    const n = starsFor(level, m.s);
    const again = m.done === TOTAL && level === m.target ? ' is-target' : '';
    return `<button type="button" class="tf-levels-tile s${n}${again} ${extra}" aria-label="Level ${level}, ${n} of 3 stars"${again ? ' aria-current="true"' : ''}>${level}<span class="tf-levels-stars"></span></button>`;
  };

  const head = (m: Model): string => `<header class="tf-levels-head">
      <h3 class="tf-levels-title">TURNFLOCK</h3>
      <span class="tf-levels-pill" aria-label="Coins"><i class="tf-levels-coin"></i>${m.s === 'new' ? 30 : m.s === 'mid' ? 485 : m.s === 'all' ? 2640 : 3120}</span>
      <span class="tf-levels-pill tf-levels-progress" aria-label="${m.done} of ${TOTAL} levels, ${m.stars} of ${TOTAL * 3} stars"><span>${m.done}<small>/ ${TOTAL}</small></span><span><i class="tf-levels-star"></i>${m.stars}</span></span>
      ${famButton('tf-utility', SMALL, gearIcon, 'Settings')}
    </header>`;
  const play = (m: Model): string => famButton('tf-action tf-levels-play', '--w:100%;--h:var(--tl-play-h);--d:var(--tl-play-d);--r:22px', `${playIcon}<span class="tf-label">${m.label}</span>`, m.label);
  const phoneOpen = (kind: string, id: string, w: number, h: number): string => `<div class="tf-levels-phone tf-levels-${kind}" id="${id}" style="width:${w}px;height:${h}px">`;

  /** A: one page of 20 at a time, pager in the dock. `perPage` only differs on wide screens (5×4 is still 20). */
  const optionA = (s: Situation, id: string, w = 390, h = 844): string => {
    const m = model(s);
    const pages = Math.ceil(TOTAL / PER_PAGE);
    const page = Math.floor((m.target - 1) / PER_PAGE);
    const first = page * PER_PAGE + 1;
    let tiles = '';
    for (let i = first; i < first + PER_PAGE && i <= TOTAL; i++) tiles += tile(i, m);
    const dots = Array.from({ length: pages }, (_, p) => `<i class="${p === page ? 'on' : (p + 1) * PER_PAGE <= m.done ? 'full' : ''}"></i>`).join('');
    return `${phoneOpen('a', id, w, h)}${head(m)}
      <div class="tf-levels-body"><div class="tf-levels-tray"><div class="tf-levels-grid">${tiles}</div></div></div>
      <footer class="tf-levels-dock">
        <div class="tf-levels-pager">${famButton('tf-utility', SMALL, chevron('M15 5l-7 7 7 7'), 'Previous levels', page === 0)}
          <div class="tf-levels-pageinfo" aria-label="Page ${page + 1} of ${pages}"><span>Levels ${first}–${Math.min(first + PER_PAGE - 1, TOTAL)}</span><span class="tf-levels-dots">${dots}</span></div>
          ${famButton('tf-utility', SMALL, chevron('M9 5l7 7-7 7'), 'Next levels', page === pages - 1)}</div>
        ${play(m)}
      </footer></div>`;
  };

  const fig = (html: string, caption: string): string => `<figure class="tf-levels-fig">${html}<figcaption>${caption}</figcaption></figure>`;
  const sheet = document.getElementById('sheet')!;
  const add = (id: string, title: string, dims: string, body: string, note: string): void => {
    const el = document.createElement('section');
    el.className = 'card wide';
    el.id = id;
    el.innerHTML = `<h2>${title}</h2><p class="dims">${dims}</p>${body}<p class="note">${note}</p>`;
    sheet.appendChild(el);
  };

  // The tile on its own, in every state, plus the optional touches.
  {
    const mid = model('mid');
    const states = [
      fig(tile(200, mid), 'op slot'),
      fig(tile(38, mid), 'open · volgende'),
      fig(tile(4, mid), '1 ster'),
      fig(tile(16, mid), '2 sterren'),
      fig(tile(128, { ...mid, done: 200 }), '3 sterren'),
      fig(tile(16, mid, 'is-pressed'), 'ingedrukt'),
      fig(tile(7, mid, 'is-focus'), 'toetsenbordfocus'),
      fig(tile(4, { ...mid, done: TOTAL, target: 4 }), 'nog te verbeteren'),
    ].join('');
    const digits = [fig(tile(7, mid), '1 cijfer'), fig(tile(64, { ...mid, done: 200 }), '2 cijfers'), fig(tile(200, { ...mid, done: 200, s: 'all' }), '3 cijfers'), fig(tile(138, { ...mid, done: 137 }), '3 cijfers · open'), fig(tile(199, mid), '3 cijfers · slot')].join('');
    add('levels-tiles', 'Levelscherm · de leveltegel', 'minimaal 56×56 px · wand 5 px · getal 23–34 px, vet · sterren 46×17 px',
      `<h3 class="btn-title">Toestanden</h3><div class="tf-levels-strip" id="levels-tile-states">${states}</div>
       <h3 class="btn-title">Leesbaarheid · 1 tot 3 cijfers op de smalste maat (56 px)</h3><div class="tf-levels-strip" id="levels-tile-digits" style="--tl-tile-h:56px">${digits.replaceAll('class="tf-levels-tile', 'style="width:56px" class="tf-levels-tile')}</div>`,
      'Echte <code>&lt;button&gt;</code>-elementen met tekst als getal. Een tegel is een laag kussen met een echte zijwand, uit dezelfde familie als de knoppen; drie sterren krijgt een gouden wand, de volgende tegel is uitgang-groen met een witte ring, en een tegel op slot is een lege uitsparing in de bak. Geen vervaging of filters per tegel, zodat 200 tegels soepel scrollen.');
  }

  add('levels-a', 'Levelscherm · raster per pagina', '20 levels per pagina · 4×5 · bladeren onderin',
    `<div class="tf-levels-row">${SITUATIONS.map(([s, name]) => fig(optionA(s, `levels-a-${s}`), name)).join('')}</div>`,
    'Eén pagina van 20 past altijd zonder scrollen. Het scherm opent op de pagina van het level waar de hoofdknop naar wijst; bladeren en spelen zitten allebei onderin, binnen duimbereik. De stippen tonen 10 pagina’s: goud is helemaal uitgespeeld. Is alles uitgespeeld, dan wijst de knop naar het eerste level zonder drie sterren; heeft alles drie sterren, dan begint hij opnieuw bij level 1.');
  const SIZES: [number, number][] = [[320, 568], [390, 844], [430, 932], [768, 1024]];
  add('levels-sizes', 'Levelscherm · vier schermmaten', SIZES.map(([w, h]) => `${w}×${h}`).join(' · '),
    `<div class="tf-levels-row">${SIZES.map(([w, h]) => fig(optionA('mid', `levels-a-${w}`, w, h), `${w}×${h}`)).join('')}</div>`,
    'De tegelhoogte volgt de schermhoogte; op een tablet wordt het 5×4. Kopregel en dok worden op lage schermen iets platter.');
}

// End-of-round pop-up: plain HTML and CSS (tf-end-*) in a phone frame over a stand-in for the board.
// A mock-up of every situation; the game builds the same card in src/ui/endCard.ts from the shared styles (src/ui/tf-end.css).
{
  const STAR = 'M32 8 38.6 23.2 55 24.7 42.6 35.6 46.2 51.7 32 43.2 17.8 51.7 21.4 35.6 9 24.7 25.4 23.2Z';
  const starPath = (fill: string, width: number, extra = ''): string => `<path d="${STAR}" fill="${fill}" stroke="${fill}" stroke-width="${width}" stroke-linejoin="round" ${extra}/>`;
  /** The star: a gold block with a darker wall under it when earned, a sunk slot in the panel tones when not. */
  const star = (on: boolean, extra = ''): string => `<svg class="tf-end-star ${on ? 'on' : 'off'}" viewBox="0 0 64 64" aria-hidden="true" ${extra}>${
    on
      ? starPath('#C9961A', 10, 'transform="translate(0 3.5)"') + starPath('#C9961A', 10) + starPath('url(#tf-end-gold)', 6.5) + starPath('#FFE48A', 5, 'transform="translate(32 29.5) scale(.46) translate(-32 -31)"') + '<path d="M16.5 24.6c3.4-.9 6.6-1.3 9.6-1.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".85"/>'
      : starPath('#C9D2E3', 11) + starPath('#E6EBF5', 5, 'transform="translate(0 2.2)"')
  }</svg>`;
  const defs = '<svg class="tf-end-defs" aria-hidden="true"><defs><linearGradient id="tf-end-gold" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="56"><stop offset="0" stop-color="#FFE48A"/><stop offset=".45" stop-color="#F6C542"/><stop offset="1" stop-color="#EDB52C"/></linearGradient></defs></svg>';

  const icon = (shape: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><g class="tf-ink-shadow" transform="translate(0 1.3)">${shape}</g><g>${shape}</g></svg>`;
  const stroke = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ICONS = {
    undo: icon(`<path d="M9.4 4.2 3.6 9.3l5.8 5.1z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>` + stroke('M9 9.3h5.4a5.3 5.3 0 0 1 0 10.6H9.6', 3.5)),
    retry: icon(stroke('M17.1 16.9A7 7 0 1 1 15.5 8', 3.5) + stroke('M18.4 3.2v6h-6', 3.5)),
    replay: icon('<path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'),
    next: icon(stroke('M4.5 12h13.5M12.4 5.4 19 12l-6.6 6.6', 3.8)),
    levels: icon('<rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/>'),
    none: '',
  };
  /** One button of the tf-btn family. `after` puts the icon behind the label (Next). */
  const button = (kind: string, text: string, glyph: keyof typeof ICONS, opts: { name?: string; disabled?: boolean; after?: boolean; inner?: string } = {}): string => {
    const label = `<span class="tf-label">${text}</span>`;
    const inner = opts.inner ?? (opts.after ? label + ICONS[glyph] : ICONS[glyph] + label);
    return `<button type="button" class="tf-btn ${kind}"${opts.name ? ` aria-label="${opts.name}"` : ''}${opts.disabled ? ' disabled' : ''}><span class="tf-clip"><span class="tf-face">${inner}</span></span></button>`;
  };
  const utility = (text: string, glyph: keyof typeof ICONS, size = 'tf-end-small'): string => button(`tf-utility ${size}`, text, glyph);

  // The stand-in board: a 6x6 plate with walls, the exit and whoever is still on it.
  const WALLS = new Set([7, 9, 22, 24, 32]);
  const scene = (level: string, left: Record<number, string>, moves: string, even = false): string => {
    let tiles = '';
    for (let i = 0; i < 36; i++) tiles += `<i class="${i === 5 ? 'exit' : WALLS.has(i) ? 'wall' : (left[i] ?? ((i + Math.floor(i / 6)) % 2 ? 'alt' : ''))}"></i>`;
    const count = Object.keys(left).length;
    return `<div class="tf-end-scene" aria-hidden="true"><div class="bar"><span>${level}</span><span>${12 - count} / 12</span><span>${moves}</span></div><div class="plate">${tiles}</div><div class="pad"><i></i><i></i><i></i><i></i></div></div><div class="tf-end-dim${even ? ' even' : ''}"></div>`;
  };
  const STUCK = { 14: 'red', 20: 'blue', 27: 'yellow' };

  let serial = 0;
  type Layout = 'sheet' | 'centre';
  /** The dialog itself. Reading order is title, result, then actions; the stars are only drawn above the title. */
  const dialog = (layout: Layout, body: (id: string) => string): string => {
    const id = `tf-end-${++serial}`;
    return `<section class="tf-end-card ${layout}" role="dialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-r">${body(id)}</section>`;
  };
  const phone = (sceneHtml: string, card: string, cls = ''): string => `<div class="tf-end-phone ${cls}">${sceneHtml}${card}</div>`;

  const FLECKS = ['#F1454B', '#2E84F1', '#F4C62F', '#39E85C', '#7E6BFF', '#FFE48A'];
  const confetti = (): string => {
    let out = '';
    for (let i = 0; i < 16; i++) {
      const angle = Math.PI * (1.08 + (0.84 * i) / 15);
      const reach = 92 + ((i * 37) % 60);
      out += `<i style="--c:${FLECKS[i % FLECKS.length]};--x:${Math.round(Math.cos(angle) * reach * 1.25)}px;--y:${Math.round(Math.sin(angle) * reach + 46)}px;--r:${(i % 2 ? 1 : -1) * (160 + i * 23)}deg;--dl:${((i * 53) % 220) / 1000}s"></i>`;
    }
    return `<div class="tf-end-confetti" aria-hidden="true">${out}</div>`;
  };

  type Win = { level: string; stars: 1 | 2 | 3; moves: number; par: number; backup?: boolean; earned: number; total: number; parts?: string; paidNote?: string; last?: boolean };
  const win = (layout: Layout, w: Win, live = false): string =>
    phone(
      scene(w.level, {}, `${w.moves} moves`, layout === 'centre'),
      dialog(layout, (id) => {
        const result = w.backup ? `<b>${w.moves} moves</b> · with extra moves` : w.moves <= w.par ? `<b>${w.moves} moves</b> · the shortest solution` : `<b>${w.moves} moves</b> · shortest is ${w.par}`;
        const coins = w.earned > 0
          ? `<p class="tf-end-earned"><img src="${coinIcon}" alt="" /><span class="tf-end-sr">Coins earned: </span><b class="tf-end-count" data-to="${w.earned}">+${w.earned}</b><span class="tf-end-total">${w.total} in total</span></p>${w.parts ? `<p class="tf-end-break">${w.parts}</p>` : ''}`
          : `<p class="tf-end-earned none"><img src="${coinIcon}" alt="" /><span class="tf-end-total">${w.paidNote ?? ''} ${w.total} in total.</span></p>`;
        const actions = w.last
          ? `${button('tf-end-main tf-end-big wide', 'Levels', 'levels')}<div class="wide">${utility('Replay', 'replay')}</div>`
          : `${button('tf-end-go tf-end-big wide', 'Next', 'next', { after: true })}${utility('Replay', 'replay')}${utility('Levels', 'levels')}`;
        return `${live ? confetti() : ''}<div class="tf-end-head"><p class="tf-end-level">${w.level}</p><h3 class="tf-end-title" id="${id}-t">${w.last ? 'All home, all done' : 'All home'}</h3></div>
          <div class="tf-end-stars" role="img" aria-label="${w.stars} of 3 stars">${[0, 1, 2].map((i) => `<span class="tf-end-slot${i < w.stars ? ' won' : ''}" style="--i:${i}">${star(false)}${i < w.stars ? star(true) : ''}</span>`).join('')}</div>
          <p class="tf-end-result" id="${id}-r">${result}${w.backup ? '<br />One star when extra moves are used.' : ''}${w.last ? '<br />That was the last level.' : ''}</p>
          <div class="tf-end-coins">${coins}</div>
          <div class="tf-end-actions">${actions}</div>`;
      }),
      live ? 'tf-end-live' : '',
    );

  type Lost = { level?: string; offer?: 'afford' | 'short'; coins?: number; note?: string };
  const lost = (l: Lost, layout: Layout = 'sheet'): string =>
    phone(
      scene(l.level ?? 'Level 5 · Queue Up', STUCK, '0 moves', layout === 'centre'),
      dialog(layout, (id) => {
        const offer = l.offer
          ? `<div class="tf-end-offer"><img src="${extraMovesIcon}" alt="" /><div><strong>+3 moves</strong><span class="why">Checked: 3 more moves are enough from here.</span></div>
              ${button('tf-end-buy tf-end-small', '25', 'none', { name: l.offer === 'afford' ? 'Get 3 more moves for 25 coins' : 'Get 3 more moves for 25 coins (not enough coins)', disabled: l.offer === 'short', inner: `<img src="${coinIcon}" alt="" /><span class="tf-label">25</span>` })}
              <p class="tf-end-wallet">${l.offer === 'afford' ? `You have <b>${l.coins} coins</b>.` : `You have <b>${l.coins} coins</b>, so this is not available now.`}</p></div>`
          : '';
        return `<div class="tf-end-head"><h3 class="tf-end-title" id="${id}-t">Out of moves</h3></div>
          <p class="tf-end-result" id="${id}-r"><span class="tf-end-left" aria-hidden="true"><i style="--c:#F1454B"></i><i style="--c:#2E84F1"></i><i style="--c:#F4C62F"></i></span>3 still on the board</p>
          ${offer}${l.note ? `<p class="tf-end-note">${l.note}</p>` : ''}
          <div class="tf-end-actions lead">${utility('Undo', 'undo', 'tf-end-mid')}${button('tf-end-main tf-end-mid', 'Retry', 'retry')}</div>`;
      }),
    );

  /** The two plain cards of the test lab. */
  const info = (title: string, text: string, second: string): string =>
    phone(
      scene('Test board 8×8', {}, 'Test'),
      dialog('sheet', (id) => `<span class="tf-end-tag">Test lab</span><div class="tf-end-head"><h3 class="tf-end-title" id="${id}-t">${title}</h3></div><p class="tf-end-note" id="${id}-r">${text}</p>
        <div class="tf-end-actions lead">${utility(second, 'none', 'tf-end-mid')}${button('tf-end-main tf-end-mid', 'Levels', 'levels')}</div>`),
    );

  const cell = (id: string, html: string, caption: string, extra = ''): string => `<figure class="tf-end-cell" id="${id}">${html}<figcaption>${caption}</figcaption>${extra}</figure>`;
  const LEVEL = 'Level 5 · Queue Up';
  const three: Win = { level: LEVEL, stars: 3, moves: 8, par: 8, earned: 32, total: 142, parts: 'Win 10 · 4 spare moves 12 · Shortest solution 10' };
  const two: Win = { level: LEVEL, stars: 2, moves: 10, par: 8, earned: 16, total: 126, parts: 'Win 10 · 2 spare moves 6' };
  const one: Win = { level: LEVEL, stars: 1, moves: 12, par: 8, earned: 10, total: 120, parts: 'Win 10' };
  const sizes = [24, 32, 44, 64];

  const el = document.createElement('section');
  el.className = 'card wide';
  el.id = 'endpopup';
  el.innerHTML = `${defs}<h2>Eind-pop-up</h2><p class="dims">telefoonkader 390×844 px · echte HTML en CSS · de game gebruikt dezelfde stijlen</p>
  <h3 class="tf-end-group">De ster · gevuld en leeg, op 24, 32, 44 en 64 px</h3>
  <div class="tf-end-row" id="endpopup-stars">
    <div class="tf-end-starsheet">${sizes.map((s) => `<div>${star(true, `style="width:${s}px;height:${s}px"`)}<span>${s} px</span></div>`).join('')}${sizes.map((s) => `<div>${star(false, `style="width:${s}px;height:${s}px"`)}<span>${s} px</span></div>`).join('')}</div>
    <div class="tf-end-starsheet dark">${sizes.map((s) => `<div>${star(true, `style="width:${s}px;height:${s}px"`)}<span>${s} px</span></div>`).join('')}${sizes.map((s) => `<div>${star(false, `style="width:${s}px;height:${s}px"`)}<span>${s} px</span></div>`).join('')}</div>
  </div>
  <h3 class="tf-end-group">Winst · twee indelingen</h3>
  <div class="tf-end-row">
    ${cell('endpopup-win-live', win('sheet', three, true), '<b>B · blad onderaan (aanbevolen), live.</b> De animatie speelt één keer zodra dit kader in beeld komt; de knoppen zijn vanaf het eerste beeld te gebruiken.', '<button type="button" class="tf-end-again">Animatie opnieuw afspelen</button>')}
    ${cell('endpopup-win-sheet', win('sheet', three), '<b>B · blad onderaan, eindstand.</b> Het opgeloste bord blijft zichtbaar; alle knoppen liggen in de onderste duimzone.')}
    ${cell('endpopup-win-centre', win('centre', three), '<b>A · kaart in het midden, eindstand.</b> Meer nadruk op de beloning, maar het bord is bedekt en de knoppen liggen hoger.')}
  </div>
  <h3 class="tf-end-group">Winst · 2 sterren, 1 ster en de varianten</h3>
  <div class="tf-end-row">
    ${cell('endpopup-win-2', win('sheet', two), '2 sterren: binnen twee zetten van de kortste oplossing.')}
    ${cell('endpopup-win-1', win('sheet', one), '1 ster: opgelost, meer dan twee zetten boven de kortste oplossing.')}
    ${cell('endpopup-win-extra', win('sheet', { level: LEVEL, stars: 1, moves: 14, par: 8, backup: true, earned: 10, total: 95, parts: 'Win 10' }), 'Gewonnen met extra zetten: hoogstens één ster, alleen het basisbedrag.')}
    ${cell('endpopup-win-paid', win('sheet', { ...two, earned: 0, total: 142, paidNote: 'No new coins: your best reward for this level is already paid.' }), 'Opnieuw gespeeld, beloning al uitbetaald: geen nieuwe munten, eerlijk gezegd.')}
    ${cell('endpopup-win-topup', win('sheet', { ...three, earned: 16, total: 158, parts: 'Better than before: 16 on top of the 16 already paid' }), 'Opnieuw gespeeld en beter dan eerst: alleen het verschil wordt uitbetaald.')}
    ${cell('endpopup-win-last', win('sheet', { ...three, level: 'Level 40 · The Long Way Round the Very Crowded Corner Garden', last: true }), 'Laatste level: geen "Next"; "Levels" is de hoofdactie. Ook de proef met een lange levelnaam.')}
  </div>
  <h3 class="tf-end-group">Zetten op</h3>
  <div class="tf-end-row">
    ${cell('endpopup-lost-offer', lost({ offer: 'afford', coins: 142 }), '+3 zetten zijn bewezen genoeg en betaalbaar. Prijs staat op de knop; Retry blijft de hoofdactie.')}
    ${cell('endpopup-lost-short', lost({ offer: 'short', coins: 12 }), '+3 zetten zijn bewezen genoeg, maar te duur: de knop staat uit, zonder aandrang en zonder koopaanbod.')}
    ${cell('endpopup-lost-hopeless', lost({ note: 'Extra moves would not solve it from here, so there is no offer. Undo a step or start again: both are free.' }), '+3 zetten zouden niet genoeg zijn: geen betaald aanbod.')}
    ${cell('endpopup-lost-unknown', lost({ note: 'We could not check in time whether extra moves would help, so there is no offer. Undo and Retry are free.' }), 'De controle kwam niet op tijd klaar: dat staat er eerlijk, geen betaald aanbod.')}
  </div>
  <h3 class="tf-end-group">Testlab · twee sobere kaarten</h3>
  <div class="tf-end-row">
    ${cell('endpopup-test-cleared', info('Test board cleared', 'This board only shows how the board scales. Nothing was saved.', 'Again'), 'Testbord opgelost.')}
    ${cell('endpopup-test-unsolvable', info('Not proven solvable', 'With the single-file exit rule this level has no solution in a fair number of moves.', 'Play anyway'), 'Testregel: geen oplossing gevonden.')}
    ${cell('endpopup-test-unfinished', info('Not proven solvable', 'The check for the single-file exit rule could not finish for this level.', 'Play anyway'), 'Testregel: controle niet afgerond.')}
  </div>
  <p class="note">Echte HTML en CSS: cijfers en labels zijn tekst, de knoppen zijn de bestaande <code>tf-btn</code>-blokken met eigen tinten (<code>tf-end-go</code>, <code>tf-end-main</code>, <code>tf-end-buy</code>). De kaart is een <code>role="dialog"</code> en leest als titel, uitslag, acties. Bij <code>prefers-reduced-motion</code> staat alles er in één keer.</p>`;
  document.getElementById('sheet')!.appendChild(el);

  // The live win: play once when it scrolls into view, and again on request. The numbers in the
  // markup are the end state; the count-up only borrows the text while it runs.
  const live = el.querySelector<HTMLElement>('.tf-end-live')!;
  const count = live.querySelector<HTMLElement>('.tf-end-count')!;
  const target = Number(count.dataset.to);
  let frame = 0;
  const play = (): void => {
    cancelAnimationFrame(frame);
    count.textContent = `+${target}`;
    live.classList.remove('tf-end-play');
    void live.offsetWidth;
    live.classList.add('tf-end-play');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now() + 700;
    const tick = (now: number): void => {
      const t = Math.min(1, Math.max(0, (now - start) / 600));
      count.textContent = `+${Math.round(target * (1 - (1 - t) ** 2))}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    play();
  }, { threshold: 0.6 }).observe(live);
  el.querySelector('.tf-end-again')!.addEventListener('click', play);
}

// The settings screen and its controls (src/parts/settings.ts).
addSettingsCards(document.getElementById('sheet')!);

document.body.dataset.ready = 'true';
