import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GardenPictures } from './pictures';
import {
  GARDEN_FX,
  beamRays,
  easeOut,
  easeOutBack,
  envelope,
  fxSeconds,
  puffBalls,
  randomSource,
  smooth,
  span,
  starSpots,
  type GardenFxConfig,
  type GardenFxKind,
} from './effectsPlan';

/**
 * The garden theme's board effects (sheet 21-sheet-effects): a green beam rising from a ring, a
 * burst of puffy stars, a white cloud puff and a swirling blue ring. Each is a short piece with a
 * start, a middle and an end, built in code from the config in data/themes/garden/effects.json.
 *
 * Contract with the theme session: `GardenEffects` lives in the board's group, like the robot
 * theme's `burst` and `pulseExit` in `BoardView`; positions are world x and z of a cell centre
 * (`cellX`, `cellZ`), sizes are in cells times `pitch`, heights from `floorY`.
 */

/** The board measures an effect is built to. */
export interface FxFrame {
  /** Distance between two neighbouring cells, in world units. */
  readonly pitch: number;
  /** Height of the tiles' top face. */
  readonly floorY: number;
  /** Camera tilt away from straight down, in degrees: flat pieces (stars, sparkles) face the player. Defaults to the config's. */
  readonly tilt?: number;
}

/** How one effect is played. */
export interface FxOptions {
  /** The quiet version: no flight, no spin, a soft fade in and out. */
  readonly calm?: boolean;
  /** Size against the configured size. */
  readonly scale?: number;
  /** Stars: how many (1 to 5). */
  readonly count?: number;
}

/** What an effect costs while it plays. */
export interface FxCost {
  /** Meshes it adds to the scene; each is one draw call, two for the two-material stars. */
  readonly drawCalls: number;
  /** Moving pieces: rays, sparks, stars, twinkles, cloud balls. */
  readonly particles: number;
  /** Triangles drawn, all instances together. */
  readonly triangles: number;
}

/** One playing effect. `update` takes the seconds since it started. */
export interface GardenFx {
  readonly kind: GardenFxKind;
  /** How long it plays, in seconds. */
  readonly seconds: number;
  readonly group: THREE.Group;
  readonly cost: FxCost;
  update(t: number): void;
  dispose(): void;
}

/** A canvas of `w` by `h` pixels whose pixels `paint` gives as RGBA 0..1 from u, v (0..1, v up). */
function paintTexture(w: number, h: number, paint: (u: number, v: number) => [number, number, number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint((x + 0.5) / w, 1 - (y + 0.5) / h);
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(Math.min(Math.max(r, 0), 1) * 255);
      img.data[i + 1] = Math.round(Math.min(Math.max(g, 0), 1) * 255);
      img.data[i + 2] = Math.round(Math.min(Math.max(b, 0), 1) * 255);
      img.data[i + 3] = Math.round(Math.min(Math.max(a, 0), 1) * 255);
    }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const rgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2)) as [number, number, number];
};
const mixRgb = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** A star with five round tips, radius 1, in the xy plane. */
function starShape(inner: number, round: number): THREE.Shape {
  const s = new THREE.Shape();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : inner;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  // Each corner is cut back along its two edges and rounded with a curve through the corner.
  const cut = (i: number): { from: THREE.Vector2; to: THREE.Vector2 } => {
    const p = pts[i];
    const prev = pts[(i + 9) % 10];
    const next = pts[(i + 1) % 10];
    const k = i % 2 === 0 ? round : round * 0.6;
    return { from: p.clone().lerp(prev, k), to: p.clone().lerp(next, k) };
  };
  const first = cut(0);
  s.moveTo(first.to.x, first.to.y);
  for (let i = 1; i <= 10; i++) {
    const c = cut(i % 10);
    s.lineTo(c.from.x, c.from.y);
    s.quadraticCurveTo(pts[i % 10].x, pts[i % 10].y, c.to.x, c.to.y);
  }
  return s;
}

