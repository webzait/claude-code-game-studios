/**
 * The garden theme's flock chick from the owner's 3D master model (made in ComfyUI, rendered in
 * Blender; skill `turnflock-3d-master`). One mesh for every chick: each colour is only a material,
 * the same base texture recoloured through a mask (r = body, g = belly, b = forehead mark). Eyes,
 * cheeks, beak and feet fall outside the mask and stay as painted.
 *
 * Ported unchanged in behaviour from the block the owner had in the published game on 2026-11-24
 * ("Turnflock 3D Master: gedeeld kuikenmodel"). Until the model has loaded, the garden falls back
 * to the code-built chick (src/render/parts/chick.ts).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from '../../../config';
import type { Color } from '../../../engine/types';
import { bodyYaw, type HeadingStyle } from '../../heading';
import { shapePlate } from '../flockbot';
import type { RobotView } from '../../robot';
import PARTS from '../../../../data/parts.json';
import masterGlb from '../../../../assets/turnflock/garden/chick/chick_master.glb?inline';

/** One chick colour: body, belly and the forehead mark. */
interface ChickPalette {
  readonly body: string;
  readonly belly: string;
  readonly mark: string;
  /** The colour the model was painted in: drawn as is, no recolouring. */
  readonly original?: boolean;
}

/** The owner's tuning (from the published block). */
export const CHICK_MASTER = {
  reference: 'blue',
  colors: {
    blue: { original: true, body: '#04478F', belly: '#4F6E86', mark: '#BABABA' },
    red: { body: '#C21F25', belly: '#D99A96', mark: '#BABABA' },
    yellow: { body: '#EFA90C', belly: '#F2D99A', mark: '#3A3D45' },
    green: { body: '#1E9A45', belly: '#9CCFA4', mark: '#BABABA' },
    purple: { body: '#6A2FB8', belly: '#B9A1DA', mark: '#BABABA' },
    orange: { body: '#E8691A', belly: '#F2BE94', mark: '#BABABA' },
  } as Record<string, ChickPalette>,
  /** The model is 0.85 wide; at this scale the chick (beak included) about fills a tile. */
  scale: 1.05,
  /** Brightness of the whole chick in the game's light (all colours alike). */
  exposure: 1.35,
  /** Share of `robot.lean` used with the "To player" heading style. */
  leanShare: 0.6,
  /** The colour shape (setting "Colour shapes"): a small plate on the crown, behind the crest. */
  badge: { y: 0.688, z: -0.075, tilt: -12, size: 0.27 },
};

const state = {
  ready: false,
  geometry: null as THREE.BufferGeometry | null,
  markGeometry: null as THREE.BufferGeometry | null,
  baseMaterial: null as THREE.MeshStandardMaterial | null,
  mask: null as THREE.Texture | null,
  materials: new Map<string, THREE.Material>(),
  markMaterials: new Map<string, THREE.Material>(),
  promise: null as Promise<void> | null,
};

/** True once the master model has loaded; before that the garden shows the code-built chick. */
export function chickMasterReady(): boolean {
  return state.ready;
}

