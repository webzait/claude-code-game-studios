import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { Color } from '../../engine/types';
import parts from '../../../data/parts.json';
import { roundedRect } from './shapes';

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
  /** The four feet. */
  readonly feet: THREE.Group;
  /** The symbol on top; turn it around y to show the heading. It points north (-z) at rest. */
  readonly symbol: THREE.Group;
}

// The body: a rounded cube. The ears stick out a little, so the body itself is that much narrower than the cell.
const HALF_W = F.width / 2 - F.ear.protrude;
const HALF_D = F.depth / 2;
const BODY_BOTTOM = F.foot.height;
const SHELL_TOP = F.height - F.symbol.raise;
const ROMP_H = F.seam - BODY_BOTTOM;
const SHELL_H = SHELL_TOP - F.seam;

/** How far the body reaches sideways at height `y`, as a fraction of its widest outline (1 at the seam). */
function reachAt(y: number): number {
  const [span, round] = y >= F.seam ? [SHELL_H, F.shellRound] : [ROMP_H, F.rompRound];
  const t = Math.min(1, Math.abs(y - F.seam) / span);
  return (1 - t ** (2 / round)) ** (round / 2);
}

/** Footprint roundness at height `y`: the squircle of the seam, easing to a circle at the crown so the dome has no creases. */
function squircleAt(y: number): number {
  if (y <= F.seam) return F.squircle;
  const t = Math.min(1, (y - F.seam) / SHELL_H);
  return F.squircle + (1 - F.squircle) * t ** F.crownEase;
}

/** The front surface of the body: z at a point (x, y) on the face side. */
function frontZ(x: number, y: number): number {
  const reach = reachAt(y);
  const e = squircleAt(y);
  const across = Math.min(1, Math.abs(x) / (HALF_W * reach));
  return HALF_D * reach * (1 - across ** (2 / e)) ** (e / 2);
}

/** The side surface of the body: x at a point (y, z) on the +x side. */
function sideX(y: number, z: number): number {
  const reach = reachAt(y);
  const e = squircleAt(y);
  const across = Math.min(1, Math.abs(z) / (HALF_D * reach));
  return HALF_W * reach * (1 - across ** (2 / e)) ** (e / 2);
}