/** Give a geometry one flat vertex colour, so it can be merged with others of other colours. */
function painted(geometry: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geometry.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * Geometries and painted textures of the code-built effects. Built once per board, the first
 * time a code-built effect plays (they need a document to paint their textures on).
 */
export class CodeFxAssets {
  readonly quad: THREE.PlaneGeometry;
  readonly cross: THREE.BufferGeometry;
  readonly column: THREE.CylinderGeometry;
  readonly disc: THREE.CircleGeometry;
  readonly beamRing: THREE.BufferGeometry;
  readonly star: THREE.ExtrudeGeometry;
  readonly ball: THREE.SphereGeometry;
  readonly curl: THREE.BufferGeometry;
  readonly torus: THREE.TorusGeometry;
  readonly torusThin: THREE.TorusGeometry;
  readonly columnTex: THREE.CanvasTexture;
  readonly rayTex: THREE.CanvasTexture;
  readonly dotTex: THREE.CanvasTexture;
  readonly twinkleTex: THREE.CanvasTexture;
  readonly padTex: THREE.CanvasTexture;
  readonly swirlTex: THREE.CanvasTexture;
  readonly streakTex: THREE.CanvasTexture;
  readonly haloTex: THREE.CanvasTexture;

  constructor(readonly config: GardenFxConfig = GARDEN_FX) {
    const b = config.beam;
    const r = config.ring;
    this.quad = new THREE.PlaneGeometry(1, 1);
    // Two crossed upright quads, bottom edge at y = 0: a ray that looks the same from every side.
    const a1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const a2 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2);
    this.cross = mergeGeometries([a1, a2])!;
    a1.dispose();
    a2.dispose();
    this.column = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0);
    this.disc = new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2);
    // The beam's ring: a white rounded lip on a green band, radius 1, one draw call.
    const tube = b.tube / b.radius;
    const band = b.band / b.radius;
    const lip = painted(new THREE.TorusGeometry(1, tube, 14, 72).rotateX(-Math.PI / 2).translate(0, band, 0), b.colors.ring);
    const wall = painted(new THREE.CylinderGeometry(1 + tube * 0.6, 1 + tube * 0.9, band, 72, 1, true).translate(0, band / 2, 0), b.colors.band);
    const inner = painted(new THREE.CylinderGeometry(1 - tube * 0.6, 1 - tube * 0.6, band, 72, 1, true).translate(0, band / 2, 0), b.colors.band);
    this.beamRing = mergeGeometries([lip, wall, inner])!;
    [lip, wall, inner].forEach((g) => g.dispose());
    const s = config.stars;
    this.star = new THREE.ExtrudeGeometry(starShape(0.5, 0.2), { depth: s.depth / s.size, bevelEnabled: true, bevelThickness: s.puff / s.size, bevelSize: (s.puff / s.size) * 0.75, bevelSegments: 3, curveSegments: 6 });
    this.star.center();
    this.ball = new THREE.SphereGeometry(1, 18, 12);
    this.shadeBall(this.ball, config.cloud.colors.light, config.cloud.colors.shade);
    this.curl = this.shadeBall(new THREE.TorusGeometry(0.16, 0.06, 10, 24, Math.PI * 1.5).rotateZ(Math.PI * 0.35), config.cloud.colors.light, config.cloud.colors.shade);
    this.torus = new THREE.TorusGeometry(1, r.tube / r.radius, 16, 80).rotateX(-Math.PI / 2);
    this.torusThin = new THREE.TorusGeometry(1, (r.tube / r.radius) * 1.25, 12, 80).rotateX(-Math.PI / 2);

    // Light of the column: bright at the foot, gone at the top, with soft upright streaks.
    const streaks = [0.07, 0.19, 0.33, 0.41, 0.58, 0.66, 0.79, 0.91];
    this.columnTex = paintTexture(256, 256, (u, v) => {
      let lines = 0.6;
      streaks.forEach((c, i) => {
        const d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c));
        lines += (i % 2 ? 0.45 : 0.7) * Math.exp(-(d * d) / 0.0006);
      });
      const fade = Math.pow(1 - v, 1.6) * smooth(Math.min(v / 0.05, 1));
      return [1, 1, 1, Math.min(lines, 1) * fade];
    });
    this.columnTex.wrapS = THREE.RepeatWrapping;
    // A ray: a thin needle of light, broad and bright at the foot, pointed at the top.
    this.rayTex = paintTexture(32, 256, (u, v) => {
      const w = 0.5 * (1 - v) + 0.04;
      const d = Math.abs(u - 0.5) / w;
      return [1, 1, 1, Math.exp(-d * d * 3) * Math.pow(1 - v, 0.9) * smooth(Math.min(v / 0.04, 1))];
    });
    this.dotTex = paintTexture(64, 64, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      return [1, 1, 1, Math.exp(-d * d * 4) * (d < 1 ? 1 : 0)];
    });
    // A four-pointed twinkle like the small ones beside the stars on the sheet.
    this.twinkleTex = paintTexture(128, 128, (u, v) => {
      const x = (u - 0.5) * 2;
      const y = (v - 0.5) * 2;
      const arms = Math.exp(-(x * x) / 0.004) * Math.pow(Math.max(0, 1 - Math.abs(y)), 2.2) + Math.exp(-(y * y) / 0.004) * Math.pow(Math.max(0, 1 - Math.abs(x)), 2.2);
      const core = Math.exp(-(x * x + y * y) / 0.03);
      return [1, 1, 1, Math.min(1, arms + core)];
    });
    // The beam's pad: pale lime in the middle, deeper green to the edge.
    const padCore = rgb(b.colors.core);
    const padMid = rgb(b.colors.pad);
    const padEdge = rgb(b.colors.padEdge);
    this.padTex = paintTexture(256, 256, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const c = d < 0.55 ? mixRgb(padCore, padMid, smooth(d / 0.55)) : mixRgb(padMid, padEdge, smooth((d - 0.55) / 0.45));
      return [...c, d < 0.985 ? 0.96 : 0];
    });
    // The blue ring's skin: u runs round the ring, v round the tube (0 outside, 0.25 on top).
    // Deep blue underneath, light on top, with bright streaks that slant round the ring like a swirl.
    const deep = rgb(r.colors.deep);
    const mid = rgb(r.colors.mid);
    const light = rgb(r.colors.light);
    this.swirlTex = paintTexture(1024, 128, (u, v) => {
      const top = Math.max(0, Math.sin(v * Math.PI * 2));
      const side = Math.max(0, Math.cos(v * Math.PI * 2));
      let c = mixRgb(deep, mid, Math.min(1, top * 1.4 + side * 0.8));
      c = mixRgb(c, light, Math.pow(top, 2) * 0.75);
      // Thin bright arcs that run along the ring and slowly wind round the tube, broken into long
      // dashes: the swirl of the sheet's ring, not stripes across it.
      const wind = u * 2 + 0.25 * Math.sin(u * Math.PI * 4) + 0.1 * Math.sin(u * Math.PI * 14);
      const arcs = Math.pow(0.5 + 0.5 * Math.sin((v * 3 + wind) * Math.PI * 2), 26);
      const thin = Math.pow(0.5 + 0.5 * Math.sin((v * 5 - wind * 1.5 + 0.3) * Math.PI * 2), 60);
      const dash = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin((u * 5 + v) * Math.PI * 2), 2);
      const streak = (arcs * 0.95 + thin * 0.7) * dash;
      c = mixRgb(c, [1, 1, 1], Math.min(1, streak * (0.6 + top)));
      return [...c, 1];
    });
    this.swirlTex.wrapS = THREE.RepeatWrapping;
    // Light streaks for the thin outer ring: mostly clear, with long thin arcs of light.
    this.streakTex = paintTexture(1024, 64, (u, v) => {
      const arc = Math.pow(0.5 + 0.5 * Math.sin((u * 3 + 0.3 * Math.sin(u * Math.PI * 4)) * Math.PI * 2), 4);
      const line = Math.pow(0.5 + 0.5 * Math.sin((v * 4 + u * 2) * Math.PI * 2), 30);
      const top = Math.max(0, Math.sin(v * Math.PI * 2));
      return [1, 1, 1, arc * line * Math.pow(top, 0.8)];
    });
    this.streakTex.wrapS = THREE.RepeatWrapping;
    // A soft halo whose brightest line sits at the ring's radius (0.48 of the quad's half width).
    this.haloTex = paintTexture(256, 256, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const ring = Math.exp(-Math.pow((d - 0.6) / 0.26, 2));
      const fill = 0.55 * Math.exp(-Math.pow(d / 0.4, 4));
      return [1, 1, 1, Math.min(1, ring + fill) * smooth(Math.min(Math.max((1 - d) / 0.15, 0), 1))];
    });
  }

  /** Vertex colours from light on top to lavender underneath, like the shading of the sheet's cloud. */
  private shadeBall<G extends THREE.BufferGeometry>(geometry: G, lightHex: string, shadeHex: string): G {
    geometry.computeVertexNormals();
    const normal = geometry.getAttribute('normal');
    const light = new THREE.Color(lightHex);
    const shade = new THREE.Color(shadeHex);
    const c = new THREE.Color();
    const colors = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const up = normal.getY(i) * 0.75 + normal.getZ(i) * 0.25;
      c.copy(shade).lerp(light, smooth(Math.min(Math.max((up + 0.55) / 1.2, 0), 1)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  dispose(): void {
    for (const g of [this.quad, this.cross, this.column, this.disc, this.beamRing, this.star, this.ball, this.curl, this.torus, this.torusThin]) g.dispose();
    for (const t of [this.columnTex, this.rayTex, this.dotTex, this.twinkleTex, this.padTex, this.swirlTex, this.streakTex, this.haloTex]) t.dispose();
  }
}

/**
 * What the effects of one board share: the config, a plain quad, and, made the first time they
 * are needed, the owner's pictures and the code-built effects' geometries and textures.
 */
export class GardenFxAssets {
  readonly quad = new THREE.PlaneGeometry(1, 1);
  private codeAssets: CodeFxAssets | null = null;
  private pictureSet: GardenPictures | null = null;

  constructor(readonly config: GardenFxConfig = GARDEN_FX) {}

  /** Geometries and textures of the code-built effects. */
  get code(): CodeFxAssets {
    return (this.codeAssets ??= new CodeFxAssets(this.config));
  }

  /** The owner's pictures as textures. */
  get pictures(): GardenPictures {
    return (this.pictureSet ??= new GardenPictures());
  }

  dispose(): void {
    this.quad.dispose();
    this.codeAssets?.dispose();
    this.pictureSet?.dispose();
  }
}

const triangles = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

/** The turn that makes a piece in the xy plane face a camera tilted `tilt` degrees from straight down. */
export function facing(tilt: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -((90 - tilt) * Math.PI) / 180);
}

/** Base of every effect: a group at a cell, its own materials, and cleanup. */
export abstract class Piece implements GardenFx {
  readonly group = new THREE.Group();
  protected materials: THREE.Material[] = [];
  protected meshes: THREE.Mesh[] = [];
  abstract readonly kind: GardenFxKind;
  abstract readonly seconds: number;
  abstract readonly cost: FxCost;
  protected readonly p: number;
  protected readonly calm: boolean;
  protected readonly scale: number;
  protected readonly face: THREE.Quaternion;
  protected readonly right: THREE.Vector3;
  protected readonly up: THREE.Vector3;
  protected readonly toward: THREE.Vector3;

  constructor(protected assets: GardenFxAssets, frame: FxFrame, x: number, z: number, lift: number, options: FxOptions) {
    this.scale = options.scale ?? 1;
    this.p = frame.pitch * this.scale;
    this.calm = options.calm ?? false;
    this.face = facing(frame.tilt ?? assets.config.facingTilt);
    this.right = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.face);
    this.toward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.face);
    this.group.position.set(x, frame.floorY + lift * this.p, z);
  }

  protected add<M extends THREE.Mesh>(mesh: M, order = 3): M {
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    this.meshes.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  protected material<M extends THREE.Material>(m: M): M {
    this.materials.push(m);
    return m;
  }

  /** A see-through material lit by nothing, for light. */
  protected glow(map: THREE.Texture, color: string, additive: boolean): THREE.MeshBasicMaterial {
    return this.material(new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0 }));
  }

  abstract update(t: number): void;

  dispose(): void {
    this.group.removeFromParent();
    for (const m of this.meshes) if (m instanceof THREE.InstancedMesh) m.dispose();
    for (const m of this.materials) m.dispose();
  }
}

