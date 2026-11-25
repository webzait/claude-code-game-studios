import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import garden from '../../../../data/themes/garden/exit.json';
import { profiledBlock } from '../shapes';
import { hash01, once, paint, paintByHeight, shadowed, slab, turned, type TurnPoint } from './common';

/**
 * Garden theme: the turn tile, the pressure plate and the gate. The owner made no pictures of
 * these; they are designed to sit with the garden pictures and to read as clearly as the robot
 * versions in src/render/parts/board.ts, whose contract they keep: the same function names and
 * parameters, sizes in cells, and the same moving children in `userData` (`disc` and `glow` on the
 * turn tile, `button` on the plate, `door` on the gate). Design: design/themes/garden-exit.md.
 *
 * - Turn tile: a cream stepping-stone disc with two leaf-green arrows chasing each other clockwise,
 *   in a ring of honey-coloured wooden planks (a garden lazy Susan).
 * - Pressure plate: a lavender push button in a log slice; a small white fence on the button says
 *   which gate it opens.
 * - Gate: a little lavender picket pen with white rails around the cell; it sinks into the grass
 *   when open.
 * Plate and gate share the lavender: no chick, exit, flower or tile in the garden uses it.
 */

const S = garden.floorStandIn;
const T = garden.turnTile;
const PL = garden.plate;
const G = garden.gate;

/** Builds the grass tile the special tiles stand on. */
export type FloorTileBuilder = (alt?: boolean, pegs?: boolean) => THREE.Group;

const grass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

/**
 * A plain stand-in grass tile, one cell, as high as a robot floor tile. Only so the special tiles
 * can be shown on their own: the board session makes the real garden tile.
 */
export function buildStandInTile(alt = false, _pegs = true): THREE.Group {
  const t = new THREE.Group();
  const g = once(alt ? 'garden-standin-alt' : 'garden-standin', () => {
    const top = alt ? S.topAlt : S.top;
    const r = 0.04;
    return profiledBlock(1, 1, S.radius, [
      { inset: 0, y: 0, color: S.foot },
      { inset: 0, y: S.height - r, color: S.side },
      { inset: r * 0.3, y: S.height - r * 0.3, color: top },
      { inset: r, y: S.height, color: top },
    ], 8);
  });
  t.add(new THREE.Mesh(g, grass));
  return shadowed(t);
}

let floorTile: FloorTileBuilder = buildStandInTile;
/** Let the special tiles stand on another grass tile (the board session's), from now on. */
export function useGardenFloorTile(builder: FloorTileBuilder): void {
  floorTile = builder;
}

/** The plain grass tile, the same as the board session's `buildFloorTile` once `useGardenFloorTile` is set. */
export function buildFloorTile(alt = false, pegs = true): THREE.Group {
  return floorTile(alt, pegs);
}

/** Height of the grass tile's top. */
const TOP = S.height;

const kit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
const gloss = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3 });
const inkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

/**
 * One curved arrow lying flat: an arc of `span` degrees running clockwise seen from above, from
 * `start` degrees (0 = north, 90 = east), with an arrowhead of `head` degrees. As on the robot turn tile.
 */
