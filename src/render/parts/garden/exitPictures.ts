import * as THREE from 'three';
import { CONFIG } from '../../../config';
import type { Color } from '../../../engine/types';
import garden from '../../../../data/themes/garden/exit.json';
import { radialGlowTexture } from './common';
import { EXIT_MOMENT_LOOKS } from './exit';
import type { ExitLook } from './exitMoments';
import { buildFloorTile } from './specials';
/** Size fragments, one per part, written by tools/asset-pipeline/garden_exit/<part>.py. */
const FRAGMENTS = import.meta.glob<{ sprites: Record<string, Sprite> }>('../../../../data/themes/garden/exit-sprites/*.json', { eager: true, import: 'default' });
/** The pictures themselves. */
const FILES = import.meta.glob<string>('../../../../assets/turnflock/garden/exit/*.webp', { eager: true, query: '?url', import: 'default' });

/**
 * Garden theme, the standard version: the owner's own pictures are the parts. Each is a cut-out
 * WebP (tools/asset-pipeline/turnflock-garden-exit.py) drawn on a flat quad that faces the game
 * camera (tilted `board.roomy.tilt` degrees from straight down), so under that camera it looks
 * exactly as painted: not squashed, not skewed. Same function names, parameters and `userData`
 * as the robot parts in src/render/parts/board.ts; the modelled versions in exit.ts, specials.ts and
 * gazebo.ts stay as an alternative. Design: design/themes/garden-exit.md.
 *
 * Call `loadGardenExitPictures()` once and wait for it before the first frame that shows them.
 */

/** Name of a picture: its file name without `.webp`. */
type SpriteName = string;
/** One picture's size in cells and the point (fractions from its top left) put over the cell centre. */
interface Sprite {
  width: number;
  height: number;
  anchor: number[];
  /** Pad-shaped pictures: the stone tile's box (x0, y0, x1, y1, fractions from the top left). */
  tile?: number[];
}
const SPRITES: Record<SpriteName, Sprite> = Object.assign({}, ...Object.values(FRAGMENTS).map((f) => f.sprites));
const URLS: Record<SpriteName, string> = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/(.+)\.webp$/, '$1'), url]));

/** Tilt of the game camera from straight down: the quads lean back by 90° minus this, so they face it. */
const TILT = THREE.MathUtils.degToRad(CONFIG.board.roomy.tilt);
/** Direction from the board towards the game camera. */
const TOWARDS_CAMERA = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
/** Height of a grass tile's top. */
const TOP = garden.floorStandIn.height;

const textures = new Map<SpriteName, THREE.Texture>();
const pending: Promise<void>[] = [];
const canLoad = typeof document !== 'undefined';

/** The texture of one picture, made once. Outside a browser (unit tests) it stays empty. */
function texture(name: SpriteName): THREE.Texture {
  if (!(name in URLS)) throw new Error(`garden exit picture "${name}" is missing: run tools/asset-pipeline/garden_exit/build.py`);
  let t = textures.get(name);
  if (!t) {
    if (canLoad) {
      const loader = new THREE.TextureLoader();
      let done: () => void = () => undefined;
      pending.push(new Promise<void>((resolve) => (done = resolve)));
      t = loader.load(URLS[name], () => done(), undefined, () => done());
    } else {
      t = new THREE.Texture();
    }
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    textures.set(name, t);
  }
  return t;
}

/** Start loading every picture; resolves when all are in. */
export function loadGardenExitPictures(): Promise<void> {
  for (const name of Object.keys(URLS)) texture(name);
  return Promise.all(pending).then(() => undefined);
}

const materials = new Map<SpriteName, THREE.MeshBasicMaterial>();
function material(name: SpriteName): THREE.MeshBasicMaterial {
  let m = materials.get(name);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: texture(name), transparent: true, depthWrite: false, toneMapped: false, alphaTest: 0.01 });
    materials.set(name, m);
  }
  return m;
}