const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const qz = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);
const o3 = new THREE.Vector3();

/**
 * The green beam (sheet: left): a white ring on a green band snaps open on the floor, a lime pad
 * lights up inside it, a column of light with upright streaks rises, needles of light shoot up
 * and sparks drift up through it; then it thins and fades. Meant for a chick reaching the exit.
 */
export class BeamFx extends Piece {
  readonly kind = 'beam' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshStandardMaterial;
  private pad: THREE.Mesh;
  private padMat: THREE.MeshBasicMaterial;
  private outer: THREE.Mesh;
  private outerMat: THREE.MeshBasicMaterial;
  private core: THREE.Mesh;
  private coreMat: THREE.MeshBasicMaterial;
  private rays: THREE.InstancedMesh;
  private rayMat: THREE.MeshBasicMaterial;
  private sparks: THREE.InstancedMesh;
  private sparkMat: THREE.MeshBasicMaterial;
  private rayPlan = beamRays(this.assets.config.beam.rays);
  private sparkPlan: { x: number; z: number; born: number; speed: number; size: number }[] = [];

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, 0.004, options);
    const b = assets.config.beam;
    this.seconds = fxSeconds('beam', this.calm, assets.config);
    const r = b.radius * this.p;
    this.ringMat = this.material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, emissive: '#FFFFFF', emissiveIntensity: 0.12, transparent: true }));
    this.ring = this.add(new THREE.Mesh(assets.code.beamRing, this.ringMat), 4);
    this.ring.scale.setScalar(r);
    this.padMat = this.material(new THREE.MeshBasicMaterial({ map: assets.code.padTex, transparent: true, depthWrite: false, opacity: 0 }));
    this.pad = this.add(new THREE.Mesh(assets.code.disc, this.padMat), 3);
    this.pad.position.y = 0.004 * this.p;
    this.pad.scale.setScalar(r * 0.98);
    this.outerMat = this.glow(assets.code.columnTex, b.colors.light, false);
    this.outer = this.add(new THREE.Mesh(assets.code.column, this.outerMat), 5);
    this.coreMat = this.glow(assets.code.columnTex, b.colors.core, true);
    this.core = this.add(new THREE.Mesh(assets.code.column, this.coreMat), 6);
    this.core.rotation.y = 1.3;
    this.rayMat = this.glow(assets.code.rayTex, b.colors.ray, true);
    this.rays = this.add(new THREE.InstancedMesh(assets.code.cross, this.rayMat, this.rayPlan.length), 7);
    const random = randomSource(5);
    const sparkCount = this.calm ? 0 : b.sparks;
    for (let i = 0; i < sparkCount; i++) {
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * 0.8;
      this.sparkPlan.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, born: 0.12 + random() * 0.45, speed: 0.7 + random() * 0.6, size: 0.6 + random() * 0.6 });
    }
    this.sparkMat = this.glow(assets.code.dotTex, b.colors.core, true);
    this.sparks = this.add(new THREE.InstancedMesh(assets.quad, this.sparkMat, Math.max(sparkCount, 1)), 8);
    this.sparks.count = sparkCount;
    if (this.calm) this.rays.count = 0;
    this.cost = {
      drawCalls: 4 + (this.calm ? 0 : 2),
      particles: this.rays.count + sparkCount,
      triangles: triangles(assets.code.beamRing) + triangles(assets.code.disc) + 2 * triangles(assets.code.column) + this.rays.count * triangles(assets.code.cross) + sparkCount * 2,
    };
  }

  update(t: number): void {
    const b = this.assets.config.beam;
    const u = Math.min(t / this.seconds, 1);
    const r = b.radius * this.p;
    if (this.calm) {
      // Quiet: ring, pad and a low column fade in together and out again. Nothing grows or turns.
      const k = envelope(u, 0.3, 0.6);
      this.ringMat.opacity = k;
      this.padMat.opacity = k * 0.95;
      this.outer.scale.set(r * 0.92, b.height * 0.45 * this.p, r * 0.92);
      this.core.scale.set(r * 0.55, b.height * 0.35 * this.p, r * 0.55);
      this.outerMat.opacity = k * 0.4;
      this.coreMat.opacity = k * 0.35;
      return;
    }
    // Ring: pops open, stays, fades at the end.
    this.ring.scale.setScalar(r * Math.max(easeOutBack(span(u, 0, 0.2)), 0.0001));
    this.ringMat.opacity = 1 - smooth(span(u, 0.72, 1));
    this.padMat.opacity = envelope(u, 0.14, 0.72) * 0.95;
    // Column: rises from the pad, shimmers by turning slowly, thins and fades.
    const rise = easeOut(span(u, 0.05, 0.38));
    const thin = 1 - 0.35 * smooth(span(u, 0.55, 1));
    this.outer.scale.set(r * 0.98 * thin, Math.max(b.height * this.p * rise, 0.0001), r * 0.98 * thin);
    this.outer.rotation.y = t * 0.9;
    this.outerMat.opacity = envelope(u, 0.16, 0.6) * 0.75;
    this.core.scale.set(r * 0.58 * thin, Math.max(b.height * 0.9 * this.p * rise, 0.0001), r * 0.58 * thin);
    this.core.rotation.y = 1.3 - t * 1.4;
    this.coreMat.opacity = envelope(u, 0.16, 0.55) * 0.3;
    // Rays: each shoots up in turn, stands, and narrows away.
    this.rayMat.opacity = 0.8;
    this.rayPlan.forEach((ray, i) => {
      const grow = easeOut(span(u, ray.start, ray.start + 0.28));
      const narrow = 1 - smooth(span(u, 0.5 + ray.start, 0.92));
      const h = Math.max(b.rayHeight * ray.height * this.p * grow, 0.0001);
      const w = Math.max(b.rayWidth * this.p * (0.6 + ray.height * 0.6) * narrow, 0.0001);
      this.rays.setMatrixAt(i, m4.compose(v3.set(ray.x * r, 0, ray.z * r), q4.identity(), s3.set(w * 3, h, w * 3)));
    });
    this.rays.instanceMatrix.needsUpdate = true;
    // Sparks: drift up through the column and wink out.
    this.sparkMat.opacity = 1;
    this.sparkPlan.forEach((s, i) => {
      const age = (u - s.born) / 0.4;
      const alive = age > 0 && age < 1;
      const size = alive ? Math.sin(Math.PI * age) * b.sparkSize * s.size * this.p : 0.0001;
      this.sparks.setMatrixAt(i, m4.compose(v3.set(s.x * r, age * b.height * s.speed * this.p, s.z * r), this.face, s3.set(size, size, size)));
    });
    this.sparks.instanceMatrix.needsUpdate = true;
  }
}

