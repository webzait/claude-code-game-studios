import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { Color } from '../../engine/types';
import parts from '../../../data/parts.json';
import { shapePlate } from './flockbot';
import { profiledBlock, roundedFrame, roundedRect, slabOf, type ProfileRing } from './shapes';

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
  exitBase: new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.exit, emissiveIntensity: 0.08 }),
  exitFace: new THREE.MeshPhysicalMaterial({ color: K.exitTop, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.exitTop, emissiveIntensity: 0.3 }),
  check: new THREE.MeshPhysicalMaterial({ color: K.check, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: K.check, emissiveIntensity: 0.25 }),
  rim: glossy(K.frame, 0.32, 0.5),
  underlay: glossy(K.frameShadow, 0.45, 0.1),
  /** The turn tile's arrows: flat, matt and unlit by the gloss, so they stay dark from every side. */
  turnInk: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
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

/**
 * Materials of the board modules. The tones are baked into each module's
 * vertices (bright top, darker edge and side), so one material covers a whole
 * module and the game can merge identical modules later.
 */
const kit = {
  tile: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35, emissive: '#FFFFFF', emissiveIntensity: P.floorTile.lift }),
  frame: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: new THREE.Color().setScalar(P.rim.gain), roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.14 }),
  tray: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: new THREE.Color().setScalar(P.underlay.gain), roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4 }),
};

const tone = (hex: string): THREE.Color => new THREE.Color(hex);

/** One outline of a lofted shape: the base rounded rectangle moved `inset` inward, at height `y`. */
interface Ring {
  inset: number;
  y: number;
  /** Surface normal here: its part pointing away from the centre, and its part pointing up. */
  out: number;
  up: number;
  color: THREE.Color;
}

/**
 * A solid drawn as a stack of rounded-rectangle outlines, `w` by `d` with
 * corner radius `r`, joined ring to ring. List the rings along the surface:
 * up the outside, inward over the top. Repeat a ring with another normal for
 * a hard edge. `cap` closes the last ring with a flat face.
 */
function loft(w: number, d: number, r: number, rings: readonly Ring[], cap: boolean, cornerSteps = 5): THREE.BufferGeometry {
  const perRing = 4 * (cornerSteps + 1);
  const position: number[] = [];
  const normal: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  const signs: readonly (readonly [number, number])[] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const addRing = (ring: Ring): void => {
    const length = Math.hypot(ring.out, ring.up) || 1;
    signs.forEach(([sx, sz], k) => {
      for (let j = 0; j <= cornerSteps; j++) {
        const phi = (k + j / cornerSteps) * (Math.PI / 2);
        const reach = Math.max(0, r - ring.inset);
        position.push(sx * (w / 2 - r) + Math.cos(phi) * reach, ring.y, sz * (d / 2 - r) + Math.sin(phi) * reach);
        normal.push((Math.cos(phi) * ring.out) / length, ring.up / length, (Math.sin(phi) * ring.out) / length);
        color.push(ring.color.r, ring.color.g, ring.color.b);
      }
    });
  };
  rings.forEach(addRing);
  for (let i = 0; i < rings.length - 1; i++) {
    // A repeated ring only changes the normal: no faces between the two copies.
    if (rings[i].inset === rings[i + 1].inset && rings[i].y === rings[i + 1].y) continue;
    for (let j = 0; j < perRing; j++) {
      const a = i * perRing + j;
      const b = i * perRing + ((j + 1) % perRing);
      index.push(a, a + perRing, b, b, a + perRing, b + perRing);
    }
  }
  if (cap) {
    const last = rings[rings.length - 1];
    const first = position.length / 3;
    addRing({ ...last, out: 0, up: 1 });
    const centre = position.length / 3;
    position.push(0, last.y, 0);
    normal.push(0, 1, 0);
    color.push(last.color.r, last.color.g, last.color.b);
    for (let j = 0; j < perRing; j++) index.push(centre, first + ((j + 1) % perRing), first + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(index);
  return g;
}

/** Geometry is built once per module and shared by every copy on the board. */
const shared = new Map<string, THREE.BufferGeometry>();
function once(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = build();
    shared.set(key, g);
  }
  return g;
}

/** The tile body: a darker side, a rounded bevel that brightens towards the top, and a bright flat top. */
function tileGeometry(alt: boolean, topTone?: string): THREE.BufferGeometry {
  const t = P.floorTile;
  const top = tone(topTone ?? (alt ? K.tileMid : K.tileLight));
  const edge = tone(K.tileEdge);
  const rings: Ring[] = [
    { inset: 0, y: 0, out: 1, up: 0, color: tone(K.tileShade) },
    { inset: 0, y: t.height - t.bevel, out: 1, up: 0, color: edge },
  ];
  for (let k = 1; k <= t.bevelSteps; k++) {
    const a = (k / t.bevelSteps) * (Math.PI / 2);
    rings.push({ inset: t.bevel * (1 - Math.cos(a)), y: t.height - t.bevel + t.bevel * Math.sin(a), out: Math.cos(a), up: Math.sin(a), color: edge.clone().lerp(top, (k / t.bevelSteps) ** t.bevelFade) });
  }
  return loft(t.size, t.size, t.radius, rings, true);
}

/** 1. Floor tile: one cell, rounded and bevelled, with four pegs underneath that stand around the underlay's socket. */
export function buildFloorTile(alt = false, pegs = true): THREE.Group {
  const t = P.floorTile;
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(once(alt ? 'tileAlt' : 'tile', () => tileGeometry(alt)), kit.tile));
  if (pegs) {
    const peg = once('tilePeg', () => {
      const g = new THREE.BoxGeometry(t.peg, t.pegHeight, t.peg);
      paint(g, K.tileShade);
      return g;
    });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const mesh = new THREE.Mesh(peg, kit.tile);
      mesh.position.set(sx * t.pegSpread, -t.pegHeight / 2, sz * t.pegSpread);
      tile.add(mesh);
    }
  }
  return shadowed(tile);
}

