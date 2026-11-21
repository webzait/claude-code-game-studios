import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import hintIcon from '../../assets/turnflock/ui/hint.webp';
import { boardPixels, buildExit, buildFloorTile, buildObstacle, buildRim, buildRimCorner, buildRimEdge, buildUnderlay, rimLayout } from '../render/parts/board';
import decorBushLarge from '../../assets/turnflock/decor/decor-bush-large.webp';
import decorBushSmall from '../../assets/turnflock/decor/decor-bush-small.webp';
import decorTuftClover from '../../assets/turnflock/decor/decor-tuft-clover.webp';
import decorSprigTop from '../../assets/turnflock/decor/decor-sprig-top.webp';
import { buildExit, buildFloorTile, buildObstacle, buildRim, buildRimCorner, buildRimEdge, buildUnderlay } from '../render/parts/board';
import { buildFlockbot } from '../render/parts/flockbot';
import { addCoinCards } from './coins';
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

document.body.dataset.ready = 'true';