/**
 * The star sparkle (sheet: second): puffy yellow stars with an orange rim pop out of a point,
 * fly apart in a loose triangle, wobble and rise, with small four-pointed twinkles round them;
 * then they shrink away. Meant for the celebration and for earning stars.
 */
export class StarsFx extends Piece {
  readonly kind = 'stars' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private stars: THREE.InstancedMesh;
  private faceMat: THREE.MeshStandardMaterial;
  private rimMat: THREE.MeshStandardMaterial;
  private twinkles: THREE.InstancedMesh;
  private twinkleMat: THREE.MeshBasicMaterial;
  private spots: ReturnType<typeof starSpots>;
  private twinklePlan: { x: number; y: number; at: number; size: number }[] = [];

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, assets.config.stars.lift, options);
    const s = assets.config.stars;
    this.seconds = fxSeconds('stars', this.calm, assets.config);
    this.spots = starSpots(options.count ?? s.count);
    this.faceMat = this.material(new THREE.MeshStandardMaterial({ color: s.colors.face, emissive: s.colors.face, emissiveIntensity: 0.32, roughness: 0.4, metalness: 0, transparent: this.calm }));
    this.rimMat = this.material(new THREE.MeshStandardMaterial({ color: s.colors.rim, emissive: s.colors.rim, emissiveIntensity: 0.22, roughness: 0.5, metalness: 0, transparent: this.calm }));
    this.stars = this.add(new THREE.InstancedMesh(assets.code.star, [this.faceMat, this.rimMat], this.spots.length), 6);
    const random = randomSource(9);
    for (let i = 0; i < s.twinkles; i++) {
      const a = (i / s.twinkles) * Math.PI * 2 + 0.6;
      this.twinklePlan.push({ x: Math.cos(a) * (0.75 + random() * 0.35), y: 0.7 + Math.sin(a) * (0.6 + random() * 0.3), at: 0.12 + random() * 0.4, size: 0.6 + random() * 0.5 });
    }
    this.twinkleMat = this.glow(assets.code.twinkleTex, s.colors.glow, true);
    this.twinkles = this.add(new THREE.InstancedMesh(assets.quad, this.twinkleMat, s.twinkles), 7);
    this.cost = { drawCalls: 3, particles: this.spots.length + s.twinkles, triangles: this.spots.length * triangles(assets.code.star) + s.twinkles * 2 };
  }

  update(t: number): void {
    const s = this.assets.config.stars;
    const u = Math.min(t / this.seconds, 1);
    const size = s.size * this.p;
    const spread = s.spread * this.p;
    if (this.calm) {
      // Quiet: the stars are simply there in their places, fade in and out; no flight, no wobble.
      const k = envelope(u, 0.3, 0.65);
      this.faceMat.opacity = this.rimMat.opacity = k;
      this.spots.forEach((spot, i) => {
        v3.copy(this.right).multiplyScalar(spot.x * spread).addScaledVector(this.up, spot.y * spread);
        this.stars.setMatrixAt(i, m4.compose(v3, this.face, s3.setScalar(size * spot.size)));
      });
      this.twinkleMat.opacity = k * 0.8;
      this.twinklePlan.forEach((tw, i) => {
        v3.copy(this.right).multiplyScalar(tw.x * spread).addScaledVector(this.up, tw.y * spread).addScaledVector(this.toward, 0.05 * this.p);
        this.twinkles.setMatrixAt(i, m4.compose(v3, this.face, s3.setScalar(s.twinkleSize * tw.size * this.p)));
      });
    } else {
      this.spots.forEach((spot, i) => {
        const at = (t - spot.delay) / this.seconds;
        const pop = easeOutBack(span(at, 0, 0.24));
        const fly = easeOut(span(at, 0, 0.42));
        const gone = 1 - smooth(span(u, 0.72 + spot.delay * 0.3, 0.97));
        v3.copy(this.right)
          .multiplyScalar(spot.x * spread * fly)
          .addScaledVector(this.up, spot.y * spread * fly + s.rise * this.p * easeOut(u));
        const wobble = ((s.wobble * Math.PI) / 180) * Math.sin(t * 9 + i * 2) * (1 - u);
        q4.copy(this.face).multiply(qz.setFromAxisAngle(Z, wobble));
        this.stars.setMatrixAt(i, m4.compose(v3, q4, s3.setScalar(Math.max(size * spot.size * pop * gone, 0.0001))));
      });
      this.twinkleMat.opacity = 1;
      this.twinklePlan.forEach((tw, i) => {
        const k = span(u, tw.at, tw.at + 0.4);
        const flash = Math.sin(Math.PI * k) * (0.8 + 0.2 * Math.sin(t * 30 + i));
        v3.copy(this.right)
          .multiplyScalar(tw.x * spread)
          .addScaledVector(this.up, tw.y * spread + s.rise * this.p * u)
          .addScaledVector(this.toward, 0.05 * this.p);
        q4.copy(this.face).multiply(qz.setFromAxisAngle(Z, k * 0.8));
        this.twinkles.setMatrixAt(i, m4.compose(v3, q4, s3.setScalar(Math.max(s.twinkleSize * tw.size * this.p * flash, 0.0001))));
      });
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.twinkles.instanceMatrix.needsUpdate = true;
  }
}

