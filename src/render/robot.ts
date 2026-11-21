import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import { bodyYaw, travelAxis, type HeadingStyle } from './heading';
import { fuse } from './kit';
import { buildFlockbot } from './parts/flockbot';
import PARTS from '../../data/parts.json';

/** A robot mesh plus the animated values the board view tweens. */
export interface RobotView {
  readonly id: number;
  readonly color: Color;
  /** Outer group: board position. */
  readonly root: THREE.Group;
  /** Body: hops and squashes. It is never turned itself, so its axes stay the board's axes. */
  readonly body: THREE.Group;
  readonly lids: THREE.Mesh[];
  /** Show a heading, in radians: turns the whole robot, or only its symbol in the `symbol` style. */
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
 * Build one built-in robot. It stands upright, so both turning styles are the
 * same here: the whole robot turns to its heading, with the arrow on its head
 * fixed pointing the way it faces. In the `symbol` style the body and its big
 * eyes keep facing the player, only the arrow turns and the pupils glance
 * along it.
 */
export function buildRobot(id: number, color: Color, style: HeadingStyle = 'faceUp'): RobotView {
  const tint = new THREE.Color(CONFIG.colors[color]);
  const root = new THREE.Group();
  const hop = new THREE.Group();
  root.add(hop);
  // Everything is built on `body`, which turns inside the group that hops and squashes.
  const body = new THREE.Group();
  hop.add(body);

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

  // The arrow was drawn pointing away from the face; fixed to the body it points the way the robot faces.
  if (style !== 'symbol') cap.rotation.y = Math.PI;
  const aim = (angle: number): void => {
    if (style !== 'symbol') {
      body.rotation.y = bodyYaw(angle);
      return;
    }
    cap.rotation.y = angle;
    // Heading as seen by the player: -sin is right/left, cos is away/toward.
    const dx = -Math.sin(angle);
    const dz = -Math.cos(angle);
    for (const pupil of pupils) pupil.position.set(dx * 0.045, -dz * 0.04, 0);
  };
  return { id, color, root, body: hop, lids, aim, angle: 0, blinkIn: 1 + ((id * 37) % 23) / 6, visibleScale: 1 };
}

/** The kit body is 0.89 wide; scaled so the robot fills the configured share of a tile. */
const KIT_BODY_WIDTH = 0.89;
const KIT_BODY_HEIGHT = 0.8;
const KIT_BODY_DEPTH = 0.84;
const KIT_SCALE = CONFIG.board.grid.robotFill / KIT_BODY_WIDTH;
const BOT = CONFIG.robot;

/**
 * Rounded block for one colour, shaded from a deep underside through the side
 * and main colour to a light top, so the toy has depth even in flat light.
 */
function makeKitBody(color: Color): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(KIT_BODY_WIDTH, KIT_BODY_HEIGHT, KIT_BODY_DEPTH, 8, 0.26);
  const tones = CONFIG.colors.robots[color];
  const stops: [number, THREE.Color][] = [
    [-0.5, new THREE.Color(tones.deep)],
    [-0.28, new THREE.Color(tones.side)],
    [0.12, new THREE.Color(tones.main)],
    // The top face is what the camera mostly sees: keep it close to the main colour.
    [0.5, new THREE.Color(tones.main).lerp(new THREE.Color(tones.top), BOT.topLight)],
  ];
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const mixed = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) / KIT_BODY_HEIGHT;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    mixed.copy(c0).lerp(c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

const kitShared = {
  bodies: { red: makeKitBody('red'), blue: makeKitBody('blue'), yellow: makeKitBody('yellow') },
  bodyMat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: BOT.gloss, clearcoatRoughness: 0.1, envMapIntensity: 0.6 }),
  white: new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.robots.eyeWhite, roughness: 0.25, clearcoat: 0.5 }),
  black: new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.robots.eye, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
  glint: new THREE.MeshBasicMaterial({ color: CONFIG.colors.robots.eyeWhite }),
  ball: new THREE.SphereGeometry(1, 28, 20),
};

