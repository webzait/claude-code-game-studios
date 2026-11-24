import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import { LEVELS } from '../levels';
import { buildObstacle as buildRobotObstacle } from '../render/parts/board';
import { buildFlockbot } from '../render/parts/flockbot';
import { shadeByHeight, roundedBlock } from '../render/parts/shapes';
import { buildObstacle, buildObstacleModel, GARDEN_OBSTACLE_KINDS, OBSTACLE_SPRITES, obstaclePicturesLoaded } from '../render/parts/garden/obstacles';
import spriteData from '../../data/themes/garden/obstacle-sprites.json';
import rockWebp from '../../assets/turnflock/garden/obstacles/rock.webp';
import rockMossyWebp from '../../assets/turnflock/garden/obstacles/rock-mossy.webp';
import stumpWebp from '../../assets/turnflock/garden/obstacles/stump.webp';
import bushWhiteWebp from '../../assets/turnflock/garden/obstacles/bush-white.webp';
import bushPinkWebp from '../../assets/turnflock/garden/obstacles/bush-pink.webp';
import sprigWebp from '../../assets/turnflock/garden/obstacles/plant-sprig.webp';
import grassWebp from '../../assets/turnflock/garden/obstacles/plant-grass.webp';
import flowerWhiteWebp from '../../assets/turnflock/garden/obstacles/plant-flower-white.webp';
import flowerPinkWebp from '../../assets/turnflock/garden/obstacles/plant-flower-pink.webp';
import { chooseObstacles, type GardenObstacleKind } from '../render/parts/garden/obstacleChoice';
import data from '../../data/themes/garden/obstacles.json';
import refRock from './garden-ref/rock.webp';
import refStump from './garden-ref/stump.webp';
import refBush from './garden-ref/bush.webp';
import refSheetRock from './garden-ref/sheet-rock.webp';
import refSheetPlants from './garden-ref/sheet-plants.webp';
import './garden-obstacles.css';

/**
 * Parts-sheet section for the garden theme's obstacles: each obstacle large
 * next to the owner's picture, from the usual sides, and at game size under
 * the game camera (30° tilt, perspective). Has its own renderer so it leaves
 * the rest of the sheet alone. Nothing here is in the game yet.
 */

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
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: '#5B4A6E', opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const perspective = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 200);
const TILT = CONFIG.board.roomy.tilt;
const PITCH = 1 + CONFIG.board.grid.gap;
const TILE_TOP = 0.12;

const VIEWS = {
  ref: { label: 'Zoals het voorbeeld (bijna van voren)', dir: new THREE.Vector3(0, 0.36, 1) },
  quarter: { label: 'Driekwart', dir: new THREE.Vector3(-0.55, 0.62, 1) },
  front: { label: 'Voorkant', dir: new THREE.Vector3(0, 0.0001, 1) },
  side: { label: 'Zijaanzicht', dir: new THREE.Vector3(1, 0.0001, 0) },
  top: { label: 'Bovenaanzicht', dir: new THREE.Vector3(0, 1, 0.0001) },
} as const;
type View = keyof typeof VIEWS;

function copyCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  return canvas;
}

/** Draw one object from one side, filling the picture. */
function snapshot(object: THREE.Object3D, view: View, floorY = 0): HTMLCanvasElement {
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const reach = Math.max(size.x, size.y, size.z) * 0.66;
  scene.add(object);
  ground.position.y = floorY - 0.002;
  ground.visible = view !== 'front' && view !== 'side';
  ortho.left = ortho.bottom = -reach;
  ortho.right = ortho.top = reach;
  ortho.updateProjectionMatrix();
  ortho.position.copy(centre).addScaledVector(VIEWS[view].dir.clone().normalize(), 20);
  ortho.lookAt(centre);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -reach * 3;
  cam.right = cam.top = reach * 3;
  cam.updateProjectionMatrix();
  sun.target.position.copy(centre);
  renderer.render(scene, ortho);
  scene.remove(object);
  return copyCanvas();
}