/**
 * One instanced mesh shared by every effect of a kind, in blocks of `block` instances: many cloud
 * puffs at once (every chick bumping in the same step) still cost one draw call. An effect takes
 * a block, writes its instances, and gives the block back when it ends.
 */
export class InstancePool {
  readonly mesh: THREE.InstancedMesh;
  private used: boolean[];
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, readonly block: number, readonly blocks: number) {
    this.mesh = new THREE.InstancedMesh(geometry, material, block * blocks);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.used = new Array(blocks).fill(false);
    parent.add(this.mesh);
  }

  /** A free block, or null when all are taken. */
  take(): number | null {
    const b = this.used.indexOf(false);
    if (b < 0) return null;
    this.used[b] = true;
    for (let i = 0; i < this.block; i++) this.mesh.setMatrixAt(b * this.block + i, this.zero);
    this.mesh.count = Math.max(this.mesh.count, (b + 1) * this.block);
    this.mesh.visible = true;
    return b;
  }

  /** Place instance `i` of block `b`. */
  set(b: number, i: number, matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(b * this.block + i, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Give block `b` back: its instances vanish. */
  release(b: number): void {
    this.used[b] = false;
    for (let i = 0; i < this.block; i++) this.mesh.setMatrixAt(b * this.block + i, this.zero);
    const last = this.used.lastIndexOf(true);
    this.mesh.count = (last + 1) * this.block;
    this.mesh.visible = this.mesh.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Blocks in use. */
  get busy(): number {
    return this.used.filter(Boolean).length;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }
}

/** The shared meshes of the cloud puffs on one board: the balls, and the curls. */
export class CloudPool {
  readonly material: THREE.MeshStandardMaterial;
  readonly balls: InstancePool;
  readonly curls: InstancePool;

  constructor(parent: THREE.Object3D, assets: GardenFxAssets, capacity = 32) {
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, emissive: '#FFFFFF', emissiveIntensity: 0.18 });
    this.balls = new InstancePool(parent, assets.code.ball, this.material, puffBalls().length, capacity);
    this.curls = new InstancePool(parent, assets.code.curl, this.material, 1, capacity);
  }

  dispose(): void {
    this.balls.dispose();
    this.curls.dispose();
    this.material.dispose();
  }
}