/** One half of the body, from the seam to the crown (`dome`) or down to the underside, as a closed skin. */
function bodyHalf(dome: boolean): THREE.BufferGeometry {
  const around = 176;
  const up = 56;
  const [span, round] = dome ? [SHELL_H, F.shellRound] : [ROMP_H, F.rompRound];
  const positions: number[] = [];
  for (let v = 0; v <= up; v++) {
    const theta = (v / up) * (Math.PI / 2);
    const y = F.seam + span * Math.cos(theta) ** round * (dome ? 1 : -1);
    const reach = Math.sin(theta) ** round;
    const e = squircleAt(y);
    for (let u = 0; u < around; u++) {
      const phi = (u / around) * Math.PI * 2;
      const cos = Math.cos(phi);
      const sin = Math.sin(phi);
      positions.push(HALF_W * reach * Math.sign(cos) * Math.abs(cos) ** e, y, HALF_D * reach * Math.sign(sin) * Math.abs(sin) ** e);
    }
  }
  const index: number[] = [];
  for (let v = 0; v < up; v++) {
    for (let u = 0; u < around; u++) {
      const p = v * around + u;
      const q = v * around + ((u + 1) % around);
      if (dome) index.push(p, q + around, p + around, p, q, q + around);
      else index.push(p, p + around, q + around, p, q + around, q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A flat outline laid onto a curved surface: the shape (in x/y, around the
 * origin) becomes a fan of rings whose depth follows `depthAt`, so it hugs
 * the body instead of standing off it like a plate.
 */
function wrapped(shape: THREE.Shape, depthAt: (x: number, y: number) => number): THREE.BufferGeometry {
  const rim = shape.getSpacedPoints(96);
  rim.pop();
  const rings = 14;
  const positions: number[] = [0, 0, depthAt(0, 0)];
  for (let k = 1; k <= rings; k++) {
    for (const p of rim) {
      const x = (p.x * k) / rings;
      const y = (p.y * k) / rings;
      positions.push(x, y, depthAt(x, y));
    }
  }
  const n = rim.length;
  const index: number[] = [];
  for (let u = 0; u < n; u++) index.push(0, 1 + u, 1 + ((u + 1) % n));
  for (let k = 1; k < rings; k++) {
    for (let u = 0; u < n; u++) {
      const p = 1 + (k - 1) * n + u;
      const q = 1 + (k - 1) * n + ((u + 1) % n);
      index.push(p, p + n, q + n, p, q + n, q);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * A raised frame around a rounded rectangle (in x/y, around the origin) laid
 * onto a curved surface: `band` wide, swelling to `height` in the middle and
 * coming back down to the surface on both edges, like a soft tube.
 */
function wrappedFrame(w: number, h: number, r: number, band: number, height: number, depthAt: (x: number, y: number) => number): THREE.BufferGeometry {
  const perCorner = 20;
  const across = 12;
  const centres = [
    [w / 2 - r, h / 2 - r, 0],
    [-(w / 2 - r), h / 2 - r, Math.PI / 2],
    [-(w / 2 - r), -(h / 2 - r), Math.PI],
    [w / 2 - r, -(h / 2 - r), Math.PI * 1.5],
  ] as const;
  const around = centres.length * (perCorner + 1);
  const positions: number[] = [];
  for (let j = 0; j <= across; j++) {
    const s = j / across;
    const radius = r - band * s;
    const lift = height * Math.sin(Math.PI * s) ** 0.6;
    for (const [cx, cy, from] of centres) {
      for (let k = 0; k <= perCorner; k++) {
        const angle = from + (k / perCorner) * (Math.PI / 2);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        positions.push(x, y, depthAt(x, y) + lift);
      }
    }
  }
  const index: number[] = [];
  for (let j = 0; j < across; j++) {
    for (let u = 0; u < around; u++) {
      const p = j * around + u;
      const q = j * around + ((u + 1) % around);
      index.push(p, q, q + around, p, q + around, p + around);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Colour the body: blended by height through `stops`, then darkened towards
 * `shade` where the surface turns sideways or down, so the sides read as sides.
 */
function shadeBody(g: THREE.BufferGeometry, stops: readonly (readonly [number, string])[], shade: string): void {
  const tones = stops.map(([at, hex]) => [at, new THREE.Color(hex)] as const);
  const dark = new THREE.Color(shade);
  const position = g.getAttribute('position');
  const normal = g.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    let k = 0;
    while (k < tones.length - 2 && y > tones[k + 1][0]) k++;
    const [y0, c0] = tones[k];
    const [y1, c1] = tones[k + 1];
    mixed.copy(c0).lerp(c1, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
    const sideways = Math.abs(normal.getX(i)) + Math.max(0, -normal.getY(i));
    mixed.lerp(dark, Math.min(1, sideways) * F.material.sideShade);
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** The body's outline at the seam, lying flat: closes a shell or romp that is seen apart. */
function seamPlate(inset: number): THREE.Shape {
  const s = new THREE.Shape();
  const steps = 96;
  for (let u = 0; u <= steps; u++) {
    const phi = (u / steps) * Math.PI * 2;
    const x = (HALF_W - inset) * Math.sign(Math.cos(phi)) * Math.abs(Math.cos(phi)) ** F.squircle;
    const y = (HALF_D - inset) * Math.sign(Math.sin(phi)) * Math.abs(Math.sin(phi)) ** F.squircle;
    if (u === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** Arrowhead with softened corners and a notched tail, pointing to +y of the shape plane. */
function arrowShape(size: number): THREE.Shape {
  const half = size / 2;
  const corners = [
    new THREE.Vector2(0, half),
    new THREE.Vector2(half * 0.92, -half * 0.86),
    new THREE.Vector2(0, -half * 0.86 + size * F.symbol.notch),
    new THREE.Vector2(-half * 0.92, -half * 0.86),
  ];
  const soften = size * F.symbol.soften;
  const s = new THREE.Shape();
  corners.forEach((corner, i) => {
    const before = corners[(i + corners.length - 1) % corners.length];
    const after = corners[(i + 1) % corners.length];
    // The notch stays crisper than the three outer corners.
    const cut = i === 2 ? soften * 0.4 : soften;
    const from = corner.clone().add(before.clone().sub(corner).setLength(cut));
    const to = corner.clone().add(after.clone().sub(corner).setLength(cut));
    if (i === 0) s.moveTo(from.x, from.y);
    else s.lineTo(from.x, from.y);
    s.quadraticCurveTo(corner.x, corner.y, to.x, to.y);
  });
  s.closePath();
  return s;
}

const eyeBall = new THREE.SphereGeometry(1, 32, 24);
const eyeBlack = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.robots.eye, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: F.material.reflect });
const eyeGlint = new THREE.MeshBasicMaterial({ color: CONFIG.colors.robots.eyeWhite });
// The face looks sideways, away from the light from above; it glows a little so it stays light.
const windowMat = new THREE.MeshPhysicalMaterial({ color: F.colors.window, roughness: 0.3, clearcoat: 0.5, emissive: F.colors.window, emissiveIntensity: 0.42, side: THREE.DoubleSide });

/**
 * Build one Flockbot from its modules, after the asset sheet: a rounded cube
 * split at a hidden seam into a domed top shell (with the heading symbol) and a
 * lower body, a framed face window with two large eyes, an ear disc on each
 * side and four small feet underneath.
 */
export function buildFlockbot(color: Color): FlockbotParts {
  const tones = CONFIG.colors.robots[color];
  const M = F.material;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: M.roughness,
    clearcoat: M.clearcoat,
    clearcoatRoughness: M.clearcoatRoughness,
    envMapIntensity: M.reflect,
    // A little of its own colour, so the shaded sides stay saturated instead of going grey.
    emissive: tones.main,
    emissiveIntensity: M.glow,
  });
  const deepMat = new THREE.MeshPhysicalMaterial({ color: tones.deep, roughness: 0.4, clearcoat: 0.4, side: THREE.DoubleSide });
  // Matt, so the seam stays a dark line instead of mirroring the sky.
  const seamMat = new THREE.MeshStandardMaterial({ color: tones.deep, roughness: 1, envMapIntensity: 0, side: THREE.DoubleSide });
  const half = F.seamGap / 2;

  // Lower body: a boxy bowl hanging from the seam.
  const rompGeo = bodyHalf(false);
  shadeBody(
    rompGeo,
    [
      [BODY_BOTTOM, tones.deep],
      [BODY_BOTTOM + ROMP_H * 0.16, tones.side],
      [BODY_BOTTOM + ROMP_H * 0.55, tones.main],
      [F.seam, tones.main],
    ],
    tones.side,
  );
  rompGeo.translate(0, -half, 0);
  const romp = new THREE.Mesh(rompGeo, bodyMat);
  // The seam: a dark plate just inside the outline, seen as a fine line between shell and body.
  const plateGeo = new THREE.ExtrudeGeometry(seamPlate(0.008), { depth: Math.max(0.001, F.seamGap * 2), bevelEnabled: false });
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(0, F.seam - Math.max(0.002, F.seamGap), 0);
  // And a lid right at the rim, so no view from above looks past the plate into the body.
  const rimLidGeo = new THREE.ShapeGeometry(seamPlate(0));
  rimLidGeo.rotateX(Math.PI / 2);
  rimLidGeo.translate(0, F.seam - half - 0.001, 0);
  romp.add(new THREE.Mesh(plateGeo, seamMat), new THREE.Mesh(rimLidGeo, seamMat));

  // Top shell: a dome on the same outline, so shell and body are one rounded cube.
  const shellGeo = bodyHalf(true);
  shadeBody(
    shellGeo,
    [
      [F.seam, tones.main],
      [F.seam + SHELL_H * 0.9, tones.main],
      [SHELL_TOP, new THREE.Color(tones.main).lerp(new THREE.Color(tones.top), M.topTint).getStyle()],
    ],
    tones.side,
  );
  shellGeo.translate(0, half, 0);
  const shell = new THREE.Mesh(shellGeo, bodyMat);
  const lidGeo = new THREE.ShapeGeometry(seamPlate(0.002));
  lidGeo.rotateX(Math.PI / 2);
  lidGeo.translate(0, F.seam + half, 0);
  shell.add(new THREE.Mesh(lidGeo, seamMat));

  // Face module: a soft raised frame in the body colour, the light window sunk inside it, two big eyes.
  const face = new THREE.Group();
  const W = F.face;
  const onFront = (lift: number) => (x: number, y: number): number => frontZ(x, y + W.centre) + lift;
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: tones.main,
    roughness: M.roughness,
    clearcoat: M.clearcoat,
    clearcoatRoughness: M.clearcoatRoughness,
    envMapIntensity: M.reflect,
    emissive: tones.main,
    emissiveIntensity: M.glow,
  });
  const frame = new THREE.Mesh(wrappedFrame(W.width, W.height, W.radius, W.bezel, W.bezelHeight, onFront(0)), frameMat);
  // The window reaches a little under the frame, so no body colour shows between them.
  const inner = W.bezel * 0.8;
  const pane = new THREE.Mesh(wrapped(roundedRect(W.width - 2 * inner, W.height - 2 * inner, W.radius - inner), onFront(W.depth)), windowMat);
  face.add(frame, pane);
  const E = F.eye;
  for (const side of [-1, 1]) {
    const x = side * E.spread;
    const z = frontZ(x, W.centre) + W.depth;
    // Turn each eye with the curve of the front, so it sits flat on the window.
    const turn = Math.atan2(frontZ(x - 0.02, W.centre) - frontZ(x + 0.02, W.centre), 0.04);
    const eye = new THREE.Group();
    eye.position.set(x, 0, z);
    eye.rotation.y = turn;
    const ball = new THREE.Mesh(eyeBall, eyeBlack);
    ball.scale.set(E.radius, E.radius * 1.06, E.radius * E.bulge);
    const glint = new THREE.Mesh(eyeBall, eyeGlint);
    glint.scale.set(E.glint, E.glint, E.glint * 0.5);
    glint.position.set(E.radius * 0.32, E.radius * 0.42, E.radius * E.bulge * 0.8);
    eye.add(ball, glint);
    face.add(eye);
  }
  face.position.y = W.centre;

  // Ears: a flat light disc on each side.
  const ears = new THREE.Group();
  const earMat = new THREE.MeshPhysicalMaterial({ color: F.colors.window, roughness: 0.3, clearcoat: 0.6, emissive: F.colors.window, emissiveIntensity: 0.55 });
  const seat = sideX(F.ear.centre, 0) - 0.01;
  const earThick = F.width / 2 - seat;
  const earGeo = new THREE.CylinderGeometry(F.ear.radius * 0.94, F.ear.radius, earThick, 40);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.rotation.z = (-side * Math.PI) / 2;
    ear.position.set(side * (seat + earThick / 2), F.ear.centre, 0);
    ears.add(ear);
  }

  // Feet: four small rounded pegs tucked under the corners of the body.
  const feet = new THREE.Group();
  const P = F.foot;
  const footTall = P.height + P.sink;
  const footGeo = new THREE.CapsuleGeometry(P.radius, Math.max(0.001, footTall - P.radius), 8, 24);
  // Flatten the sole a little so the foot stands instead of balancing on a point.
  footGeo.translate(0, (footTall + P.radius) / 2, 0);
  const sole = footGeo.getAttribute('position');
  for (let i = 0; i < sole.count; i++) if (sole.getY(i) < P.radius) sole.setY(i, sole.getY(i) * 0.45);
  footGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const foot = new THREE.Mesh(footGeo, deepMat);
      foot.position.set(side * P.spread, 0, end * P.forward);
      feet.add(foot);
    }
  }

  // Symbol: a raised arrowhead on the shell, turning with the heading.
  const symbol = new THREE.Group();
  const S = F.symbol;
  const bevel = S.raise * 0.4;
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape(S.size - 2 * bevel), {
    depth: S.raise + S.sink - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
  });
  // Extruded along z with its tip to +y; lay it flat with the tip to north (-z).
  arrowGeo.rotateX(-Math.PI / 2);
  arrowGeo.translate(0, bevel - S.sink, 0);
  const arrow = new THREE.Mesh(
    arrowGeo,
    // The dark arrow is kept matt: a glossy one mirrors the sky and turns grey seen from above.
    color === 'yellow'
      ? new THREE.MeshStandardMaterial({ color: F.colors.symbolDark, roughness: 0.75, envMapIntensity: 0 })
      : new THREE.MeshPhysicalMaterial({ color: F.colors.symbolLight, roughness: 0.3, clearcoat: 0.7, emissive: F.colors.symbolLight, emissiveIntensity: 0.25 }),
  );
  symbol.add(arrow);
  symbol.position.y = SHELL_TOP + half;

  const root = new THREE.Group();
  root.add(feet, romp, shell, face, ears, symbol);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return { root, shell, face, romp, feet, symbol };
}
