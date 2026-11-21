import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import { DIR_DX, DIR_DY, type Color, type GameState, type RobotEvent } from '../engine/types';
import type { Level } from '../levels/parse';
import { fuse, type Kit } from './kit';
import { buildKitRobot, buildRobot, type RobotView } from './robot';

/** Which models the board is drawn with. */
export interface BoardStyle {
  readonly kitRobots: boolean;
  readonly kitBoard: boolean;
}

/** Height range of the board itself, and of a robot standing on it, in world units. */
const BOX_BOTTOM = -0.2;
const BOX_TOP = 0.3;
const ROBOT_TOP = 1.0;

const GRID = CONFIG.board.grid;
/** Floor tiles of the kit are this wide in the file; they are scaled to exactly one tile. */
const KIT_TILE_WIDTH = 0.948;
const KIT_WALL_WIDTH = 0.84;

/** How the board sits in the canvas. */
export interface BoardLayout {
  /** Camera tilt away from straight down, in degrees. */
  readonly tilt: number;
  /** Width of the frame around the tiles, in cells (both sides together). */
  readonly frame: number;
  /** Share of the spare height that goes above the board: 0 = against the top, 0.5 = centred, 1 = against the controls. */
  readonly spareAbove: number;
}

interface Tween {
  elapsed: number;
  duration: number;
  update: (k: number) => void;
  done: () => void;
}
interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  spin: number;
}

const easeOutBack = (k: number): number => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3);

/** Rounded rectangle slab lying flat, centred on the origin, top at y = 0. */
function slab(w: number, d: number, r: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2);
  return g;
}

/** Cross-section of the rim: `rim` wide, `rimHeight` tall, rounded on top. u runs outward, v up. */
function rimProfile(): THREE.Vector2[] {
  const r = Math.min(0.06, GRID.rim / 2);
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const arc = (cu: number, cv: number, from: number, to: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = from + ((to - from) * i) / 6;
      points.push(new THREE.Vector2(cu + Math.cos(a) * r, cv + Math.sin(a) * r));
    }
  };
  arc(r, GRID.rimHeight - r, Math.PI, Math.PI / 2);
  arc(GRID.rim - r, GRID.rimHeight - r, Math.PI / 2, 0);
  points.push(new THREE.Vector2(GRID.rim, 0));
  return points;
}

/** Straight rim module, one unit long on x, lying along the board's front edge (outward is +z). */
function rimEdge(): THREE.BufferGeometry {
  const shape = new THREE.Shape(rimProfile());
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  // Extruded along z with the profile in x/y: turn it so the length runs along x and outward is +z.
  g.translate(0, 0, -0.5);
  g.rotateY(-Math.PI / 2);
  return g;
}

/** Corner rim module: the same profile swept a quarter turn, for the +x/+z corner. */
function rimCorner(): THREE.BufferGeometry {
  // Reversed so the surface faces outward.
  const profile = rimProfile().reverse();
  const g = new THREE.LatheGeometry(profile, 14, 0, Math.PI / 2);
  return g.toNonIndexed();
}

/**
 * Three.js presentation of a level. It never decides anything: it shows a
 * `GameState` (`sync`) and animates the events of a step (`play`).
 */
