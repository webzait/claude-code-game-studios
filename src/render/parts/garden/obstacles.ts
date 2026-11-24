import * as THREE from 'three';
import { CONFIG } from '../../../config';
import data from '../../../../data/themes/garden/obstacles.json';
import sprites from '../../../../data/themes/garden/obstacle-sprites.json';
import rockUrl from '../../../../assets/turnflock/garden/obstacles/rock.webp';
import rockMossyUrl from '../../../../assets/turnflock/garden/obstacles/rock-mossy.webp';
import stumpUrl from '../../../../assets/turnflock/garden/obstacles/stump.webp';
import bushWhiteUrl from '../../../../assets/turnflock/garden/obstacles/bush-white.webp';
import bushPinkUrl from '../../../../assets/turnflock/garden/obstacles/bush-pink.webp';
import type { GardenObstacleKind } from './obstacleChoice';

/** Every garden obstacle kind, in the order the parts page shows them. */
export const GARDEN_OBSTACLE_KINDS: readonly GardenObstacleKind[] = ['rock', 'rockMossy', 'stump', 'bushWhite', 'bushPink'];

/**
 * The garden theme's obstacles as the owner drew them: each one is the
 * owner's picture (cut out, transparent, baked shadow kept; made by
 * `tools/asset-pipeline/garden-obstacles.py`) on a flat card that faces the
 * game camera, its foot on the tile. Garden counterpart of `buildObstacle`
 * in `src/render/parts/board.ts`.
 */

const URLS: Readonly<Record<GardenObstacleKind, string>> = {
  rock: rockUrl,
  rockMossy: rockMossyUrl,
  stump: stumpUrl,
  bushWhite: bushWhiteUrl,
  bushPink: bushPinkUrl,
};

/** Size and foot of each picture, written by the cutting tool. */
export const OBSTACLE_SPRITES = sprites.obstacles as Readonly<Record<GardenObstacleKind, {
  readonly file: string;
  readonly px: readonly number[];
  readonly bytes: number;
  readonly objectLeft: number;
  readonly objectRight: number;
  readonly objectTop: number;
  readonly foot: number;
}>>;

const materials = new Map<GardenObstacleKind, THREE.MeshBasicMaterial>();
const loaded = new Map<GardenObstacleKind, Promise<void>>();

/**
 * One material per picture, shared by every copy, so the fused board draws
 * each kind once. Unlit and not tone-mapped: the picture shows exactly the
 * owner's colours, light and shadow included.
 */
function material(kind: GardenObstacleKind): THREE.MeshBasicMaterial {
  let m = materials.get(kind);
  if (!m) {
    // Outside a browser (unit tests) there is nothing to load the picture into.
    let map: THREE.Texture;
    if (typeof document === 'undefined') {
      map = new THREE.Texture();
      loaded.set(kind, Promise.resolve());
    } else {
      let done: () => void = () => undefined;
      loaded.set(kind, new Promise<void>((resolve) => (done = resolve)));
      map = new THREE.TextureLoader().load(URLS[kind], () => done(), undefined, () => done());
    }
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    m = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.02, toneMapped: false });
    m.name = `garden-obstacle-${kind}`;
    materials.set(kind, m);
  }
  return m;
}

/** Resolves once every obstacle picture has loaded (or failed), e.g. before taking a snapshot. */
export function obstaclePicturesLoaded(): Promise<void> {
  const kinds = Object.keys(URLS) as GardenObstacleKind[];
  for (const k of kinds) material(k);
  return Promise.all(kinds.map((k) => loaded.get(k))).then(() => undefined);
}

/**
 * The flat card for one picture, in the obstacle's own space (cell centre on
 * the tile top at the origin). The card is square to the game camera's view
 * (tilted `tilt` degrees from straight down, looking towards -z), so the
 * picture is seen undistorted; the object's foot line lies on the floor
 * `footForward` towards the camera, then the whole card moves `lift` along
 * the view towards the camera (no change on screen) so a robot standing
 * behind never cuts into it.
 */
export function spriteGeometry(kind: GardenObstacleKind, mirrored = false, tilt: number = CONFIG.board.roomy.tilt): THREE.BufferGeometry {
  const s = OBSTACLE_SPRITES[kind];
  const S = data.sprite;
  const [w, h] = s.px;
  const perPx = S.width[kind] / ((s.objectRight - s.objectLeft) * w);
  const width = w * perPx;
  const height = h * perPx;
  const t = THREE.MathUtils.degToRad(tilt);
  const toCamera = new THREE.Vector3(0, Math.cos(t), Math.sin(t));
  const up = new THREE.Vector3(0, Math.sin(t), -Math.cos(t));
  const foot = new THREE.Vector3(0, 0, S.footForward).addScaledVector(toCamera, S.lift);
  const centreX = ((s.objectLeft + s.objectRight) / 2) * width;
  const footY = (1 - s.foot) * height;
  const corner = (u: number, v: number): THREE.Vector3 =>
    foot.clone().add(new THREE.Vector3(u * width - centreX, 0, 0)).addScaledVector(up, v * height - footY);
  const g = new THREE.BufferGeometry();
  const p = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((v) => v.toArray()), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => toCamera.toArray()), 3));
  const us = mirrored ? [1, 0, 0, 1] : [0, 1, 1, 0];
  g.setAttribute('uv', new THREE.Float32BufferAttribute([us[0], 0, us[1], 0, us[2], 1, us[3], 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/**
 * One garden obstacle, filling one cell: the owner's picture on a card facing
 * the game camera, to be placed on the floor tile at the cell centre exactly
 * like the robot theme's `buildObstacle()`. `kind` picks the picture (default:
 * the plain rock); an odd `turn` mirrors the pictures that allow it, so
 * neighbouring copies differ (`chooseObstacles` picks both per cell). The
 * card does not turn with `turn`: it always faces the camera.
 */
export function buildObstacle(kind: GardenObstacleKind = 'rock', turn = 0): THREE.Group {
  const mirrored = turn % 2 === 1 && data.sprite.mirror[kind];
  const mesh = new THREE.Mesh(spriteGeometry(kind, mirrored), material(kind));
  // The shadow is in the picture; a flat card would cast a wrong one.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.kind = kind;
  return group;
}
