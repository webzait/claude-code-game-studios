import * as THREE from 'three';
import { CONFIG } from '../../config';
import parts from '../../../data/parts.json';
import { roundedBlock, roundedFrame, roundedRect, slabOf } from './shapes';

const K = CONFIG.colors.kit;
const P = parts;

const glossy = (color: string, roughness = 0.34, clearcoat = 0.35): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.3 });

const mats = {
  tileTop: glossy(K.tileLight, 0.4, 0.2),
  tileAlt: glossy(K.tileMid, 0.4, 0.2),
  tileEdge: glossy(K.tileEdge, 0.45, 0),
  obstacle: glossy(K.obstacle),
  obstacleTop: glossy(K.obstacleTop),
  stud: glossy(K.obstacleBolt, 0.3, 0.5),
  exitBase: new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.exit, emissiveIntensity: 0.08 }),
  exitFace: new THREE.MeshPhysicalMaterial({ color: K.exitTop, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.exitTop, emissiveIntensity: 0.3 }),
  check: new THREE.MeshPhysicalMaterial({ color: K.check, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.check, emissiveIntensity: 0.25 }),
  rim: glossy(K.frame, 0.32, 0.5),
  underlay: glossy(K.frameShadow, 0.45, 0.1),
};

function shadowed<T extends THREE.Object3D>(node: T): T {
  node.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return node;
}

/** 1. Floor tile: one cell, rounded, with four pegs underneath that sit in the underlay. */
export function buildFloorTile(alt = false, pegs = true): THREE.Group {
  const t = P.floorTile;
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(roundedBlock(t.size, t.size, t.height, t.radius, t.bevel), alt ? mats.tileAlt : mats.tileTop));
  if (pegs) {
    const peg = new THREE.BoxGeometry(t.peg, t.pegHeight, t.peg);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const mesh = new THREE.Mesh(peg, mats.tileEdge);
      mesh.position.set(sx * t.size * 0.28, -t.pegHeight / 2, sz * t.size * 0.28);
      tile.add(mesh);
    }
  }
  return shadowed(tile);
}

/** 5. Obstacle block: a low rounded block with four round studs on top. Stands on the floor tile. */
export function buildObstacle(): THREE.Group {
  const o = P.obstacle;
  const block = new THREE.Group();
  block.add(new THREE.Mesh(roundedBlock(o.size, o.size, o.height, o.radius, o.bevel), mats.obstacle));
  const plate = new THREE.Mesh(slabOf(roundedRect(o.size - 2 * o.bevel - 0.04, o.size - 2 * o.bevel - 0.04, o.radius - o.bevel), 0.012), mats.obstacleTop);
  plate.position.y = o.height - 0.006;
  block.add(plate);
  const stud = new THREE.CylinderGeometry(o.stud * 0.92, o.stud, o.studHeight, 24);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const mesh = new THREE.Mesh(stud, mats.stud);
    mesh.position.set(sx * o.studSpread, o.height + o.studHeight / 2, sz * o.studSpread);
    block.add(mesh);
  }
  return shadowed(block);
}

/**
 * Tick mark as one outline: a thick stroke from `a` through the elbow `b` to
 * `c`, `width` wide, with round ends, a round outer elbow and a small fillet
 * in the inner one. Sized by `size`, the tick's overall span.
 */
function checkShape(size: number, width: number): THREE.Shape {
  const c = P.exit.checkPath;
  const at = (p: number[]): THREE.Vector2 => new THREE.Vector2(p[0] * size, p[1] * size);
  const [a, b, e] = [at(c.start), at(c.elbow), at(c.end)];
  const w = width / 2;
  const fillet = w * c.fillet;
  const d1 = b.clone().sub(a).normalize();
  const d2 = e.clone().sub(b).normalize();
  const t1 = Math.atan2(d1.y, d1.x);
  const t2 = Math.atan2(d2.y, d2.x);
  // Left-hand normals; the stroke turns left at the elbow, so the inner corner lies on this side.
  const n1 = new THREE.Vector2(-d1.y, d1.x);
  const n2 = new THREE.Vector2(-d2.y, d2.x);
  const inner = b.clone().add(n1.clone().add(n2).multiplyScalar((w + fillet) / (1 + n1.dot(n2))));
  const s = new THREE.Shape();
  s.moveTo(a.x - n1.x * w, a.y - n1.y * w);
  s.lineTo(b.x - n1.x * w, b.y - n1.y * w);
  s.absarc(b.x, b.y, w, t1 - Math.PI / 2, t2 - Math.PI / 2, false);
  s.lineTo(e.x - n2.x * w, e.y - n2.y * w);
  s.absarc(e.x, e.y, w, t2 - Math.PI / 2, t2 + Math.PI / 2, false);
  s.lineTo(inner.x - n2.x * fillet, inner.y - n2.y * fillet);
  s.absarc(inner.x, inner.y, fillet, t2 - Math.PI / 2, t1 - Math.PI / 2, true);
  s.lineTo(a.x + n1.x * w, a.y + n1.y * w);
  s.absarc(a.x, a.y, w, t1 + Math.PI / 2, t1 + Math.PI * 1.5, false);
  s.closePath();
  return s;
}