/** The two drawn designs of the turn tile: `pair` (two chasing arrows on a white disc, the one in the game) and `hook` (one long arrow on a violet disc, kept for comparison on the parts page). */
export type TurnTileDesign = 'pair' | 'hook';

/**
 * One curved arrow lying flat: an arc of `span` degrees around the origin that runs CLOCKWISE seen
 * from above, starting at `start` degrees (0 = north, 90 = east), with an arrowhead of `head` degrees at its
 * leading end. Sizes in cells.
 */
function clockwiseArrow(a: { radius: number; width: number; span: number; head: number; headWidth: number }, start: number): THREE.BufferGeometry {
  const rad = Math.PI / 180;
  // Compass degrees to a point in the shape's plane (x east, y north); the shape is laid flat afterwards.
  const at = (radius: number, degrees: number): THREE.Vector2 => new THREE.Vector2(Math.sin(degrees * rad) * radius, Math.cos(degrees * rad) * radius);
  const body = a.span - a.head;
  const steps = Math.max(6, Math.round(body / 8));
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = start + (body * i) / steps;
    outer.push(at(a.radius + a.width / 2, d));
    inner.unshift(at(a.radius - a.width / 2, d));
  }
  // A round tail, so the arrow reads as a stroke and not as a wedge.
  // From the inner side round the back to the outer side.
  const tail: THREE.Vector2[] = [];
  const centre = at(a.radius, start);
  const out = at(1, start);
  const back = at(1, start - 90);
  for (let i = 1; i < 6; i++) {
    const phi = (i / 6) * Math.PI;
    const u = (-Math.cos(phi) * a.width) / 2;
    const v = (Math.sin(phi) * a.width) / 2;
    tail.push(new THREE.Vector2(centre.x + out.x * u + back.x * v, centre.y + out.y * u + back.y * v));
  }
  const end = start + body;
  const points = [...outer, at(a.radius + a.headWidth / 2, end), at(a.radius, end + a.head), at(a.radius - a.headWidth / 2, end), ...inner, ...tail];
  const g = new THREE.ShapeGeometry(new THREE.Shape(points));
  g.rotateX(-Math.PI / 2);
  return g;
}

