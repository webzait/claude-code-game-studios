import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import garden from '../../data/themes/garden/exit.json';
import * as robot from '../render/parts/board';
import { buildFlockbot } from '../render/parts/flockbot';
import { buildExit, EXIT_MOMENT_LOOKS } from '../render/parts/garden/exit';
import type { ExitLook, ExitMoment } from '../render/parts/garden/exitMoments';
import { buildGazebo } from '../render/parts/garden/gazebo';
import { buildStandInTile as buildFloorTile, buildGate, buildPlate, buildTurnTile, gateDoorScale } from '../render/parts/garden/specials';
import { drawCount, triangleCount } from '../render/parts/garden/common';
import refPads from './ref/garden/22-sheet-exit-pad-states.webp';
import refGoal from './ref/garden/24-sheet-gazebo-goal.webp';
import refGazebo from './ref/garden/08-gazebo.webp';
import * as pic from '../render/parts/garden/exitPictures';
import { addPictureCards } from './garden-exit-pictures';
import './garden-exit.css';

/**
 * Parts sheet section for the garden theme's exit, gazebo goal and special tiles
 * (src/render/parts/garden/). Each part is shown large, next to the owner's
 * picture, and at game size under the game's own camera: perspective, field of
 * view `camera.fov`, tilted `board.roomy.tilt` degrees from straight down, at
 * the cell sizes a phone gives (53 and 42 CSS px), drawn at 3× for sharp screens.
 * Nothing here is in the playable game.
 */

const BIG = 1000;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = CONFIG.light.reflections;
scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
const sun = new THREE.DirectionalLight('#FFFFFF', CONFIG.light.sun);
sun.position.set(-4.5, 9, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: '#2A4A1A', opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const persp = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 200);

// The game's renderer draws without tone mapping: match it for the game-size views.
const GAME_TONE = THREE.NoToneMapping;

/** Directions to look from. `quarter` is the asset-sheet three-quarter view; `game` the game camera. */
const DIRS = {
  quarter: new THREE.Vector3(-0.55, 0.62, 1),
  front: new THREE.Vector3(0, 0.32, 1),
  top: new THREE.Vector3(0, 1, 0.0001),
  game: new THREE.Vector3(0, Math.cos(THREE.MathUtils.degToRad(CONFIG.board.roomy.tilt)), Math.sin(THREE.MathUtils.degToRad(CONFIG.board.roomy.tilt))),
};

function capture(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  return c;
}

/** Large picture of `object` from `dir`, orthographic, fitted to its measured box (`pad` adds room for light that is not counted). */
function large(object: THREE.Object3D, dir: THREE.Vector3, pad = 1.15, size = BIG): HTMLCanvasElement {
  renderer.setSize(size, size, false);
  renderer.toneMapping = GAME_TONE;
  scene.add(object);
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const reach = (box.getSize(new THREE.Vector3()).length() / 2) * pad;
  ortho.left = ortho.bottom = -reach;
  ortho.right = ortho.top = reach;
  ortho.updateProjectionMatrix();
  ortho.position.copy(centre).addScaledVector(dir.clone().normalize(), 40);
  ortho.lookAt(centre);
  ground.position.y = box.min.y - 0.002;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -reach * 2;
  cam.right = cam.top = reach * 2;
  cam.updateProjectionMatrix();
  sun.target.position.copy(centre);
  renderer.render(scene, ortho);
  scene.remove(object);
  return capture(size, size);
}

/**
 * The field as the game shows it: perspective camera of the game, tilted from straight down,
 * framing `cells` cells across, drawn so one cell is `cellPx` CSS px (canvas at 3×).
 */
function inGame(field: THREE.Object3D, cells: number, rows: number, cellPx: number, centre = new THREE.Vector3(0, parts.floorTile.height, 0)): HTMLCanvasElement {
  const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
  const cssW = Math.round(cells * pitch * cellPx);
  const cssH = Math.round(rows * pitch * cellPx);
  renderer.setSize(cssW * 3, cssH * 3, false);
  renderer.toneMapping = GAME_TONE;
  scene.add(field);
  persp.aspect = cssW / cssH;
  const half = THREE.MathUtils.degToRad(CONFIG.camera.fov / 2);
  const dist = (rows * pitch) / 2 / Math.tan(half) / Math.cos(THREE.MathUtils.degToRad(CONFIG.board.roomy.tilt)) * 0.98;
  persp.position.copy(centre).addScaledVector(DIRS.game, dist);
  persp.lookAt(centre);
  persp.updateProjectionMatrix();
  ground.position.y = -0.002;
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -cells * 1.5;
  cam.right = cam.top = cells * 1.5;
  cam.updateProjectionMatrix();
  sun.target.position.copy(centre);
  renderer.render(scene, persp);
  scene.remove(field);
  const c = capture(cssW * 3, cssH * 3);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  return c;
}