export class BoardView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.5, 400);
  private boardGroup = new THREE.Group();
  private robots = new Map<number, RobotView>();
  private tweens: Tween[] = [];
  private particles: Particle[] = [];
  private exitPad: THREE.Group | null = null;
  private exitRing: THREE.Mesh | null = null;
  private level: Level | null = null;
  private sun: THREE.DirectionalLight;
  private time = 0;
  private last = 0;
  private particleGeo = new RoundedBoxGeometry(0.09, 0.09, 0.09, 2, 0.02);
  private layout: BoardLayout = CONFIG.board.roomy;
  private kit: Kit | null = null;
  private style: BoardStyle = { kitRobots: true, kitBoard: true };
  /** Height of the tile surface the robots stand on. */
  private floorY = 0.06;
  private speedScale = 1;
  private reduced = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    // Soft studio reflections give the glossy materials something to mirror.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = CONFIG.light.reflections;
    pmrem.dispose();
    this.scene.add(this.boardGroup);
    this.scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
    this.sun = new THREE.DirectionalLight('#FFFFFF', CONFIG.light.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 5;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: '#1F3A7A', opacity: CONFIG.light.shadow }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = BOX_BOTTOM - 0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Distance between the centres of two neighbouring cells. */
  private get pitch(): number {
    return this.modular ? GRID.tile + GRID.gap : 1;
  }
  private get modular(): boolean {
    return this.style.kitBoard && this.kit !== null;
  }
  private cellX(x: number): number {
    return (x - ((this.level?.board.width ?? 1) - 1) / 2) * this.pitch;
  }
  private cellZ(y: number): number {
    return (y - ((this.level?.board.height ?? 1) - 1) / 2) * this.pitch;
  }
  /** Outer size of the whole board in world units: tiles, gaps between them and the rim on both sides. */
  private boardSize(): { w: number; d: number } {
    const { width, height } = this.level?.board ?? { width: 1, height: 1 };
    if (!this.modular) return { w: width + this.layout.frame, d: height + this.layout.frame };
    const side = (cells: number): number => cells * GRID.tile + (cells - 1) * GRID.gap + 2 * GRID.rim;
    return { w: side(width), d: side(height) };
  }

  /** Hand over the asset kit once it has loaded. Takes effect at the next level load. */
  setKit(kit: Kit): void {
    this.kit = kit;
  }

  /** Choose kit models or the built-in shapes. Takes effect at the next level load. */
  setStyle(style: BoardStyle): void {
    this.style = style;
  }

  /** The level on show, if any. */
  get currentLevel(): Level | null {
    return this.level;
  }

  /** Choose how the board is framed; takes effect at the next resize or level load. */
  setLayout(layout: BoardLayout): void {
    this.layout = layout;
  }

  /** Playback speed multiplier, and reduced motion (no hops, squash or confetti). */
  setMotion(speed: number, reduced: boolean): void {
    this.speedScale = speed;
    this.reduced = reduced;
  }

  /** Build the diorama for a level and show its start state. */
  loadLevel(level: Level): void {
    this.skip();
    this.level = level;
    this.boardGroup.clear();
    this.robots.clear();
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    const kitBoard = this.style.kitBoard ? this.kit?.board : undefined;
    this.floorY = kitBoard ? 0.145 : 0.06;
    if (kitBoard) this.buildKitBoard(level, kitBoard);
    else this.buildPlainBoard(level);

    for (const r of level.start.robots) {
      const template = this.style.kitRobots ? this.kit?.robots[r.color] : undefined;
      const view = template ? buildKitRobot(r.id, r.color, template) : buildRobot(r.id, r.color);
      this.robots.set(r.id, view);
      this.boardGroup.add(view.root);
    }
    this.sync(level.start, false);
    this.fitCamera();
  }

  /**
   * Board from repeated modules, sized by the level: one underlay, one floor tile per cell, one rim
   * segment per cell along each side, four corners, and a wall or the exit where the level has one.
   */
  private buildKitBoard(level: Level, pieces: Kit['board']): void {
    const { width, height, walls, exitX, exitY } = level.board;
    const { w, d } = this.boardSize();
    const frameMat = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.kit.frame, roughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    const gapMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.kit.gap, roughness: 0.5 });
    const underlayMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.kit.frameShadow, roughness: 0.45 });
    // Everything that never moves goes into one group and is fused into a few meshes.
    const fixed = new THREE.Group();
    const place = (piece: THREE.Object3D, x: number, z: number, turn = 0, parent: THREE.Object3D = fixed): THREE.Object3D => {
      const copy = piece.clone(true);
      copy.position.set(x, 0, z);
      copy.rotation.y = turn;
      parent.add(copy);
      return copy;
    };
    // 4. Underlay: one plate under the whole grid; its top shows in the gaps between tiles.
    const underlay = new THREE.Mesh(slab(w, d, GRID.underlay, GRID.cornerRadius), underlayMat);
    fixed.add(underlay);
    const gapFill = new THREE.Mesh(slab(w - 2 * GRID.rim, d - 2 * GRID.rim, 0.01, 0.02), gapMat);
    gapFill.position.y = 0.012;
    fixed.add(gapFill);
    // 1, 5, 6. Floor tile per cell; wall or exit from the level data.
    const tileScale = GRID.tile / KIT_TILE_WIDTH;
    const wallScale = (GRID.tile * GRID.wallFill) / KIT_WALL_WIDTH;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cx = this.cellX(x);
        const cz = this.cellZ(y);
        if (x === exitX && y === exitY) {
          this.exitPad = place(pieces.exitTile, cx, cz, 0, this.boardGroup) as THREE.Group;
          this.exitPad.scale.set(tileScale, 1, tileScale);
        } else {
          place((x + y) % 2 ? pieces.floorAlt : pieces.floorLight, cx, cz).scale.set(tileScale, 1, tileScale);
        }
        if (walls[y * width + x]) place(pieces.wallBlock, cx, cz).scale.set(wallScale, GRID.wallHeight, wallScale);
      }
    }
    // 2. Straight rim module: one per cell along each side, the same geometry turned four ways.
    const innerW = w - 2 * GRID.rim;
    const innerD = d - 2 * GRID.rim;
    const edge = new THREE.Mesh(rimEdge(), frameMat);
    for (let x = 0; x < width; x++) {
      const cx = (x - (width - 1) / 2) * (innerW / width);
      place(edge, cx, innerD / 2, 0).scale.x = innerW / width;
      place(edge, cx, -innerD / 2, Math.PI).scale.x = innerW / width;
    }
    for (let y = 0; y < height; y++) {
      const cz = (y - (height - 1) / 2) * (innerD / height);
      place(edge, innerW / 2, cz, Math.PI / 2).scale.x = innerD / height;
      place(edge, -innerW / 2, cz, -Math.PI / 2).scale.x = innerD / height;
    }
    // 3. Corner module: one geometry, four turns.
    const corner = new THREE.Mesh(rimCorner(), frameMat);
    place(corner, innerW / 2, innerD / 2, 0);
    place(corner, innerW / 2, -innerD / 2, Math.PI / 2);
    place(corner, -innerW / 2, -innerD / 2, Math.PI);
    place(corner, -innerW / 2, innerD / 2, -Math.PI / 2);
    this.boardGroup.add(fuse(fixed));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: CONFIG.colors.kit.exitGlow, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.cellX(exitX), 0.26, this.cellZ(exitY));
    this.exitRing = ring;
    this.boardGroup.add(ring);
  }

  /** Board from built-in shapes, used when the kit is switched off or failed to load. */
  private buildPlainBoard(level: Level): void {
    const { width, height, walls, exitX, exitY } = level.board;
    const c = CONFIG.colors;
    const mat = (color: string, roughness = 0.8): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color, roughness });
    const rim = this.layout.frame;
    const frame = new THREE.Mesh(
      slab(width + rim, height + rim, 0.22 + rim * 0.35, 0.34),
      new THREE.MeshPhysicalMaterial({ color: c.boardFrame, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.5 }),
    );
    frame.castShadow = true;
    frame.receiveShadow = true;
    const grout = new THREE.Mesh(slab(width + 0.1, height + 0.1, 0.16, 0.05), mat(c.boardGrout, 0.6));
    grout.position.y = 0.012;
    grout.receiveShadow = true;
    this.boardGroup.add(frame, grout);

    const tileGeo = slab(0.93, 0.93, 0.12, 0.05);
    const wallGeo = new RoundedBoxGeometry(0.86, 0.44, 0.86, 5, 0.16);
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14);
    const tileA = mat(c.tileA, 0.55);
    const tileB = mat(c.tileB, 0.55);
    const wallMat = new THREE.MeshPhysicalMaterial({ color: c.wall, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.6 });
    const boltMat = mat(c.wallBolt, 0.5);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = new THREE.Mesh(tileGeo, (x + y) % 2 ? tileB : tileA);
        tile.position.set(this.cellX(x), 0.035, this.cellZ(y));
        tile.receiveShadow = true;
        this.boardGroup.add(tile);
        if (walls[y * width + x]) {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(this.cellX(x), 0.26, this.cellZ(y));
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.boardGroup.add(wall);
          for (const bx of [-0.25, 0.25]) for (const bz of [-0.25, 0.25]) {
            const bolt = new THREE.Mesh(boltGeo, boltMat);
            bolt.position.set(this.cellX(x) + bx, 0.485, this.cellZ(y) + bz);
            this.boardGroup.add(bolt);
          }
        }
      }
    }

    // Exit: green pad with a white tick and a slow pulse ring.
    const pad = new THREE.Group();
    pad.position.set(this.cellX(exitX), 0.04, this.cellZ(exitY));
    const padMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.88, 0.14, 0.88, 4, 0.07),
      new THREE.MeshPhysicalMaterial({ color: c.green, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.5, emissive: c.green, emissiveIntensity: 0.25 }),
    );
    padMesh.position.y = 0.04;
    padMesh.receiveShadow = true;
    padMesh.castShadow = true;
    const tick = new THREE.Shape();
    tick.moveTo(-0.24, 0.0);
    tick.lineTo(-0.16, 0.08);
    tick.lineTo(-0.06, -0.03);
    tick.lineTo(0.17, 0.2);
    tick.lineTo(0.25, 0.12);
    tick.lineTo(-0.06, -0.2);
    tick.closePath();
    const tickGeo = new THREE.ExtrudeGeometry(tick, { depth: 0.03, bevelEnabled: false });
    tickGeo.rotateX(-Math.PI / 2);
    const tickMesh = new THREE.Mesh(tickGeo, mat('#FFFFFF', 0.4));
    tickMesh.position.y = 0.1;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.47, 40),
      new THREE.MeshBasicMaterial({ color: c.green, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    pad.add(padMesh, tickMesh, ring);
    this.exitPad = pad;
    this.exitRing = ring;
    this.boardGroup.add(pad);
  }

  /** Match the canvas size and frame the whole board. */
  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.fitCamera();
  }

  /**
   * Frame the board with a perspective camera, tilted from straight down, so the board has depth:
   * its near edge is drawn larger than its far edge. The board is as
   * wide as the canvas allows (less the side margin), or as tall, whichever limit is reached first.
   */
  private fitCamera(): void {
    if (!this.level) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const { width, height } = this.level.board;
    const tilt = (this.layout.tilt * Math.PI) / 180;
    const dir = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
    const size = this.boardSize();
    const hw = size.w / 2;
    const hd = size.d / 2;
    const target = new THREE.Vector3(0, 0, 0);
    this.camera.aspect = w / h;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    // The board as a box, measured on screen from a given camera distance, in CSS pixels.
    const corners: THREE.Vector3[] = [];
    for (const x of [-hw, hw]) for (const y of [BOX_BOTTOM, BOX_TOP]) for (const z of [-hd, hd]) corners.push(new THREE.Vector3(x, y, z));
    const point = new THREE.Vector3();
    const toScreen = (p: THREE.Vector3): { x: number; y: number } => {
      point.copy(p).project(this.camera);
      return { x: ((point.x + 1) / 2) * w, y: ((1 - point.y) / 2) * h };
    };
    const measure = (distance: number): { width: number; top: number; bottom: number; headroom: number } => {
      this.camera.position.copy(target).addScaledVector(dir, distance);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      const on = corners.map(toScreen);
      const xs = on.map((p) => p.x);
      const ys = on.map((p) => p.y);
      const backTop = toScreen(new THREE.Vector3(0, BOX_TOP, -hd)).y;
      const robotTop = toScreen(new THREE.Vector3(0, ROBOT_TOP, -hd)).y;
      return { width: Math.max(...xs) - Math.min(...xs), top: Math.min(...ys), bottom: Math.max(...ys), headroom: Math.max(0, backTop - robotTop) };
    };
    const fits = (distance: number): boolean => {
      const m = measure(distance);
      return m.width <= w - 2 * CONFIG.camera.marginX && m.bottom - m.top + m.headroom <= h - 2 * CONFIG.camera.marginY;
    };
    // The nearest distance at which the board still fits: as wide as the margins allow, or as tall.
    let near = 1;
    let far = 300;
    for (let i = 0; i < 40; i++) {
      const mid = (near + far) / 2;
      if (fits(mid)) far = mid;
      else near = mid;
    }
    const m = measure(far);
    // Place the board in the spare height without changing the perspective: slide the picture, not the camera.
    const spare = h - (m.bottom - m.top);
    const wanted = h / 2 - (0.5 - this.layout.spareAbove) * spare;
    this.camera.setViewOffset(w, h, 0, (m.top + m.bottom) / 2 - wanted, w, h);
    this.camera.updateProjectionMatrix();
    this.sun.position.set(target.x - 4.5, 9, target.z - 3.5);
    this.sun.target.position.copy(target);
    const cam = this.sun.shadow.camera;
    const reach = Math.max(width, height) * 0.9 + 1.5;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = 0.5;
    cam.far = 30;
    cam.updateProjectionMatrix();
  }

  /** Show a state exactly. With `animate`, robots glide there (used by undo). */
  sync(state: GameState, animate: boolean): void {
    this.skip();
    for (const r of state.robots) {
      const view = this.robots.get(r.id);
      if (!view) continue;
      const tx = this.cellX(r.x);
      const tz = this.cellZ(r.y);
      // Nearest equivalent heading, so an undo turns back the short way.
      const want = -r.dir * (Math.PI / 2);
      const turns = Math.round((view.angle - want) / (Math.PI * 2));
      const ta = want + turns * Math.PI * 2;
      const ts = r.collected ? 0 : 1;
      if (!animate) {
        this.pose(view, tx, tz, ta, ts);
        continue;
      }
      const fx = view.root.position.x;
      const fz = view.root.position.z;
      const fa = view.angle;
      const fs = view.visibleScale;
      this.addTween(CONFIG.anim.undoTime, (k) => {
        const e = easeOut(k);
        this.pose(view, fx + (tx - fx) * e, fz + (tz - fz) * e, fa + (ta - fa) * e, fs + (ts - fs) * e);
      });
    }
  }

  private pose(view: RobotView, x: number, z: number, angle: number, scale: number): void {
    view.root.position.set(x, this.floorY, z);
    view.angle = angle;
    view.visibleScale = scale;
    view.body.rotation.set(0, 0, 0);
    view.aim(angle);
    view.body.position.set(0, 0, 0);
    view.body.scale.setScalar(Math.max(scale, 0.0001));
    view.root.visible = scale > 0.001;
  }

  private addTween(duration: number, update: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.push({ elapsed: 0, duration: Math.max(duration, 0.001), update, done: resolve });
    });
  }

  /** Finish every running animation at once. */
  skip(): void {
    // A finishing tween may start a follow-up, so loop until none are left.
    while (this.tweens.length) {
      const running = this.tweens;
      this.tweens = [];
      for (const t of running) {
        t.update(1);
        t.done();
      }
    }
  }

  /**
   * Animate one resolved step: turn first, then everyone steps, bumps or exits.
   * The logical state is already final when this is called.
   */
  async play(events: readonly RobotEvent[], queueSpeed: number): Promise<void> {
    const a = CONFIG.anim;
    const speed = queueSpeed * this.speedScale;
    const lively = this.reduced ? 0 : 1;
    const turning = events.filter((e) => e.turned);
    if (turning.length) {
      await Promise.all(
        turning.map((e) => {
          const view = this.robots.get(e.id)!;
          const from = view.angle;
          return this.addTween(a.turnTime / speed, (k) => {
            view.angle = from - (Math.PI / 2) * easeOutBack(k);
            view.aim(view.angle);
            view.body.position.y = Math.sin(Math.PI * k) * 0.07 * lively;
          });
        }),
      );
    }
    await Promise.all(
      events.map((e) => {
        const view = this.robots.get(e.id)!;
        const fx = this.cellX(e.fromX);
        const fz = this.cellZ(e.fromY);
        const dx = DIR_DX[e.dir];
        const dz = DIR_DY[e.dir];
        if (e.outcome === 'moved' || e.outcome === 'exited') {
          const tx = this.cellX(e.toX);
          const tz = this.cellZ(e.toY);
          const walk = this.addTween(a.moveTime / speed, (k) => {
            const m = easeInOut(k);
            view.root.position.x = fx + (tx - fx) * m;
            view.root.position.z = fz + (tz - fz) * m;
            const arc = Math.sin(Math.PI * k) * lively;
            view.body.position.y = arc * a.hopHeight;
            view.body.scale.set(1 - arc * 0.05, 1 + arc * 0.09, 1 - arc * 0.05);
          });
          if (e.outcome === 'moved') return walk;
          // Collected: pop, spin and sink into the pad while confetti flies.
          return walk.then(() => {
            this.burst(tx, tz, view.color);
            this.pulseExit();
            void this.addTween(a.exitTime / speed, (k) => {
              const s = k < 0.25 ? 1 + k * 0.9 : 1.225 * (1 - easeInOut((k - 0.25) / 0.75));
              view.visibleScale = Math.max(s, 0);
              view.body.scale.setScalar(Math.max(s, 0.0001));
              view.body.rotation.y = -k * Math.PI * 2 * lively;
              view.body.position.y = Math.sin(Math.PI * k) * 0.35 * lively;
              if (k >= 1) view.root.visible = false;
            });
          });
        }
        // Blocked: lunge, squash against the obstacle, spring back.
        return this.addTween((a.moveTime * 1.05) / speed, (k) => {
          const lunge = k < 0.35 ? easeOut(k / 0.35) : 1 - easeOutBack((k - 0.35) / 0.65);
          const off = lunge * a.bumpDistance * (this.reduced ? 0.5 : 1);
          view.root.position.x = fx + dx * off;
          view.root.position.z = fz + dz * off;
          const squash = Math.max(0, Math.sin(Math.PI * Math.min(k / 0.6, 1))) * 0.14 * lively;
          const along = 1 - squash;
          const across = 1 + squash * 0.6;
          // The body does not turn, so squash along the world axis it is travelling on.
          if (dx !== 0) view.body.scale.set(along, 1 + squash * 0.3, across);
          else view.body.scale.set(across, 1 + squash * 0.3, along);
        });
      }),
    );
  }

  private pulseExit(): void {
    const pad = this.exitPad;
    if (!pad) return;
    void this.addTween(0.32, (k) => {
      const s = 1 + Math.sin(Math.PI * k) * 0.16;
      pad.scale.set(s, 1 + Math.sin(Math.PI * k) * 0.8, s);
    });
  }

  private burst(x: number, z: number, color: Color): void {
    if (this.reduced) return;
    const palette = [CONFIG.colors.green, CONFIG.colors[color], '#FFFFFF'];
    for (let i = 0; i < 14; i++) {
      // Deterministic spread: looks random, needs no random source.
      const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
      const speed = 1.5 + (i % 4) * 0.45;
      const mesh = new THREE.Mesh(this.particleGeo, new THREE.MeshBasicMaterial({ color: palette[i % 3] }));
      mesh.position.set(x, 0.45, z);
      this.scene.add(mesh);
      this.particles.push({ mesh, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: 3.2 + (i % 5) * 0.4, life: 0.7, spin: 6 + i });
    }
  }

  /** Celebration when the last robot is in. */
  celebrate(): void {
    if (!this.level) return;
    const { exitX, exitY } = this.level.board;
    for (const color of ['red', 'blue', 'yellow'] as const) this.burst(this.cellX(exitX), this.cellZ(exitY), color);
    this.pulseExit();
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000 || 0, 0.05);
    this.last = now;
    this.time += dt;
    if (this.tweens.length) {
      const running = this.tweens;
      this.tweens = [];
      const finished: Tween[] = [];
      for (const t of running) {
        t.elapsed += dt;
        const k = Math.min(t.elapsed / t.duration, 1);
        t.update(k);
        if (k >= 1) finished.push(t);
        else this.tweens.push(t);
      }
      for (const t of finished) t.done();
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy -= 11 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * 0.7 * dt;
      p.mesh.scale.setScalar(Math.max(p.life / 0.7, 0.001));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
    // Idle life: blinking; the exit ring breathes.
    for (const view of this.robots.values()) {
      view.blinkIn -= dt;
      const closed = view.blinkIn < 0.11;
      for (const lid of view.lids) lid.visible = closed;
      if (view.blinkIn < 0) view.blinkIn = 2.4 + ((view.id * 53 + Math.floor(this.time * 7)) % 17) / 5;
      if (!this.tweens.length) {
        view.body.scale.setScalar(Math.max(view.visibleScale, 0.0001));
      }
    }
    if (this.exitRing) {
      const beat = (this.time * 0.7) % 1;
      this.exitRing.scale.setScalar(0.9 + beat * 0.55);
      (this.exitRing.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - beat);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