let turnGlowMap: THREE.DataTexture | null = null;
/** A soft ring of light around the turn tile's disc, for the flash when it turns a robot. Made once. */
function turnGlowTexture(): THREE.DataTexture {
  if (turnGlowMap) return turnGlowMap;
  const { inner, outer } = P.turnTile.glow;
  const n = 96;
  const c = new THREE.Color(K.turnGlow);
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2 * outer;
    const mid = (inner + outer) / 2;
    const k = Math.max(0, 1 - Math.abs(r - mid) / ((outer - inner) / 2));
    data.set([c.r * 255, c.g * 255, c.b * 255, 255 * k * k * (3 - 2 * k)], (j * n + i) * 4);
  }
  turnGlowMap = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  turnGlowMap.colorSpace = THREE.SRGBColorSpace;
  turnGlowMap.magFilter = THREE.LinearFilter;
  turnGlowMap.minFilter = THREE.LinearFilter;
  turnGlowMap.needsUpdate = true;
  return turnGlowMap;
}

/**
 * 7. Turn tile: a floor tile with a turntable let into it. A robot that arrives on it is turned a
 * quarter clockwise, whatever its colour, so the tile wears none of the robot colours: a white
 * round disc with two dark arrows chasing each other clockwise, in a periwinkle collar that
 * reaches almost to the tile's edge and so stays visible around a robot standing on it. The tile's own
 * top is tinted periwinkle too, so its corners tell it from a plain tile when the middle is covered.
 *
 * The body and collar never move. The disc is the child named `turn-disc`, also at
 * `userData.disc`: the game turns it around y together with the robot. `userData.glow` is a flat
 * ring of light with a material of its own, normally invisible (`opacity` 0); the game flashes
 * it up to `glow.peak` while the tile turns a robot. The glow is light, not body, and does not
 * count towards the tile's measured size.
 */
export function buildTurnTile(alt = false, pegs = true, design: TurnTileDesign = 'pair'): THREE.Group {
  const t = P.turnTile;
  const top = P.floorTile.height;
  const tile = buildFloorTile(alt, pegs);
  // The whole top is tinted towards the frame's periwinkle, so the cell still reads as special
  // where a robot on it, or one standing in front of it, covers the disc.
  (tile.children[0] as THREE.Mesh).geometry = once(alt ? 'turnTileAlt' : 'turnTile', () => tileGeometry(alt, alt ? K.turnTileAlt : K.turnTile));

  // Collar: a flat band just above the tile top, darker at its outer edge so it reads as a groove.
  const collar = once('turnCollar', () => {
    const g = new THREE.RingGeometry(t.disc - 0.01, t.ringOuter, 48, 2);
    g.rotateX(-Math.PI / 2);
    const position = g.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const inner = tone(K.turnRing);
    const outer = tone(K.turnRingEdge);
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i));
      const c = inner.clone().lerp(outer, Math.min(1, Math.max(0, (r - t.disc) / (t.ringOuter - t.disc))) ** 2);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const band = new THREE.Mesh(collar, kit.tile);
  band.position.y = top + t.lift;
  tile.add(band);

  const disc = new THREE.Group();
  disc.name = 'turn-disc';
  disc.position.y = top;
  const face = design === 'pair' ? K.turnDisc : K.turnAltDisc;
  const plate = once(`turnDisc-${design}`, () => profiledBlock(t.disc * 2, t.disc * 2, t.disc, [
    { inset: 0, y: 0, color: design === 'pair' ? K.turnDiscEdge : K.turnRingEdge },
    ...roundOver(0, t.discHeight - t.discRound, t.discRound, blend(design === 'pair' ? K.turnDiscEdge : K.turnAltDisc, face), 3),
  ], 10));
  disc.add(new THREE.Mesh(plate, kit.tile));
  const ink = design === 'pair' ? K.turnInk : K.turnAltInk;
  const spec = design === 'pair' ? t.arrow : { ...t.hook, count: 1 };
  for (let k = 0; k < spec.count; k++) {
    const arrow = once(`turnArrow-${design}-${k}`, () => {
      const g = clockwiseArrow(spec, spec.start + (k * 360) / spec.count);
      paint(g, ink);
      return g;
    });
    const mark = new THREE.Mesh(arrow, mats.turnInk);
    mark.position.y = t.discHeight + t.lift;
    disc.add(mark);
  }
  tile.add(disc);
  shadowed(tile);
  disc.traverse((n) => {
    n.castShadow = false;
  });

  const span = t.glow.outer * 2;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  light.translate(0, t.discHeight + 3 * t.lift, 0);
  // Keep the light out of the tile's bounding box: see the doc comment.
  const half = P.floorTile.size / 2;
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-half, 0, -half), new THREE.Vector3(half, 0, half));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: turnGlowTexture(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  glow.name = 'turn-glow';
  glow.position.y = top;
  glow.renderOrder = 1;
  tile.add(glow);
  tile.userData.disc = disc;
  tile.userData.glow = glow;
  return tile;
}

