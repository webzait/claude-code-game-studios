/**
 * Picture parts: a theme part may be one of the owner's pictures (a cut-out
 * WebP with transparency) instead of a model. Two shapes cover the board:
 *
 * - `buildBillboard`: a picture whose foot stands on the tile and which turns to
 *   face the camera every frame (obstacles, the exit, decor on the board).
 * - `buildDecal`: a picture lying flat, optionally cut from part of a larger
 *   picture (a tile's face, the rim's corner and edge pieces).
 *
 * Both draw as cut-outs: pixels under `alphaCut` are not drawn at all and write no
 * depth, so pictures, chicks and robots overlap by depth with no sorting and no
 * light seam around the picture; with the renderer's antialiasing the cut edge is
 * smoothed (alpha to coverage). Pictures are drawn unlit by default: the light is
 * painted in them. Contract: design/themes.md.
 */
import * as THREE from 'three';

/** Pixels whose alpha is under this are left out (0..1). */
export const DEFAULT_ALPHA_CUT = 0.5;

const textures = new Map<string, THREE.Texture>();
const materials = new Map<string, THREE.Material>();

/**
 * Prepare a texture for a picture part: sRGB colours, mipmaps with trilinear filtering
 * so it stays sharp and calm when small, the widest anisotropy the device has, edges clamped.
 */
export function prepareSpriteTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // three.js lowers this to what the device supports.
  texture.anisotropy = 16;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * The texture for an imported picture (`import rock from '../../../../assets/turnflock/garden/obstacles/rock.webp'`).
 * One texture per picture, shared by every part that uses it; it appears as soon as it has decoded.
 * The single-file build inlines the picture, so no request leaves the page.
 */
export function spriteTexture(url: string): THREE.Texture {
  let texture = textures.get(url);
  if (!texture) {
    texture = prepareSpriteTexture(new THREE.TextureLoader().load(url));
    textures.set(url, texture);
  }
  return texture;
}

/** How a picture part is drawn. */
export interface SpriteLook {
  /** Lit by the scene's light (`true`) or shown with its own painted light (`false`, the default). */
  readonly lit?: boolean;
  /** Alpha under which a pixel is left out. */
  readonly alphaCut?: number;
}

/** One material per texture and look, so parts that share a picture can be fused into one mesh. */
export function spriteMaterial(texture: THREE.Texture, look: SpriteLook = {}): THREE.Material {
  const lit = look.lit === true;
  const alphaTest = look.alphaCut ?? DEFAULT_ALPHA_CUT;
  const key = `${texture.uuid}|${lit}|${alphaTest}`;
  let material = materials.get(key);
  if (!material) {
    const options = { map: texture, alphaTest, alphaToCoverage: true, transparent: false, side: THREE.DoubleSide };
    material = lit ? new THREE.MeshStandardMaterial({ ...options, roughness: 1, metalness: 0 }) : new THREE.MeshBasicMaterial(options);
    materials.set(key, material);
  }
  return material;
}

/** Part of a picture, in texture coordinates from the bottom left: [left, bottom, right, top]. */
export type UvRect = readonly [number, number, number, number];
const WHOLE: UvRect = [0, 0, 1, 1];

function plane(width: number, height: number, uv: UvRect): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height);
  const [u0, v0, u1, v1] = uv;
  const attr = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) attr.setXY(i, u0 + attr.getX(i) * (u1 - u0), v0 + attr.getY(i) * (v1 - v0));
  return geometry;
}

/** Options for an upright picture. */
export interface BillboardOptions extends SpriteLook {
  /** Width in world units (a tile is `floorTile.size` wide, data/parts.json). */
  readonly width: number;
  /** Height in world units; left out, it follows the picture's proportions given by `aspect`. */
  readonly height?: number;
  /** Picture width / height, used when `height` is left out. */
  readonly aspect?: number;
  /** Where the foot is, as a share of the picture's height from the bottom (transparent space under the foot). */
  readonly foot?: number;
  /** Part of the picture to show. */
  readonly uv?: UvRect;
  /**
   * `camera` (default): faces the camera fully, pivoting on the foot, so the picture shows unsquashed
   * under the board's steep camera. `upright`: turns only around the vertical (looks squashed from above).
   */
  readonly facing?: 'upright' | 'camera';
  /** Casts a shadow shaped like the picture. Default true. */
  readonly castShadow?: boolean;
}

const forward = new THREE.Vector3();
const parentTurn = new THREE.Quaternion();

/**
 * An upright picture standing on the origin (the tile's surface when placed on it) that faces the
 * camera every frame. The returned group is what a build function returns or adds; it is marked
 * `userData.keepApart`, so the board does not fuse it into the still geometry (src/render/kit.ts).
 */
export function buildBillboard(texture: THREE.Texture, options: BillboardOptions): THREE.Group {
  const width = options.width;
  const height = options.height ?? width / (options.aspect ?? 1);
  const geometry = plane(width, height, options.uv ?? WHOLE);
  // Foot at the origin: the picture's bottom edge sits `foot` of its height below the tile.
  geometry.translate(0, height / 2 - (options.foot ?? 0) * height, 0);
  const mesh = new THREE.Mesh(geometry, spriteMaterial(texture, options));
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = false;
  const facing = options.facing ?? 'camera';
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    if (facing === 'camera') {
      mesh.parent?.getWorldQuaternion(parentTurn);
      mesh.quaternion.copy(parentTurn.invert().multiply(camera.quaternion));
      return;
    }
    // Turn around y towards where the camera looks from, in the parent's frame.
    camera.getWorldDirection(forward);
    const yaw = Math.atan2(-forward.x, -forward.z);
    mesh.parent?.getWorldQuaternion(parentTurn);
    const parentYaw = new THREE.Euler().setFromQuaternion(parentTurn, 'YXZ').y;
    mesh.rotation.set(0, yaw - parentYaw, 0);
  };
  const group = new THREE.Group();
  group.add(mesh);
  group.userData.keepApart = true;
  return group;
}

/** Options for a flat picture. */
export interface DecalOptions extends SpriteLook {
  /** Size along x and z in world units. */
  readonly width: number;
  readonly depth: number;
  /** Height above the origin (lay it a hair over the surface it covers). */
  readonly y?: number;
  /** Part of the picture to show, for corner and edge pieces cut from one picture. */
  readonly uv?: UvRect;
  /** Quarter turns around y, to reuse one edge piece on all four sides. */
  readonly quarterTurns?: number;
}

/**
 * A picture lying flat, its top towards -z (away from the player), centred on the origin.
 * Still geometry: the board fuses it with everything else that shares its picture.
 */
export function buildDecal(texture: THREE.Texture, options: DecalOptions): THREE.Mesh {
  const geometry = plane(options.width, options.depth, options.uv ?? WHOLE);
  geometry.rotateX(-Math.PI / 2);
  if (options.quarterTurns) geometry.rotateY((options.quarterTurns * Math.PI) / 2);
  geometry.translate(0, options.y ?? 0.001, 0);
  const mesh = new THREE.Mesh(geometry, spriteMaterial(texture, options));
  mesh.receiveShadow = options.lit === true;
  return mesh;
}
