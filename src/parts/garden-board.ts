import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import G from '../../data/themes/garden/board.json';
import * as robot from '../render/parts/board';
import { fuse } from '../render/kit';
import {
  boardFootprint, boardPixels, buildDirtTile, buildFloorTile, buildHighlightTile, buildRim, buildTileGlow, buildUnderlay, hintGlowCells,
} from '../render/parts/garden/board';
import './garden/garden-board.css';
import refBoard from './garden/ref-01-board-full.webp';
import refTile from './garden/ref-02-tile-grass.webp';
import refRim from './garden/ref-03-rim-vines.webp';
import refSheetGrass from './garden/ref-11-sheet-tile-grass.webp';
import refSheetGlow from './garden/ref-12-sheet-tile-highlight.webp';
import refSheetDirt from './garden/ref-13-sheet-tile-dirt.webp';

/**
 * Parts sheet section: the garden theme's board (grass tile, glowing tile, dirt tile, twig rim,
 * underlay and grass bed), each next to the owner's reference picture, the whole board at several
 * sizes, and the board as the game's tilted camera shows it on a phone. Not in the game yet.
 */

const GAP = CONFIG.board.grid.gap;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = CONFIG.light.reflections;
scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
const sun = new THREE.DirectionalLight('#FFFFFF', CONFIG.light.sun);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: '#1F3A7A', opacity: CONFIG.light.shadow }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

type View = { label: string; dir: THREE.Vector3 };
const VIEWS = {
  quarter: { label: 'Driekwart', dir: new THREE.Vector3(-0.55, 0.62, 1) },
  front: { label: 'Voorkant', dir: new THREE.Vector3(0, 0.0001, 1) },
  side: { label: 'Zijaanzicht', dir: new THREE.Vector3(1, 0.0001, 0) },
  top: { label: 'Bovenaanzicht', dir: new THREE.Vector3(0, 1, 0.0001) },
  close: { label: 'Van dichtbij, schuin', dir: new THREE.Vector3(0, 1, 0.75) },
} satisfies Record<string, View>;

/** Draw `object` with an orthographic camera from `view`, `px` pixels square, framing `reach` cells round its centre. */
function still(object: THREE.Object3D, view: View, px: number, reach?: number): HTMLCanvasElement {
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r = reach ?? Math.max(size.x, size.y, size.z) * 0.62;
  const camera = new THREE.OrthographicCamera(-r, r, r, -r, 0.1, 100);
  camera.position.copy(centre).addScaledVector(view.dir.clone().normalize(), 30);
  camera.lookAt(centre);
  return draw(object, camera, px, px, centre, r, box.min.y);
}

/**
 * Draw `object` (a board) as the game's camera sees it: perspective (field of view
 * `camera.fov`), tilted `board.roomy.tilt` degrees from straight down, the board's outside
 * filling `cssW` less the side margins. The picture is `dpr` times the CSS size.
 */
function gameView(object: THREE.Object3D, cols: number, rows: number, cssW: number, cssH: number, dpr: number): HTMLCanvasElement {
  const tilt = (CONFIG.board.roomy.tilt * Math.PI) / 180;
  const { outerW, outerD } = boardFootprint(cols, rows, GAP);
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, cssW / cssH, 0.1, 200);
  const dir = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  const target = new THREE.Vector3(0, 0, 0);
  const wanted = cssW - 2 * CONFIG.camera.marginX;
  // Move the camera until the board's widest row (its near edge) is as wide as allowed.
  let lo = 2;
  let hi = 80;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    camera.position.copy(target).addScaledVector(dir, mid);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const a = new THREE.Vector3(-outerW / 2, 0.3, outerD / 2).project(camera);
    const b = new THREE.Vector3(outerW / 2, 0.3, outerD / 2).project(camera);
    const width = ((b.x - a.x) / 2) * cssW;
    if (width > wanted) lo = mid;
    else hi = mid;
  }
  return draw(object, camera, Math.round(cssW * dpr), Math.round(cssH * dpr), target, Math.max(outerW, outerD) * 0.62, 0);
}

