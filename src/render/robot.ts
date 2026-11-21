import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import { fuse } from './kit';

/** A robot mesh plus the animated values the board view tweens. */
export interface RobotView {
  readonly id: number;
  readonly color: Color;
  /** Outer group: board position. */
  readonly root: THREE.Group;
  /** Body: always faces the player; hops and squashes. */
  readonly body: THREE.Group;
  /** Head cap with the arrow: turns to show the heading. */
  readonly cap: THREE.Group;
  readonly lids: THREE.Mesh[];
  /** Point the arrow (and the gaze) along a heading, in radians. */
  readonly aim: (angle: number) => void;
  /** Cumulative heading in radians, so turns always animate clockwise. */
  angle: number;
  /** Seconds until the next blink. */
  blinkIn: number;
  visibleScale: number;
}

const shared = {
  body: new RoundedBoxGeometry(0.76, 0.6, 0.76, 6, 0.24),
  base: new RoundedBoxGeometry(0.56, 0.1, 0.56, 3, 0.05),
  eye: new THREE.SphereGeometry(0.135, 28, 20),
  pupil: new THREE.SphereGeometry(0.07, 20, 14),
  glint: new THREE.SphereGeometry(0.024, 10, 8),
  arrow: makeArrow(),
};

/** Rounded arrowhead pointing to -z (north on the board). */
function makeArrow(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.17);
  s.quadraticCurveTo(0.03, 0.17, 0.05, 0.14);
  s.lineTo(0.17, -0.08);
  s.quadraticCurveTo(0.19, -0.13, 0.13, -0.12);
  s.quadraticCurveTo(0, -0.07, -0.13, -0.12);
  s.quadraticCurveTo(-0.19, -0.13, -0.17, -0.08);
  s.lineTo(-0.05, 0.14);
  s.quadraticCurveTo(-0.03, 0.17, 0, 0.17);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.012, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Build one robot. The body and its big eyes always face the player; the
 * arrow on its head turns to show where it is heading, and the pupils glance
 * the same way.
 */
export function buildRobot(id: number, color: Color): RobotView {
  const tint = new THREE.Color(CONFIG.colors[color]);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shell = new THREE.Mesh(
    shared.body,
    new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.38, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.55 }),
  );
  shell.position.y = 0.37;
  shell.castShadow = true;
  body.add(shell);

  // Barely visible feet: a low dark pad tucked under the body.
  const base = new THREE.Mesh(shared.base, new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.4), roughness: 0.8 }));
  base.position.y = 0.05;
  body.add(base);

  // Big eyes high on the front, tilted up so they read from above.
  const white = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#141A2E', roughness: 0.2 });
  const lidMat = new THREE.MeshPhysicalMaterial({ color: tint.clone().multiplyScalar(0.82), roughness: 0.35, clearcoat: 0.6 });
  const face = new THREE.Group();
  // On the rounded front-top edge of the body, pointing up and toward the player.
  face.position.set(0, 0.6, 0.315);
  face.rotation.x = -0.82;
  const pupils: THREE.Object3D[] = [];
  const lids: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.155, 0, 0);
    const ball = new THREE.Mesh(shared.eye, white);
    ball.scale.set(1, 1.08, 0.62);
    const pupil = new THREE.Group();
    const dot = new THREE.Mesh(shared.pupil, dark);
    dot.scale.set(1, 1, 0.5);
    dot.position.z = 0.062;
    const glint = new THREE.Mesh(shared.glint, white);
    glint.position.set(0.026, 0.03, 0.094);
    pupil.add(dot, glint);
    const lid = new THREE.Mesh(shared.eye, lidMat);
    lid.scale.set(1.06, 1.14, 0.7);
    lid.visible = false;
    eye.add(ball, pupil, lid);
    pupils.push(pupil);
    lids.push(lid);
    face.add(eye);
  }
  body.add(face);

  const cap = new THREE.Group();
  cap.position.set(0, 0.68, -0.09);
  cap.scale.setScalar(1.3);
  const arrowColor = color === 'yellow' ? '#3A3118' : '#FFFFFF';
  const arrow = new THREE.Mesh(shared.arrow, new THREE.MeshStandardMaterial({ color: arrowColor, roughness: 0.4 }));
  arrow.castShadow = false;
  cap.add(arrow);
  body.add(cap);

  const aim = (angle: number): void => {
    cap.rotation.y = angle;
    // Heading as seen by the player: -sin is right/left, cos is away/toward.
    const dx = -Math.sin(angle);
    const dz = -Math.cos(angle);
    for (const pupil of pupils) pupil.position.set(dx * 0.045, -dz * 0.04, 0);
  };
  return { id, color, root, body, cap, lids, aim, angle: 0, blinkIn: 1 + ((id * 37) % 23) / 6, visibleScale: 1 };
}

/** Tuning of the asset-kit robot inside one cell. */
/** The kit body is 0.89 wide; scaled so the robot fills the configured share of a tile. */
const KIT_BODY_WIDTH = 0.89;
const KIT_SCALE = CONFIG.board.grid.robotFill / KIT_BODY_WIDTH;
const KIT_TILT = -0.3;
/** The kit's eyes are small; they are enlarged and raised to read as big eyes high on the front. */
const KIT_EYE_SCALE = 1.55;
const KIT_FACE_LIFT = 0.07;

/** Scale a model part around its own middle rather than around the model's origin. */
function growInPlace(node: THREE.Object3D, sx: number, sy: number, lift: number): void {
  // The kit's parts carry no transform of their own, so the shape's own box is its place in the model.
  const geometry = (node as THREE.Mesh).geometry as THREE.BufferGeometry;
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox!.getCenter(new THREE.Vector3());
  node.scale.set(sx, sy, 1);
  node.position.set(centre.x * (1 - sx), centre.y * (1 - sy) + lift, 0);
}

/**
 * Build a robot from the asset kit's model. The model's face looks at the
 * player and its arrow points north, so the body stays put and only the arrow
 * turns with the heading. The model is leaned back a little so the eyes on its
 * front can be seen from the steep camera.
 */
export function buildKitRobot(id: number, color: Color, template: THREE.Group): RobotView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const model = template.clone(true);
  const lean = new THREE.Group();
  lean.rotation.x = KIT_TILT;
  lean.scale.setScalar(KIT_SCALE);
  // The model is centred on its middle; lift it so its feet stand on the tile.
  lean.position.y = 0.45 * KIT_SCALE;
  lean.add(model);
  body.add(lean);
  const cap = new THREE.Group();
  const arrows: THREE.Object3D[] = [];
  const face: THREE.Object3D[] = [];
  model.traverse((node) => {
    if (node.name.startsWith('direction_arrow')) arrows.push(node);
    else if (node.name.startsWith('eye') || node.name === 'face_panel') face.push(node);
  });
  for (const part of face) {
    if (part.name === 'face_panel') growInPlace(part, 1, 1.35, KIT_FACE_LIFT);
    else growInPlace(part, KIT_EYE_SCALE, KIT_EYE_SCALE, KIT_FACE_LIFT);
  }
  // The arrow turns on its own; everything else is fused into a few meshes.
  const arrowParts = new THREE.Group();
  for (const arrow of arrows) arrowParts.add(arrow);
  const still = fuse(model);
  cap.add(fuse(arrowParts));
  lean.remove(model);
  lean.add(still, cap);
  const aim = (angle: number): void => {
    cap.rotation.y = angle;
  };
  return { id, color, root, body, cap, lids: [], aim, angle: 0, blinkIn: 1e9, visibleScale: 1 };
}
