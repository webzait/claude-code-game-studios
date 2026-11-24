import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../../config';
import * as robot from '../../render/parts/board';
import { fuse } from '../../render/kit';
import TILE from '../../../data/themes/garden/tile.json';
import { boardFootprint, buildDirtTile, buildFloorTile, buildHighlightTile, buildRim, buildUnderlay } from '../../render/parts/garden/board';

/**
 * Parts sheet, garden board: the shared renderer and card helpers. Each part has its own card file
 * next to this one (tile.ts, highlight.ts, dirt.ts, rim.ts); index.ts puts them on the sheet.
 */

export const GAP = CONFIG.board.grid.gap;
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

export type View = { label: string; dir: THREE.Vector3 };
export const VIEWS = {
  quarter: { label: 'Driekwart', dir: new THREE.Vector3(-0.55, 0.62, 1) },
  front: { label: 'Voorkant', dir: new THREE.Vector3(0, 0.0001, 1) },
  side: { label: 'Zijaanzicht', dir: new THREE.Vector3(1, 0.0001, 0) },
  top: { label: 'Bovenaanzicht', dir: new THREE.Vector3(0, 1, 0.0001) },
  close: { label: 'Van dichtbij, schuin', dir: new THREE.Vector3(0, 1, 0.75) },
} satisfies Record<string, View>;

/** Draw `object` with an orthographic camera from `view`, `px` pixels square, framing `reach` cells round its centre. */
export function still(object: THREE.Object3D, view: View, px: number, reach?: number): HTMLCanvasElement {
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
export function gameView(object: THREE.Object3D, cols: number, rows: number, cssW: number, cssH: number, dpr: number): HTMLCanvasElement {
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
export function cost(object: THREE.Object3D): { tris: number; draws: number } {
  let tris = 0;
  object.traverse((n) => {
    if (!(n instanceof THREE.Mesh) || n.name.endsWith('-glow')) return;
    const g = n.geometry as THREE.BufferGeometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  const fused = fuse(object.clone(true));
  return { tris: Math.round(tris), draws: fused.children.length };
}

export const fmt = (n: number): string => n.toLocaleString('nl-NL');

/** A garden board of `cols` by `rows`: underlay, rim, a checkerboard of grass tiles, plus optional lit and dirt cells. */
export function gardenBoard(cols: number, rows: number, lit: number[] = [], dirt: number[] = []): THREE.Group {
  const pitch = TILE.tile.size + GAP;
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
export function robotBoard(cols: number, rows: number): THREE.Group {
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

export function figure(content: HTMLElement | string, caption: string, cls = ''): string {
  const id = `gb-fig-${Math.random().toString(36).slice(2)}`;
  queueMicrotask(() => {
    if (typeof content !== 'string') document.getElementById(id)?.prepend(content);
  });
  return `<figure id="${id}" class="${cls}">${typeof content === 'string' ? content : ''}<figcaption>${caption}</figcaption></figure>`;
}

export const img = (src: string, alt: string): string => `<img src="${src}" alt="${alt}" loading="lazy">`;

export function section(sheet: HTMLElement, id: string, title: string, body: string, note: string, wide = true): HTMLElement {
  const el = document.createElement('section');
  el.className = `card garden-board${wide ? ' wide' : ''}`;
  el.id = id;
  el.innerHTML = `<h2>${title}</h2>${body}<p class="note">${note}</p>`;
  sheet.appendChild(el);
  return el;
}