function clockwiseArrow(a: { radius: number; width: number; span: number; head: number; headWidth: number }, start: number): THREE.BufferGeometry {
  const rad = Math.PI / 180;
  const at = (radius: number, degrees: number): THREE.Vector2 => new THREE.Vector2(Math.sin(degrees * rad) * radius, Math.cos(degrees * rad) * radius);
  const body = a.span - a.head;
  const steps = Math.max(6, Math.round(body / 6));
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = start + (body * i) / steps;
    outer.push(at(a.radius + a.width / 2, d));
    inner.unshift(at(a.radius - a.width / 2, d));
  }
  const tail: THREE.Vector2[] = [];
  const centre = at(a.radius, start);
  const out = at(1, start);
  const back = at(1, start - 90);
  for (let i = 1; i < 8; i++) {
    const phi = (i / 8) * Math.PI;
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

/** Wooden planks in a ring: radial joints, each plank a little different in tone. */
function plankRing(inner: number, outer: number, height: number, planks: number, light: string, mid: string, dark: string): THREE.BufferGeometry {
  const round = Math.min(0.012, height * 0.5);
  const profile: TurnPoint[] = [
    { r: outer, y: 0, color: dark },
    { r: outer, y: height - round, color: mid },
    { r: outer - round * 0.3, y: height - round * 0.3, color: light },
    { r: outer - round, y: height, color: light },
    { r: inner + round, y: height, color: light },
    { r: inner, y: height - round, color: mid },
    { r: inner, y: 0, color: dark },
  ];
  const joint = new THREE.Color(dark);
  const step = (Math.PI * 2) / planks;
  return turned(profile, planks * 5, (a) => {
    const u = a / step;
    const block = Math.floor(u);
    const f = u - block;
    const near = Math.max(0, 1 - (Math.min(f, 1 - f) * step * outer) / 0.014);
    return { inset: 0, mix: 0.9 * near * near, tint: joint, gain: 1 + (hash01(block * 7 + 3) - 0.5) * 0.16 };
  });
}

/**
 * Turn tile: a grass tile with a turntable let into it. A chick that arrives on it is turned a
 * quarter clockwise, whatever its colour. The wooden ring never moves; the disc is the child named
 * `turn-disc`, also at `userData.disc`, which the game turns with the chick. `userData.glow` is a
 * ring of light (opacity 0) the game flashes up to `glow.peak` while the tile turns a chick.
 */
export function buildTurnTile(alt = false, pegs = true): THREE.Group {
  const tile = buildFloorTile(alt, pegs);
  const ring = new THREE.Mesh(once('garden-turn-ring', () => plankRing(T.disc - 0.005, T.ringOuter, T.ringHeight, T.planks, T.colors.woodLight, T.colors.wood, T.colors.woodDark)), kit);
  ring.position.y = TOP;
  tile.add(shadowed(ring));

  const disc = new THREE.Group();
  disc.name = 'turn-disc';
  disc.position.y = TOP;
  const round = 0.012;
  const stone = once('garden-turn-disc', () => {
    const pts: TurnPoint[] = [{ r: T.disc - 0.008, y: 0, color: T.colors.discEdge }];
    for (let i = 0; i <= 4; i++) {
      const t = (i / 4) * (Math.PI / 2);
      pts.push({ r: T.disc - 0.008 - round + Math.cos(t) * round, y: T.discHeight - round + Math.sin(t) * round, color: new THREE.Color(T.colors.discEdge).lerp(new THREE.Color(T.colors.disc), i / 4) });
    }
    pts.push({ r: 0, y: T.discHeight, color: T.colors.disc });
    return turned(pts, 64);
  });
  disc.add(new THREE.Mesh(stone, kit));
  for (let k = 0; k < T.arrow.count; k++) {
    const arrow = once(`garden-turn-arrow-${k}`, () => paint(clockwiseArrow(T.arrow, T.arrow.start + (k * 360) / T.arrow.count), T.colors.ink));
    const mark = new THREE.Mesh(arrow, inkMat);
    mark.position.y = T.discHeight + 0.002;
    disc.add(mark);
  }
  disc.traverse((n) => {
    if (n instanceof THREE.Mesh) n.receiveShadow = true;
  });
  tile.add(disc);

  const span = T.glow.outer * 2;
  const light = new THREE.PlaneGeometry(span, span);
  light.rotateX(-Math.PI / 2);
  light.translate(0, T.discHeight + 0.006, 0);
  light.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5));
  const glow = new THREE.Mesh(light, new THREE.MeshBasicMaterial({ map: ringGlow(), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  glow.name = 'turn-glow';
  glow.position.y = TOP;
  glow.renderOrder = 1;
  tile.add(glow);
  tile.userData.disc = disc;
  tile.userData.glow = glow;
  return tile;
}

let ringGlowMap: THREE.DataTexture | null = null;
/** A soft ring of light between `glow.inner` and `glow.outer`, for the flash while the tile turns a chick. */
function ringGlow(): THREE.DataTexture {
  if (ringGlowMap) return ringGlowMap;
  const n = 96;
  const c = new THREE.Color(T.colors.glow);
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5) * 2 * T.glow.outer;
    const mid = (T.glow.inner + T.glow.outer) / 2;
    const k = Math.max(0, 1 - Math.abs(r - mid) / ((T.glow.outer - T.glow.inner) / 2));
    data.set([c.r * 255, c.g * 255, c.b * 255, 255 * k * k * (3 - 2 * k)], (j * n + i) * 4);
  }
  ringGlowMap = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  ringGlowMap.colorSpace = THREE.SRGBColorSpace;
  ringGlowMap.magFilter = THREE.LinearFilter;
  ringGlowMap.minFilter = THREE.LinearFilter;
  ringGlowMap.needsUpdate = true;
  return ringGlowMap;
}

/** Join geometries into one, keeping only position, normal and colour (so they merge). */
function joined(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(name)) n.deleteAttribute(name);
    if (!n.getAttribute('normal')) n.computeVertexNormals();
    return n;
  });
  const g = mergeGeometries(clean, false)!;
  g.computeBoundingBox();
  return g;
}

