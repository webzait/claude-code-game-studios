import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../../config';
import type { Color } from '../../../engine/types';
import garden from '../../../../data/themes/garden/exit.json';
import { shapePlate } from '../flockbot';
import { hash01, once, radialGlowTexture, shadedDisc, shadowed, slab, tickShape, turned, type TurnPoint, type TurnShaping } from './common';
import type { ExitLook, ExitMomentLooks } from './exitMoments';

/**
 * Garden theme: the exit pad, after the owner's sheet `22-sheet-exit-pad-states`. A round stone
 * plinth of hewn blocks with a rounded stone cap ring, and inside it a recessed face with a thick
 * white tick. It has three looks: `grey` (plain stone), `green` (the lit pad) and `rays` (lit, with
 * three yellow rays above it). Which look belongs to which moment of play: `exitMoment` and
 * `moments` in data/themes/garden/exit.json. Design: design/themes/garden-exit.md.
 *
 * Same contract as `buildExit` in src/render/parts/board.ts: one cell wide, robots (chicks) walk
 * onto it, and `userData` carries `glow`, `check` and, for an exit of one colour, `shape`.
 */

const E = garden.exit;
const C = E.colors;

/** Which look each moment of play wears, as the data file sets it. */
export const EXIT_MOMENT_LOOKS: ExitMomentLooks = {
  waiting: garden.moments.waiting as ExitLook,
  entered: garden.moments.entered as ExitLook,
  complete: garden.moments.complete as ExitLook,
  spent: garden.moments.spent as ExitLook,
};

const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });

/** Distance (as a fraction of the joint width) from angle `a` to the nearest of `count` joints rotated by `offset`; with the index of the block `a` lies in. */
function jointAt(a: number, count: number, offset: number, radius: number): { near: number; block: number } {
  const step = (Math.PI * 2) / count;
  const u = a / step - offset;
  const block = Math.floor(u);
  const frac = u - block;
  const arc = Math.min(frac, 1 - frac) * step * radius;
  return { near: Math.max(0, 1 - arc / E.jointWidth), block: ((block % count) + count) % count };
}

/** Joints carved into a ring of `count` blocks: grooves pulled in and darkened, blocks a little different in tone. */
function blockShaping(count: number, offset: number, radius: number, joint: THREE.Color, reach: (k: number) => number, seed: number): (a: number, k: number) => TurnShaping {
  return (a, k) => {
    const { near, block } = jointAt(a, count, offset, radius);
    const groove = near * near * (3 - 2 * near);
    const r = reach(k);
    return { inset: E.jointDepth * groove * r, mix: 0.85 * groove * r, tint: joint, gain: 1 + (hash01(block + seed) - 0.5) * 2 * E.toneJitter };
  };
}

/** The leaning outer wall of hewn blocks, from the foot up to under the cap. */
function wallGeometry(): THREE.BufferGeometry {
  const profile: TurnPoint[] = [
    { r: E.wallFoot - E.footRound, y: 0, color: C.stoneFoot },
    { r: E.wallFoot - E.footRound * 0.3, y: E.footRound * 0.3, color: C.stoneFoot },
    { r: E.wallFoot, y: E.footRound, color: C.stoneSide },
    { r: (E.wallFoot + E.wallTop) / 2, y: E.wallHeight * 0.55, color: C.stoneSide },
    { r: E.wallTop, y: E.wallHeight, color: C.stoneMid },
    { r: E.wallTop - 0.03, y: E.wallHeight + 0.01, color: C.stoneMid },
  ];
  return turned(profile, E.stations, blockShaping(E.wallJoints, 0.5, E.wallFoot, new THREE.Color(C.joint), (k) => (k >= 2 && k <= 4 ? 1 : 0.4), 3));
}

/**
 * The cap: a ring of curved stone blocks with a rounded crown, lying on the wall. `lit` tints its
 * joints and inner edge with green light, as on the lit pads of the sheet.
 */