/** Distance from (x, y) to a rounded square of half-size `half` and corner radius `r`; negative inside. */
function roundedSquareDistance(x: number, y: number, half: number, r: number): number {
  const qx = Math.abs(x) - half + r;
  const qy = Math.abs(y) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

let exitGlowMap: THREE.DataTexture | null = null;
/** Soft light around the pad: brightest at its edge, fading to nothing `glowReach` further out. Made once. */
function exitGlowTexture(): THREE.DataTexture {
  if (exitGlowMap) return exitGlowMap;
  const e = P.exit;
  const n = 128;
  const span = e.size + 2 * e.glowReach;
  const near = new THREE.Color(K.exitGlow);
  const far = new THREE.Color(K.exitTop);
  const mixed = new THREE.Color();
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * span;
    const y = ((j + 0.5) / n - 0.5) * span;
    const out = Math.min(1, Math.max(0, roundedSquareDistance(x, y, e.size / 2, e.radius) / e.glowReach));
    mixed.copy(near).lerp(far, out);
    data.set([mixed.r * 255, mixed.g * 255, mixed.b * 255, 255 * (1 - out) ** e.glowFalloff], (j * n + i) * 4);
  }
  exitGlowMap = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  exitGlowMap.colorSpace = THREE.SRGBColorSpace;
  exitGlowMap.magFilter = THREE.LinearFilter;
  exitGlowMap.minFilter = THREE.LinearFilter;
  exitGlowMap.needsUpdate = true;
  return exitGlowMap;
}

/**
 * 6. Exit: a green pad as high as a floor tile, so robots drive onto it. Its
 * outer wall rises a little further into a rounded bezel; inside the bezel
 * lies a bright face at floor height with a thick rounded tick in relief.
 *
 * A flat patch of light lies around the pad, just above the neighbouring
 * tiles. It is the child named `exit-glow`, also at `userData.glow`, with a
 * material of its own, so the game can pulse it: slowly swing its
 * `material.opacity` between `glowPulse.low` and `glowPulse.high` and its
 * x/z scale up to `glowPulse.scale`, one cycle per `glowPulse.seconds`. The
 * glow is light, not body, and does not count towards the pad's measured size.
 */
export function buildExit(): THREE.Group {
  const e = P.exit;
  const pad = new THREE.Group();
  const top = e.height + e.bezelHeight;
  const inner = e.size - 2 * e.bezelWidth;
  const innerRadius = Math.max(0.02, e.radius - e.bezelWidth);

  // Wall and bezel in one piece. The cross-section runs from the foot up the outer wall, over the
  // rounded crest and down the inner wall to the face; each point carries its own tone.
  const profile: THREE.Vector2[] = [];
  const tones: THREE.Color[] = [];
  const tone = (hex: string, towards: string, by: number): THREE.Color => new THREE.Color(hex).lerp(new THREE.Color(towards), by);
  const point = (inset: number, y: number, color: THREE.Color): void => {
    profile.push(new THREE.Vector2(inset, y));
    tones.push(color);
  };
  const arcSteps = 6;
  const crest = tone(K.exit, K.exitShadow, e.crestShade).getStyle();
  point(e.bevel, 0, new THREE.Color(K.exitShadow));
  point(0, e.bevel, new THREE.Color(K.exitShadow));
  for (let k = 0; k <= arcSteps; k++) {
    const t = (k / arcSteps) * (Math.PI / 2);
    // The shoulder catches the light: a bright line all round, as on the styled reference.
    point(e.crestOuter * (1 - Math.cos(t)), top - e.crestOuter * (1 - Math.sin(t)), tone(K.exitGlow, crest, Math.abs(k / arcSteps - e.rimLight) / Math.max(e.rimLight, 1 - e.rimLight)));
  }
  for (let k = 0; k <= arcSteps; k++) {
    const t = (k / arcSteps) * (Math.PI / 2);
    point(e.bezelWidth - e.crestInner * (1 - Math.sin(t)), top - e.crestInner * (1 - Math.cos(t)), tone(crest, K.exitShadow, k / arcSteps));
  }
  point(e.bezelWidth, e.height - 0.01, new THREE.Color(K.exitShadow));
  const wallShape = roundedFrame(e.size, e.radius, profile);
  const colors = new Float32Array(wallShape.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) tones[i % tones.length].toArray(colors, i * 3);
  wallShape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const wall = new THREE.Mesh(wallShape, mats.exitBase);

  const face = new THREE.Mesh(slabOf(roundedRect(inner + 0.01, inner + 0.01, innerRadius), e.height), mats.exitFace);
  const check = new THREE.Mesh(slabOf(checkShape(e.check, e.checkWidth), e.checkDepth, e.checkBevel), mats.check);
  check.position.y = e.height;
  pad.add(wall, face, check);
  shadowed(pad);
  check.castShadow = false;

  const span = e.size + 2 * e.glowReach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  // Keep the light out of the pad's bounding box: see the doc comment.
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-e.size / 2, 0, -e.size / 2), new THREE.Vector3(e.size / 2, 0, e.size / 2));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: exitGlowTexture(), transparent: true, opacity: e.glowPulse.high, depthWrite: false, toneMapped: false }));
  glow.name = 'exit-glow';
  glow.position.y = e.height + e.glowLift;
  glow.renderOrder = 1;
  pad.add(glow);
  pad.userData.glow = glow;
  return pad;
}