/**
 * One picture on a quad that faces the game camera. The quad lies in the group's x/y plane with
 * the picture's anchor at the origin; the group is leant back so the quad faces the camera.
 * `lift` slides it towards the camera, which keeps where it is seen but lets it clear the floor.
 */
function sprite(name: SpriteName, lift = 0): THREE.Group {
  const s = SPRITES[name];
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(s.width, s.height), material(name));
  quad.position.set((0.5 - s.anchor[0]) * s.width, (s.anchor[1] - 0.5) * s.height, 0);
  quad.name = name;
  quad.renderOrder = 2;
  const holder = new THREE.Group();
  holder.rotation.x = -(Math.PI / 2 - TILT);
  holder.add(quad);
  holder.position.addScaledVector(TOWARDS_CAMERA, lift);
  holder.userData.sprite = name;
  return holder;
}

/** Width of a cell's tile: a pad picture's stone tile is drawn this wide. */
const CELL = garden.floorStandIn.size;
/** A hair towards the camera, so a tile picture standing on the floor never fights with it. */
const TILE_LIFT = 0.006;

/**
 * A pad-shaped picture standing in for a cell's tile. The owner's stone tile is lined up with the
 * cell: as wide as a grass tile, its front foot on the cell's front edge at floor level, so under the
 * game camera its outline sits where the grass tile it replaces would be (its back edge lands on the
 * cell's back edge, the stone reading about a quarter of a cell high). Scaled uniformly: the picture
 * is not stretched. `ref` is the pad whose tile box places it; another picture (the portal's column
 * of light) can share it, its own anchor landing on the ref's anchor. The holder's origin is the
 * tile's front foot, so a pop scales it up from where it stands.
 */
function tileSprite(name: SpriteName, ref: SpriteName = name): THREE.Group {
  const r = SPRITES[ref];
  const s = SPRITES[name];
  if (!r.tile) throw new Error(`garden exit picture "${ref}" has no tile box: run tools/asset-pipeline/garden_exit/build.py`);
  const [x0, , x1, y1] = r.tile;
  const k = CELL / ((x1 - x0) * r.width);
  // The ref's anchor, measured from the tile's front foot (x right, y up the picture), in cells.
  const ax = (r.anchor[0] - (x0 + x1) / 2) * r.width * k;
  const ay = (y1 - r.anchor[1]) * r.height * k;
  const w = s.width * k;
  const h = s.height * k;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material(name));
  quad.position.set(ax + (0.5 - s.anchor[0]) * w, ay + (s.anchor[1] - 0.5) * h, 0);
  quad.name = name;
  quad.renderOrder = 2;
  const holder = new THREE.Group();
  holder.rotation.x = -(Math.PI / 2 - TILT);
  holder.add(quad);
  holder.position.set(0, 0, CELL / 2).addScaledVector(TOWARDS_CAMERA, TILE_LIFT);
  holder.userData.sprite = name;
  return holder;
}

function exitSpriteName(look: ExitLook, color?: Color): SpriteName {
  if (look === 'grey') return 'exit-grey';
  if (look === 'rays') return 'exit-rays';
  if (look === 'portal') return 'exit-portal';
  return color ? (`exit-${color}` as SpriteName) : 'exit-green';
}

const glowMaps = new Map<string, THREE.Texture>();
/** The round light patch, for the turn tile's ring. */
function glowMap(color?: Color): THREE.Texture {
  const key = color ?? 'all';
  let m = glowMaps.get(key);
  if (!m) {
    const tone = color ? CONFIG.colors.robots[color].top : garden.exit.colors.glow;
    m = radialGlowTexture(tone, tone, 0.62, 1.6);
    glowMaps.set(key, m);
  }
  return m;
}

/**
 * A soft light patch shaped like the square stone tile (a rounded square), so the light round the
 * exit follows the owner's pad instead of a circle. Full inside `inner` (share of the patch's half
 * width), fading to nothing at the patch's edge.
 */
