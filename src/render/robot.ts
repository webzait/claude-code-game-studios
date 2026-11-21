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
  /** Inner group: heading, hop, squash. */
  readonly body: THREE.Group;
  readonly antenna: THREE.Group;
  readonly lids: THREE.Mesh[];
  /** Cumulative heading in radians, so turns always animate clockwise. */
  angle: number;
  /** Seconds until the next blink. */
  blinkIn: number;
  visibleScale: number;
}

const shared = {
  body: new RoundedBoxGeometry(0.68, 0.46, 0.68, 5, 0.17),
  base: new RoundedBoxGeometry(0.56, 0.16, 0.56, 4, 0.08),
  eye: new THREE.SphereGeometry(0.07, 20, 14),
  pupil: new THREE.SphereGeometry(0.038, 14, 10),
  glint: new THREE.SphereGeometry(0.016, 8, 6),
  arrow: makeArrow(),
};

/** Rounded chevron-style arrow pointing to -z (the robot's front). */
function makeArrow(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.2);
  s.lineTo(0.19, -0.13);
  s.quadraticCurveTo(0, -0.05, -0.19, -0.13);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.012, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Build one robot. Its front faces -z; the arrow on its head shows the heading. */
export function buildRobot(id: number, color: Color): RobotView {
  const hex = CONFIG.colors[color];
  const tint = new THREE.Color(hex);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shell = new THREE.Mesh(shared.body, new THREE.MeshStandardMaterial({ color: tint, roughness: 0.42, metalness: 0.02 }));
  shell.position.y = 0.37;
  shell.castShadow = true;
  body.add(shell);

  const base = new THREE.Mesh(
    shared.base,
    new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.55), roughness: 0.7 }),
  );
  base.position.y = 0.1;
  base.castShadow = true;
  body.add(base);

  const arrowColor = color === 'yellow' ? '#3A3118' : '#FFFFFF';
  const arrow = new THREE.Mesh(shared.arrow, new THREE.MeshStandardMaterial({ color: arrowColor, roughness: 0.5 }));
  arrow.position.set(0, 0.6, 0.06);
  body.add(arrow);

  // Small expressive eyes peeking over the front edge, visible from every heading.
  const white = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: CONFIG.colors.ink, roughness: 0.3 });
  const lids: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.14, 0.55, -0.27);
    const ball = new THREE.Mesh(shared.eye, white);
    const pupil = new THREE.Mesh(shared.pupil, dark);
    pupil.position.set(side * -0.01, 0.036, -0.046);
    const glint = new THREE.Mesh(shared.glint, white);
    glint.position.set(side * -0.01 + 0.016, 0.068, -0.058);
    const lid = new THREE.Mesh(shared.eye, new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.8), roughness: 0.5 }));
    lid.scale.setScalar(1.08);
    lid.visible = false;
    eye.add(ball, pupil, glint, lid);
    lids.push(lid);
    body.add(eye);
  }

  // Empty pivot kept for a future head ornament (skins); nothing is drawn on it.
  const antenna = new THREE.Group();
  body.add(antenna);

  return { id, color, root, body, antenna, lids, angle: 0, blinkIn: 1 + ((id * 37) % 23) / 6, visibleScale: 1 };
}