const PITCH = parts.floorTile.size + CONFIG.board.grid.gap;

/** A small field of grass stand-in tiles with `centre` in the middle and the extras placed by cell. */
function field(centre: THREE.Object3D | null, extras: [number, number, THREE.Object3D][] = [], size = 3): THREE.Group {
  const g = new THREE.Group();
  const r = (size - 1) / 2;
  const taken = new Set(extras.filter(([, , o]) => o.userData.tile).map(([x, z]) => `${x},${z}`));
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    if (x === 0 && z === 0 && centre) continue;
    if (taken.has(`${x},${z}`)) continue;
    const t = buildFloorTile((x + z + 2 * r) % 2 === 1, false);
    t.position.set(x * PITCH, 0, z * PITCH);
    g.add(t);
  }
  if (centre) g.add(centre);
  for (const [x, z, o] of extras) {
    o.position.x += x * PITCH;
    o.position.z += z * PITCH;
    g.add(o);
  }
  return g;
}

/** A robot standing on a cell, as the measure of size (the chicks are another session's part). */
function bot(color: Color, heading = 0): THREE.Object3D {
  const b = buildFlockbot(color);
  b.root.scale.setScalar(CONFIG.board.grid.robotFill);
  b.root.rotation.y = Math.PI - (heading * Math.PI) / 2;
  b.root.position.y = parts.floorTile.height;
  return b.root;
}

function figure(canvas: HTMLCanvasElement | HTMLImageElement, caption: string, cls = ''): HTMLElement {
  const f = document.createElement('figure');
  if (cls) f.className = cls;
  f.appendChild(canvas);
  f.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
  return f;
}

function img(src: string, alt: string): HTMLImageElement {
  const i = new Image();
  i.src = src;
  i.alt = alt;
  return i;
}

function section(id: string, title: string, intro: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card wide garden-exit';
  el.id = id;
  el.innerHTML = `<h2>${title}</h2><p class="dims">${intro}</p>`;
  return el;
}

function row(el: HTMLElement, cls = ''): HTMLElement {
  const r = document.createElement('div');
  r.className = `ge-row ${cls}`;
  el.appendChild(r);
  return r;
}

function note(el: HTMLElement, html: string): void {
  el.insertAdjacentHTML('beforeend', `<p class="note">${html}</p>`);
}

const LOOK_NAMES: Record<ExitLook, string> = { grey: 'Grijs', green: 'Groen', rays: 'Groen met stralen' };
const MOMENT_NAMES: Record<ExitMoment, string> = {
  waiting: 'Wachten: er moeten nog kuikens door deze uitgang',
  entered: `Net binnen: een kuiken ging zojuist door deze uitgang (${garden.exit.flashSeconds} s)`,
  complete: 'Gehaald: alle kuikens zijn binnen',
  spent: 'Klaar: deze uitgang neemt niemand meer (gekleurde uitgang, al zijn kuikens binnen), andere kuikens nog buiten',
};

/** Triangle and draw-call counts of a part, for the cost table. */
function cost(o: THREE.Object3D): string {
  return `${triangleCount(o).toLocaleString('nl-NL')} driehoeken · ${drawCount(o)} tekenopdrachten`;
}

