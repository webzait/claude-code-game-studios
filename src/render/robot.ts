import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';

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
  readonly pupils: THREE.Object3D[];
  readonly lids: THREE.Mesh[];
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

  return { id, color, root, body, cap, pupils, lids, angle: 0, blinkIn: 1 + ((id * 37) % 23) / 6, visibleScale: 1 };
}

/** Point the arrow along the heading and let the pupils glance the same way. */
export function aimRobot(view: RobotView, angle: number): void {
  view.cap.rotation.y = angle;
  // Heading as seen by the player: -sin is right/left, cos is away/toward.
  const dx = -Math.sin(angle);
  const dz = -Math.cos(angle);
  for (const pupil of view.pupils) pupil.position.set(dx * 0.045, -dz * 0.04, 0);
}