export function squareGlowTexture(tone: string, inner: number, corner: number, falloff: number, n = 128): THREE.DataTexture {
  const c = new THREE.Color(tone);
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    // Rounded-square distance in units of the half width: 0 at the centre, `inner` on the tile's edge.
    const x = Math.abs(((i + 0.5) / n - 0.5) * 2);
    const y = Math.abs(((j + 0.5) / n - 0.5) * 2);
    const qx = Math.max(x - (inner - corner), 0);
    const qy = Math.max(y - (inner - corner), 0);
    const d = Math.hypot(qx, qy) + Math.min(Math.max(x, y) - (inner - corner), 0) - corner + inner;
    const out = Math.min(1, Math.max(0, (d - inner) / (1 - inner)));
    const alpha = d < inner ? 1 : (1 - out) ** falloff;
    data.set([c.r * 255, c.g * 255, c.b * 255, 255 * alpha], (j * n + i) * 4);
  }
  const map = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

const squareGlowMaps = new Map<string, THREE.Texture>();
/** The exit's light patch, square like the tile. */
function exitGlowMap(color?: Color): THREE.Texture {
  const key = color ?? 'all';
  let m = squareGlowMaps.get(key);
  if (!m) {
    const tone = color ? CONFIG.colors.robots[color].top : garden.exit.colors.glow;
    const g = garden.exit.entry.glowSquare;
    m = squareGlowTexture(tone, g.inner, g.corner, g.falloff);
    squareGlowMaps.set(key, m);
  }
  return m;
}

/**
 * The exit: the owner's painted stone pad on a grass tile, in one of its four looks. `color`
 * makes it an exit for one chick colour (the green pad retoned). `userData.check` is the pad picture,
 * `userData.shape` (colour exits) the same pad with the colour's shape for the tick, hidden;
 * `userData.glow` a soft patch of light on the grass to pulse as the robot glow is. The rays
 * look uses the owner's pad with rays; a colour exit shows rays only in green, so in the rays
 * moment it keeps its own colour (see the design doc).
 */
export function buildExit(color?: Color, look: ExitLook = EXIT_MOMENT_LOOKS.waiting): THREE.Group {
  const pad = new THREE.Group();
  pad.name = 'garden-exit-picture';
  // The stone tile is the cell's tile: no grass tile under it.
  pad.userData.color = color;
  const span = 2 * garden.exit.radius + 2 * garden.exit.glowReach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: exitGlowMap(color), transparent: true, opacity: garden.exit.glowPulse.high, depthWrite: false, toneMapped: false }));
  glow.name = 'exit-glow';
  glow.position.y = TOP + 0.004;
  glow.renderOrder = 1;
  pad.add(glow);
  pad.userData.glow = glow;
  setExitLook(pad, look);
  return pad;
}

/** Put a picture exit into one of its four looks (grey, green, rays, portal). */
export function setExitLook(pad: THREE.Group, look: ExitLook): void {
  const color = pad.userData.color as Color | undefined;
  for (const key of ['check', 'shape'] as const) {
    const old = pad.userData[key] as THREE.Object3D | undefined;
    if (old) pad.remove(old);
  }
  // Rays and portal exist only in the owner's green: a colour exit keeps its own colour then.
  const name = color && (look === 'rays' || look === 'portal') ? exitSpriteName('green', color) : exitSpriteName(look, color);
  const main = tileSprite(name);
  pad.add(main);
  pad.userData.check = main;
  if (color) {
    const shapeName = (look === 'grey' ? 'exit-grey' : `exit-shape-${color}`) as SpriteName;
    const shape = tileSprite(shapeName);
    shape.visible = false;
    pad.add(shape);
    pad.userData.shape = shape;
  }
  (pad.userData.glow as THREE.Object3D).visible = look !== 'grey';
  pad.userData.look = look;
}

