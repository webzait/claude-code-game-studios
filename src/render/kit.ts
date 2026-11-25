import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import redBot from '../../assets/turnflock/3d/flockbot_red.glb?inline';
import blueBot from '../../assets/turnflock/3d/flockbot_blue.glb?inline';
import yellowBot from '../../assets/turnflock/3d/flockbot_yellow.glb?inline';
import floorLight from '../../assets/turnflock/3d/board/floor_light.glb?inline';
import floorAlt from '../../assets/turnflock/3d/board/floor_alt.glb?inline';
import wallBlock from '../../assets/turnflock/3d/board/wall_block.glb?inline';
import exitTile from '../../assets/turnflock/3d/board/exit_tile.glb?inline';

/** Board modules of the asset kit; each is one grid cell in size. The frame and underlay are built in code. */
export type BoardPiece = 'floorLight' | 'floorAlt' | 'wallBlock' | 'exitTile';

/** The asset kit's 3D models, loaded once and cloned wherever they are used. */
export interface Kit {
  readonly robots: Record<Color, THREE.Group>;
  readonly board: Record<BoardPiece, THREE.Group>;
}

/**
 * Fuse every mesh under `source` that shares a material into one mesh. The
 * kit's pieces are many small parts; drawn one by one they cost a phone far
 * more than their triangle count suggests.
 */
export function fuse(source: THREE.Object3D): THREE.Group {
  source.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(source.matrixWorld).invert();
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  source.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const source = node.geometry as THREE.BufferGeometry;
    // Merging needs like with like: every part is made non-indexed first.
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    const list = byMaterial.get(node.material as THREE.Material) ?? [];
    list.push(geometry);
    byMaterial.set(node.material as THREE.Material, list);
  });
  const fused = new THREE.Group();
  for (const [material, geometries] of byMaterial) {
    // Parts drawn with one material may carry different extras (texture coordinates, vertex colours);
    // only what all of them have can be merged.
    const shared = Object.keys(geometries[0].attributes).filter((name) => geometries.every((g) => g.getAttribute(name) !== undefined));
    for (const g of geometries) for (const name of Object.keys(g.attributes)) if (!shared.includes(name)) g.deleteAttribute(name);
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    // Parts that cannot be merged (differing attributes) are kept as they were.
    const parts = merged ? [merged] : geometries;
    for (const geometry of parts) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      fused.add(mesh);
    }
  }
  return fused;
}

/** The models are bundled as data URIs, so they are decoded here and no network request is made. */
function decode(dataUri: string): ArrayBuffer {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Fixed board colours, by the name of the part inside a kit model. Parts not listed keep the file's colour. */
const K = CONFIG.colors.kit;
const PART_COLORS: Record<string, string> = {
  'floor_light:top': K.tileLight,
  'floor_light:sides': K.tileEdge,
  'floor_alt:top': K.tileMid,
  'floor_alt:sides': K.tileEdge,
  'exit_tile:floor': K.tileEdge,
  'exit_tile:green_bezel': K.exitShadow,
  'exit_tile:green_face': K.exit,
  'exit_tile:glow_ring_front': K.exitGlow,
  'exit_tile:glow_ring_back': K.exitGlow,
  'exit_tile:check_short': K.check,
  'exit_tile:check_long': K.check,
  'wall_block:body': K.obstacle,
  'wall_block:top_plate': K.obstacleTop,
  'wall_block:bolt1': K.obstacleBolt,
  'wall_block:bolt2': K.obstacleBolt,
  'wall_block:bolt3': K.obstacleBolt,
  'wall_block:bolt4': K.obstacleBolt,
};
/** The loader drops the colon from part names, so parts are looked up without it. */
const PART_BY_NODE = new Map(Object.entries(PART_COLORS).map(([name, color]) => [name.replace(/:/g, ''), color]));

function parse(loader: GLTFLoader, dataUri: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.parse(decode(dataUri), '', (gltf) => {
      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          // The files carry no metalness value, which glTF reads as fully metallic:
          // the models then mirror the bright room and lose their colour. They are plastic.
          const material = node.material as THREE.MeshStandardMaterial;
          material.metalness = 0;
          // The colour numbers in the files are screen (sRGB) values stored where glTF
          // expects linear ones, which shows red as pink. Read them as intended.
          const fixed = PART_BY_NODE.get(node.name.replace(/:/g, ''));
          if (fixed) material.color.set(fixed);
          else material.color.convertSRGBToLinear();
          material.roughness = 0.32;
          // The exit lights up a little by itself so it reads as the goal.
          if (node.name.startsWith('exit_tile') && /green|glow/.test(node.name)) {
            material.emissive.copy(material.color);
            material.emissiveIntensity = 0.35;
          }
        }
      });
      resolve(gltf.scene);
    }, reject);
  });
}

/** Load every kit model. Rejects when a model cannot be read; the game then keeps its built-in shapes. */
export async function loadKit(): Promise<Kit> {
  const loader = new GLTFLoader();
  const [red, blue, yellow, light, alt, wall, exit] = await Promise.all(
    [redBot, blueBot, yellowBot, floorLight, floorAlt, wallBlock, exitTile].map((uri) => parse(loader, uri)),
  );
  return {
    robots: { red, blue, yellow },
    board: { floorLight: light, floorAlt: alt, wallBlock: wall, exitTile: exit },
  };
}