/** Draw a board-like field as the game camera sees it: perspective, tilted `TILT` degrees from straight down. */
function gameShot(field: THREE.Object3D, span: number): HTMLCanvasElement {
  const box = new THREE.Box3().setFromObject(field);
  const centre = box.getCenter(new THREE.Vector3());
  centre.y = TILE_TOP;
  scene.add(field);
  ground.position.y = -0.002;
  ground.visible = true;
  const distance = (span / 2) / Math.tan(THREE.MathUtils.degToRad(CONFIG.camera.fov / 2)) * 1.08;
  const t = THREE.MathUtils.degToRad(TILT);
  perspective.aspect = 1;
  perspective.updateProjectionMatrix();
  perspective.position.copy(centre).add(new THREE.Vector3(0, Math.cos(t), Math.sin(t)).multiplyScalar(distance));
  perspective.lookAt(centre);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -span;
  cam.right = cam.top = span;
  cam.updateProjectionMatrix();
  sun.target.position.copy(centre);
  renderer.render(scene, perspective);
  scene.remove(field);
  return copyCanvas();
}

/** Scale a picture down as a phone would show it: `css` CSS pixels wide, drawn at 3x. */
function phoneSize(source: HTMLCanvasElement, css: number): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = small.height = css * 3;
  const pen = small.getContext('2d')!;
  pen.imageSmoothingQuality = 'high';
  pen.drawImage(source, 0, 0, small.width, small.height);
  small.style.width = small.style.height = `${css}px`;
  small.className = 'phone';
  return small;
}

/** A plain grass tile standing in for the board session's tile, so the obstacles are seen on green. */
function grassTile(alt: boolean): THREE.Mesh {
  const g = roundedBlock(0.96, 0.96, TILE_TOP, 0.16, 0.03);
  shadeByHeight(g, alt ? [[0, '#5FAE2A'], [TILE_TOP, '#93D33E']] : [[0, '#64B42C'], [TILE_TOP, '#9DDA45']]);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** A field of `cols` by `rows` grass tiles with an obstacle (or bot) placed by `put`. */
function field(cols: number, rows: number, put: (x: number, y: number) => THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cx = (x - (cols - 1) / 2) * PITCH;
    const cz = (y - (rows - 1) / 2) * PITCH;
    const tile = grassTile((x + y) % 2 === 1);
    tile.position.set(cx, 0, cz);
    g.add(tile);
    const thing = put(x, y);
    if (thing) {
      thing.position.set(cx, TILE_TOP, cz);
      g.add(thing);
    }
  }
  return g;
}

function bot(color: 'red' | 'blue' | 'yellow', heading = 2): THREE.Object3D {
  const b = buildFlockbot(color);
  b.root.scale.setScalar(CONFIG.board.grid.robotFill);
  b.root.rotation.y = Math.PI - (heading * Math.PI) / 2;
  return b.root;
}

/** Triangles and draw calls of an object (one draw call per mesh). */
function cost(o: THREE.Object3D): { triangles: number; draws: number } {
  let triangles = 0;
  let draws = 0;
  o.traverse((n) => {
    if (!(n instanceof THREE.Mesh)) return;
    const g = n.geometry as THREE.BufferGeometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    draws++;
  });
  return { triangles: Math.round(triangles), draws };
}

const NAMES: Record<GardenObstacleKind, string> = {
  rock: 'Steen (kaal)',
  rockMossy: 'Steen met mos',
  stump: 'Boomstronk',
  bushWhite: 'Bosje met witte bloemen',
  bushPink: 'Bosje met roze bloemen',
};
const NOTES: Record<GardenObstacleKind, string> = {
  rock: 'Uit 14-sheet-rock: de enige kale steen van de eigenaar, maar 96 px breed; op twee keer die grootte bewaard en daardoor iets zachter dan de andere.',
  rockMossy: 'Uit 04-rock (1254 px): die steen heeft zelf al mos, dus hij is de steen met mos.',
  stump: 'Uit 05-stump (1254 px), met de blaadjes en de ingebakken schaduw.',
  bushWhite: 'Uit 06-bush-flowers (1254 px).',
  bushPink: 'Uit 06-bush-flowers (1254 px) met de drie witte bloemen roze, lila en lichtroze bijgekleurd, zoals op 17-sheet-bushes-plants; het roze bosje bestaat daar alleen op 83 px.',
};
const REFS: Record<GardenObstacleKind, [string, string]> = {
  rock: [refSheetRock, '14-sheet-rock (96 px breed)'],
  rockMossy: [refRock, '04-rock'],
  stump: [refStump, '05-stump'],
  bushWhite: [refBush, '06-bush-flowers'],
  bushPink: [refSheetPlants, '17-sheet-bushes-plants (roze bosje: tweede van links)'],
};
const WEBP: Record<GardenObstacleKind, string> = { rock: rockWebp, rockMossy: rockMossyWebp, stump: stumpWebp, bushWhite: bushWhiteWebp, bushPink: bushPinkWebp };