/**
 * The cloud puff (sheet: third): white balls with lavender undersides pop out one after the
 * other into a round puff with a little curl, swell and drift up, then shrink away ball by ball.
 * Meant for a chick bumping into an obstacle or the edge. With a `CloudPool` the puff draws into
 * the board's shared meshes; without one (or when the pool is full) it has its own.
 */
export class CloudFx extends Piece {
  readonly kind = 'cloud' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private balls: InstancePool;
  private curls: InstancePool;
  private ballBlock: number;
  private curlBlock: number;
  private ownPool: CloudPool | null = null;
  private plan = puffBalls();

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}, pool?: CloudPool) {
    super(assets, frame, x, z, assets.config.cloud.lift, options);
    this.seconds = fxSeconds('cloud', this.calm, assets.config);
    let ballBlock = pool ? pool.balls.take() : null;
    let curlBlock = ballBlock !== null && pool ? pool.curls.take() : null;
    if (pool && ballBlock !== null && curlBlock === null) pool.balls.release(ballBlock);
    if (!pool || ballBlock === null || curlBlock === null) {
      // No room in the board's pool: a pool of one, in this effect's own group.
      this.ownPool = new CloudPool(this.group, assets, 1);
      pool = this.ownPool;
      ballBlock = pool.balls.take()!;
      curlBlock = pool.curls.take()!;
    }
    this.balls = pool.balls;
    this.curls = pool.curls;
    this.ballBlock = ballBlock;
    this.curlBlock = curlBlock!;
    this.cost = { drawCalls: this.ownPool ? 2 : 0, particles: this.plan.length + 1, triangles: this.plan.length * triangles(assets.code.ball) + triangles(assets.code.curl) };
  }

  update(t: number): void {
    const c = this.assets.config.cloud;
    const u = Math.min(t / this.seconds, 1);
    const radius = c.size * this.p;
    const swell = this.calm ? 1 : 1 + c.grow * easeOut(u);
    const lift = this.calm ? 0 : c.rise * this.p * easeOut(u);
    // A shared pool sits at the board's origin, so the puff's own place is added in; a pool of one sits in the puff's group.
    const origin = this.ownPool ? o3.set(0, 0, 0) : o3.copy(this.group.position);
    this.plan.forEach((ball, i) => {
      const pop = this.calm ? smooth(span(u, 0, 0.3)) : easeOutBack(span(u, ball.order * 0.12, ball.order * 0.12 + 0.22));
      const shrink = 1 - smooth(span(u, 0.42 + ball.order * 0.3, 0.72 + ball.order * 0.28));
      v3.copy(this.right)
        .multiplyScalar(ball.x * radius * swell)
        .addScaledVector(this.up, ball.y * radius * swell)
        .addScaledVector(this.toward, ball.z * radius)
        .add(origin);
      v3.y += lift;
      this.balls.set(this.ballBlock, i, m4.compose(v3, this.face, s3.setScalar(Math.max(ball.r * radius * pop * shrink, 0.0001))));
    });
    // The little curl sits on the upper left of the puff and goes first.
    const curl = (this.calm ? smooth(span(u, 0.1, 0.35)) : easeOutBack(span(u, 0.15, 0.4))) * (1 - smooth(span(u, 0.4, 0.65)));
    v3.copy(this.right).multiplyScalar(-0.44 * radius * swell).addScaledVector(this.up, 0.56 * radius * swell).addScaledVector(this.toward, 0.12 * radius).add(origin);
    v3.y += lift;
    this.curls.set(this.curlBlock, 0, m4.compose(v3, this.face, s3.setScalar(Math.max(radius * curl, 0.0001))));
  }

  dispose(): void {
    if (this.ownPool) this.ownPool.dispose();
    else {
      this.balls.release(this.ballBlock);
      this.curls.release(this.curlBlock);
    }
    super.dispose();
  }
}