/** Two large glossy eyes, high on the front face: white, a dark pupil and a bright glint each. */
function makeKitEyes(): THREE.Group {
  const eyes = new THREE.Group();
  const front = KIT_BODY_DEPTH / 2;
  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(kitShared.ball, kitShared.white);
    white.scale.set(BOT.eyeSize, BOT.eyeSize * 1.08, BOT.eyeSize * 0.45);
    white.position.set(side * BOT.eyeSpread, BOT.eyeHeight, front - 0.01);
    const pupil = new THREE.Mesh(kitShared.ball, kitShared.black);
    pupil.scale.set(BOT.pupilSize, BOT.pupilSize * 1.08, BOT.pupilSize * 0.5);
    pupil.position.set(side * BOT.eyeSpread * 0.94, BOT.eyeHeight - 0.015, front + BOT.eyeSize * 0.3);
    const glint = new THREE.Mesh(kitShared.ball, kitShared.glint);
    glint.scale.setScalar(BOT.pupilSize * 0.32);
    glint.position.set(pupil.position.x - 0.035, pupil.position.y + 0.04, pupil.position.z + BOT.pupilSize * 0.42);
    eyes.add(white, pupil, glint);
  }
  return eyes;
}

/**
 * Build a robot on the asset kit's model: its arrow and feet are kept, the
 * body is replaced by a rounder shaded block and the small face by two large
 * eyes high on the front. The face looks at the player and only the arrow
 * turns with the heading. The camera looks almost straight down, so the robot
 * is leaned back to show its face.
 */
export function buildKitRobot(id: number, color: Color, template: THREE.Group): RobotView {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const model = template.clone(true);
  const lean = new THREE.Group();
  lean.rotation.x = -BOT.lean;
  lean.scale.setScalar(KIT_SCALE);
  // Lift it so the leaned block still rests on the tile instead of sinking into it.
  lean.position.y = ((KIT_BODY_HEIGHT / 2) * Math.cos(BOT.lean) + (KIT_BODY_DEPTH / 2) * Math.sin(BOT.lean)) * KIT_SCALE * 0.9;
  body.add(lean);
  const cap = new THREE.Group();
  const arrowParts = new THREE.Group();
  const still = new THREE.Group();
  const arrows: THREE.Object3D[] = [];
  const feet: THREE.Object3D[] = [];
  model.traverse((node) => {
    if (node.name.startsWith('direction_arrow')) arrows.push(node);
    else if (node.name.startsWith('foot')) feet.push(node);
  });
  for (const arrow of arrows) arrowParts.add(arrow);
  for (const foot of feet) still.add(foot);
  still.add(new THREE.Mesh(kitShared.bodies[color], kitShared.bodyMat), makeKitEyes());
  // The arrow lay on the kit body's top, which was a little higher than the new one.
  arrowParts.position.y = KIT_BODY_HEIGHT / 2 - 0.415;
  // Smaller and a little towards the player, so no tip runs over the rounded back edge.
  cap.scale.set(BOT.arrowScale, 1, BOT.arrowScale);
  cap.position.z = BOT.arrowForward;
  // The arrow turns on its own; everything else is fused into a few meshes.
  cap.add(fuse(arrowParts));
  lean.add(fuse(still), cap);
  const aim = (angle: number): void => {
    cap.rotation.y = angle;
  };
  return { id, color, root, body, lids: [], aim, angle: 0, blinkIn: 1e9, visibleScale: 1 };
}

/** Corners of the Flockbot part's bounding box in its own space: it stands on y = 0 and faces +z. */
const PART_CORNERS = [-1, 1].flatMap((x) => [0, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3((x * PARTS.flockbot.width) / 2, y * PARTS.flockbot.height, (z * PARTS.flockbot.depth) / 2))));

