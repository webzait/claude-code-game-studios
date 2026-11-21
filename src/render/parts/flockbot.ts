import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { Color } from '../../engine/types';
import parts from '../../../data/parts.json';
import { halfSuperquadric, roundedRect, shadeByHeight, slabOf } from './shapes';

const F = parts.flockbot;

/** A Flockbot as separate modules, in cell units: it stands on y = 0, faces +z and is one cell wide. */
export interface FlockbotParts {
  /** Everything, ready to place on a tile. */
  readonly root: THREE.Group;
  /** Top shell (dome) carrying the symbol. */
  readonly shell: THREE.Mesh;
  /** Face module: window with the two eyes. */
  readonly face: THREE.Group;
  /** Lower body. */
  readonly romp: THREE.Mesh;
  /** The two feet. */
  readonly feet: THREE.Group;
  /** The symbol on top; turn it around y to show the heading. It points north (-z) at rest. */
  readonly symbol: THREE.Group;
}

const SYMBOL_LIGHT = '#FFFFFF';
const SYMBOL_DARK = '#2B2F45';
const FACE_LIGHT = '#F4F8FF';

const eyeBall = new THREE.SphereGeometry(1, 28, 20);
const eyeBlack = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.robots.eye, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
const eyeGlint = new THREE.MeshBasicMaterial({ color: CONFIG.colors.robots.eyeWhite });
const faceMat = new THREE.MeshPhysicalMaterial({ color: FACE_LIGHT, roughness: 0.3, clearcoat: 0.4 });
const bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: CONFIG.robot.gloss, clearcoatRoughness: 0.1, envMapIntensity: 0.6 });

/** Solid triangle with softened corners, pointing to +y of the shape plane. */
function arrowShape(size: number): THREE.Shape {
  const tip = new THREE.Vector2(0, size * 0.5);
  const right = new THREE.Vector2(size * 0.5, -size * 0.38);
  const left = new THREE.Vector2(-size * 0.5, -size * 0.38);
  const corners = [tip, right, left];
  const soften = size * 0.16;
  const s = new THREE.Shape();
  corners.forEach((corner, i) => {
    const before = corners[(i + 2) % 3];
    const after = corners[(i + 1) % 3];
    const from = corner.clone().add(before.clone().sub(corner).setLength(soften));
    const to = corner.clone().add(after.clone().sub(corner).setLength(soften));
    if (i === 0) s.moveTo(from.x, from.y);
    else s.lineTo(from.x, from.y);
    s.quadraticCurveTo(corner.x, corner.y, to.x, to.y);
  });
  s.closePath();
  return s;
}

/**
 * Build one Flockbot from its modules, after the asset sheet: top shell with
 * the symbol, face module with the eyes, lower body, two feet and an ear disc
 * on each side.
 */
export function buildFlockbot(color: Color): FlockbotParts {
  const tones = CONFIG.colors.robots[color];
  const halfW = F.width / 2;
  const halfD = F.depth / 2;
  const top = F.height;
  const rompBottom = F.footHeight * 0.55;
  const dark = new THREE.MeshPhysicalMaterial({ color: tones.deep, roughness: 0.4, clearcoat: 0.3 });

  // Lower body: a boxy bowl hanging from the seam.
  const rompGeo = halfSuperquadric(halfW - F.rompInset, F.seam - rompBottom, halfD - F.rompInset, F.rompRound, F.squircle, false);
  rompGeo.translate(0, F.seam, 0);
  shadeByHeight(rompGeo, [
    [rompBottom, tones.deep],
    [rompBottom + 0.14, tones.side],
    [F.seam, tones.main],
  ]);
  const romp = new THREE.Mesh(rompGeo, bodyMat);

  // Top shell: a dome on the same rounded-square footprint, a touch wider so its lip shows as a seam.
  const shellGeo = halfSuperquadric(halfW, top - F.seam, halfD, F.shellRound, F.squircle, true);
  shellGeo.translate(0, F.seam, 0);
  shadeByHeight(shellGeo, [
    [F.seam, tones.main],
    [top - 0.12, tones.main],
    [top, new THREE.Color(tones.main).lerp(new THREE.Color(tones.top), CONFIG.robot.topLight * 2).getStyle()],
  ]);
  const shell = new THREE.Mesh(shellGeo, bodyMat);
  // Underside of the lip, so nothing is open when seen from below the seam.
  const lip = new THREE.Mesh(slabOf(roundedRect(F.width - 0.02, F.depth - 0.02, 0.3), 0.012), dark);
  lip.position.y = F.seam - 0.012;

  // Face module: a dark rim, a light window and two glossy eyes with a glint.
  const face = new THREE.Group();
  const window = F.face;
  const rimGeo = new THREE.ExtrudeGeometry(roundedRect(window.width, window.height, window.radius), { depth: window.depth, bevelEnabled: false, curveSegments: 12 });
  const paneGeo = new THREE.ExtrudeGeometry(roundedRect(window.width - 2 * window.rim, window.height - 2 * window.rim, window.radius - window.rim), {
    depth: window.depth + 0.008,
    bevelEnabled: false,
    curveSegments: 12,
  });
  face.add(new THREE.Mesh(rimGeo, dark), new THREE.Mesh(paneGeo, faceMat));
  const eyeZ = window.depth + 0.008;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeBall, eyeBlack);
    eye.scale.set(F.eye.radius, F.eye.radius * 1.1, F.eye.radius * 0.5);
    eye.position.set(side * F.eye.spread, 0, eyeZ);
    const glint = new THREE.Mesh(eyeBall, eyeGlint);
    glint.scale.setScalar(F.eye.glint);
    glint.position.set(side * F.eye.spread - F.eye.radius * 0.32, F.eye.radius * 0.38, eyeZ + F.eye.radius * 0.42);
    face.add(eye, glint);
  }
  face.position.set(0, window.centre, halfD - F.rompInset - 0.035);

  // Ears: a light disc on each side.
  const earGeo = new THREE.CylinderGeometry(F.ear.radius, F.ear.radius, F.ear.depth, 24);
  earGeo.rotateZ(Math.PI / 2);
  const ears = new THREE.Group();
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, faceMat);
    ear.position.set(side * (halfW - F.rompInset - 0.01), F.ear.centre, 0);
    ears.add(ear);
  }

  // Feet: two short pegs under the body.
  const feet = new THREE.Group();
  const footGeo = new THREE.CylinderGeometry(F.footRadius * 0.9, F.footRadius, F.footHeight + 0.06, 20);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeo, dark);
    foot.position.set(side * F.footSpread, (F.footHeight + 0.06) / 2, F.footForward);
    feet.add(foot);
  }

  // Symbol: a raised arrow on the shell, turning with the heading.
  const symbol = new THREE.Group();
  const arrow = new THREE.Mesh(
    slabOf(arrowShape(F.symbol.size), F.symbol.depth, 0.008),
    new THREE.MeshPhysicalMaterial({ color: color === 'yellow' ? SYMBOL_DARK : SYMBOL_LIGHT, roughness: 0.3, clearcoat: 0.5 }),
  );
  symbol.add(arrow);
  symbol.position.y = top - 0.03;

  const root = new THREE.Group();
  root.add(romp, lip, shell, face, ears, feet, symbol);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return { root, shell, face, romp, feet, symbol };
}