/**
 * The blue ring (sheet: right): a ring of swirling blue light opens on the floor with a halo,
 * turns, and pulls itself shut with a flash. It belongs to an element the game does not have
 * yet (design/themes/garden-effects.md proposes a pair of portals).
 */
export class RingFx extends Piece {
  readonly kind = 'ring' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private body: THREE.Mesh;
  private bodyMat: THREE.MeshBasicMaterial;
  private streak: THREE.Mesh;
  private streakMat: THREE.MeshBasicMaterial;
  private halo: THREE.Mesh;
  private haloMat: THREE.MeshBasicMaterial;
  private flash: THREE.Mesh;
  private flashMat: THREE.MeshBasicMaterial;

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, assets.config.ring.lift, options);
    const r = assets.config.ring;
    this.seconds = fxSeconds('ring', this.calm, assets.config);
    this.bodyMat = this.material(new THREE.MeshBasicMaterial({ map: assets.code.swirlTex, transparent: true, opacity: 1 }));
    this.body = this.add(new THREE.Mesh(assets.code.torus, this.bodyMat), 5);
    this.streakMat = this.glow(assets.code.streakTex, '#FFFFFF', true);
    this.streak = this.add(new THREE.Mesh(assets.code.torusThin, this.streakMat), 6);
    this.haloMat = this.glow(assets.code.haloTex, r.colors.glow, false);
    this.halo = this.add(new THREE.Mesh(assets.quad, this.haloMat), 4);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = -r.lift * this.p * 0.6;
    this.flashMat = this.glow(assets.code.dotTex, r.colors.light, true);
    this.flash = this.add(new THREE.Mesh(assets.quad, this.flashMat), 7);
    this.flash.quaternion.copy(this.face);
    this.cost = { drawCalls: this.calm ? 3 : 4, particles: 0, triangles: triangles(assets.code.torus) + triangles(assets.code.torusThin) + 2 + (this.calm ? 0 : 2) };
    if (this.calm) this.flash.visible = false;
  }

  update(t: number): void {
    const r = this.assets.config.ring;
    const u = Math.min(t / this.seconds, 1);
    const R = r.radius * this.p;
    if (this.calm) {
      // Quiet: the ring glows up where it is and fades; it turns only very slowly.
      const k = envelope(u, 0.3, 0.65);
      this.body.scale.setScalar(R);
      this.streak.scale.setScalar(R);
      this.body.rotation.y = -u * 0.3;
      this.bodyMat.opacity = k;
      this.streakMat.opacity = k * 0.6;
      this.halo.scale.setScalar(R * 4.2);
      this.haloMat.opacity = k * r.glow;
      return;
    }
    const open = easeOutBack(span(u, 0, 0.22));
    const close = 1 - smooth(span(u, 0.74, 0.95));
    const s = Math.max(R * open * close, 0.0001);
    this.body.scale.setScalar(s);
    this.streak.scale.setScalar(s * (1 + 0.04 * Math.sin(t * 14)));
    // It turns ever faster as it closes: the swirl is pulled in.
    const turn = r.turns * Math.PI * 2 * (u + 0.8 * u * u * u);
    this.body.rotation.y = -turn;
    this.streak.rotation.y = turn * 1.4;
    this.bodyMat.opacity = 1;
    this.streakMat.opacity = envelope(u, 0.15, 0.8);
    this.halo.scale.setScalar(R * 4.2 * (0.85 + 0.15 * open) * (0.5 + 0.5 * close));
    this.haloMat.opacity = envelope(u, 0.15, 0.78) * r.glow;
    const f = span(u, 0.82, 1);
    this.flash.scale.setScalar(Math.max(R * 2.4 * Math.sin(Math.PI * f), 0.0001));
    this.flashMat.opacity = Math.sin(Math.PI * f);
  }
}

/** The code-built effects by kind. */
export const CODE_BUILDERS: Record<GardenFxKind, FxBuilder> = { beam: BeamFx, stars: StarsFx, cloud: CloudFx, ring: RingFx };

/** Builds one effect. */
export type FxBuilder = new (a: GardenFxAssets, f: FxFrame, x: number, z: number, o?: FxOptions, pool?: CloudPool) => GardenFx;
