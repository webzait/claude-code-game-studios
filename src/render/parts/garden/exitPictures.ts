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
}
const SPRITES: Record<SpriteName, Sprite> = Object.assign({}, ...Object.values(FRAGMENTS).map((f) => f.sprites));
const URLS: Record<SpriteName, string> = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/(.+)\.webp$/, '$1'), url]));

/** Tilt of the game camera from straight down: the quads lean back by 90° minus this, so they face it. */
const TILT = THREE.MathUtils.degToRad(CONFIG.board.roomy.tilt);
/** Direction from the board towards the game camera. */
const TOWARDS_CAMERA = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
/** Height of a grass tile's top. */
const TOP = garden.floorStandIn.height;
/** Height of the painted pad's face above the floor, where the sprite's anchor goes. */
const FACE = garden.exit.faceHeight;

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

/** How far a sprite with its anchor at `height` must slide towards the camera so its lower edge stays above the grass. */
function clearance(name: SpriteName, height: number): number {
  const s = SPRITES[name];
  const below = (1 - s.anchor[1]) * s.height;
  // The quad leans back by 90° - tilt, so going `below` down its own height drops `below * sin(tilt)`.
  const drop = below * Math.sin(TILT);
  const need = drop - (height - TOP) + 0.01;
  return Math.max(0, need / TOWARDS_CAMERA.y);
}

function exitSpriteName(look: ExitLook, color?: Color): SpriteName {
  if (look === 'grey') return 'exit-grey';
  if (look === 'rays') return 'exit-rays';
  return color ? (`exit-${color}` as SpriteName) : 'exit-green';
}

const glowMaps = new Map<string, THREE.Texture>();
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
 * The exit: the owner's painted stone pad on a grass tile, in one of its three looks. `color`
 * makes it an exit for one chick colour (the green pad retoned). `userData.check` is the pad picture,
 * `userData.shape` (colour exits) the same pad with the colour's shape for the tick, hidden;
 * `userData.glow` a soft patch of light on the grass to pulse as the robot glow is. The rays
 * look uses the owner's pad with rays; a colour exit shows rays only in green, so in the rays
 * moment it keeps its own colour (see the design doc).
 */
export function buildExit(color?: Color, look: ExitLook = EXIT_MOMENT_LOOKS.waiting): THREE.Group {
  const pad = new THREE.Group();
  pad.name = 'garden-exit-picture';
  pad.add(buildFloorTile(false, false));
  pad.userData.color = color;
  const span = 2 * garden.exit.radius + 2 * garden.exit.glowReach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: glowMap(color), transparent: true, opacity: garden.exit.glowPulse.high, depthWrite: false, toneMapped: false }));
  glow.name = 'exit-glow';
  glow.position.y = TOP + 0.004;
  glow.renderOrder = 1;
  pad.add(glow);
  pad.userData.glow = glow;
  setExitLook(pad, look);
  return pad;
}

/** Put a picture exit into one of its three looks. */
export function setExitLook(pad: THREE.Group, look: ExitLook): void {
  const color = pad.userData.color as Color | undefined;
  for (const key of ['check', 'shape'] as const) {
    const old = pad.userData[key] as THREE.Object3D | undefined;
    if (old) pad.remove(old);
  }
  const name = color && look === 'rays' ? exitSpriteName('green', color) : exitSpriteName(look, color);
  const main = sprite(name, clearance(name, TOP + FACE));
  main.position.y += TOP + FACE;
  pad.add(main);
  pad.userData.check = main;
  if (color) {
    const shapeName = (look === 'grey' ? 'exit-grey' : `exit-shape-${color}`) as SpriteName;
    const shape = sprite(shapeName, clearance(shapeName, TOP + FACE));
    shape.position.y += TOP + FACE;
    shape.visible = false;
    pad.add(shape);
    pad.userData.shape = shape;
  }
  (pad.userData.glow as THREE.Object3D).visible = look !== 'grey';
  pad.userData.look = look;
}

/**
 * Turn tile: a cream pad with the clockwise arrow of the owner's turn button, on a grass tile.
 * A painted picture cannot turn with the chick, so `userData.disc` is an empty group (turning it is
 * harmless); `userData.glow` is a ring of light the game flashes while the tile turns a chick.
 */
export function buildTurnTile(alt = false, pegs = true): THREE.Group {
  const tile = buildFloorTile(alt, pegs);
  const pic = sprite('turn', clearance('turn', TOP + FACE * 0.6));
  pic.position.y += TOP + FACE * 0.6;
  tile.add(pic);
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

/** Pressure plate: the owner's pad retoned lavender, on a grass tile. `userData.button` is the picture; the game lowers it while a chick stands on it. */
export function buildPlate(alt = false, pegs = true): THREE.Group {
  const plate = buildFloorTile(alt, pegs);
  const button = new THREE.Group();
  const pic = sprite('plate', clearance('plate', TOP + FACE * 0.6));
  button.add(pic);
  button.position.y = TOP + FACE * 0.6;
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
