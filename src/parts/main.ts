import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import coinIcon from '../../assets/turnflock/ui/coin.webp';
import extraMovesIcon from '../../assets/turnflock/ui/extra-moves.webp';
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

// End-of-round pop-up: plain HTML and CSS (tf-end-*) in a phone frame over a stand-in for the board.
// A mock-up of every situation the game's card has today; it is not wired into the playable game.
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
  el.innerHTML = `${defs}<h2>Eind-pop-up</h2><p class="dims">telefoonkader 390×844 px · echte HTML en CSS · nog niet in de game</p>
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

document.body.dataset.ready = 'true';