/** Give every vertex of `g` the same colour, for a part drawn with a vertex-coloured material. */
function paint(g: THREE.BufferGeometry, hex: string): void {
  const c = tone(hex);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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

/** The four tones an exit pad is drawn in. */
interface ExitTones {
  exit: string;
  exitTop: string;
  exitShadow: string;
  exitGlow: string;
}

/** Tones of an exit: the green of the exit for everyone, or a robot colour's own tones for an exit that takes only that colour. */
function exitTones(color?: Color): ExitTones {
  if (!color) return K;
  const c = CONFIG.colors.robots[color];
  return { exit: c.main, exitTop: c.top, exitShadow: c.deep, exitGlow: new THREE.Color(c.top).lerp(new THREE.Color('#FFFFFF'), 0.45).getStyle() };
}

const exitGlowMaps = new Map<string, THREE.DataTexture>();
/** Soft light around the pad: brightest at its edge, fading to nothing `glowReach` further out. Made once per colour. */
function exitGlowTexture(X: ExitTones, key: string): THREE.DataTexture {
  const known = exitGlowMaps.get(key);
  if (known) return known;
  const e = P.exit;
  const n = 128;
  const span = e.size + 2 * e.glowReach;
  const near = new THREE.Color(X.exitGlow);
  const far = new THREE.Color(X.exitTop);
  const mixed = new THREE.Color();
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * span;
    const y = ((j + 0.5) / n - 0.5) * span;
    const out = Math.min(1, Math.max(0, roundedSquareDistance(x, y, e.size / 2, e.radius) / e.glowReach));
    mixed.copy(near).lerp(far, out);
    data.set([mixed.r * 255, mixed.g * 255, mixed.b * 255, 255 * (1 - out) ** e.glowFalloff], (j * n + i) * 4);
  }
  const map = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  exitGlowMaps.set(key, map);
  return map;
}

