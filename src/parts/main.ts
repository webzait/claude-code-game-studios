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

// Level selection screen: three layout options as standalone mock-ups. Plain HTML and CSS (tf-levels-*),
// with made-up progress; nothing here reads the save or is wired into the game.
{
  type Situation = 'new' | 'mid' | 'all';
  const TOTAL = 200;
  const PER_PAGE = CONFIG.levelsPerPage;
  const DONE: Record<Situation, number> = { new: 0, mid: 37, all: TOTAL };
  const SITUATIONS: [Situation, string][] = [['new', 'Nieuwe speler'], ['mid', 'Halverwege · 37 van 200'], ['all', 'Alles uitgespeeld']];
  /** Made-up but fixed star results, so every screenshot shows the same mix. */
  const starsFor = (level: number, s: Situation): number => {
    const h = (level * 7919 + 13) % 10;
    return s === 'all' ? (h < 9 ? 3 : 2) : h < 6 ? 3 : h < 9 ? 2 : 1;
  };
  type Model = { s: Situation; done: number; target: number; stars: number; label: string };
  const model = (s: Situation): Model => {
    const done = DONE[s];
    let stars = 0;
    let improve = 1;
    for (let i = done; i >= 1; i--) {
      stars += starsFor(i, s);
      if (starsFor(i, s) < 3) improve = i;
    }
    const target = done < TOTAL ? done + 1 : improve;
    return { s, done, target, stars, label: done < TOTAL ? `Play level ${target}` : `Improve level ${target}` };
  };

  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 5v14l11.4-7z" fill="currentColor" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/></svg>';
  const gearIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="7" r="2.4" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="8" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>';
  const chevron = (d: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /** A button from the existing family (tf-btn), sized through its custom properties. */
  const famButton = (kind: string, size: string, inner: string, name: string, disabled = false): string =>
    `<button type="button" class="tf-btn ${kind}" style="${size}" aria-label="${name}"${disabled ? ' disabled' : ''}><span class="tf-clip"><span class="tf-face">${inner}</span></span></button>`;
  const SMALL = '--w:46px;--h:40px;--d:6px;--r:15px';

  /** One level tile. `extra` adds a class, `slot` replaces the line under the number (optional touches). */
  const tile = (level: number, m: Model, extra = '', slot = '', style = ''): string => {
    const st = style ? ` style="${style}"` : '';
    if (level > m.done + 1) return `<button type="button" class="tf-levels-tile is-locked ${extra}"${st} aria-label="Level ${level}, locked" disabled>${level}<span class="tf-levels-mark"></span></button>`;
    if (level === m.done + 1) return `<button type="button" class="tf-levels-tile is-next ${extra}"${st} aria-label="Level ${level}, play next" aria-current="true">${level}${slot || '<span class="tf-levels-mark"></span>'}</button>`;
    const n = starsFor(level, m.s);
    const again = m.done === TOTAL && level === m.target ? ' is-target' : '';
    return `<button type="button" class="tf-levels-tile s${n}${again} ${extra}"${st} aria-label="Level ${level}, ${n} of 3 stars"${again ? ' aria-current="true"' : ''}>${level}${slot || '<span class="tf-levels-stars"></span>'}</button>`;
  };

  const head = (m: Model): string => `<header class="tf-levels-head">
      <h3 class="tf-levels-title">TURNFLOCK</h3>
      <span class="tf-levels-pill" aria-label="Coins"><i class="tf-levels-coin"></i>${m.s === 'new' ? 30 : m.s === 'mid' ? 485 : 2640}</span>
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

  /** B: every level in one scrolling list, a tray per 20 with its own star count. */
  const optionB = (s: Situation, id: string, w = 390, h = 844): string => {
    const m = model(s);
    let groups = '';
    for (let first = 1; first <= TOTAL; first += PER_PAGE) {
      let tiles = '';
      let stars = 0;
      for (let i = first; i < first + PER_PAGE && i <= TOTAL; i++) {
        tiles += tile(i, m);
        if (i <= m.done) stars += starsFor(i, s);
      }
      groups += `<section class="tf-levels-tray tf-levels-group"><h4 class="tf-levels-grouphead"><span>${first}–${Math.min(first + PER_PAGE - 1, TOTAL)}</span><span><i class="tf-levels-star"></i>${stars} / ${PER_PAGE * 3}</span></h4><div class="tf-levels-grid">${tiles}</div></section>`;
    }
    return `${phoneOpen('b', id, w, h)}${head(m)}<div class="tf-levels-scroll">${groups}</div><footer class="tf-levels-dock">${play(m)}</footer></div>`;
  };

  /** C: a winding path, one node per level. */
  const optionC = (s: Situation, id: string, w = 390, h = 844): string => {
    const m = model(s);
    const xs = [18, 50, 82];
    const cycle = [0, 1, 2, 1];
    const pitch = 60;
    const top = 12;
    const at = (i: number): [number, number] => [xs[cycle[(i - 1) % cycle.length]], top + (i - 1) * pitch];
    let nodes = '';
    const points: string[] = [];
    for (let i = 1; i <= TOTAL; i++) {
      const [x, y] = at(i);
      points.push(`${x},${y + 34}`);
      nodes += tile(i, m, '', '', `left:${x}%;top:${y}px`);
    }
    const height = top + TOTAL * pitch + 24;
    const reached = Math.min(m.done + 1, TOTAL);
    return `${phoneOpen('c', id, w, h)}${head(m)}<div class="tf-levels-scroll"><div class="tf-levels-path" style="height:${height}px">
        <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points.join(' ')}" stroke="#8fa7e6" stroke-opacity=".55" stroke-width="16"/><polyline points="${points.slice(0, reached).join(' ')}" stroke="#f8faff" stroke-width="16"/><polyline points="${points.slice(0, reached).join(' ')}" stroke="#f6c542" stroke-width="5" stroke-dasharray="1 12"/></svg>
        ${nodes}</div></div><footer class="tf-levels-dock">${play(m)}</footer></div>`;
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
    const mini = `<svg class="tf-levels-mini" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="6" fill="#8fa7e6"/>${[0, 1, 2, 3].map((x) => [0, 1, 2, 3].map((y) => `<rect x="${2.5 + x * 6.5}" y="${2.5 + y * 6.5}" width="5.5" height="5.5" rx="1.4" fill="${x === 3 && y === 0 ? '#39e85c' : '#f7faff'}"/>`).join('')).join('')}<circle cx="5.25" cy="11.75" r="2.3" fill="#f1454b"/><circle cx="11.75" cy="24.75" r="2.3" fill="#2e84f1"/><circle cx="18.25" cy="11.75" r="2.3" fill="#f4c62f"/><rect x="15.5" y="15.5" width="5.5" height="5.5" rx="1.4" fill="#8fa0c3"/></svg>`;
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
    const touches = [
      fig(tile(38, mid, 'has-mini', mini, 'width:100px'), 'optie: mini-bord op de volgende tegel'),
      fig(tile(16, mid, '', '<span class="tf-levels-best">12 zetten</span>'), 'optie: beste aantal zetten'),
      fig(tile(16, mid), 'standaard'),
    ].join('');
    add('levels-tiles', 'Levelscherm · de leveltegel', 'minimaal 56×56 px · wand 5 px · getal 23–34 px, vet · sterren 46×17 px',
      `<h3 class="btn-title">Toestanden</h3><div class="tf-levels-strip" id="levels-tile-states">${states}</div>
       <h3 class="btn-title">Leesbaarheid · 1 tot 3 cijfers op de smalste maat (56 px)</h3><div class="tf-levels-strip" id="levels-tile-digits" style="--tl-tile-h:56px">${digits.replaceAll('class="tf-levels-tile', 'style="width:56px" class="tf-levels-tile')}</div>
       <h3 class="btn-title">Optionele extra's (niet standaard)</h3><div class="tf-levels-strip" id="levels-tile-touches">${touches}</div>`,
      'Echte <code>&lt;button&gt;</code>-elementen met tekst als getal. Een tegel is een laag kussen met een echte zijwand, uit dezelfde familie als de knoppen; drie sterren krijgt een gouden wand, de volgende tegel is uitgang-groen met een witte ring, en een tegel op slot is een lege uitsparing in de bak. Geen vervaging of filters per tegel, zodat 200 tegels soepel scrollen.');
  }

  const options: [string, string, string, (s: Situation, id: string, w?: number, h?: number) => string, string][] = [
    ['a', 'Levelscherm · optie A: raster per pagina (aanbevolen)', '20 levels per pagina · 4×5 · bladeren onderin', optionA, 'Eén pagina van 20 past altijd zonder scrollen. Het scherm opent op de pagina van het volgende level; bladeren en spelen zitten allebei onderin, binnen duimbereik. De stippen tonen 10 pagina’s: goud is helemaal uitgespeeld.'],
    ['b', 'Levelscherm · optie B: doorlopend raster in groepen van 20', '200 tegels in één lijst · 5 kolommen (4 op smalle schermen)', optionB, 'Alles in één lijst die opent bij het volgende level. Elke groep van 20 is een eigen bak met een eigen sterrentelling.'],
    ['c', 'Levelscherm · optie C: slingerpad', 'één level per stap · 60 px per stap · 200 levels = 12.000 px', optionC, 'Het bekende pad: speels, maar je ziet maar ±11 levels tegelijk en 200 levels is heel lang scrollen.'],
  ];
  for (const [key, title, dims, build, note] of options) {
    add(`levels-${key}`, title, dims, `<div class="tf-levels-row">${SITUATIONS.map(([s, name]) => fig(build(s, `levels-${key}-${s}`), name)).join('')}</div>`, note);
  }
  const SIZES: [number, number][] = [[320, 568], [390, 844], [430, 932], [768, 1024]];
  add('levels-sizes', 'Levelscherm · optie A op vier schermmaten', SIZES.map(([w, h]) => `${w}×${h}`).join(' · '),
    `<div class="tf-levels-row">${SIZES.map(([w, h]) => fig(optionA('mid', `levels-a-${w}`, w, h), `${w}×${h}`)).join('')}</div>`,
    'De tegelhoogte volgt de schermhoogte; op een tablet wordt het 5×4. Kopregel en dok worden op lage schermen iets platter.');

  // Open each scrolling option where the main action points: the level to play, in the middle of the screen.
  for (const scroller of document.querySelectorAll<HTMLElement>('.tf-levels-scroll')) {
    const target = scroller.querySelector<HTMLElement>('.is-next') ?? scroller.querySelector<HTMLElement>('.is-target');
    for (let pass = 0; target && pass < 2; pass++) {
      scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 2 + target.offsetHeight / 2;
    }
  }
}

document.body.dataset.ready = 'true';