/** The small white fence on the plate's button: three pickets and a rail, lying flat. */
function fenceGlyph(size: number, depth: number): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const w = size * 0.2;
  const h = size * 0.82;
  for (const x of [-size * 0.33, 0, size * 0.33]) {
    const s = new THREE.Shape();
    const p = w * 0.55;
    s.moveTo(x - w / 2, -h / 2);
    s.lineTo(x + w / 2, -h / 2);
    s.lineTo(x + w / 2, h / 2 - p);
    s.quadraticCurveTo(x + w / 2, h / 2 - p * 0.2, x, h / 2);
    s.quadraticCurveTo(x - w / 2, h / 2 - p * 0.2, x - w / 2, h / 2 - p);
    s.closePath();
    pieces.push(slab(s, depth, depth * 0.3, 6));
  }
  const rail = new THREE.Shape();
  const rw = size * 0.95;
  const rh = size * 0.13;
  rail.moveTo(-rw / 2, -rh / 2);
  rail.lineTo(rw / 2, -rh / 2);
  rail.lineTo(rw / 2, rh / 2);
  rail.lineTo(-rw / 2, rh / 2);
  rail.closePath();
  const r1 = slab(rail, depth * 0.8, depth * 0.25, 2);
  r1.translate(0, depth * 0.2, 0);
  pieces.push(r1);
  const g = joined(pieces);
  return paint(g, PL.colors.mark);
}

/**
 * Pressure plate: a grass tile with a log slice let into it and a round lavender button in the
 * middle, carrying a small white fence. The button (with its fence) is the child at
 * `userData.button`, so the game can press it down while a chick stands on the plate.
 */
export function buildPlate(alt = false, pegs = true): THREE.Group {
  const plate = buildFloorTile(alt, pegs);
  const slice = new THREE.Mesh(once('garden-plate-ring', () => {
    const h = PL.ringHeight;
    const pts: TurnPoint[] = [
      { r: PL.ring, y: 0, color: PL.colors.ring },
      { r: PL.ring, y: h - 0.008, color: PL.colors.ring },
      { r: PL.ring - 0.01, y: h, color: PL.colors.ringLight },
    ];
    // Growth rings: light and slightly darker bands across the cut face.
    const bands = 5;
    for (let i = 1; i <= bands; i++) {
      const r = PL.ring - 0.01 - ((PL.ring - 0.01 - PL.button) * i) / bands;
      pts.push({ r, y: h, color: i % 2 ? '#B47A46' : PL.colors.ringLight });
    }
    pts.push({ r: PL.button - 0.01, y: h - 0.01, color: PL.colors.ring });
    return turned(pts, 44);
  }), kit);
  slice.position.y = TOP;
  plate.add(shadowed(slice));

  const button = new THREE.Group();
  const body = once('garden-plate-button', () => {
    const h = PL.buttonHeight;
    const d = PL.dome;
    const r = PL.button;
    const pts: TurnPoint[] = [{ r: r * 0.98, y: 0, color: PL.colors.lavenderDeep }, { r, y: h * 0.45, color: PL.colors.lavender }];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2);
      const rr = r - 0.03 + Math.cos(t) * 0.03;
      pts.push({ r: rr * (1 - (i / steps) ** 3 * 0.02), y: h - 0.03 + Math.sin(t) * 0.03, color: new THREE.Color(PL.colors.lavender).lerp(new THREE.Color(PL.colors.lavenderLight), i / steps) });
    }
    for (let i = 1; i <= 4; i++) {
      const f = i / 4;
      pts.push({ r: (r - 0.03) * (1 - f), y: h + d * Math.sin((f * Math.PI) / 2), color: new THREE.Color(PL.colors.lavenderLight).lerp(new THREE.Color(PL.colors.lavender), f * 0.4) });
    }
    return turned(pts, 44);
  });
  button.add(new THREE.Mesh(body, gloss));
  const glyph = new THREE.Mesh(once('garden-plate-glyph', () => fenceGlyph(PL.glyph, 0.014)), gloss);
  glyph.position.y = PL.buttonHeight + PL.dome - 0.004;
  button.add(glyph);
  button.position.y = TOP + PL.ringHeight * 0.4;
  button.userData.restY = button.position.y;
  shadowed(button);
  glyph.castShadow = false;
  plate.add(button);
  plate.userData.button = button;
  return plate;
}