function draw(object: THREE.Object3D, camera: THREE.Camera, w: number, h: number, centre: THREE.Vector3, reach: number, floorY: number): HTMLCanvasElement {
  renderer.setSize(w, h, false);
  scene.add(object);
  ground.position.y = floorY - 0.25;
  sun.position.set(centre.x - 4.5, 9, centre.z - 3.5);
  sun.target.position.copy(centre);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -reach * 2;
  cam.right = cam.top = reach * 2;
  cam.updateProjectionMatrix();
  renderer.render(scene, camera);
  scene.remove(object);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  return canvas;
}

/** Triangles and draw calls of `object` once the game has fused it (one draw per material). */
function cost(object: THREE.Object3D): { tris: number; draws: number } {
  let tris = 0;
  object.traverse((n) => {
    if (!(n instanceof THREE.Mesh) || n.name.endsWith('-glow')) return;
    const g = n.geometry as THREE.BufferGeometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  const fused = fuse(object.clone(true));
  return { tris: Math.round(tris), draws: fused.children.length };
}

const fmt = (n: number): string => n.toLocaleString('nl-NL');

/** A garden board of `cols` by `rows`: underlay, rim, a checkerboard of grass tiles, plus optional lit and dirt cells. */
function gardenBoard(cols: number, rows: number, lit: number[] = [], dirt: number[] = []): THREE.Group {
  const pitch = G.tile.size + GAP;
  const board = new THREE.Group();
  board.add(buildUnderlay(cols, rows, GAP), buildRim(cols, rows, GAP));
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const cell = y * cols + x;
    const alt = (x + y) % 2 === 1;
    const tile = dirt.includes(cell) ? buildDirtTile(alt, false) : lit.includes(cell) ? buildHighlightTile(alt, false) : buildFloorTile(alt, false);
    tile.position.set((x - (cols - 1) / 2) * pitch, 0, (y - (rows - 1) / 2) * pitch);
    board.add(tile);
  }
  return board;
}

/** The robot board of the same size, for the cost comparison. */
function robotBoard(cols: number, rows: number): THREE.Group {
  const pitch = 1 + GAP;
  const board = new THREE.Group();
  board.add(robot.buildUnderlay(cols, rows, GAP), robot.buildRim(cols, rows, GAP));
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const tile = robot.buildFloorTile((x + y) % 2 === 1, false);
    tile.position.set((x - (cols - 1) / 2) * pitch, 0, (y - (rows - 1) / 2) * pitch);
    board.add(tile);
  }
  return board;
}

function figure(content: HTMLElement | string, caption: string, cls = ''): string {
  const id = `gb-fig-${Math.random().toString(36).slice(2)}`;
  queueMicrotask(() => {
    if (typeof content !== 'string') document.getElementById(id)?.prepend(content);
  });
  return `<figure id="${id}" class="${cls}">${typeof content === 'string' ? content : ''}<figcaption>${caption}</figcaption></figure>`;
}

const img = (src: string, alt: string): string => `<img src="${src}" alt="${alt}" loading="lazy">`;

function section(sheet: HTMLElement, id: string, title: string, body: string, note: string, wide = true): HTMLElement {
  const el = document.createElement('section');
  el.className = `card garden-board${wide ? ' wide' : ''}`;
  el.id = id;
  el.innerHTML = `<h2>${title}</h2>${body}<p class="note">${note}</p>`;
  sheet.appendChild(el);
  return el;
}