function capGeometry(lit: boolean, color?: Color): THREE.BufferGeometry {
  // A colour exit's light is its own colour, also in the joints and on the inner edge.
  const lip = !color ? C.lipGreen : new THREE.Color(CONFIG.colors.robots[color].top).lerp(new THREE.Color('#FFFFFF'), 0.45).getStyle();
  const lineLit = !color ? C.jointLit : CONFIG.colors.robots[color].top;
  const faceEdge = !color ? C.faceGreenEdge : CONFIG.colors.robots[color].main;
  const r = E.capRound;
  const top = E.capTop;
  const inner = E.capInner;
  const outer = E.capOuter;
  const bottom = E.wallHeight - 0.004;
  const pts: TurnPoint[] = [{ r: outer - 0.004, y: bottom, color: C.stoneSide }];
  // Outer shoulder, then the crown, then the inner shoulder down to below the face.
  const steps = 3;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    pts.push({ r: outer - r + Math.cos(t) * r, y: top - r + Math.sin(t) * r, color: i === steps ? C.stoneTop : new THREE.Color(C.stoneMid).lerp(new THREE.Color(C.stoneTop), i / steps) });
  }
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI / 2 + (i / steps) * (Math.PI / 2);
    const edge = lit ? new THREE.Color(C.stoneTop).lerp(new THREE.Color(lip), (i / steps) * 0.75) : new THREE.Color(C.stoneTop).lerp(new THREE.Color(C.stoneMid), i / steps);
    pts.push({ r: inner + r + Math.cos(t) * r, y: top - r + Math.sin(t) * r, color: edge });
  }
  pts.push({ r: inner, y: E.faceHeight - 0.012, color: lit ? faceEdge : C.faceGreyEdge });
  const joint = new THREE.Color(lit ? lineLit : C.joint);
  return turned(pts, E.stations, blockShaping(E.capJoints, 0, (inner + outer) / 2, joint, (k) => (k === 0 || k === pts.length - 1 ? 0.3 : 1), 17));
}

/** The face colours of each look; a colour exit lights up in its own colour. */
function faceStops(look: ExitLook, color?: Color): [number, string][] {
  if (look === 'grey') return [[0, '#A9AEC2'], [0.75, C.faceGrey], [1, C.faceGreyEdge]];
  if (!color) return [[0, C.faceGreenCentre], [0.55, C.faceGreen], [0.88, C.faceGreen], [1, C.lipGreen]];
  const t = CONFIG.colors.robots[color];
  const centre = new THREE.Color(t.top).lerp(new THREE.Color('#FFFFFF'), 0.35).getStyle();
  return [[0, centre], [0.55, t.main], [0.88, t.main], [1, new THREE.Color(t.top).lerp(new THREE.Color('#FFFFFF'), 0.5).getStyle()]];
}

interface LookMaterials {
  face: THREE.Material;
  check: THREE.Material;
}
const lookMats = new Map<string, LookMaterials>();
/** Face and tick materials of one look (and colour). Made once. */
function materialsFor(look: ExitLook, color?: Color): LookMaterials {
  const key = look === 'grey' ? 'grey' : `lit-${color ?? 'all'}`;
  let m = lookMats.get(key);
  if (!m) {
    const lit = look !== 'grey';
    const glowTone = !color ? C.faceGreen : CONFIG.colors.robots[color].main;
    const face = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: lit ? glowTone : '#000000', emissiveIntensity: lit ? 0.32 : 0 });
    // White does not read on a light yellow face: there the tick takes the colour's darkest tone.
    const ink = !lit ? C.checkGrey : color === 'yellow' ? CONFIG.colors.robots.yellow.deep : C.check;
    const check = new THREE.MeshPhysicalMaterial({ color: ink, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: ink, emissiveIntensity: lit ? 0.3 : 0.05 });
    m = { face, check };
    lookMats.set(key, m);
  }
  return m;
}