/** The pen of the gate as one geometry: corner posts with white caps, lavender pickets and white rails on all four sides. */
function penGeometry(): THREE.BufferGeometry {
  const half = G.size / 2;
  const pieces: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: string, y0?: number, y1?: number, dark?: string): void => {
    if (dark !== undefined && y0 !== undefined && y1 !== undefined) paintByHeight(g, y0, y1, dark, color);
    else paint(g, color);
    pieces.push(g);
  };
  // Foot: a low lavender frame, which stays as the outline on the grass when the gate is open.
  {
    const outer = new THREE.Shape();
    const r = 0.1;
    const s = half;
    outer.moveTo(-s + r, -s);
    outer.lineTo(s - r, -s);
    outer.quadraticCurveTo(s, -s, s, -s + r);
    outer.lineTo(s, s - r);
    outer.quadraticCurveTo(s, s, s - r, s);
    outer.lineTo(-s + r, s);
    outer.quadraticCurveTo(-s, s, -s, s - r);
    outer.lineTo(-s, -s + r);
    outer.quadraticCurveTo(-s, -s, -s + r, -s);
    const w = G.picketDepth + 0.03;
    const hole = new THREE.Path();
    const t = s - w;
    hole.moveTo(-t + r * 0.6, -t);
    hole.quadraticCurveTo(-t, -t, -t, -t + r * 0.6);
    hole.lineTo(-t, t - r * 0.6);
    hole.quadraticCurveTo(-t, t, -t + r * 0.6, t);
    hole.lineTo(t - r * 0.6, t);
    hole.quadraticCurveTo(t, t, t, t - r * 0.6);
    hole.lineTo(t, -t + r * 0.6);
    hole.quadraticCurveTo(t, -t, t - r * 0.6, -t);
    hole.closePath();
    outer.holes.push(hole);
    add(slab(outer, G.foot, 0.008, 6), G.colors.picketDark);
  }
  // One picket: a board with a rounded point, standing in the x/y plane.
  const picket = (): THREE.BufferGeometry => {
    const w = G.picket;
    const h = G.height - G.point;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.quadraticCurveTo(w / 2, h + G.point * 0.55, 0, h + G.point);
    s.quadraticCurveTo(-w / 2, h + G.point * 0.55, -w / 2, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: G.picketDepth - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4 });
    g.translate(0, 0, -(G.picketDepth - 0.012) / 2);
    return g;
  };
  const inner = half - G.post / 2;
  for (let side = 0; side < 4; side++) {
    const turn = (side * Math.PI) / 2;
    for (let k = 0; k < G.pickets; k++) {
      const x = -inner + G.post / 2 + ((k + 0.5) * (2 * inner - G.post)) / G.pickets;
      const g = picket();
      g.translate(x, 0, half - G.picketDepth / 2 - 0.012);
      g.rotateY(turn);
      add(g, G.colors.picket, 0, G.height, G.colors.picketDark);
    }
    for (const y of G.rails) {
      const g = new THREE.BoxGeometry(2 * inner, G.rail, G.railDepth);
      g.translate(0, y, half - G.picketDepth - 0.012 - G.railDepth / 2 + 0.004);
      g.rotateY(turn);
      add(g, G.colors.picketDark);
      const out = new THREE.BoxGeometry(2 * inner, G.rail, G.railDepth);
      out.translate(0, y, half + G.railDepth / 2 - 0.016);
      out.rotateY(turn);
      add(out, G.colors.rail);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.CylinderGeometry(G.post / 2, G.post / 2 + 0.004, G.height + 0.02, 12);
    post.translate(sx * inner, (G.height + 0.02) / 2, sz * inner);
    add(post, G.colors.post, 0, G.height, G.colors.picketDark);
    const cap = new THREE.SphereGeometry(G.postCap, 12, 8);
    cap.scale(1, 0.85, 1);
    cap.translate(sx * inner, G.height + 0.02 + G.postCap * 0.4, sz * inner);
    add(cap, G.colors.cap);
  }
  return joined(pieces);
}

/**
 * Gate: a grass tile with a little lavender picket pen around the cell (white rails, white post
 * caps). The pen is the child at `userData.door`; the game sinks it into the grass while the gate is
 * open (see `gateDoorScale`), leaving its lavender foot as an outline.
 */
export function buildGate(alt = false, pegs = true): THREE.Group {
  const gate = buildFloorTile(alt, pegs);
  const door = new THREE.Group();
  door.add(new THREE.Mesh(once('garden-gate-pen', penGeometry), gloss));
  door.position.y = TOP;
  shadowed(door);
  gate.add(door);
  gate.userData.door = door;
  return gate;
}

/** Height scale of the gate's pen: full when shut, almost flat (a lavender outline on the grass) when open. */
export function gateDoorScale(open: boolean): number {
  return open ? G.openScale : 1;
}
