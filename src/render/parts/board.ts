import * as THREE from 'three';
import { CONFIG } from '../../config';
import parts from '../../../data/parts.json';
import { profiledBlock, roundedBlock, roundedRect, slabOf, type ProfileRing } from './shapes';

const K = CONFIG.colors.kit;
const P = parts;

const glossy = (color: string, roughness = 0.34, clearcoat = 0.35): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.3 });

const mats = {
  tileTop: glossy(K.tileLight, 0.4, 0.2),
  tileAlt: glossy(K.tileMid, 0.4, 0.2),
  tileEdge: glossy(K.tileEdge, 0.45, 0),
  obstacle: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 }),
  obstacleStud: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
  obstacleSeat: new THREE.MeshBasicMaterial({ color: K.obstacleBolt }),
  exitBase: glossy(K.exitShadow),
  exitFace: new THREE.MeshPhysicalMaterial({ color: K.exit, roughness: 0.25, clearcoat: 0.6, emissive: K.exit, emissiveIntensity: 0.35 }),
  exitBezel: new THREE.MeshPhysicalMaterial({ color: K.exitTop, roughness: 0.25, clearcoat: 0.6, emissive: K.exitTop, emissiveIntensity: 0.3 }),
  check: glossy(K.check, 0.3, 0.5),
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

/** Points of a quarter round from (`inset`, `y`) turning inwards and up over radius `round`. */
function roundOver(inset: number, y: number, round: number, color: (t: number) => string, steps = 8): ProfileRing[] {
  const rings: ProfileRing[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    rings.push({ inset: inset + round * (1 - Math.cos(a)), y: y + round * Math.sin(a), color: color(i / steps) });
  }
  return rings;
}

const blend = (from: string, to: string) => (t: number): string => `#${new THREE.Color(from).lerp(new THREE.Color(to), t).getHexString()}`;

/**
 * 5. Obstacle block: a dense rounded block, one skin from floor to top. Darker
 * sides that lean in slightly, a soft rounded shoulder, a lighter top with a
 * shallow inset plate, and four raised round studs. Stands on the floor tile.
 */
export function buildObstacle(): THREE.Group {
  const o = P.obstacle;
  const shoulder = o.height - o.round;
  const rimIn = o.taper + o.round + o.rim;
  const plateY = o.height - o.plateDepth;
  const rings: ProfileRing[] = [
    { inset: o.foot, y: 0, color: K.obstacleShadow },
    { inset: o.foot * 0.3, y: o.foot * 0.3, color: K.obstacleShadow },
    { inset: 0, y: o.foot, color: K.obstacleSide },
    { inset: o.taper * 0.5, y: shoulder * 0.5, color: blend(K.obstacleSide, K.obstacle)(0.5) },
    ...roundOver(o.taper, shoulder, o.round, blend(K.obstacleSide, K.obstacle)),
    { inset: rimIn, y: o.height, color: K.obstacle },
    { inset: rimIn, y: o.height, color: K.obstacleShadow },
    { inset: rimIn + o.plateWall, y: plateY, color: K.obstacleShadow },
    { inset: rimIn + o.plateWall, y: plateY, color: K.obstacleTop },
  ];
  const block = new THREE.Group();
  block.add(new THREE.Mesh(profiledBlock(o.size, o.size, o.radius, rings), mats.obstacle));

  // Stud: a low round button, the block's own colours, on a thin dark seat that reads as its shadow line.
  const side = o.stud * 2;
  const stud = profiledBlock(side, side, o.stud, [
    { inset: 0, y: 0, color: K.obstacle },
    ...roundOver(0, o.studHeight - o.studRound, o.studRound, blend(K.obstacle, K.obstacleTop), 6),
  ], 8);
  const seat = new THREE.CircleGeometry(o.stud + o.studRing, 40);
  seat.rotateX(-Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const mesh = new THREE.Mesh(stud, mats.obstacleStud);
    mesh.position.set(sx * o.studSpread, plateY, sz * o.studSpread);
    const ring = new THREE.Mesh(seat, mats.obstacleSeat);
    ring.position.set(sx * o.studSpread, plateY + 0.0015, sz * o.studSpread);
    block.add(mesh, ring);
  }
  return shadowed(block);
}

/** Tick mark with square ends, as one outline. */
function checkShape(size: number): THREE.Shape {
  const s = new THREE.Shape();
  const k = size / 2;
  s.moveTo(-0.92 * k, 0.02 * k);
  s.lineTo(-0.62 * k, 0.32 * k);
  s.lineTo(-0.22 * k, -0.08 * k);
  s.lineTo(0.62 * k, 0.76 * k);
  s.lineTo(0.92 * k, 0.46 * k);
  s.lineTo(-0.22 * k, -0.68 * k);
  s.closePath();
  return s;
}

/** 6. Exit: a tile-high green pad with a raised bezel, an inset bright face and an embossed tick. */
export function buildExit(): THREE.Group {
  const e = P.exit;
  const pad = new THREE.Group();
  pad.add(new THREE.Mesh(roundedBlock(e.size, e.size, e.height, e.radius, e.bevel), mats.exitBase));
  const outer = roundedRect(e.size * e.bezel, e.size * e.bezel, e.radius);
  const inner = e.size * e.bezel - 2 * e.bezelWidth;
  outer.holes.push(roundedRect(inner, inner, Math.max(0.02, e.radius - e.bezelWidth)));
  const bezel = new THREE.Mesh(slabOf(outer, e.bezelHeight, 0.012), mats.exitBezel);
  bezel.position.y = e.height - 0.005;
  const face = new THREE.Mesh(slabOf(roundedRect(inner + 0.01, inner + 0.01, Math.max(0.02, e.radius - e.bezelWidth)), 0.02), mats.exitFace);
  face.position.y = e.height - 0.008;
  const check = new THREE.Mesh(slabOf(checkShape(e.check), e.checkDepth, 0.01), mats.check);
  check.position.y = e.height + 0.01;
  pad.add(bezel, face, check);
  return shadowed(pad);
}

/** Cross-section of the rim: u runs outward from the inner face, v up from the floor; rounded on top. */
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