const E = garden.exit.entry;
const ramp = (k: number, from: number, to: number): number => Math.min(1, Math.max(0, (k - from) / (to - from)));
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** The extra layers of the entry animation of one pad, made on first use: the portal over the pad and the column of light. */
interface EntryLayers {
  portal: THREE.Group | null;
  portalMat: THREE.MeshBasicMaterial | null;
  beam: THREE.Group | null;
  beamQuad: THREE.Mesh | null;
  beamMat: THREE.MeshBasicMaterial | null;
  beamBottom: number;
  beamHeight: number;
  glowOpacity: number;
}

function entryLayers(pad: THREE.Group): EntryLayers {
  let layers = pad.userData.entry as EntryLayers | undefined;
  if (layers) return layers;
  const color = pad.userData.color as Color | undefined;
  layers = { portal: null, portalMat: null, beam: null, beamQuad: null, beamMat: null, beamBottom: 0, beamHeight: 0, glowOpacity: 0 };
  if (!color) {
    // Own materials: the shared ones of the pictures must not fade on every exit at once.
    layers.portal = tileSprite('exit-portal');
    const quad = layers.portal.children[0] as THREE.Mesh;
    layers.portalMat = new THREE.MeshBasicMaterial({ map: texture('exit-portal'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    quad.material = layers.portalMat;
    quad.renderOrder = 3;
    layers.beam = tileSprite('exit-portal-beam', 'exit-portal');
    layers.beamQuad = layers.beam.children[0] as THREE.Mesh;
    layers.beamMat = new THREE.MeshBasicMaterial({ map: texture('exit-portal-beam'), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    layers.beamQuad.material = layers.beamMat;
    layers.beamQuad.renderOrder = 4;
    const beamGeometry = layers.beamQuad.geometry as THREE.PlaneGeometry;
    layers.beamHeight = beamGeometry.parameters.height;
    layers.beamBottom = layers.beamQuad.position.y - layers.beamHeight / 2;
    layers.portal.visible = false;
    layers.beam.visible = false;
    pad.add(layers.portal, layers.beam);
  }
  pad.userData.entry = layers;
  return layers;
}

/**
 * The animation of a chick going into the exit, at progress `k` (0 to 1 over
 * `garden.exit.flashSeconds`): call it every frame of that time, as the robot theme pulses its pad
 * (`pulsePad` in BoardView). The owner's portal picture fades in over the pad, which pops a little;
 * a column of the portal's own light grows up out of its ring and fades; then the pad's look shows
 * again. No ring or circle of its own: the light comes from the square tile's picture. A colour exit
 * (no portal in its colour) only pops and flares its glow. `calm` (reduced motion): the portal only
 * fades in and out. At `k >= 1` everything is back as it was.
 */
export function exitEntry(pad: THREE.Group, k: number, calm = false): void {
  const layers = entryLayers(pad);
  const done = k <= 0 || k >= 1;
  const glow = pad.userData.glow as THREE.Mesh;
  const glowMat = glow.material as THREE.MeshBasicMaterial;
  if (!pad.userData.entryActive && !done) layers.glowOpacity = glowMat.opacity;
  const pop = done || calm ? 1 : 1 + E.pop * Math.sin(Math.PI * ramp(k, 0, E.popUntil));
  for (const key of ['check', 'shape'] as const) (pad.userData[key] as THREE.Object3D | undefined)?.scale.setScalar(pop);
  if (layers.portal && layers.portalMat) {
    layers.portal.visible = !done;
    layers.portal.scale.setScalar(pop);
    layers.portalMat.opacity = done ? 0 : smooth(ramp(k, 0, E.portalIn)) * (1 - smooth(ramp(k, E.portalOut[0], E.portalOut[1])));
  }
  if (layers.beam && layers.beamQuad && layers.beamMat) {
    layers.beam.visible = !done && !calm;
    const rise = ramp(k, E.beamRise[0], E.beamRise[1]);
    // Grows up out of the ring, a touch past full height, then settles.
    const grow = rise < 1 ? E.beamOvershoot * smooth(rise) : E.beamOvershoot - (E.beamOvershoot - 1) * smooth(ramp(k, E.beamRise[1], E.beamFade[0]));
    const g = Math.max(grow, 0.001);
    layers.beamQuad.scale.y = g;
    layers.beamQuad.position.y = layers.beamBottom + (layers.beamHeight * g) / 2;
    layers.beamMat.opacity = E.beamOpacity * smooth(ramp(k, E.beamRise[0], E.beamRise[0] + 0.08)) * (1 - smooth(ramp(k, E.beamFade[0], E.beamFade[1])));
  }
  if (done) {
    if (pad.userData.entryActive) glowMat.opacity = layers.glowOpacity;
  } else {
    glowMat.opacity = Math.min(1, layers.glowOpacity * (1 + (E.glowFlare - 1) * Math.sin(Math.PI * k)));
  }
  pad.userData.entryActive = !done;
}

/**
 * Turn tile: a cream pad with the clockwise arrow of the owner's turn button, standing in for the cell's tile.
 * A painted picture cannot turn with the chick, so `userData.disc` is an empty group (turning it is
 * harmless); `userData.glow` is a ring of light the game flashes while the tile turns a chick.
 */
export function buildTurnTile(_alt = false, _pegs = true): THREE.Group {
  // The stone tile is the cell's tile: no grass tile under it.
  const tile = new THREE.Group();
  tile.name = 'garden-turn-picture';
  tile.add(tileSprite('turn'));
  const disc = new THREE.Group();
  disc.name = 'turn-disc';
  disc.position.y = TOP;
  tile.add(disc);
  const span = garden.turnTile.glow.outer * 2;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: glowMap(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  glow.name = 'turn-glow';
  glow.position.y = TOP + 0.004;
  tile.add(glow);
  tile.userData.disc = disc;
  tile.userData.glow = glow;
  return tile;
}

/** Pressure plate: the owner's pad retoned lavender, standing in for the cell's tile. `userData.button` is the picture; the game lowers it while a chick stands on it. */
export function buildPlate(_alt = false, _pegs = true): THREE.Group {
  // The stone tile is the cell's tile: no grass tile under it.
  const plate = new THREE.Group();
  plate.name = 'garden-plate-picture';
  const button = new THREE.Group();
  button.add(tileSprite('plate'));
  button.userData.restY = button.position.y;
  plate.add(button);
  plate.userData.button = button;
  return plate;
}

/**
 * Gate: a stretch of the owner's balustrade, retoned lavender, standing on a grass tile.
 * `userData.door` is its holder, leant to face the camera with its foot at the origin, so the
 * game's `door.scale.y = gateDoorScale(open)` lowers it into the grass along the picture's own
 * height.
 */
export function buildGate(alt = false, pegs = true): THREE.Group {
  const gate = buildFloorTile(alt, pegs);
  const door = sprite('gate');
  door.position.y = TOP;
  door.position.z = 0.18;
  gate.add(door);
  gate.userData.door = door;
  return gate;
}

/** Height scale of the gate picture: full when shut, a low lavender line when open. */
export function gateDoorScale(open: boolean): number {
  return open ? 0.12 : 1;
}

/**
 * The gazebo picture (`08-gazebo`), or with `goal` the gazebo with the lit pad (`24-sheet-gazebo-goal`),
 * facing the game camera, its foot at the origin. For the level-complete moment and the end of the
 * level path, not for a board cell.
 */
export function buildGazebo(goal = true): THREE.Group {
  const root = new THREE.Group();
  root.name = 'garden-gazebo-picture';
  root.add(sprite(goal ? 'gazebo-goal' : 'gazebo'));
  return root;
}

/** The picture behind a part, for the parts sheet. */
export function pictureUrl(name: SpriteName): string {
  return URLS[name];
}
