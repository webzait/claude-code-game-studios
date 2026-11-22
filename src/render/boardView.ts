import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import PARTS from '../../data/parts.json';
import { boardFootprint, buildExit, buildFloorTile, buildObstacle, buildRim, buildTurnTile, buildUnderlay } from './parts/board';
import { CONFIG } from '../config';
import { exitsOf } from '../engine/engine';
import { DIR_DX, DIR_DY, type Color, type GameState, type RobotEvent } from '../engine/types';
import type { Level } from '../levels/parse';
import { QUARTER, headingAngle, nearestAngle, squashScale, turnAngle, type HeadingStyle } from './heading';
import { fuse, type Kit } from './kit';
import { buildPartsRobot, buildRobot, type RobotView } from './robot';
import { tileBeats } from './stepPlan';

/** Which models the board is drawn with. */
export interface BoardStyle {
  readonly kitRobots: boolean;
  readonly kitBoard: boolean;
  /** How a robot shows its heading; the whole robot turns when left out. */
  readonly heading?: HeadingStyle;
}

/** Height range of the board itself, and of a robot standing on it, in world units. */
const BOX_BOTTOM = -0.2;
const BOX_TOP = 0.3;
const ROBOT_TOP = 1.0;

const GRID = CONFIG.board.grid;
const HINT = CONFIG.hintPicture;

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
/** A turn tile on the board: the disc that turns with a robot and the light that flashes when it does. */
interface TurnTileView {
  readonly disc: THREE.Object3D;
  readonly glow: THREE.Mesh | null;
  /** Shown angle of the disc around y; it keeps the quarter turns it has made. */
  angle: number;
  /** True once this tile has turned a robot since the level was loaded. */
  used: boolean;
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
  /** One pad per exit, by cell. */
  private exitPads = new Map<number, THREE.Group>();
  private exitRings: THREE.Mesh[] = [];
  /** Patches of light around the parts exits; they breathe slowly. */
  private exitGlows: THREE.Mesh[] = [];
  private level: Level | null = null;
  /** The level's turn tiles by cell index (row-major). */
  private turnTiles = new Map<number, TurnTileView>();
  /** The cell each robot is shown on, by robot id; -1 once collected. Lets an undo see which tile a robot steps back off. */
  private shownCell = new Map<number, number>();
  /** Seconds into the turn tiles' opening cue, or null when it is not playing. */
  private cueTime: number | null = null;
  private sun: THREE.DirectionalLight;
  private time = 0;
  private last = 0;
  private particleGeo = new RoundedBoxGeometry(0.09, 0.09, 0.09, 2, 0.02);
  private layout: BoardLayout = CONFIG.board.roomy;
  private style: BoardStyle = { kitRobots: true, kitBoard: true };
  private colourShapes = false;
  /** Height of the tile surface the robots stand on. */
  private floorY = 0.06;
  private speedScale = 1;
  private reduced = false;
  /** The hint picture: one group of flat marks per robot, lying on the tiles. */
  private hintGroup = new THREE.Group();
  private hintMarks: { group: THREE.Group; dx: number; dz: number; materials: THREE.MeshBasicMaterial[] }[] = [];

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
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
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
    return this.modular ? PARTS.floorTile.size + GRID.gap : 1;
  }
  private get modular(): boolean {
    return this.style.kitBoard;
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
    const { outerW, outerD } = boardFootprint(width, height, GRID.gap);
    return { w: outerW + 2 * PARTS.underlay.lip, d: outerD + 2 * PARTS.underlay.lip };
  }

  /** Hand over the asset kit once it has loaded. Takes effect at the next level load. */
  setKit(kit: Kit): void {
    void kit;
  }

  /** Choose kit models or the built-in shapes. Takes effect at the next level load. */
  setStyle(style: BoardStyle): void {
    this.style = style;
  }

  /** The "Colour shapes" setting: show each robot colour's shape on its robots. Takes effect at once. */
  setColourShapes(on: boolean): void {
    this.colourShapes = on;
    for (const view of this.robots.values()) view.showShape(on);
    this.showExitShapes();
  }

  /** On an exit for one colour: the colour's shape in place of the tick while "Colour shapes" is on. */
  private showExitShapes(): void {
    for (const pad of this.exitPads.values()) {
      const shape = pad.userData.shape as THREE.Object3D | undefined;
      const check = pad.userData.check as THREE.Object3D | undefined;
      if (!shape || !check) continue;
      shape.visible = this.colourShapes;
      check.visible = !this.colourShapes;
    }
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
    this.clearHint();
    this.boardGroup.add(this.hintGroup);
    this.robots.clear();
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    this.exitPads.clear();
    this.exitRings = [];
    this.exitGlows = [];
    this.turnTiles.clear();
    this.shownCell.clear();
    this.floorY = this.modular ? PARTS.floorTile.height : 0.06;
    if (this.modular) this.buildPartsBoard(level);
    else this.buildPlainBoard(level);
    this.showExitShapes();

    for (const r of level.start.robots) {
      const heading = this.style.heading ?? 'faceUp';
      const viewTilt = (this.layout.tilt * Math.PI) / 180;
      const view = this.style.kitRobots ? buildPartsRobot(r.id, r.color, heading, viewTilt) : buildRobot(r.id, r.color, heading);
      view.showShape(this.colourShapes);
      this.robots.set(r.id, view);
      this.boardGroup.add(view.root);
    }
    this.sync(level.start, false);
    this.fitCamera();
    // The cue: every turn tile shows once what it does, before the player has touched anything.
    this.cueTime = this.turnTiles.size ? 0 : null;
  }

  /**
   * The turn tiles' opening cue, `seconds` in: after a short wait every disc makes one quarter
   * turn clockwise while its light flashes. With reduced motion the disc stays and only the
   * light shows. Ends the cue (the discs keep their quarter turn) once the time is up.
   */
  private playCue(seconds: number): void {
    const a = CONFIG.anim;
    const k = Math.min(1, Math.max(0, (seconds - a.tileCueDelay) / a.tileCueTime));
    for (const tile of this.turnTiles.values()) {
      if (!this.reduced) tile.disc.rotation.y = tile.angle - QUARTER * easeInOut(k);
      this.flash(tile, k);
    }
    if (k < 1) return;
    if (!this.reduced) for (const tile of this.turnTiles.values()) tile.angle -= QUARTER;
    this.cueTime = null;
  }

  /** Finish the opening cue at once, so a step or an undo starts from settled tiles. */
  private endCue(): void {
    if (this.cueTime !== null) this.playCue(Infinity);
  }

  /**
   * Board from the standalone parts, sized by the level: one underlay, the rim (a straight piece per
   * cell and four corners), a floor tile per cell, and an obstacle or the exit where the level has one.
   */
  private buildPartsBoard(level: Level): void {
    const { width, height, walls } = level.board;
    const exitAt = new Map(exitsOf(level.board).map((e) => [e.y * width + e.x, e] as const));
    // Everything that never moves goes into one group and is fused into a few meshes.
    const fixed = new THREE.Group();
    fixed.add(buildUnderlay(width, height, GRID.gap), buildRim(width, height, GRID.gap));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cx = this.cellX(x);
        const cz = this.cellZ(y);
        const exit = exitAt.get(y * width + x);
        if (exit) {
          const pad = buildExit(exit.color ?? undefined);
          pad.position.set(cx, 0, cz);
          this.exitPads.set(y * width + x, pad);
          const glow = pad.userData.glow as THREE.Mesh | undefined;
          if (glow) this.exitGlows.push(glow);
          this.boardGroup.add(pad);
          continue;
        }
        if (level.board.turnTiles?.[y * width + x]) {
          const tile = buildTurnTile((x + y) % 2 === 1, false);
          tile.position.set(cx, 0, cz);
          // The disc turns and the light flashes, so they stay out of the fused board.
          const disc = tile.userData.disc as THREE.Object3D;
          const glow = tile.userData.glow as THREE.Mesh;
          for (const moving of [disc, glow]) {
            tile.remove(moving);
            moving.position.x += cx;
            moving.position.z += cz;
            this.boardGroup.add(moving);
          }
          this.turnTiles.set(y * width + x, { disc, glow, angle: 0, used: false });
          fixed.add(tile);
          continue;
        }
        const tile = buildFloorTile((x + y) % 2 === 1, false);
        tile.position.set(cx, 0, cz);
        fixed.add(tile);
        if (walls[y * width + x]) {
          const block = buildObstacle();
          block.position.set(cx, PARTS.floorTile.height, cz);
          fixed.add(block);
        }
      }
    }
    this.boardGroup.add(fuse(fixed));
  }

  /** Board from built-in shapes, used when the kit is switched off or failed to load. */
  private buildPlainBoard(level: Level): void {
    const { width, height, walls } = level.board;
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
        if (level.board.turnTiles?.[y * width + x]) {
          // The built-in board borrows the part's disc, so a turn tile is never an unmarked cell.
          const part = buildTurnTile(false, false);
          const disc = part.userData.disc as THREE.Object3D;
          disc.position.set(this.cellX(x), 0.036, this.cellZ(y));
          this.boardGroup.add(disc);
          this.turnTiles.set(y * width + x, { disc, glow: null, angle: 0, used: false });
        }
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

    // Exits: a pad with a white tick and a slow pulse ring; green for everyone, or in a robot's colour.
    for (const exit of exitsOf(level.board)) {
    const tint = exit.color ? c[exit.color] : c.green;
    const pad = new THREE.Group();
    pad.position.set(this.cellX(exit.x), 0.04, this.cellZ(exit.y));
    const padMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.88, 0.14, 0.88, 4, 0.07),
      new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.5, emissive: tint, emissiveIntensity: 0.25 }),
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
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    pad.add(padMesh, tickMesh, ring);
    this.exitPads.set(exit.y * width + exit.x, pad);
    this.exitRings.push(ring);
    this.boardGroup.add(pad);
    }
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

  /**
   * Show a state exactly. With `animate`, robots glide there (used by undo). A robot that steps
   * back off a turn tile is first turned back by the tile, a quarter against the clock, and then
   * glides home: the tile's beat played backwards.
   */
  sync(state: GameState, animate: boolean): void {
    this.skip();
    this.endCue();
    const width = this.level?.board.width ?? 1;
    const a = CONFIG.anim;
    for (const r of state.robots) {
      const view = this.robots.get(r.id);
      if (!view) continue;
      const tx = this.cellX(r.x);
      const tz = this.cellZ(r.y);
      // Nearest equivalent heading, so an undo turns back the short way.
      const ta = nearestAngle(view.angle, headingAngle(r.dir));
      const ts = r.collected ? 0 : 1;
      const cell = r.collected ? -1 : r.y * width + r.x;
      const before = this.shownCell.get(r.id);
      this.shownCell.set(r.id, cell);
      if (!animate) {
        this.pose(view, tx, tz, ta, ts);
        continue;
      }
      const fx = view.root.position.x;
      const fz = view.root.position.z;
      const fa = view.angle;
      const fs = view.visibleScale;
      const tile = before !== undefined && before !== cell ? this.turnTiles.get(before) : undefined;
      if (tile?.used && ta - fa > QUARTER / 2) {
        const mid = fa + QUARTER;
        const discFrom = tile.angle;
        const back = a.tileTurnTime * a.tileUndoShare;
        const total = back + a.undoTime;
        this.addTween(total, (k) => {
          const first = Math.min(1, (k * total) / back);
          const second = Math.max(0, (k * total - back) / a.undoTime);
          const turn = easeOut(first);
          const e = easeOut(second);
          tile.angle = discFrom + QUARTER * turn;
          tile.disc.rotation.y = tile.angle;
          this.flash(tile, first);
          this.pose(view, fx + (tx - fx) * e, fz + (tz - fz) * e, fa + (mid - fa) * turn + (ta - mid) * e, fs + (ts - fs) * e);
        });
        continue;
      }
      this.addTween(a.undoTime, (k) => {
        const e = easeOut(k);
        this.pose(view, fx + (tx - fx) * e, fz + (tz - fz) * e, fa + (ta - fa) * e, fs + (ts - fs) * e);
      });
    }
  }

  /** The turn tile's light at point `k` (0 to 1) of a turn: up and down again. */
  private flash(tile: TurnTileView, k: number): void {
    if (!tile.glow) return;
    (tile.glow.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * Math.min(1, Math.max(0, k))) * PARTS.turnTile.glow.peak;
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
  async play(events: readonly RobotEvent[], queueSpeed: number, onBeat?: (beat: 'turn' | 'step') => void): Promise<void> {
    const a = CONFIG.anim;
    const speed = queueSpeed * this.speedScale;
    const lively = this.reduced ? 0 : 1;
    const width = this.level?.board.width ?? 1;
    for (const e of events) this.shownCell.set(e.id, e.outcome === 'exited' ? -1 : e.toY * width + e.toX);
    const turning = events.filter((e) => e.turned);
    if (turning.length) {
      onBeat?.('turn');
      await Promise.all(
        turning.map((e) => {
          const view = this.robots.get(e.id)!;
          const from = view.angle;
          return this.addTween(a.turnTime / speed, (k) => {
            view.angle = turnAngle(from, easeOutBack(k));
            view.aim(view.angle);
            view.body.position.y = Math.sin(Math.PI * k) * 0.07 * lively;
          });
        }),
      );
    }
    onBeat?.('step');
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
            this.pulseExit(e.toY * width + e.toX);
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
          // Squash along the way the robot itself travels: its heading, whichever way the body is turned.
          const s = squashScale(headingAngle(e.dir), squash);
          view.body.scale.set(s.x, s.y, s.z);
        });
      }),
    );
    // Turn tiles: every robot that arrived on one has finished its step and stands still. After
    // a short pause the tile turns it a quarter clockwise, disc and robot together, with a flash
    // of the tile's light: a beat of its own, so it reads as the board's doing and not the command's.
    const beats = tileBeats(events);
    if (!beats.length) return;
    this.endCue();
    await this.addTween(a.tileTurnPause / speed, () => undefined);
    await Promise.all(
      beats.map((beat) => {
        const view = this.robots.get(beat.id)!;
        const tile = this.turnTiles.get(beat.y * width + beat.x);
        const from = view.angle;
        const discFrom = tile?.angle ?? 0;
        if (tile) tile.used = true;
        return this.addTween(a.tileTurnTime / speed, (k) => {
          const e = this.reduced ? easeOut(k) : easeOutBack(k);
          view.angle = turnAngle(from, e);
          view.aim(view.angle);
          if (!tile) return;
          tile.angle = discFrom - QUARTER * e;
          tile.disc.rotation.y = tile.angle;
          this.flash(tile, k);
        });
      }),
    );
  }

  /**
   * Draw a hint on the board: for every robot what the hinted command will do to it. A robot the
   * command turns gets a quarter arc from its old heading to its new one; a robot that will step
   * gets a ghost arrow to its target cell, and a second quarter arc round that cell when it is a turn
   * tile that will turn it on arrival; a robot that will be blocked gets a bump mark at the
   * edge it runs into. `events` are the engine's own for that command (see `previewStep`); null
   * or an empty list clears the picture. The marks pulse softly unless motion is reduced.
   */
  showHint(events: readonly RobotEvent[] | null): void {
    this.clearHint();
    if (!events || !this.level) return;
    const p = this.pitch;
    for (const e of events) {
      const color = this.level.start.robots.find((r) => r.id === e.id)?.color;
      if (!color) continue;
      const dx = DIR_DX[e.dir];
      const dz = DIR_DY[e.dir];
      const cx = this.cellX(e.fromX);
      const cz = this.cellZ(e.fromY);
      /** A point `along` the heading and `side` to its right, in cells from the robot's centre. */
      const at = (along: number, side: number): THREE.Vector2 => new THREE.Vector2((dx * along - dz * side) * p, (dz * along + dx * side) * p);
      const shapes: THREE.Vector2[][] = [];
      if (e.outcome === 'moved' || e.outcome === 'exited') {
        const a = HINT.arrow;
        shapes.push([at(a.from, -a.shaft), at(a.neck, -a.shaft), at(a.neck, -a.head), at(a.tip, 0), at(a.neck, a.head), at(a.neck, a.shaft), at(a.from, a.shaft)]);
      } else {
        const b = HINT.bump;
        const end = b.bar + b.thick;
        shapes.push([at(b.from, -b.shaft), at(b.bar, -b.shaft), at(b.bar, -b.half), at(end, -b.half), at(end, b.half), at(b.bar, b.half), at(b.bar, b.shaft), at(b.from, b.shaft)]);
      }
      /**
       * A quarter arc with an arrowhead, clockwise as the robot itself will turn, ending on
       * heading `after`; its centre lies `ahead` cells along the robot's way.
       */
      const quarterArc = (after: number, ahead: number): THREE.Vector2[] => {
        const t = HINT.turn;
        const rad = Math.PI / 180;
        const to = after * 90 - t.endGap;
        const from = after * 90 - 90 + t.startGap;
        const ring = (radius: number, degrees: number): THREE.Vector2 => new THREE.Vector2((dx * ahead + Math.sin(degrees * rad) * radius) * p, (dz * ahead - Math.cos(degrees * rad) * radius) * p);
        const outer: THREE.Vector2[] = [];
        const inner: THREE.Vector2[] = [];
        for (let i = 0; i <= 10; i++) {
          const d = from + ((to - from) * i) / 10;
          outer.push(ring(t.radius + t.width / 2, d));
          inner.unshift(ring(t.radius - t.width / 2, d));
        }
        return [...outer, ring(t.radius + t.headWidth / 2, to), ring(t.radius, to + t.head), ring(t.radius - t.headWidth / 2, to), ...inner];
      };
      // The command's own turn: round the robot, from its old heading to its new one.
      if (e.turned) shapes.push(quarterArc(e.dir, 0));
      // A turn tile's turn: round the cell the robot steps onto, from the way it came to the way it will face.
      if (e.tileTurned) shapes.push(quarterArc(e.dir + 1, 1));
      const group = new THREE.Group();
      group.position.set(cx, this.floorY + HINT.lift, cz);
      const flat = (tone: string): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color: tone, transparent: true, opacity: HINT.opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
      // The robot's colour with a white edge, drawn over everything so no robot hides a mark.
      const tint = flat(CONFIG.colors.robots[color].side);
      const white = flat('#FFFFFF');
      for (const points of shapes) {
        const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
        geometry.rotateX(Math.PI / 2);
        // The edge is the same outline, a little larger, drawn under the fill.
        const rim = new THREE.Mesh(this.outline(points, HINT.outline * p), white);
        rim.renderOrder = 20;
        const mark = new THREE.Mesh(geometry, tint);
        mark.renderOrder = 21;
        group.add(rim, mark);
      }
      this.hintGroup.add(group);
      this.hintMarks.push({ group, dx, dz, materials: [tint, white] });
    }
  }

  /** A closed outline of `points` widened by `grow` on every side, lying flat. */
  private outline(points: readonly THREE.Vector2[], grow: number): THREE.BufferGeometry {
    const n = points.length;
    // Shoelace sum: its sign tells which way round the points run, so "outward" is known.
    let area = 0;
    for (let i = 0; i < n; i++) area += points[i].x * points[(i + 1) % n].y - points[(i + 1) % n].x * points[i].y;
    const sign = area > 0 ? 1 : -1;
    const grown = points.map((point, i) => {
      const before = points[(i + n - 1) % n];
      const after = points[(i + 1) % n];
      const a = new THREE.Vector2().subVectors(point, before).normalize();
      const b = new THREE.Vector2().subVectors(after, point).normalize();
      const normal = new THREE.Vector2(a.y + b.y, -a.x - b.x).normalize().multiplyScalar(sign);
      const sharp = Math.max(0.35, Math.sqrt((1 + a.dot(b)) / 2));
      return new THREE.Vector2(point.x + (normal.x * grow) / sharp, point.y + (normal.y * grow) / sharp);
    });
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(grown));
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }

  private clearHint(): void {
    for (const mark of this.hintMarks) {
      for (const child of mark.group.children) (child as THREE.Mesh).geometry.dispose();
      for (const material of mark.materials) material.dispose();
    }
    this.hintMarks = [];
    this.hintGroup.clear();
  }

  /** Pop the pad on one cell, or every pad when no cell is given. */
  private pulseExit(cell?: number): void {
    const pads = cell === undefined ? [...this.exitPads.values()] : [this.exitPads.get(cell)].filter((p): p is THREE.Group => p !== undefined);
    for (const pad of pads) this.pulsePad(pad);
  }

  private pulsePad(pad: THREE.Group): void {
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
    // Confetti at every exit: in the exit's own colour, or in all three at the exit for everyone.
    for (const exit of exitsOf(this.level.board)) {
      for (const color of exit.color ? [exit.color] : (['red', 'blue', 'yellow'] as const)) this.burst(this.cellX(exit.x), this.cellZ(exit.y), color);
    }
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
    if (this.cueTime !== null) {
      this.cueTime += dt;
      this.playCue(this.cueTime);
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
    // The hint picture breathes: its marks slide a little along the heading and fade, then come back.
    if (this.hintMarks.length) {
      const swing = this.reduced ? 0 : 0.5 - 0.5 * Math.cos((this.time / HINT.pulse.seconds) * Math.PI * 2);
      for (const mark of this.hintMarks) {
        const base = mark.group.userData.base as THREE.Vector3 | undefined ?? (mark.group.userData.base = mark.group.position.clone());
        mark.group.position.set(base.x + mark.dx * swing * HINT.pulse.slide * this.pitch, base.y, base.z + mark.dz * swing * HINT.pulse.slide * this.pitch);
        for (const material of mark.materials) material.opacity = HINT.opacity * (1 - HINT.pulse.fade * swing);
      }
    }
    for (const ring of this.exitRings) {
      const beat = (this.time * 0.7) % 1;
      ring.scale.setScalar(0.9 + beat * 0.55);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - beat);
    }
    for (const glow of this.exitGlows) {
      const pulse = PARTS.exit.glowPulse;
      const swing = this.reduced ? 1 : 0.5 + 0.5 * Math.sin((this.time / pulse.seconds) * Math.PI * 2);
      (glow.material as THREE.MeshBasicMaterial).opacity = pulse.low + (pulse.high - pulse.low) * swing;
      const grow = 1 + (pulse.scale - 1) * swing;
      glow.scale.set(grow, 1, grow);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