const glowMaps = new Map<string, THREE.DataTexture>();
function glowMap(color?: Color): THREE.DataTexture {
  const key = color ?? 'all';
  let map = glowMaps.get(key);
  if (!map) {
    const near = !color ? C.glow : new THREE.Color(CONFIG.colors.robots[color].top).lerp(new THREE.Color('#FFFFFF'), 0.4).getStyle();
    const far = !color ? C.glowFar : CONFIG.colors.robots[color].top;
    map = radialGlowTexture(near, far, (2 * E.radius) / (2 * E.radius + 2 * E.glowReach), E.glowFalloff);
    glowMaps.set(key, map);
  }
  return map;
}

/** One ray: a rounded trapezoid, narrow end towards the pad, lying in the x/y plane with its narrow end at the origin. */
function rayGeometry(): THREE.BufferGeometry {
  const R = E.rays;
  const s = new THREE.Shape();
  const n = R.widthNear / 2;
  const f = R.widthFar / 2;
  const L = R.length;
  const c = Math.min(0.02, n * 0.5);
  s.moveTo(-n + c, 0);
  s.lineTo(n - c, 0);
  s.quadraticCurveTo(n, 0, n, c);
  s.lineTo(f, L - c);
  s.quadraticCurveTo(f, L, f - c, L);
  s.lineTo(-f + c, L);
  s.quadraticCurveTo(-f, L, -f, L - c);
  s.lineTo(-n, c);
  s.quadraticCurveTo(-n, 0, -n + c, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: R.thickness, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -R.thickness / 2);
  // Brighter at the tip, as on the sheet.
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const a = new THREE.Color(C.ray);
  const b = new THREE.Color(C.rayTip);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    mixed.copy(a).lerp(b, Math.min(1, Math.max(0, position.getY(i) / L)) ** 2 * 0.7);
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
const rayMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

/**
 * The fan of rays: `count` rays spread over `spread` degrees, standing behind the pad and leaning
 * back by `lean` degrees, so under the game camera (30° from straight down) they read at full
 * length above the pad, as on the sheet.
 */
function buildRays(): THREE.Group {
  const R = E.rays;
  // All rays in one geometry (one draw call), laid out in the fan's own plane.
  const fanGeometry = once('garden-exit-rays', () => {
    const one = rayGeometry();
    const all: THREE.BufferGeometry[] = [];
    for (let k = 0; k < R.count; k++) {
      const angle = THREE.MathUtils.degToRad((k - (R.count - 1) / 2) * R.spread);
      const g = one.clone();
      g.rotateZ(angle);
      g.translate(-Math.sin(angle) * R.from, Math.cos(angle) * R.from, 0);
      all.push(g.index ? g.toNonIndexed() : g);
    }
    for (const g of all) for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    const merged = mergeGeometries(all, false)!;
    // Light, not body: an empty box at the fan's origin (on top of the pad) keeps the rays out of the pad's measured size.
    merged.boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
    return merged;
  });
  const fan = new THREE.Mesh(fanGeometry, rayMat);
  fan.rotation.x = -THREE.MathUtils.degToRad(R.lean);
  fan.position.set(0, R.height, -R.back);
  const holder = new THREE.Group();
  holder.add(fan);
  return holder;
}

/**
 * The garden exit pad, one cell across. `color` makes it an exit for that chick colour only: the
 * same stone with a face in that colour, and the colour's shape at `userData.shape` (hidden until
 * the "Colour shapes" setting asks for it). `look` picks one of the sheet's three looks; change
 * it later with `setExitLook`.
 *
 * `userData.glow` is a flat patch of light round the pad with its own material, to pulse as the
 * robot pad's glow is (`glowPulse` in the data file); it is hidden in the grey look. `userData.rays`
 * is the fan of rays, shown only in the `rays` look. Glow and rays are light, not body: they do
 * not count towards the pad's measured size.
 */
export function buildExit(color?: Color, look: ExitLook = EXIT_MOMENT_LOOKS.waiting): THREE.Group {
  const pad = new THREE.Group();
  pad.name = 'garden-exit';
  const wall = new THREE.Mesh(once('garden-exit-wall', wallGeometry), stone);
  wall.name = 'exit-wall';
  const cap = new THREE.Mesh(once('garden-exit-cap', () => capGeometry(false)), stone);
  cap.name = 'exit-cap';
  const face = new THREE.Mesh(once('garden-exit-face-grey', () => shadedDisc(E.capInner + 0.01, faceStops('grey'), E.stations, 6)), materialsFor('grey').face);
  face.name = 'exit-face';
  face.position.y = E.faceHeight;
  const check = new THREE.Mesh(once('garden-exit-check', () => slab(tickShape(E.check, E.checkWidth, E.checkPath), E.checkDepth, E.checkBevel, 10)), materialsFor('grey').check);
  check.name = 'exit-check';
  check.position.y = E.faceHeight;
  pad.add(wall, cap, face, check);
  shadowed(pad);
  check.castShadow = false;
  face.castShadow = false;
  pad.userData.check = check;
  pad.userData.color = color;
  if (color) {
    const plate = new THREE.Mesh(shapePlate(color, E.capInner * 2 * 0.62, E.checkDepth, 0), materialsFor('grey').check);
    plate.position.y = E.faceHeight;
    plate.visible = false;
    pad.add(plate);
    pad.userData.shape = plate;
  }

  const span = 2 * E.radius + 2 * E.glowReach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  // Keep the light out of the pad's bounding box: see the doc comment.
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-E.radius, 0, -E.radius), new THREE.Vector3(E.radius, 0, E.radius));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: glowMap(color), transparent: true, opacity: E.glowPulse.high, depthWrite: false, toneMapped: false }));
  glow.name = 'exit-glow';
  glow.position.y = garden.floorStandIn.height + E.glowLift;
  glow.renderOrder = 1;
  pad.add(glow);
  pad.userData.glow = glow;

  const rays = buildRays();
  rays.name = 'exit-rays';
  pad.add(rays);
  pad.userData.rays = rays;
  setExitLook(pad, look);
  return pad;
}

