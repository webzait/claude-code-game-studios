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

document.body.dataset.ready = 'true';