const colourExitMats = new Map<Color, { base: THREE.MeshPhysicalMaterial; face: THREE.MeshPhysicalMaterial; mark: THREE.MeshPhysicalMaterial }>();
/** Wall and face materials of an exit in a robot colour: the green ones, re-toned. Made once per colour. */
function colourExitMaterials(color: Color, X: ExitTones): { base: THREE.MeshPhysicalMaterial; face: THREE.MeshPhysicalMaterial; mark: THREE.MeshPhysicalMaterial } {
  let m = colourExitMats.get(color);
  if (!m) {
    const base = mats.exitBase.clone();
    base.emissive.set(X.exit);
    const face = mats.exitFace.clone();
    face.color.set(X.exitTop);
    face.emissive.set(X.exitTop);
    // White does not read on the light yellow face: there the tick and the shape take the colour's darkest tone,
    // as the glyph on the yellow command button does.
    let mark = mats.check;
    if (color === 'yellow') {
      mark = mats.check.clone();
      mark.color.set(X.exitShadow);
      mark.emissive.set(X.exitShadow);
    }
    m = { base, face, mark };
    colourExitMats.set(color, m);
  }
  return m;
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
 *
 * With `color` the pad is an exit for that robot colour only: the same pad in that colour's tones.
 * It also carries the colour's shape as the child at `userData.shape` (hidden until asked for), and
 * its tick at `userData.check`, so the "Colour shapes" setting can show the shape in place of the tick.
 */
export function buildExit(color?: Color): THREE.Group {
  const X = exitTones(color);
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
  const crest = tone(X.exit, X.exitShadow, e.crestShade).getStyle();
  point(e.bevel, 0, new THREE.Color(X.exitShadow));
  point(0, e.bevel, new THREE.Color(X.exitShadow));
  for (let k = 0; k <= arcSteps; k++) {
    const t = (k / arcSteps) * (Math.PI / 2);
    // The shoulder catches the light: a bright line all round, as on the styled reference.
    point(e.crestOuter * (1 - Math.cos(t)), top - e.crestOuter * (1 - Math.sin(t)), tone(X.exitGlow, crest, Math.abs(k / arcSteps - e.rimLight) / Math.max(e.rimLight, 1 - e.rimLight)));
  }
  for (let k = 0; k <= arcSteps; k++) {
    const t = (k / arcSteps) * (Math.PI / 2);
    point(e.bezelWidth - e.crestInner * (1 - Math.sin(t)), top - e.crestInner * (1 - Math.cos(t)), tone(crest, X.exitShadow, k / arcSteps));
  }
  point(e.bezelWidth, e.height - 0.01, new THREE.Color(X.exitShadow));
  const wallShape = roundedFrame(e.size, e.radius, profile);
  const colors = new Float32Array(wallShape.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) tones[i % tones.length].toArray(colors, i * 3);
  wallShape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const painted = color ? colourExitMaterials(color, X) : { base: mats.exitBase, face: mats.exitFace, mark: mats.check };
  const wall = new THREE.Mesh(wallShape, painted.base);

  const face = new THREE.Mesh(slabOf(roundedRect(inner + 0.01, inner + 0.01, innerRadius), e.height), painted.face);
  const check = new THREE.Mesh(slabOf(checkShape(e.check, e.checkWidth), e.checkDepth, e.checkBevel), painted.mark);
  check.position.y = e.height;
  pad.add(wall, face, check);
  shadowed(pad);
  check.castShadow = false;
  pad.userData.check = check;
  if (color) {
    // The colour's shape, for players who tell the colours apart by shape: shown in place of the tick.
    const plate = new THREE.Mesh(shapePlate(color, inner * 0.62, e.checkDepth, 0), painted.mark);
    plate.position.y = e.height;
    plate.visible = false;
    pad.add(plate);
    pad.userData.shape = plate;
  }

  const span = e.size + 2 * e.glowReach;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  // Keep the light out of the pad's bounding box: see the doc comment.
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-e.size / 2, 0, -e.size / 2), new THREE.Vector3(e.size / 2, 0, e.size / 2));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: exitGlowTexture(X, color ?? 'all'), transparent: true, opacity: e.glowPulse.high, depthWrite: false, toneMapped: false }));
  glow.name = 'exit-glow';
  glow.position.y = e.height + e.glowLift;
  glow.renderOrder = 1;
  pad.add(glow);
  pad.userData.glow = glow;
  return pad;
}

/** One point of the rim's cross-section: `u` outward from the inner face, `v` up from the floor. */
interface ProfilePoint {
  u: number;
  v: number;
  nu: number;
  nv: number;
  color: THREE.Color;
}

/**
 * Cross-section of the rim, as separate runs of points (a hard edge lies
 * between two runs). From the floor: a straight inner wall, a small bright
 * round, a flat top with the thin glow line, a large round shoulder and a
 * leaning, darker outer side that ends in a notch over the underlay's lip.
 */
