import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Color } from '../engine/types';
import redBot from '../../assets/turnflock/3d/flockbot_red.glb?inline';
import blueBot from '../../assets/turnflock/3d/flockbot_blue.glb?inline';
import yellowBot from '../../assets/turnflock/3d/flockbot_yellow.glb?inline';
import baseCell from '../../assets/turnflock/3d/board/base_cell.glb?inline';
import floorLight from '../../assets/turnflock/3d/board/floor_light.glb?inline';
import floorAlt from '../../assets/turnflock/3d/board/floor_alt.glb?inline';
import wallBlock from '../../assets/turnflock/3d/board/wall_block.glb?inline';
import exitTile from '../../assets/turnflock/3d/board/exit_tile.glb?inline';
import frameEdge from '../../assets/turnflock/3d/board/frame_edge.glb?inline';
import frameCorner from '../../assets/turnflock/3d/board/frame_corner.glb?inline';

/** Board modules of the asset kit; each is one grid cell (or one frame segment) in size. */
export type BoardPiece = 'baseCell' | 'floorLight' | 'floorAlt' | 'wallBlock' | 'exitTile' | 'frameEdge' | 'frameCorner';

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
    const geometry = (node.geometry as THREE.BufferGeometry).clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    const list = byMaterial.get(node.material as THREE.Material) ?? [];
    list.push(geometry);
    byMaterial.set(node.material as THREE.Material, list);
  });
  const fused = new THREE.Group();
  for (const [material, geometries] of byMaterial) {
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
          material.color.convertSRGBToLinear();
          material.roughness = Math.max(material.roughness, 0.4);
        }
      });
      resolve(gltf.scene);
    }, reject);
  });
}

/** Load every kit model. Rejects when a model cannot be read; the game then keeps its built-in shapes. */
export async function loadKit(): Promise<Kit> {
  const loader = new GLTFLoader();
  const [red, blue, yellow, base, light, alt, wall, exit, edge, corner] = await Promise.all(
    [redBot, blueBot, yellowBot, baseCell, floorLight, floorAlt, wallBlock, exitTile, frameEdge, frameCorner].map((uri) => parse(loader, uri)),
  );
  return {
    robots: { red, blue, yellow },
    board: { baseCell: base, floorLight: light, floorAlt: alt, wallBlock: wall, exitTile: exit, frameEdge: edge, frameCorner: corner },
  };
}