/**
 * Build a robot from the standalone Flockbot part. The camera looks almost
 * straight down (`viewTilt` radians away from it), so the robot is leaned to
 * show more than its top.
 *
 * - `faceUp`: the whole robot turns, and leans back along its own axis, so its
 *   face looks up at the camera in every heading and the symbol on top, fixed
 *   to the body, points the way it faces. It turns around the line of sight
 *   rather than the board's upright, so every heading is the same picture
 *   turned a quarter: the eyes are as large facing away as facing the player.
 * - `towardPlayer`: the whole robot turns inside a lean that always goes
 *   towards the player. Facing the player it shows its face, facing away its
 *   back, sideways an ear.
 * - `symbol`: the face keeps looking at the player and only the symbol turns.
 */
export function buildPartsRobot(id: number, color: Color, style: HeadingStyle = 'faceUp', viewTilt = 0): RobotView {
  const bot = buildFlockbot(color);
  const scale = CONFIG.board.grid.robotFill;
  const tilt = CONFIG.robot.lean;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const lean = new THREE.Group();
  // A little lower than the part's full height, so a leaned robot stays within its own cell on screen.
  lean.scale.set(scale, scale * CONFIG.robot.squash, scale);
  if (style !== 'faceUp') {
    lean.rotation.x = -tilt;
    // Leaning back pushes the rear bottom edge down; lift the robot so it still rests on the tile.
    lean.position.y = (PARTS.flockbot.depth / 2) * Math.sin(tilt) * scale;
    body.add(lean);
    if (style === 'symbol') {
      // The symbol turns on its own; everything else is fused into a few meshes.
      bot.root.remove(bot.symbol);
      const cap = new THREE.Group();
      cap.add(bot.symbol);
      lean.add(fuse(bot.root), cap);
      return { id, color, root, body, lids: [], aim: (angle) => void (cap.rotation.y = angle), angle: 0, blinkIn: 1e9, visibleScale: 1 };
    }
    // The symbol rests pointing to the back of the part; fixed to the body it points the way the robot faces.
    bot.symbol.rotation.y = Math.PI;
    const turn = new THREE.Group();
    turn.add(fuse(bot.root));
    lean.add(turn);
    return { id, color, root, body, lids: [], aim: (angle) => void (turn.rotation.y = bodyYaw(angle)), angle: 0, blinkIn: 1e9, visibleScale: 1 };
  }

  const T = CONFIG.robot.faceUp;
  // `sight` tips the turning axis from the board's upright to the line of sight; the lean is measured from there.
  const sight = new THREE.Group();
  sight.rotation.x = viewTilt * T.followCamera;
  const turn = new THREE.Group();
  lean.rotation.x = -(tilt + T.extraLean + viewTilt * T.followCamera);
  bot.symbol.rotation.y = Math.PI;
  lean.add(fuse(bot.root));
  turn.add(lean);
  sight.add(turn);
  body.add(sight);
  const corner = new THREE.Vector3();
  const aim = (angle: number): void => {
    turn.rotation.y = bodyYaw(angle);
    // Leaning moves the robot off its cell and pushes an edge through the tile: find where its box
    // ends up, as the camera sees it, then centre that on the cell and rest its lowest corner on the tile.
    sight.position.set(0, 0, 0);
    sight.updateMatrix();
    turn.updateMatrix();
    lean.updateMatrix();
    let low = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const c of PART_CORNERS) {
      corner.copy(c).applyMatrix4(lean.matrix).applyMatrix4(turn.matrix).applyMatrix4(sight.matrix);
      low = Math.min(low, corner.y);
      // Across the screen, and up it: depth seen at the camera's angle less the height seen from above.
      const v = corner.z * Math.cos(viewTilt) - corner.y * Math.sin(viewTilt);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const ahead = travelAxis(angle);
    sight.position.set(
      -(minX + maxX) / 2 + ahead.x * T.forward,
      -low,
      (-(minV + maxV) / 2 - low * Math.sin(viewTilt)) / Math.cos(viewTilt) + ahead.z * T.forward,
    );
  };
  return { id, color, root, body, lids: [], aim, angle: 0, blinkIn: 1e9, visibleScale: 1 };
}