/**
 * Put a pad made by `buildExit` into one of its three looks: swaps the cap, face and tick
 * materials and shows or hides the glow and the rays. Cheap: no geometry is built.
 */
export function setExitLook(pad: THREE.Group, look: ExitLook): void {
  const color = pad.userData.color as Color | undefined;
  const lit = look !== 'grey';
  // No modelled portal: it is shown as the lit pad.
  const m = materialsFor(look === 'portal' ? 'green' : look, color);
  const cap = pad.getObjectByName('exit-cap') as THREE.Mesh;
  const face = pad.getObjectByName('exit-face') as THREE.Mesh;
  cap.geometry = lit ? once(`garden-exit-cap-lit-${color ?? 'all'}`, () => capGeometry(true, color)) : once('garden-exit-cap', () => capGeometry(false));
  face.geometry = lit ? once(`garden-exit-face-${color ?? 'all'}`, () => shadedDisc(E.capInner + 0.01, faceStops('green', color), E.stations, 6)) : once('garden-exit-face-grey', () => shadedDisc(E.capInner + 0.01, faceStops('grey'), E.stations, 6));
  face.material = m.face;
  (pad.userData.check as THREE.Mesh).material = m.check;
  if (pad.userData.shape) (pad.userData.shape as THREE.Mesh).material = m.check;
  (pad.userData.glow as THREE.Mesh).visible = lit;
  (pad.userData.rays as THREE.Object3D).visible = look === 'rays';
  pad.userData.look = look;
}

/** The look a pad is in now. */
export function exitLookOf(pad: THREE.Object3D): ExitLook {
  return pad.userData.look as ExitLook;
}