function rimProfile(): THREE.Vector2[] {
  const { width, height, round } = P.rim;
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const arc = (cu: number, cv: number, from: number, to: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = from + ((to - from) * i) / 6;
      points.push(new THREE.Vector2(cu + Math.cos(a) * round, cv + Math.sin(a) * round));
    }
  };
  arc(round, height - round, Math.PI, Math.PI / 2);
  arc(width - round, height - round, Math.PI / 2, 0);
  points.push(new THREE.Vector2(width, 0));
  return points;
}

/** 2. Straight rim piece: `length` long on x, its inner face on z = 0 and its body towards +z. */
export function buildRimEdge(length = 1): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(rimProfile()), { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  g.rotateY(-Math.PI / 2);
  return shadowed(new THREE.Mesh(g, mats.rim));
}

/**
 * 3. Corner piece: the rim's cross-section swept a quarter turn around the
 * corner's centre, for the +x/+z corner. Its inner face is `innerRadius` from that centre.
 */
export function buildRimCorner(): THREE.Mesh {
  const profile = rimProfile()
    .map((p) => new THREE.Vector2(p.x + P.rim.innerRadius, p.y))
    .reverse();
  return shadowed(new THREE.Mesh(new THREE.LatheGeometry(profile, 20, 0, Math.PI / 2), mats.rim));
}

/** Size of a whole board in cell units, for `cols` by `rows` cells with `gap` between tiles. */
export function boardFootprint(cols: number, rows: number, gap: number): { innerW: number; innerD: number; outerW: number; outerD: number } {
  const side = (cells: number): number => cells * P.floorTile.size + (cells - 1) * gap + 2 * P.rim.margin;
  const innerW = side(cols);
  const innerD = side(rows);
  return { innerW, innerD, outerW: innerW + 2 * P.rim.width, outerD: innerD + 2 * P.rim.width };
}

/** 4. Underlay: one plate under the whole board with a low lip around it. Its top is y = 0. */
export function buildUnderlay(cols: number, rows: number, gap: number, pegs = false): THREE.Group {
  const u = P.underlay;
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const radius = P.rim.innerRadius + P.rim.width + u.lip;
  const plate = new THREE.Group();
  const base = new THREE.Mesh(slabOf(roundedRect(outerW + 2 * u.lip, outerD + 2 * u.lip, radius), u.height, 0.02), mats.underlay);
  base.position.y = -u.height;
  plate.add(base);
  const ring = roundedRect(outerW + 2 * u.lip, outerD + 2 * u.lip, radius);
  ring.holes.push(roundedRect(outerW, outerD, radius - u.lip));
  plate.add(new THREE.Mesh(slabOf(ring, u.lipHeight, 0.012), mats.underlay));
  if (pegs) {
    const peg = new THREE.BoxGeometry(0.12, 0.05, 0.12);
    const pitch = P.floorTile.size + gap;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      const mesh = new THREE.Mesh(peg, mats.rim);
      mesh.position.set((x - (cols - 1) / 2) * pitch, 0.025, (z - (rows - 1) / 2) * pitch);
      plate.add(mesh);
    }
  }
  return shadowed(plate);
}

/** A whole board frame assembled from the modules: straight pieces per cell and four corners. */
export function buildRim(cols: number, rows: number, gap: number): THREE.Group {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const r = P.rim.innerRadius;
  const frame = new THREE.Group();
  const straightW = (innerW - 2 * r) / cols;
  const straightD = (innerD - 2 * r) / rows;
  for (let x = 0; x < cols; x++) {
    const cx = (x - (cols - 1) / 2) * straightW;
    const front = buildRimEdge(straightW);
    front.position.set(cx, 0, innerD / 2);
    const back = buildRimEdge(straightW);
    back.position.set(cx, 0, -innerD / 2);
    back.rotation.y = Math.PI;
    frame.add(front, back);
  }
  for (let z = 0; z < rows; z++) {
    const cz = (z - (rows - 1) / 2) * straightD;
    const right = buildRimEdge(straightD);
    right.position.set(innerW / 2, 0, cz);
    right.rotation.y = Math.PI / 2;
    const left = buildRimEdge(straightD);
    left.position.set(-innerW / 2, 0, cz);
    left.rotation.y = -Math.PI / 2;
    frame.add(right, left);
  }
  const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const signs: [number, number][] = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  signs.forEach(([sx, sz], i) => {
    const corner = buildRimCorner();
    corner.position.set(sx * (innerW / 2 - r), 0, sz * (innerD / 2 - r));
    corner.rotation.y = turns[i];
    frame.add(corner);
  });
  return frame;
}