/** Add every garden-exit card to `sheet`. */
function addModelledCards(sheet: HTMLElement): void {
  sheet.insertAdjacentHTML('beforeend', '<section class="card wide garden-exit" id="garden-modelled"><h2>Tuin · Alternatief: in code nagebouwd</h2><p class="dims">De eerste versie, nagebouwd in 3D. Blijft als keuze bestaan; de standaard is nu het beeld van de eigenaar (hierboven).</p></section>');
  // ---- 1. The exit pad, three looks ----
  {
    const el = section('garden-code-exit', 'Alternatief (code) · Uitgang: stenen plateau in drie standen', `Eén vak breed (${Math.round(garden.exit.radius * 2 * parts.unitPx)} px bij een vak van ${parts.unitPx} px), plateau ${Math.round(garden.exit.capTop * parts.unitPx)} px hoog: een kuiken stapt erop zoals op de robotuitgang.`);
    const ref = row(el, 'ref');
    ref.appendChild(figure(img(refPads, 'Voorbeeld van de eigenaar: drie standen van het plateau'), 'Voorbeeld van de eigenaar (22-sheet-exit-pad-states)'));
    const big = row(el, 'three');
    for (const look of ['grey', 'green', 'rays'] as ExitLook[]) {
      big.appendChild(figure(large(buildExit(undefined, look), DIRS.front, look === 'rays' ? 1.05 : 0.78), `${LOOK_NAMES[look]} · nagebouwd`));
    }
    const quarter = row(el, 'three');
    for (const look of ['grey', 'green', 'rays'] as ExitLook[]) {
      quarter.appendChild(figure(large(buildExit(undefined, look), DIRS.quarter, look === 'rays' ? 1.05 : 0.78, 600), `${LOOK_NAMES[look]} · driekwart`));
    }
    const top = row(el, 'three');
    for (const look of ['grey', 'green', 'rays'] as ExitLook[]) {
      top.appendChild(figure(large(buildExit(undefined, look), DIRS.top, 0.8, 600), `${LOOK_NAMES[look]} · van boven`));
    }
    el.insertAdjacentHTML('beforeend', '<h3>Op spelgrootte, onder de spelcamera</h3>');
    for (const cellPx of [53, 42]) {
      const game = row(el, 'game');
      for (const look of ['grey', 'green', 'rays'] as ExitLook[]) {
        const f = field(buildExit(undefined, look), [[-1, 0, bot('blue', 1)], [0, 1, bot('yellow', 0)]]);
        game.appendChild(figure(inGame(f, 3, 3, cellPx), `${LOOK_NAMES[look]} · vak ${cellPx} px`));
      }
    }
    const robotRow = row(el, 'game');
    {
      const rf = new THREE.Group();
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        const t = x === 0 && z === 0 ? robot.buildExit() : robot.buildFloorTile((x + z + 2) % 2 === 1, false);
        t.position.set(x * PITCH, 0, z * PITCH);
        rf.add(t);
      }
      rf.add(Object.assign(bot('blue', 1), {}));
      (rf.children[rf.children.length - 1] as THREE.Object3D).position.x = -PITCH;
      robotRow.appendChild(figure(inGame(rf, 3, 3, 53), 'Ter vergelijking: de robotuitgang, vak 53 px'));
    }
    el.insertAdjacentHTML('beforeend', '<h3>Welke stand bij welk moment</h3>');
    const table = document.createElement('table');
    table.className = 'ge-table';
    table.innerHTML = `<tr><th>Moment in het spel</th><th>Stand</th></tr>${(Object.keys(MOMENT_NAMES) as ExitMoment[]).map((m) => `<tr><td>${MOMENT_NAMES[m]}</td><td>${LOOK_NAMES[EXIT_MOMENT_LOOKS[m]]}</td></tr>`).join('')}`;
    el.appendChild(table);
    note(el, `De koppeling staat in <code>data/themes/garden/exit.json</code> (<code>moments</code>) en de logica in <code>exitMoment</code> (getest). Kosten: ${cost(buildExit(undefined, 'green'))} (groen), ${cost(buildExit(undefined, 'rays'))} (met stralen); robotuitgang ${cost(robot.buildExit())}.`);
    sheet.appendChild(el);
  }

  // ---- 2. Colour exits ----
  {
    const el = section('garden-code-colours', 'Alternatief (code) · Uitgangen per kleur', 'Dezelfde steen; het vlak licht op in de kleur van de kuikens die erdoor mogen. Met "Kleurvormen" aan staat de vorm van de kleur op de plaats van het vinkje.');
    const big = row(el, 'four');
    const colors: Color[] = ['red', 'blue', 'yellow'];
    for (const c of colors) big.appendChild(figure(large(buildExit(c, 'green'), DIRS.quarter, 0.8, 600), c === 'red' ? 'Rood' : c === 'blue' ? 'Blauw' : 'Geel'));
    {
      const shaped = buildExit('blue', 'green');
      (shaped.userData.shape as THREE.Object3D).visible = true;
      (shaped.userData.check as THREE.Object3D).visible = false;
      big.appendChild(figure(large(shaped, DIRS.quarter, 0.8, 600), 'Blauw, met kleurvorm'));
    }
    const game = row(el, 'game');
    for (const cellPx of [53, 42]) {
      const f = field(null, [[-1, 0, buildExit('red', 'green')], [0, 0, buildExit('blue', 'green')], [1, 0, buildExit('yellow', 'green')], [-1, 1, bot('red', 0)], [1, -1, bot('yellow', 2)]].map(([x, z, o]) => {
        (o as THREE.Object3D).userData.tile = (o as THREE.Object3D).name === 'garden-exit';
        return [x, z, o] as [number, number, THREE.Object3D];
      }));
      game.appendChild(figure(inGame(f, 3, 3, cellPx), `Rood, blauw, geel · vak ${cellPx} px`));
    }
    {
      const f = field(null, [[-1, 0, buildExit('red', 'grey')], [0, 0, buildExit('blue', 'green')], [1, 0, buildExit('yellow', 'rays')]].map(([x, z, o]) => {
        (o as THREE.Object3D).userData.tile = true;
        return [x, z, o] as [number, number, THREE.Object3D];
      }));
      game.appendChild(figure(inGame(f, 3, 3, 53), 'Rood klaar (grijs), blauw wacht, geel net binnen'));
    }
    sheet.appendChild(el);
  }

  // ---- 3. The gazebo goal ----
  {
    const el = section('garden-code-gazebo', 'Alternatief (code) · Het prieel als doel', 'Los onderdeel: het prieel met vlaggetje, bloemen en het groene plateau met vinkje. Voorstel: het beeld van "level gehaald" en het eindpunt van het levelpad.');
    const ref = row(el, 'two');
    ref.appendChild(figure(img(refGoal, 'Voorbeeld: prieel als doel'), 'Voorbeeld (24-sheet-gazebo-goal)'));
    ref.appendChild(figure(img(refGazebo, 'Voorbeeld: prieel'), 'Voorbeeld (08-gazebo)'));
    const mine = row(el, 'two');
    mine.appendChild(figure(large(buildGazebo(true), DIRS.front, 0.7), 'Nagebouwd, als doel (met plateau en lichtbundel)'));
    mine.appendChild(figure(large(buildGazebo(false), DIRS.quarter, 0.7), 'Nagebouwd, zonder plateau, driekwart'));
    const small = row(el, 'game');
    for (const px of [160, 96, 64]) {
      const c = large(buildGazebo(true), DIRS.front, 0.7, px * 3);
      c.style.width = c.style.height = `${px}px`;
      small.appendChild(figure(c, `${px} px (pop-up / levelpad)`));
    }
    note(el, `Kosten: ${cost(buildGazebo(true))}. Bedoeld voor één plek tegelijk (pop-up of levelpad), niet voor elk vak.`);
    sheet.appendChild(el);
  }

  // ---- 4. Special tiles ----
  {
    const el = section('garden-code-specials', 'Alternatief (code) · Draaitegel, drukplaat en poort', 'Geen voorbeelden van de eigenaar: ontworpen bij de beelden. Zelfde werking en zelfde onderdelen (schijf, knop, deur) als de robotversies; plaat en poort delen één lavendelkleur die verder nergens in de tuin voorkomt.');
    const big = row(el, 'four');
    big.appendChild(figure(large(buildTurnTile(), DIRS.quarter, 0.86, 600), 'Draaitegel'));
    big.appendChild(figure(large(buildPlate(), DIRS.quarter, 0.86, 600), 'Drukplaat'));
    big.appendChild(figure(large(buildGate(), DIRS.quarter, 0.86, 600), 'Poort dicht'));
    {
      const open = buildGate();
      (open.userData.door as THREE.Object3D).scale.y = gateDoorScale(true);
      big.appendChild(figure(large(open, DIRS.quarter, 0.86, 600), 'Poort open'));
    }
    el.insertAdjacentHTML('beforeend', '<h3>Op spelgrootte, naast de robotversie</h3>');
    for (const cellPx of [53, 42]) {
      const game = row(el, 'game');
      const pressed = buildPlate(false, false);
      const gateOpen = buildGate(false, false);
      (gateOpen.userData.door as THREE.Object3D).scale.y = gateDoorScale(true);
      const button = pressed.userData.button as THREE.Object3D;
      button.position.y -= garden.plate.buttonHeight * 0.6;
      const tiles: [number, number, THREE.Object3D][] = [
        [-1, -1, buildTurnTile(false, false)], [0, -1, buildPlate(false, false)], [1, -1, buildGate(false, false)],
        [-1, 0, buildExit(undefined, 'green')], [0, 0, pressed], [1, 0, gateOpen],
      ];
      for (const t of tiles) t[2].userData.tile = true;
      const f = field(null, [...tiles, [0, 0, bot('red', 0)], [1, 1, bot('blue', 2)]]);
      game.appendChild(figure(inGame(f, 3, 3, cellPx), `Tuin · vak ${cellPx} px · boven: draai, plaat, poort dicht · midden: uitgang, plaat ingedrukt, poort open`));
      const rf = new THREE.Group();
      const rt: [number, number, THREE.Object3D][] = [
        [-1, -1, robot.buildTurnTile(false, false)], [0, -1, robot.buildPlate(false, false)], [1, -1, robot.buildGate(false, false)],
        [-1, 0, robot.buildExit()], [0, 0, robot.buildPlate(false, false)], [1, 0, robot.buildGate(false, false)],
      ];
      ((rt[5][2].userData.door) as THREE.Object3D).scale.y = robot.gateDoorScale(true);
      const used = new Set(rt.map(([x, z]) => `${x},${z}`));
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (!used.has(`${x},${z}`)) rt.push([x, z, robot.buildFloorTile((x + z + 2) % 2 === 1, false)]);
      for (const [x, z, o] of [...rt, [0, 0, bot('red', 0)], [1, 1, bot('blue', 2)]] as [number, number, THREE.Object3D][]) {
        o.position.x += x * PITCH;
        o.position.z += z * PITCH;
        rf.add(o);
      }
      game.appendChild(figure(inGame(rf, 3, 3, cellPx), `Robot · vak ${cellPx} px · zelfde opstelling`));
    }
    const table = document.createElement('table');
    table.className = 'ge-table';
    const pairs: [string, THREE.Object3D, THREE.Object3D][] = [
      ['Uitgang (groen)', buildExit(undefined, 'green'), robot.buildExit()],
      ['Draaitegel', buildTurnTile(false, false), robot.buildTurnTile(false, false)],
      ['Drukplaat', buildPlate(false, false), robot.buildPlate(false, false)],
      ['Poort', buildGate(false, false), robot.buildGate(false, false)],
      ['Prieel (doel)', buildGazebo(true), new THREE.Group()],
    ];
    table.innerHTML = `<tr><th>Onderdeel</th><th>Tuin</th><th>Robot</th></tr>${pairs.map(([n, g, r]) => `<tr><td>${n}</td><td>${cost(g)}</td><td>${r.children.length ? cost(r) : '—'}</td></tr>`).join('')}`;
    el.insertAdjacentHTML('beforeend', '<h3>Kosten per onderdeel</h3>');
    el.appendChild(table);
    note(el, 'De tegels hieronder zijn een eenvoudige grastegel als stand-in; in het spel komt de grastegel van de bordsessie eronder (<code>useGardenFloorTile</code>). De kosten tellen de tegel mee.');
    sheet.appendChild(el);
  }
}

/**
 * Add the garden exit section to `sheet`: first the standard version made from the owner's own
 * pictures (src/parts/garden-exit-pictures.ts), then the modelled alternative. Sets
 * `data-garden-ready` on the body when everything is drawn.
 */
export async function addGardenExitCards(sheet: HTMLElement): Promise<void> {
  await pic.loadGardenExitPictures();
  addPictureCards(sheet, { large, inGame, field, bot, figure, img, section, row, note, cost, refPads, refGoal, refGazebo });
  addModelledCards(sheet);
  document.body.dataset.gardenReady = 'true';
}