/** Add the garden board cards to the parts sheet. */
export function addGardenBoardCards(sheet: HTMLElement): void {
  const head = document.createElement('section');
  head.className = 'card wide garden-board';
  head.id = 'garden-board';
  head.innerHTML = `<h2>Tuinthema · het bord</h2><p class="note">Grastegel (licht en donker), gloeiende tegel, zandtegel, de rand van gevlochten takken met blaadjes en bloemetjes, de onderplaat met het grasbed. Steeds naast het voorbeeld van de eigenaar. Code: <code>src/render/parts/garden/</code>, maten en kleuren: <code>data/themes/garden/board.json</code>. Nog niet in het spel.</p>`;
  sheet.appendChild(head);

  const PX = 1000;
  const tileCost = cost(buildFloorTile(false, false));
  const robotTileCost = cost(robot.buildFloorTile(false, false));

  // 1. Grass tile, light and dark, next to 02-tile-grass and the sheet version.
  section(sheet, 'garden-tile-grass', 'Grastegel', `<div class="gb-row three">
      ${figure(img(refTile, 'Voorbeeld grastegel'), 'Voorbeeld 02-tile-grass', 'ref')}
      ${figure(still(buildFloorTile(false, true), VIEWS.close, PX, 0.62), 'Grastegel, licht · schuin van boven')}
      ${figure(still(buildFloorTile(true, true), VIEWS.close, PX, 0.62), 'Grastegel, donker (dambord)')}
    </div><div class="gb-row four">
      ${figure(img(refSheetGrass, 'Voorbeeld sheet'), 'Voorbeeld 11-sheet', 'ref small')}
      ${figure(still(buildFloorTile(false, true), VIEWS.quarter, 360), VIEWS.quarter.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.front, 360), VIEWS.front.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.top, 360), VIEWS.top.label)}
    </div>`,
  `Zacht afgerond kussen van gras, ${G.tile.body} cel breed binnen het vak (zodat het grasbed ertussen zichtbaar blijft), ${G.tile.height} hoog zoals de robottegel. Donzige rand van grassprietjes rondom (boven over de afronding en langs de zijkant), vaag klaverpatroon in de bovenkant. De donkere tegel is ${Math.round((1 - G.colors.altShade) * 100)}% donkerder en heeft het patroon een halve slag gedraaid. Kosten per tegel: ${fmt(tileCost.tris)} driehoeken, ${tileCost.draws} tekenopdrachten (robottegel: ${fmt(robotTileCost.tris)} en ${robotTileCost.draws}); op het bord worden alle tegels samengevoegd, dus het aantal tekenopdrachten groeit niet mee.`);

  // 2. The glowing tile, next to 12-sheet-tile-highlight.
  const glowCost = cost(buildHighlightTile(false, false));
  section(sheet, 'garden-tile-highlight', 'Gloeiende tegel', `<div class="gb-row three">
      ${figure(img(refSheetGlow, 'Voorbeeld gloeiende tegel'), 'Voorbeeld 12-sheet-tile-highlight', 'ref small')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.close, PX, 0.66), 'Gloeiende tegel · schuin van boven')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.quarter, PX, 0.66), VIEWS.quarter.label)}
    </div>`,
  `Een grastegel met een lichtere, gelere bovenkant en een geelgroene gloeirand (<code>buildHighlightTile</code>); de gloed zelf is ook los te krijgen (<code>buildTileGlow</code>) om op een gewone tegel te leggen, met een eigen materiaal zodat het spel hem kan laten ademen (${G.glow.pulse.low}–${G.glow.pulse.high} in ${G.glow.pulse.seconds} s). Voorstel voor de hint in de tuin: in plaats van de pijlen van het robotthema gloeien de vakken waar de kuikens heen lopen (<code>hintGlowCells</code>). Kosten: ${fmt(glowCost.tris)} driehoeken + 2 voor de gloed, 1 extra tekenopdracht per gloed.`);

  // 3. The dirt tile, next to 13-sheet-tile-dirt.
  const dirtCost = cost(buildDirtTile(false, false));
  section(sheet, 'garden-tile-dirt', 'Zandtegel (nieuw tegeltype)', `<div class="gb-row three">
      ${figure(img(refSheetDirt, 'Voorbeeld zandtegel'), 'Voorbeeld 13-sheet-tile-dirt', 'ref small')}
      ${figure(still(buildDirtTile(false, true), VIEWS.close, PX, 0.62), 'Zandtegel · schuin van boven')}
      ${figure(still(buildDirtTile(false, true), VIEWS.quarter, PX, 0.62), VIEWS.quarter.label)}
    </div>`,
  `Hetzelfde kussen in warme aarde met korrels en steentjes, een randje kort gras rond de voet en een paar pollen op de hoeken (<code>buildDirtTile</code>). Het spel kent dit tegeltype nog niet; voorstellen staan in <code>design/themes/garden-board.md</code>. Kosten: ${fmt(dirtCost.tris)} driehoeken, ${dirtCost.draws} tekenopdrachten.`);

  // 4. The rim alone, next to 03-rim-vines.
  const rim6 = buildRim(6, 6, GAP);
  const rimCost = cost(rim6);
  const robotRimCost = cost(robot.buildRim(6, 6, GAP));
  section(sheet, 'garden-rim', 'Rand van gevlochten takken', `<div class="gb-row two">
      ${figure(img(refRim, 'Voorbeeld rand'), 'Voorbeeld 03-rim-vines', 'ref')}
      ${figure(still(rim6, VIEWS.top, 1400), 'Rand 6×6 · bovenaanzicht')}
    </div><div class="gb-row two">
      ${figure(still(buildRim(6, 6, GAP), VIEWS.quarter, 1400), 'Driekwart')}
      ${figure(still(buildRim(6, 6, GAP), VIEWS.front, 1400), 'Voorkant')}
    </div>`,
  `Drie takken in elkaar gedraaid langs een afgeronde rechthoek, met een donkere kern ertussen. Het aantal slagen is altijd een heel getal, zodat de vlecht op elk bordformaat naadloos sluit. Blaadjes, ranken en witte bloemetjes staan op vaste plekken: een vast deel van elke zijde (zie <code>decor.clusters</code>), nooit willekeurig. Langs de binnenkant groeit gras tegen de takken op. Kosten (6×6): ${fmt(rimCost.tris)} driehoeken, ${rimCost.draws} tekenopdrachten (robotrand: ${fmt(robotRimCost.tris)} en ${robotRimCost.draws}).`);

  // 5. The whole board next to 01-board-full.
  const lit = [7, 8];
  section(sheet, 'garden-board-full', 'Het hele bord, naast het voorbeeld', `<div class="gb-row two">
      ${figure(img(refBoard, 'Voorbeeld bord'), 'Voorbeeld 01-board-full', 'ref')}
      ${figure(still(gardenBoard(6, 6), VIEWS.top, 1400), 'Tuinbord 6×6 · bovenaanzicht')}
    </div>`,
  'Zelfde opzet als het voorbeeld: 6×6 grastegels in een gevlochten rand, het grasbed ertussen. Het voorbeeld heeft overal dezelfde tegel; hier staat het dambord van licht en donker, zoals bij de robottegels.');

  // 6. Board sizes, top view and as the game's camera sees it at phone size.
  const sizes: [number, number][] = [[4, 4], [5, 7], [6, 6], [8, 8]];
  for (const [cols, rows] of sizes) {
    const board = gardenBoard(cols, rows, cols === 6 ? lit : [], cols === 5 ? [rows * cols - 3, 12] : []);
    const c = cost(board);
    const r = cost(robotBoard(cols, rows));
    const phone = boardPixels(cols, rows, GAP, 390 - 2 * CONFIG.camera.marginX);
    const game = gameView(gardenBoard(cols, rows, cols === 6 ? lit : [], cols === 5 ? [rows * cols - 3, 12] : []), cols, rows, 390, Math.round(390 * (rows / cols) * 0.95 + 40), 3);
    game.style.width = '390px';
    game.className = 'gb-phone';
    section(sheet, `garden-board-${cols}x${rows}`, `Tuinbord ${cols}×${rows}`, `<div class="gb-row two">
        ${figure(still(board, VIEWS.top, 1400), 'Bovenaanzicht')}
        ${figure(game, `Spelcamera (${CONFIG.board.roomy.tilt}° gekanteld, perspectief) op een telefoon van 390 px, echte grootte`, 'game')}
      </div>`,
    `${cols * rows} tegels${cols === 6 ? ', twee gloeiend (hint)' : ''}${cols === 5 ? ', twee zandtegels' : ''}. Tegel ${phone.tile.toFixed(1)} px, rand ${phone.frame.toFixed(1)} px op de telefoon. Bord samengevoegd: ${fmt(c.tris)} driehoeken, ${c.draws} tekenopdrachten (robotbord: ${fmt(r.tris)} en ${r.draws}).`);
  }

  // 7. The glow alone and the hint rule, as a small worked example.
  const cells = hintGlowCells([{ toX: 2, toY: 1, outcome: 'moved' }, { toX: 0, toY: 0, outcome: 'blocked-wall' }, { toX: 3, toY: 0, outcome: 'exited' }], 6);
  const glow = buildTileGlow();
  section(sheet, 'garden-glow', 'Gloed los', `<div class="gb-row three">${figure(still(glow, VIEWS.top, 360, 0.7), 'Gloed van boven')}</div>`,
    `Hint-regel als voorbeeld: kuiken 1 loopt naar (2,1), kuiken 2 botst, kuiken 3 loopt naar de uitgang (3,0) → gloeiende vakken ${cells.join(', ')}.`, false);
}