function figure(content: HTMLElement, caption: string, className = ''): HTMLElement {
  const f = document.createElement('figure');
  if (className) f.className = className;
  f.appendChild(content);
  f.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
  return f;
}

function img(src: string, className = ''): HTMLImageElement {
  const i = document.createElement('img');
  i.src = src;
  i.alt = '';
  if (className) i.className = className;
  return i;
}

const kB = (bytes: number): string => `${(bytes / 1024).toLocaleString('nl', { maximumFractionDigits: 1 })} kB`;

function obstacleCard(sheet: HTMLElement, kind: GardenObstacleKind): void {
  const s = OBSTACLE_SPRITES[kind];
  const el = document.createElement('section');
  el.className = 'card wide garden';
  el.id = `garden-${kind}`;
  el.innerHTML = `<h2>Tuin · ${NAMES[kind]}</h2><p class="dims">beeld ${s.px[0]}×${s.px[1]} px · ${kB(s.bytes)} WebP · in het spel 2 driehoeken, 1 tekenopdracht</p>`;
  const row = document.createElement('div');
  row.className = 'garden-row three';
  row.append(
    figure(img(REFS[kind][0]), `Origineel: ${REFS[kind][1]}`),
    figure(img(WEBP[kind], 'checker'), 'Uitgesneden WebP (transparant)'),
    figure(img(WEBP[kind], 'grass'), 'Dezelfde WebP op gras'),
  );
  el.appendChild(row);
  // At game size: the picture on its card on a grass tile, a bot alongside, as the game camera sees it.
  const shot = gameShot(field(3, 2, (x, y) => (x === 1 && y === 0 ? buildObstacle(kind) : x === 0 && y === 1 ? bot('yellow') : x === 2 && y === 1 ? buildObstacle(kind, 1) : null)), 3 * PITCH);
  const strip = document.createElement('div');
  strip.className = 'garden-game';
  const mirrorNote = data.sprite.mirror[kind] ? 'rechts gespiegeld (oneven draai)' : 'rechts niet gespiegeld (licht komt van één kant)';
  strip.append(figure(shot, `Spelcamera (${TILT}° gekanteld, perspectief), met een Flockbot ter vergelijking; ${mirrorNote}`, 'big'));
  for (const cell of [53, 42]) strip.append(figure(phoneSize(shot, Math.round(3.25 * cell)), `vak ${cell} px`));
  el.appendChild(strip);
  el.insertAdjacentHTML('beforeend', `<p class="note">${NOTES[kind]}</p>`);
  sheet.appendChild(el);
}

function plantsCard(sheet: HTMLElement): void {
  const el = document.createElement('section');
  el.className = 'card wide garden';
  el.id = 'garden-plants';
  const P = spriteData.plants;
  const total = Object.values(P).reduce((sum, p) => sum + p.bytes, 0);
  el.innerHTML = `<h2>Tuin · losse plantjes</h2><p class="dims">Uitgesneden WebP's, samen ${kB(total)}, voor de achtergrond en de rand. Takje en graspol uit 17-sheet-bushes-plants (klein, op twee keer de grootte); de bloemen uit het grote bosje (06), de roze bijgekleurd.</p>`;
  const row = document.createElement('div');
  row.className = 'garden-row four';
  const pieces: [string, string, number][] = [
    [sprigWebp, 'Takje (4 blaadjes)', P['plant-sprig'].bytes],
    [grassWebp, 'Graspol', P['plant-grass'].bytes],
    [flowerWhiteWebp, 'Witte bloem', P['plant-flower-white'].bytes],
    [flowerPinkWebp, 'Roze bloem', P['plant-flower-pink'].bytes],
  ];
  for (const [src, label, bytes] of pieces) row.appendChild(figure(img(src, 'checker'), `${label} · ${kB(bytes)}`));
  el.appendChild(row);
  const ref = document.createElement('div');
  ref.className = 'garden-strip';
  ref.append(figure(img(refSheetPlants), 'Origineel: 17-sheet-bushes-plants'));
  el.appendChild(ref);
  sheet.appendChild(el);
}