export function rimProfile(): ProfilePoint[][] {
  const { width: W, height: H, innerRound: ri, outerRound: ro, lean, roundSteps } = P.rim;
  const { lip, lipHeight } = P.underlay;
  const main = tone(K.frame);
  const mid = tone(K.frameMid);
  const deep = tone(K.frameShadow);
  const edge = tone(K.frameEdge);
  const glow = tone(K.frameGlow);
  const gloss = P.rim.gloss;
  const shine = main.clone().lerp(edge, gloss.strength);
  // The outer side darkens downward and the underlay's wall carries that on to the deep shadow.
  const low = mid.clone().lerp(deep, P.rim.sideShade);
  const beta = (lean * Math.PI) / 180;
  // The shoulder's centre, placed so the leaning side runs from the shoulder to the outer foot.
  const cv = H - ro;
  const cu = W - ro * Math.cos(beta) - (cv + ro * Math.sin(beta) - lipHeight) * Math.tan(beta);
  /** Colour along a run from its `stops` (place 0 to 1, colour), in order. */
  const blend = (stops: readonly (readonly [number, THREE.Color])[], t: number): THREE.Color => {
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    return c0.clone().lerp(c1, Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
  };
  const arc = (centreU: number, centreV: number, radius: number, from: number, to: number, stops: readonly (readonly [number, THREE.Color])[], steps: number): ProfilePoint[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = from + ((to - from) * i) / steps;
      return { u: centreU + Math.cos(a) * radius, v: centreV + Math.sin(a) * radius, nu: Math.cos(a), nv: Math.sin(a), color: blend(stops, i / steps) };
    });
  const line = (u0: number, v0: number, u1: number, v1: number, c0: THREE.Color, c1: THREE.Color): ProfilePoint[] => {
    const length = Math.hypot(u1 - u0, v1 - v0);
    const nu = (v0 - v1) / length;
    const nv = (u1 - u0) / length;
    return [{ u: u0, v: v0, nu, nv, color: c0 }, { u: u1, v: v1, nu, nv, color: c1 }];
  };
  const g0 = ri + (cu - ri) * P.rim.glowAt - P.rim.glowWidth / 2;
  const g1 = g0 + P.rim.glowWidth;
  const sideU = cu + ro * Math.cos(beta);
  const sideV = cv + ro * Math.sin(beta);
  return [
    line(0, 0, 0, H - ri, deep, mid),
    arc(ri, H - ri, ri, Math.PI, Math.PI / 2, [[0, mid], [1, edge]], roundSteps),
    line(ri, H, g0, H, edge, edge),
    line(g0, H, g1, H, glow, glow),
    line(g1, H, cu, H, main, main),
    // The shoulder carries the gloss: a light streak part-way down, then the mid shadow.
    arc(cu, cv, ro, Math.PI / 2, beta, [[0, main], [gloss.at - gloss.width, main], [gloss.at, shine], [gloss.at + gloss.width, main], [1, mid]], P.rim.shoulderSteps),
    line(sideU, sideV, W, lipHeight, mid, low),
    line(W, lipHeight, W - lip, lipHeight, low, low),
    line(W - lip, lipHeight, W - lip, 0, low, low),
  ];
}

/**
 * The rim's cross-section swept along a path. `place` turns a station `t`
 * (0 to 1) and a cross-section point into a position and a normal; both ends
 * are closed with a flat face so a loose piece is a solid.
 */