function decode(dataUri: string): ArrayBuffer {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Load the master model once. Textures go through an image element: inside claude.ai a page may not fetch blob or data URLs. */
export function loadChickMaster(): Promise<void> {
  if (state.promise) return state.promise;
  state.promise = new Promise<void>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register((parser) => {
      (parser as unknown as { textureLoader: THREE.TextureLoader }).textureLoader = new THREE.TextureLoader(parser.options.manager);
      return { name: 'tfm_img_textures' };
    });
    loader.parse(
      decode(masterGlb),
      '',
      async (gltf) => {
        try {
          let mesh: THREE.Mesh | null = null;
          let mark: THREE.Mesh | null = null;
          gltf.scene.traverse((node) => {
            if (!(node instanceof THREE.Mesh)) return;
            // The body carries the texture; the forehead triangle has none.
            if ((node.material as THREE.MeshStandardMaterial).map) mesh ??= node;
            else mark ??= node;
          });
          if (!mesh) throw new Error('no mesh in the chick master model');
          const body = mesh as THREE.Mesh;
          const extras = ((gltf.parser.json.materials?.[0]?.extras?.turnflock ?? {}) as { maskTexture?: number; palette?: Record<string, ChickPalette>; reference?: string });
          state.mask = (await gltf.parser.getDependency('texture', extras.maskTexture ?? 1)) as THREE.Texture;
          state.geometry = body.geometry;
          state.baseMaterial = body.material as THREE.MeshStandardMaterial;
          state.markGeometry = (mark as THREE.Mesh | null)?.geometry ?? null;
          const m = state.baseMaterial;
          m.metalness = 0;
          m.envMapIntensity = 0.55;
          m.color.setScalar(CHICK_MASTER.exposure);
          // The file's palette fills in colours the code does not name; the code wins.
          for (const [k, v] of Object.entries(extras.palette ?? {})) CHICK_MASTER.colors[k] ??= v;
          if (extras.reference) CHICK_MASTER.reference = extras.reference;
          state.ready = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      reject,
    );
  });
  return state.promise;
}

function palette(color: string): ChickPalette {
  const p = CHICK_MASTER.colors[color];
  if (p) return p;
  // A colour without its own line is derived from the game's colour.
  const tones = (CONFIG.colors.robots as Record<string, { main?: string } | undefined>)[color];
  const g = new THREE.Color(tones?.main ?? '#888888');
  return { body: `#${g.clone().lerp(new THREE.Color('#000000'), 0.18).getHexString()}`, belly: `#${g.clone().lerp(new THREE.Color('#FFFFFF'), 0.55).getHexString()}`, mark: '#BABABA' };
}

/** One material per colour: the base texture, recoloured through the mask in the shader. */
function material(color: string): THREE.Material {
  const cached = state.materials.get(color);
  if (cached) return cached;
  const p = palette(color);
  const r = palette(CHICK_MASTER.reference);
  const m = state.baseMaterial!.clone();
  m.name = `chick_${color}`;
  const uniforms = {
    tfmMask: { value: state.mask },
    tfmAmount: { value: p.original ? 0 : 1 },
    tfmRef0: { value: new THREE.Color(r.body) },
    tfmRef1: { value: new THREE.Color(r.belly) },
    tfmRef2: { value: new THREE.Color(r.mark) },
    tfmCol0: { value: new THREE.Color(p.body) },
    tfmCol1: { value: new THREE.Color(p.belly) },
    tfmCol2: { value: new THREE.Color(p.mark) },
  };
  m.userData.tfm = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform sampler2D tfmMask; uniform float tfmAmount;
uniform vec3 tfmRef0, tfmRef1, tfmRef2, tfmCol0, tfmCol1, tfmCol2;
float tfmLight(vec3 c){ return pow(max(dot(c, vec3(.2126,.7152,.0722)), 1e-6), 1./3.); }
vec3 tfmTint(vec3 R, vec3 T, float lx){ float lt=tfmLight(T); float lo=max(lt+(lx-tfmLight(R)),0.); return clamp(T*pow(lo/lt,3.),0.,1.); }
void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
{ vec3 w=texture2D(tfmMask, vMapUv).rgb*tfmAmount; vec3 src=diffuseColor.rgb/max(diffuse,vec3(1e-4)); float lx=tfmLight(src);
  vec3 acc=w.r*tfmTint(tfmRef0,tfmCol0,lx)+w.g*tfmTint(tfmRef1,tfmCol1,lx)+w.b*tfmTint(tfmRef2,tfmCol2,lx);
  diffuseColor.rgb=(src*(1.-min(w.r+w.g+w.b,1.))+acc)*diffuse; }
#endif`,
      );
  };
  // One shader program for every colour.
  m.customProgramCacheKey = () => 'tfm-recolor-1';
  state.materials.set(color, m);
  return m;
}

/** Build a chick from the master model. Call only when `chickMasterReady()`. Same shape as the robot theme's `buildPartsRobot`. */
export function buildMasterChick(id: number, color: Color, style: HeadingStyle = 'faceUp'): RobotView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const lean = new THREE.Group();
  body.add(lean);
  if (style !== 'faceUp') lean.rotation.x = -CONFIG.robot.lean * CHICK_MASTER.leanShare;
  const yaw = new THREE.Group();
  lean.add(yaw);
  const scaled = new THREE.Group();
  scaled.scale.setScalar(CHICK_MASTER.scale);
  yaw.add(scaled);
  const chick = new THREE.Mesh(state.geometry!, material(color));
  chick.name = `chick_${color}`;
  chick.castShadow = true;
  chick.receiveShadow = true;
  scaled.add(chick);
  // Colour shape (setting "Colour shapes"): a plate on the crown, behind the crest.
  const f = CHICK_MASTER.badge;
  const b = PARTS.flockbot.symbol;
  const plate = new THREE.Group();
  plate.position.set(0, f.y, f.z);
  plate.rotation.x = (f.tilt * Math.PI) / 180;
  const markTone = palette(color).mark;
  const light = new THREE.Color(markTone).getHSL({ h: 0, s: 0, l: 0 }).l > 0.45;
  const shape = new THREE.Mesh(shapePlate(color, f.size, b.shape.raise, 0.012), new THREE.MeshStandardMaterial({ color: light ? '#FFFFFF' : markTone, roughness: 0.45 }));
  shape.castShadow = false;
  plate.add(shape);
  plate.visible = false;
  scaled.add(plate);
  // The triangle (heading arrow) on top of the head: white, or the dark mark colour on light chicks (yellow).
  let triangle: THREE.Mesh | null = null;
  if (state.markGeometry) {
    const tone = light ? '#FFFFFF' : markTone;
    let mm = state.markMaterials.get(tone);
    if (!mm) {
      mm = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.45, side: THREE.DoubleSide });
      state.markMaterials.set(tone, mm);
    }
    triangle = new THREE.Mesh(state.markGeometry, mm);
    triangle.name = `chick_mark_${color}`;
    triangle.castShadow = true;
    scaled.add(triangle);
  }
  const aim = (angle: number): void => void (yaw.rotation.y = bodyYaw(angle));
  const showShape = (on: boolean): void => {
    plate.visible = on;
    if (triangle) triangle.visible = !on;
  };
  return { id, color, root, body, lids: [], aim, showShape, angle: 0, blinkIn: 1e9, visibleScale: 1 };
}