/** The code-built versions, kept as an option. */
function modelsCard(sheet: HTMLElement): void {
  const el = document.createElement('section');
  el.className = 'card wide garden';
  el.id = 'garden-models';
  el.innerHTML = '<h2>Tuin · codeversie (keuze, niet de standaard)</h2><p class="dims">Dezelfde obstakels in code nagebouwd (<code>buildObstacleModel</code>). Echt 3D en vrij te draaien, maar minder trouw aan de beelden; daarom is het beeld de standaard.</p>';
  const row = document.createElement('div');
  row.className = 'garden-row';
  for (const kind of GARDEN_OBSTACLE_KINDS) {
    const model = buildObstacleModel(kind, 0, data.detail.closeUp);
    row.appendChild(figure(snapshot(model, 'ref'), `${NAMES[kind]} · ${cost(buildObstacleModel(kind)).triangles.toLocaleString('nl')} driehoeken`));
  }
  el.appendChild(row);
  sheet.appendChild(el);
}

/** The rule at work on real levels: which obstacle each wall cell gets, at game size. */
function boardsCard(sheet: HTMLElement): void {
  const el = document.createElement('section');
  el.className = 'card wide garden';
  el.id = 'garden-boards';
  el.innerHTML = '<h2>Tuin · afwisseling op het bord</h2><p class="dims">Vaste regel per level en vak (geen toeval): elke keer hetzelfde, en twee muurvakken die elkaar raken zijn nooit dezelfde soort.</p>';
  const holder = document.createElement('div');
  holder.className = 'garden-game';
  for (const id of ['long-gate', 'one-command-many-consequences', 'great-wall']) {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) continue;
    const { width, height, walls } = level.board;
    const choices = chooseObstacles(level.id, width, height, walls);
    const robots = new Map(level.start.robots.map((r) => [r.y * width + r.x, r]));
    const f = field(width, height, (x, y) => {
      const c = choices[y * width + x];
      if (c) return buildObstacle(c.kind, c.turn);
      const r = robots.get(y * width + x);
      return r ? bot(r.color, r.dir) : null;
    });
    const shot = gameShot(f, Math.max(width, height) * PITCH + 0.3);
    const cell = 42;
    holder.append(figure(shot, `Level "${level.name}" (${width}×${height}), spelcamera; alleen muren en robots getekend (uitgang, poort en knop horen bij andere sessies)`, 'big'), figure(phoneSize(shot, Math.round((Math.max(width, height) + 0.3) * cell * 1.08)), `op ware grootte, vak ${cell} px`));
  }
  el.appendChild(holder);
  const robot = cost(buildRobotObstacle());
  const lines = GARDEN_OBSTACLE_KINDS.map((k) => `<tr><td>${NAMES[k]}</td><td>${kB(OBSTACLE_SPRITES[k].bytes)}</td><td>2</td><td>1</td><td>${cost(buildObstacleModel(k)).triangles.toLocaleString('nl')}</td></tr>`).join('');
  const total = GARDEN_OBSTACLE_KINDS.reduce((sum, k) => sum + OBSTACLE_SPRITES[k].bytes, 0);
  el.insertAdjacentHTML('beforeend', `<table class="garden-cost"><tr><th>Onderdeel</th><th>WebP</th><th>Driehoeken</th><th>Tekenopdrachten</th><th>Codeversie: driehoeken</th></tr>${lines}<tr><td><b>Samen</b></td><td><b>${kB(total)}</b></td><td></td><td></td><td></td></tr><tr><td>Robotthema: obstakelblok</td><td>—</td><td>${robot.triangles.toLocaleString('nl')}</td><td>${robot.draws}</td><td></td></tr></table><p class="note">Elk soort beeld heeft één gedeeld materiaal: op een samengevoegd bord kosten alle tuinobstakels samen hooguit vijf tekenopdrachten. In het losse HTML-bestand komen de beelden als base64 erbij (ongeveer een derde groter dan de WebP's).</p>`);
  sheet.appendChild(el);
}

/** Add the garden-obstacle cards to the parts sheet, once the obstacle pictures have loaded. */
export async function addGardenObstacleCards(sheet: HTMLElement): Promise<void> {
  // Placeholder first, so the cards keep their place among the other sections.
  const anchor = document.createElement('div');
  anchor.style.display = 'contents';
  sheet.appendChild(anchor);
  await obstaclePicturesLoaded();
  const holder = document.createDocumentFragment() as unknown as HTMLElement;
  for (const kind of GARDEN_OBSTACLE_KINDS) obstacleCard(holder, kind);
  plantsCard(holder);
  boardsCard(holder);
  modelsCard(holder);
  anchor.appendChild(holder);
}