function sweepRim(stations: number, place: (t: number, u: number, v: number, nu: number, nv: number) => { p: THREE.Vector3; n: THREE.Vector3 }): THREE.BufferGeometry {
  const runs = rimProfile();
  const position: number[] = [];
  const normal: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  const push = (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color): number => {
    position.push(p.x, p.y, p.z);
    normal.push(n.x, n.y, n.z);
    color.push(c.r, c.g, c.b);
    return position.length / 3 - 1;
  };
  const corners = (a: number, b: number, c: number): THREE.Vector3 => {
    const at = (i: number): THREE.Vector3 => new THREE.Vector3(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
    return at(b).sub(at(a)).cross(at(c).sub(at(a)));
  };
  /** Add a triangle, turned so that it faces along `facing`. */
  const face = (a: number, b: number, c: number, facing: THREE.Vector3): void => {
    if (corners(a, b, c).dot(facing) >= 0) index.push(a, b, c);
    else index.push(a, c, b);
  };
  for (const run of runs) {
    const rows: number[][] = [];
    for (let s = 0; s <= stations; s++) {
      rows.push(run.map((q) => {
        const { p, n } = place(s / stations, q.u, q.v, q.nu, q.nv);
        return push(p, n, q.color);
      }));
    }
    for (let s = 0; s < stations; s++) for (let i = 0; i < run.length - 1; i++) {
      const facing = place((s + 0.5) / stations, run[i].u, run[i].v, run[i].nu, run[i].nv).n;
      face(rows[s][i], rows[s][i + 1], rows[s + 1][i], facing);
      face(rows[s + 1][i], rows[s][i + 1], rows[s + 1][i + 1], facing);
    }
  }
  // End faces: a fan from a point inside the cross-section, which sees every corner of it.
  const outline = runs.flat();
  const hub = { u: P.rim.width * 0.4, v: P.rim.height * 0.5 };
  for (const t of [0, 1]) {
    const here = place(t, hub.u, hub.v, 0, 0).p;
    const facing = here.clone().sub(place(t === 0 ? 0.001 : 0.999, hub.u, hub.v, 0, 0).p).normalize();
    const centre = push(here, facing, tone(K.frameMid));
    const ring = outline.map((q) => push(place(t, q.u, q.v, 0, 0).p, facing, q.color));
    for (let i = 0; i < ring.length; i++) face(centre, ring[i], ring[(i + 1) % ring.length], facing);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  g.setIndex(index);
  return g;
}

/** A peg under a rim piece, as in the drawing; only shown on loose pieces. */
function rimPeg(u: number, x: number): THREE.Mesh {
  const r = P.rim;
  const g = once('rimPeg', () => {
    const box = new THREE.BoxGeometry(r.peg, r.pegHeight, r.peg);
    paint(box, K.frameShadow);
    return box;
  });
  const mesh = new THREE.Mesh(g, kit.frame);
  mesh.position.set(x, -r.pegHeight / 2, u);
  return mesh;
}

/**
 * 2. Straight rim piece: `length` long on x, its inner face on z = 0 and its
 * body towards +z. Every piece is the same one-cell geometry; `length` only
 * sets how long this copy is, so a side of any number of cells closes exactly.
 */
export function buildRimEdge(length = 1, pegs = false): THREE.Mesh {
  const g = once('rimEdge', () => sweepRim(1, (t, u, v, nu, nv) => ({ p: new THREE.Vector3(t - 0.5, v, u), n: new THREE.Vector3(0, nv, nu) })));
  const piece = new THREE.Mesh(g, kit.frame);
  piece.scale.x = length;
  if (pegs) for (const side of [-1, 1]) piece.add(rimPeg((P.rim.width - P.underlay.lip) / 2, side * P.rim.pegSpread));
  return shadowed(piece);
}

/**
 * 3. Corner piece: the same cross-section swept a quarter turn around the
 * corner's centre, for the +x/+z corner. Its inner face is `innerRadius` from
 * that centre, so its two ends match a straight piece exactly.
 */
export function buildRimCorner(pegs = false): THREE.Mesh {
  const R = P.rim.innerRadius;
  const g = once('rimCorner', () => sweepRim(P.rim.cornerSteps, (t, u, v, nu, nv) => {
    const a = (t * Math.PI) / 2;
    return { p: new THREE.Vector3(Math.cos(a) * (R + u), v, Math.sin(a) * (R + u)), n: new THREE.Vector3(Math.cos(a) * nu, nv, Math.sin(a) * nu) };
  }));
  const piece = new THREE.Mesh(g, kit.frame);
  if (pegs) {
    const reach = R + (P.rim.width - P.underlay.lip) / 2;
    for (const a of [Math.PI / 8, (3 * Math.PI) / 8]) piece.add(rimPeg(Math.sin(a) * reach, Math.cos(a) * reach));
  }
  return shadowed(piece);
}

/**
 * Size of a whole board in cell units, for `cols` by `rows` cells with `gap`
 * between tiles: `inner` is the floor inside the rim, `outer` the rim's
 * outside, which is also the underlay's.
 */
export function boardFootprint(cols: number, rows: number, gap: number): { innerW: number; innerD: number; outerW: number; outerD: number } {
  const side = (cells: number): number => cells * P.floorTile.size + (cells - 1) * gap + 2 * P.rim.margin;
  const innerW = side(cols);
  const innerD = side(rows);
  return { innerW, innerD, outerW: innerW + 2 * P.rim.width, outerD: innerD + 2 * P.rim.width };
}

/**
 * What a board of `cols` by `rows` cells measures on a screen where its
 * outside is `boardPx` wide: the pixels per cell unit and the sizes that follow.
 */
export function boardPixels(cols: number, rows: number, gap: number, boardPx: number): { unit: number; tile: number; gap: number; frame: number; width: number; height: number } {
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const unit = boardPx / outerW;
  return { unit, tile: P.floorTile.size * unit, gap: gap * unit, frame: P.rim.width * unit, width: boardPx, height: outerD * unit };
}

/**
 * 4. Underlay: one tray under the whole board, sized by the grid, with a low
 * lip that the rim's notch sits over. Its floor is y = 0. `pegs` adds the
 * drawing's one socket per tile; they are hidden under the tiles, so the game leaves them out.
 */
export function buildUnderlay(cols: number, rows: number, gap: number, pegs = false): THREE.Group {
  const u = P.underlay;
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const deep = tone(K.frameShadow);
  const low = tone(K.frameMid).lerp(deep, P.rim.sideShade);
  const floor = tone(K.trayFloor);
  const chamfer = u.chamfer;
  const rings: Ring[] = [
    { inset: chamfer, y: -u.height, out: 1, up: -1, color: deep },
    { inset: 0, y: -u.height + chamfer, out: 1, up: -1, color: deep },
    { inset: 0, y: -u.height + chamfer, out: 1, up: 0, color: deep },
    { inset: 0, y: u.lipHeight, out: 1, up: 0, color: low },
    { inset: 0, y: u.lipHeight, out: 0, up: 1, color: low },
    { inset: u.lip, y: u.lipHeight, out: 0, up: 1, color: tone(K.frame) },
    { inset: u.lip, y: u.lipHeight, out: -1, up: 0, color: low },
    { inset: u.lip, y: 0, out: -1, up: 0, color: low },
    { inset: u.lip, y: 0, out: 0, up: 1, color: floor },
  ];
  const plate = new THREE.Group();
  const tray = new THREE.Mesh(loft(outerW, outerD, P.rim.innerRadius + P.rim.width, rings, true, P.rim.cornerSteps / 2), kit.tray);
  plate.add(tray);
  if (pegs) {
    const socket = once('socket', () => {
      const g = new THREE.BoxGeometry(u.socket, u.socketHeight, u.socket);
      paint(g, K.frameMid);
      return g;
    });
    const pitch = P.floorTile.size + gap;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      const mesh = new THREE.Mesh(socket, kit.tray);
      mesh.position.set((x - (cols - 1) / 2) * pitch, u.socketHeight / 2, (z - (rows - 1) / 2) * pitch);
      plate.add(mesh);
    }
  }
  shadowed(plate);
  tray.receiveShadow = false;
  return plate;
}

/** Where one rim module goes on a board: its position, its turn around y and, for a straight piece, its length. */
export interface RimPlace {
  kind: 'edge' | 'corner';
  x: number;
  z: number;
  turn: number;
  length: number;
}

/** The rim of a `cols` by `rows` board as a list of modules: one straight piece per cell on each side, and four corners. */
export function rimLayout(cols: number, rows: number, gap: number): RimPlace[] {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const r = P.rim.innerRadius;
  const places: RimPlace[] = [];
  const straightW = (innerW - 2 * r) / cols;
  const straightD = (innerD - 2 * r) / rows;
  for (let x = 0; x < cols; x++) {
    const cx = (x - (cols - 1) / 2) * straightW;
    places.push({ kind: 'edge', x: cx, z: innerD / 2, turn: 0, length: straightW }, { kind: 'edge', x: cx, z: -innerD / 2, turn: Math.PI, length: straightW });
  }
  for (let z = 0; z < rows; z++) {
    const cz = (z - (rows - 1) / 2) * straightD;
    places.push({ kind: 'edge', x: innerW / 2, z: cz, turn: Math.PI / 2, length: straightD }, { kind: 'edge', x: -innerW / 2, z: cz, turn: -Math.PI / 2, length: straightD });
  }
  const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const signs: [number, number][] = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  signs.forEach(([sx, sz], i) => places.push({ kind: 'corner', x: sx * (innerW / 2 - r), z: sz * (innerD / 2 - r), turn: turns[i], length: 0 }));
  return places;
}

/** A whole board frame assembled from the modules: straight pieces per cell and four corners. */
export function buildRim(cols: number, rows: number, gap: number): THREE.Group {
  const frame = new THREE.Group();
  for (const place of rimLayout(cols, rows, gap)) {
    const piece = place.kind === 'edge' ? buildRimEdge(place.length) : buildRimCorner();
    piece.position.set(place.x, 0, place.z);
    piece.rotation.y = place.turn;
    frame.add(piece);
  }
  return frame;
}
