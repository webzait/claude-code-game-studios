// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// The 3D diorama. It draws a level and plays back the engine's event list as animation.
// It decides nothing: every outcome comes from src/engine. The motion only looks physical.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { tune } from '../config';
import type { GameEvent, LevelDef, PlatformDef, Target } from '../engine/types';

const BALL_R = 0.105;
const BACK_Z = -0.3; // the plane the conductors run in
const DECK_Z = 0.2; // the plane the balls roll in
const DECK_DEPTH = 0.56;
const DECK_THICK = 0.07;
const CASE = { w: 4.9, h: 8.3, zBack: -0.5, zFront: 0.95 };
const BIN = { x0: -0.82, x1: 0.82, floor: 0.2, top: 1.15, cols: 7 };
const HEAT = new THREE.Color('#ff7a1a');
const HOT = new THREE.Color('#ffd9a0');
const UP = new THREE.Vector3(0, 1, 0);

interface Tween {
  t0: number;
  dur: number;
  update: (k: number) => void;
  done?: () => void;
  started?: boolean;
}

interface PlatformView {
  def: PlatformDef;
  group: THREE.Group;
  angle: number;
  /** The angle it will have once every scheduled tilt has played. */
  plannedTilt: boolean;
  dots: THREE.Mesh[];
  support?: THREE.Object3D;
}

interface BallView {
  mesh: THREE.Mesh;
  /** Where the engine has it once everything scheduled has played. */
  holder: Target;
  slot: number;
  /** Where it is resting on screen right now. */
  rest: Target;
  restSlot: number;
  moving: boolean;
  readyAt: number;
  planPos: THREE.Vector3 | null;
}

interface EdgeView {
  id: string;
  glow: number;
  mats: THREE.MeshStandardMaterial[];
  a: THREE.Vector3;
  b: THREE.Vector3;
  bridge?: THREE.Group;
  /** 0 = closed (in line), 1 = open (swung away). */
  openness: number;
  link?: { rod: THREE.Mesh; platform: string; end: 1 | -1 };
}

interface LatchView {
  block: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  pips: THREE.Mesh[];
  glow: number;
  flash: number;
  retract: number;
  threshold: number;
  lit: number;
}

interface SourceView {
  id: string;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  ripple: THREE.Mesh;
  hit: THREE.Mesh;
  flash: number;
  ripplePhase: number;
}

export interface PlayHooks {
  /** The visible ball count in the bin changed. */
  onBin: (count: number) => void;
  onDone: () => void;
}

const easeOutBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Lays a unit-height cylinder mesh between two points. */
function setRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 1e-4);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

export class Diorama {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private readonly composer: EffectComposer | null = null;
  private readonly bloom: UnrealBloomPass | null = null;
  private readonly world = new THREE.Group(); // everything a level owns
  private readonly raycaster = new THREE.Raycaster();

  private time = 0;
  private tweens: Tween[] = [];
  private level: LevelDef | null = null;
  private platforms = new Map<string, PlatformView>();
  private balls: BallView[] = [];
  private edges = new Map<string, EdgeView>();
  private latches = new Map<string, LatchView>();
  private sources = new Map<string, SourceView>();
  private nodeGlow = new Map<string, { mat: THREE.MeshStandardMaterial; glow: number }>();
  private nodePos = new Map<string, THREE.Vector3>();
  private binCount = 0;
  private playing = false;
  /** Sources look awake only while the player can use them. */
  interactive = true;

  // shared geometry
  private readonly gTube = new THREE.CylinderGeometry(0.042, 0.042, 1, 14);
  private readonly gThin = new THREE.CylinderGeometry(0.014, 0.014, 1, 8);
  private readonly gBall = new THREE.SphereGeometry(BALL_R, 28, 20);
  private readonly gJoint = new THREE.SphereGeometry(0.078, 20, 14);
  private readonly gPip = new THREE.SphereGeometry(0.046, 14, 10);

  // shared materials
  private readonly mCopper = new THREE.MeshStandardMaterial({
    color: '#c47a45',
    metalness: 1,
    roughness: 0.28,
    emissive: HEAT,
    emissiveIntensity: 0,
  });
  private readonly mSteel = new THREE.MeshStandardMaterial({ color: '#c6ccd4', metalness: 1, roughness: 0.34 });
  private readonly mDark = new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: 0.7, roughness: 0.5 });
  private readonly mBall = new THREE.MeshStandardMaterial({
    color: '#e3e8ee',
    metalness: 1,
    roughness: 0.1,
    envMapIntensity: 0.85,
  });
  private readonly mPipOff = new THREE.MeshStandardMaterial({ color: '#2a2320', metalness: 0.4, roughness: 0.6 });
  private readonly mPipOn = new THREE.MeshStandardMaterial({
    color: '#ffb46b',
    emissive: HEAT,
    emissiveIntensity: 2.2,
  });
  private readonly mDotOn = new THREE.MeshStandardMaterial({
    color: '#e9f3ff',
    emissive: new THREE.Color('#bcd9ff'),
    emissiveIntensity: 1.6,
  });

  constructor(canvas: HTMLCanvasElement, cheap: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !cheap, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(cheap ? 0.5 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = !cheap;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    this.scene.background = this.backdrop();

    const key = new THREE.DirectionalLight('#fff1dc', 2.2);
    key.position.set(-3.5, 9, 7);
    key.target.position.set(0, 4, 0);
    key.castShadow = !cheap;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 2.5;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight('#8fb2ff', 0.7);
    rim.position.set(5, 3, -2);
    this.scene.add(rim);

    this.buildCase();
    this.scene.add(this.world);

    if (!cheap) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), tune.bloom, 0.5, 1.0);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
  }

  /** True while an event list is still playing. */
  get busy(): boolean {
    return this.playing;
  }

  // ---- the fixed object: plinth, back plate, glass, bin ----------------------------------

  private backdrop(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#171a21');
    grad.addColorStop(0.55, '#0e1015');
    grad.addColorStop(1, '#07080b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private sheen(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 256, 300);
    grad.addColorStop(0.0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.16, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.24, 'rgba(255,255,255,0.02)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.07)');
    grad.addColorStop(0.36, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildCase(): void {
    const fixed = new THREE.Group();
    const depth = CASE.zFront - CASE.zBack;
    const zMid = (CASE.zFront + CASE.zBack) / 2;

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(CASE.w, CASE.h, 0.08),
      new THREE.MeshStandardMaterial({ color: '#14171d', metalness: 0.25, roughness: 0.82 }),
    );
    back.position.set(0, CASE.h / 2, CASE.zBack - 0.06);
    back.receiveShadow = true;
    fixed.add(back);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(CASE.w + 0.5, 0.42, depth + 0.5), this.mDark);
    plinth.position.set(0, -0.21, zMid);
    plinth.receiveShadow = true;
    fixed.add(plinth);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(CASE.w + 0.52, 0.035, depth + 0.52), this.mCopper);
    trim.position.set(0, -0.02, zMid);
    fixed.add(trim);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(CASE.w + 0.2, 0.12, depth + 0.2), this.mDark);
    cap.position.set(0, CASE.h + 0.06, zMid);
    fixed.add(cap);

    // the glass shows as a faint tint, bright edges and one soft sheen: no mirror image of a room
    const glass = new THREE.MeshBasicMaterial({
      color: '#9dbde6',
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(CASE.w, CASE.h - 0.02, depth), glass);
    shell.position.set(0, CASE.h / 2 + 0.01, zMid);
    shell.renderOrder = 10;
    fixed.add(shell);
    const lines = new THREE.LineSegments(
      new THREE.EdgesGeometry(shell.geometry),
      new THREE.LineBasicMaterial({ color: '#a9bdd4', transparent: true, opacity: 0.38 }),
    );
    lines.position.copy(shell.position);
    fixed.add(lines);
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(CASE.w, CASE.h),
      new THREE.MeshBasicMaterial({ map: this.sheen(), transparent: true, opacity: 0.5, depthWrite: false }),
    );
    sheen.position.set(0, CASE.h / 2, CASE.zFront + 0.002);
    sheen.renderOrder = 11;
    fixed.add(sheen);

    // the catch bin: a glass tray with a copper rim
    const binGlass = glass.clone();
    binGlass.opacity = 0.16;
    const wall = (x: number, y: number, w: number, h: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, DECK_DEPTH + 0.1), binGlass);
      m.position.set(x, y, DECK_Z);
      m.renderOrder = 9;
      fixed.add(m);
    };
    const bh = BIN.top - BIN.floor;
    wall(BIN.x0 - 0.03, BIN.floor + bh / 2, 0.05, bh);
    wall(BIN.x1 + 0.03, BIN.floor + bh / 2, 0.05, bh);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(BIN.x1 - BIN.x0 + 0.16, 0.06, DECK_DEPTH + 0.14), this.mSteel);
    floor.position.set(0, BIN.floor - 0.03, DECK_Z);
    floor.receiveShadow = true;
    fixed.add(floor);
    for (const x of [BIN.x0 - 0.03, BIN.x1 + 0.03]) {
      const rimPiece = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, DECK_DEPTH + 0.16), this.mCopper);
      rimPiece.position.set(x, BIN.top + 0.02, DECK_Z);
      fixed.add(rimPiece);
    }
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, BIN.floor - 0.06, 0.3), this.mDark);
    stand.position.set(0, (BIN.floor - 0.06) / 2, DECK_Z);
    fixed.add(stand);

    this.scene.add(fixed);
  }

  // ---- loading a level -------------------------------------------------------------------

  /** Builds the machine for a level in its starting state. Drops any running animation. */
  load(level: LevelDef): void {
    this.level = level;
    this.tweens = [];
    this.playing = false;
    this.binCount = 0;
    this.disposeWorld();
    this.platforms.clear();
    this.balls = [];
    this.edges.clear();
    this.latches.clear();
    this.sources.clear();
    this.nodeGlow.clear();
    this.nodePos.clear();

    for (const n of level.nodes) this.nodePos.set(n.id, new THREE.Vector3(n.pos[0], n.pos[1], BACK_Z));
    for (const p of level.platforms) this.buildPlatform(p);
    for (const e of level.edges) this.buildEdge(e.id, e.a, e.b, e.closed);
    for (const n of level.nodes) {
      if (n.kind === 'source') this.buildSource(n.id, n.strength);
      else if (n.kind === 'junction') this.buildJoint(n.id);
      else this.buildLatch(n.id, n.threshold);
    }
    for (const p of level.platforms) {
      for (let i = 0; i < p.balls; i++) this.addBall(p.id, i);
    }
    this.syncBalls();
    this.syncLinks();
  }

  private disposeWorld(): void {
    const owned = new Set<THREE.Material>();
    this.world.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.ownGeometry) mesh.geometry.dispose();
      if (mesh.isMesh && mesh.userData.ownMaterial) owned.add(mesh.material as THREE.Material);
    });
    owned.forEach((m) => m.dispose());
    this.world.clear();
  }

  private own(mesh: THREE.Mesh, geometry = true, material = false): THREE.Mesh {
    mesh.userData.ownGeometry = geometry;
    mesh.userData.ownMaterial = material;
    return mesh;
  }

  private tiltAngle(p: PlatformDef): number {
    return THREE.MathUtils.degToRad(tune.tilt_angle) * (p.low === 'right' ? -1 : 1);
  }

  private buildPlatform(p: PlatformDef): void {
    const group = new THREE.Group();
    group.position.set(p.pos[0], p.pos[1], DECK_Z);
    const deck = this.own(new THREE.Mesh(new THREE.BoxGeometry(p.width, DECK_THICK, DECK_DEPTH), this.mSteel));
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);
    const dir = p.low === 'right' ? 1 : -1;
    // a tall stop on the high end, a low lip on the end that drops
    const stop = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, DECK_DEPTH), this.mSteel));
    stop.position.set(-dir * (p.width / 2 - 0.025), 0.13, 0);
    stop.castShadow = true;
    group.add(stop);
    const lip = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, DECK_DEPTH), this.mCopper));
    lip.position.set(dir * (p.width / 2 - 0.02), DECK_THICK / 2 + 0.0175, 0);
    group.add(lip);
    this.world.add(group);

    // the axle it turns on, fixed to the back plate
    const axle = new THREE.Mesh(this.gTube, this.mDark);
    setRod(
      axle,
      new THREE.Vector3(p.pos[0], p.pos[1] - 0.075, CASE.zBack),
      new THREE.Vector3(p.pos[0], p.pos[1] - 0.075, DECK_Z + DECK_DEPTH / 2 + 0.03),
    );
    axle.scale.x = axle.scale.z = 1.5;
    axle.castShadow = true;
    this.world.add(axle);

    const view: PlatformView = { def: p, group, angle: 0, plannedTilt: false, dots: [] };

    if (p.tipsAtLoad !== undefined) {
      // a balance: one mark per ball it can carry, and a spring post instead of a latch
      const n = p.tipsAtLoad;
      const span = Math.min(p.width - 0.3, n * 0.13);
      for (let i = 0; i < n; i++) {
        const dot = new THREE.Mesh(this.gPip, this.mPipOff);
        dot.scale.setScalar(0.6);
        dot.position.set(-span / 2 + (n === 1 ? span / 2 : (i * span) / (n - 1)), 0, DECK_DEPTH / 2 + 0.005);
        group.add(dot);
        view.dots.push(dot);
      }
      const spring = new THREE.Group();
      const coil = new THREE.TorusGeometry(0.07, 0.014, 8, 20);
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(coil, this.mSteel);
        ring.userData.ownGeometry = i === 0;
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.05 - i * 0.05;
        spring.add(ring);
      }
      const foot = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.2), this.mDark));
      foot.position.y = -0.31;
      spring.add(foot);
      const post = new THREE.Mesh(this.gTube, this.mDark);
      setRod(post, new THREE.Vector3(0, -0.31, 0), new THREE.Vector3(0, -0.31, CASE.zBack - DECK_Z));
      spring.add(post);
      spring.position.set(p.pos[0] + dir * (p.width / 2 - 0.14), p.pos[1] - DECK_THICK / 2, DECK_Z);
      this.world.add(spring);
      view.support = spring;
    }
    this.platforms.set(p.id, view);
  }

  private glowMat(): THREE.MeshStandardMaterial {
    return this.mCopper.clone();
  }

  private buildEdge(id: string, aId: string, bId: string, closed: boolean): void {
    const a = this.nodePos.get(aId)!;
    const b = this.nodePos.get(bId)!;
    const view: EdgeView = { id, glow: 0, mats: [], a, b, openness: closed ? 0 : 1 };
    const tube = (p: THREE.Vector3, q: THREE.Vector3) => {
      const mat = this.glowMat();
      const m = this.own(new THREE.Mesh(this.gTube, mat), false, true);
      setRod(m, p, q);
      m.castShadow = true;
      this.world.add(m);
      view.mats.push(mat);
    };
    const owner = this.level!.platforms.find((p) => p.opens?.includes(id) || p.closes?.includes(id));
    if (!owner) {
      tube(a, b);
    } else {
      // a contact: two stubs, a gap, and a bridge that swings in or out of line
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      dir.normalize();
      const gap = Math.min(0.36, len * 0.5);
      const g0 = a.clone().addScaledVector(dir, (len - gap) / 2);
      const g1 = a.clone().addScaledVector(dir, (len + gap) / 2);
      tube(a, g0);
      tube(g1, b);
      for (const p of [g0, g1]) {
        const collar = new THREE.Mesh(this.gJoint, this.mDark);
        collar.position.copy(p);
        collar.scale.setScalar(0.85);
        this.world.add(collar);
      }
      const bridge = new THREE.Group();
      bridge.position.copy(g0);
      bridge.userData.base = Math.atan2(dir.y, dir.x);
      const mat = this.glowMat();
      const bar = this.own(new THREE.Mesh(this.gTube, mat), false, true);
      setRod(bar, new THREE.Vector3(0, 0, 0), new THREE.Vector3(gap, 0, 0));
      bar.scale.x = bar.scale.z = 0.8;
      bridge.add(bar);
      view.mats.push(mat);
      this.world.add(bridge);
      view.bridge = bridge;
      // a thin rod ties the contact to the platform that moves it
      const mid = a.clone().lerp(b, 0.5);
      const end: 1 | -1 = mid.x >= owner.pos[0] ? 1 : -1;
      const rod = new THREE.Mesh(this.gThin, this.mSteel);
      this.world.add(rod);
      view.link = { rod, platform: owner.id, end };
    }
    this.edges.set(id, view);
  }

  private buildJoint(id: string): void {
    const mat = this.glowMat();
    const m = this.own(new THREE.Mesh(this.gJoint, mat), false, true);
    m.position.copy(this.nodePos.get(id)!);
    m.castShadow = true;
    this.world.add(m);
    this.nodeGlow.set(id, { mat, glow: 0 });
  }

  private buildSource(id: string, strength: number): void {
    const pos = this.nodePos.get(id)!;
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, 0);
    const body = this.own(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.5, 40), this.mCopper));
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.1;
    body.castShadow = true;
    group.add(body);
    const ring = this.own(new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.03, 14, 48), this.mSteel));
    ring.position.z = 0.15;
    group.add(ring);
    const coreMat = new THREE.MeshStandardMaterial({
      color: '#ff9a4a',
      emissive: HEAT,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    const core = this.own(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), coreMat), true, true);
    core.scale.z = 0.45;
    core.position.z = 0.15;
    group.add(core);
    // one small flame mark per unit of strength, on an arc over the button
    for (let i = 0; i < strength; i++) {
      const a = Math.PI / 2 + (i - (strength - 1) / 2) * 0.3;
      const pip = new THREE.Mesh(this.gPip, this.mPipOn);
      pip.scale.setScalar(0.6);
      pip.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.12);
      group.add(pip);
    }
    const rippleMat = new THREE.MeshBasicMaterial({ color: HOT, transparent: true, opacity: 0, depthWrite: false });
    const ripple = this.own(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.335, 48), rippleMat), true, true);
    ripple.position.z = 0.17;
    group.add(ripple);
    const hit = this.own(
      new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false })),
      true,
      true,
    );
    hit.userData.source = id;
    group.add(hit);
    this.world.add(group);
    this.sources.set(id, { id, core, ring, ripple, hit, flash: 0, ripplePhase: 1 });
  }

  private buildLatch(id: string, threshold: number): void {
    const pos = this.nodePos.get(id)!;
    const block = new THREE.Group();
    block.position.set(pos.x, pos.y, 0);
    const mat = this.glowMat();
    const zFront = DECK_Z + DECK_DEPTH / 2 + 0.05;
    const jaw = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, zFront - BACK_Z), mat), true, true);
    jaw.position.set(0, 0, (zFront + BACK_Z) / 2);
    jaw.castShadow = true;
    block.add(jaw);
    const face = this.own(new THREE.Mesh(new THREE.BoxGeometry(0.08 + threshold * 0.13, 0.15, 0.03), this.mDark));
    face.position.set(0, -0.14, zFront - 0.015);
    block.add(face);
    const pips: THREE.Mesh[] = [];
    for (let i = 0; i < threshold; i++) {
      const pip = new THREE.Mesh(this.gPip, this.mPipOff);
      pip.position.set((i - (threshold - 1) / 2) * 0.13, -0.14, zFront + 0.005);
      block.add(pip);
      pips.push(pip);
    }
    this.world.add(block);
    this.latches.set(id, { block, mat, pips, glow: 0, flash: 0, retract: 0, threshold, lit: 0 });
  }

  private addBall(holder: string, slot: number): void {
    const mesh = new THREE.Mesh(this.gBall, this.mBall);
    mesh.castShadow = true;
    this.world.add(mesh);
    this.balls.push({ mesh, holder, slot, rest: holder, restSlot: slot, moving: false, readyAt: 0, planPos: null });
  }

  // ---- where things are ------------------------------------------------------------------

  /** A point on a platform's deck, given in the platform's own frame, at a given tilt. */
  private onDeck(p: PlatformView, lx: number, ly: number, angle: number, z = 0): THREE.Vector3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new THREE.Vector3(p.def.pos[0] + lx * c - ly * s, p.def.pos[1] + lx * s + ly * c, DECK_Z + z);
  }

  private slotLocal(p: PlatformDef, slot: number): [number, number, number] {
    const usable = p.width - 0.2;
    const perRow = Math.max(1, Math.floor(usable / (BALL_R * 2)));
    const row = Math.floor(slot / perRow);
    const col = slot % perRow;
    const dir = p.low === 'right' ? 1 : -1;
    // fill from the low end: the first ball to arrive rolls up against the lip
    const x = dir * (p.width / 2 - 0.07 - BALL_R - col * BALL_R * 2 - (row % 2) * BALL_R);
    const y = DECK_THICK / 2 + BALL_R + row * BALL_R * 1.74;
    const z = (col % 2 === 0 ? 0.07 : -0.07) * (row % 2 === 0 ? 1 : -1);
    return [x, y, z];
  }

  private slotPos(p: PlatformView, slot: number, angle: number): THREE.Vector3 {
    const [x, y, z] = this.slotLocal(p.def, slot);
    return this.onDeck(p, x, y, angle, z);
  }

  private binSlot(slot: number): THREE.Vector3 {
    const row = Math.floor(slot / BIN.cols);
    const col = slot % BIN.cols;
    const pitch = (BIN.x1 - BIN.x0 - BALL_R * 2 - 0.04) / (BIN.cols - 1);
    return new THREE.Vector3(
      BIN.x0 + 0.02 + BALL_R + col * pitch + (row % 2) * 0.0,
      BIN.floor + BALL_R + row * BALL_R * 1.9,
      DECK_Z + (col % 2 === 0 ? 0.1 : -0.1) * (row % 2 === 0 ? 1 : -1),
    );
  }

  private platformEnd(p: PlatformView, end: 1 | -1): THREE.Vector3 {
    return this.onDeck(p, end * (p.def.width / 2 - 0.04), -DECK_THICK / 2, p.angle, -DECK_DEPTH / 2);
  }

  private syncBalls(): void {
    for (const b of this.balls) {
      if (b.moving) continue;
      if (b.rest === 'bin') b.mesh.position.copy(this.binSlot(b.restSlot));
      else if (b.rest !== 'void') {
        const p = this.platforms.get(b.rest)!;
        b.mesh.position.copy(this.slotPos(p, b.restSlot, p.angle));
      }
    }
    for (const p of this.platforms.values()) {
      if (p.dots.length === 0) continue;
      let resting = 0;
      for (const b of this.balls) if (b.rest === p.def.id && !b.moving) resting++;
      p.dots.forEach((d, i) => (d.material = i < resting ? this.mDotOn : this.mPipOff));
    }
  }

  private syncLinks(): void {
    for (const e of this.edges.values()) {
      if (e.bridge) {
        e.bridge.rotation.z = (e.bridge.userData.base as number) + e.openness * 1.05;
      }
      if (e.link && e.bridge) {
        const p = this.platforms.get(e.link.platform)!;
        const tip = new THREE.Vector3(0.18, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), e.bridge.rotation.z);
        tip.add(e.bridge.position);
        setRod(e.link.rod, this.platformEnd(p, e.link.end), tip);
      }
    }
  }

  // ---- playing back an event list --------------------------------------------------------

  private add(t0: number, dur: number, update: (k: number) => void, done?: () => void): void {
    this.tweens.push({ t0: this.time + t0, dur: Math.max(dur, 1e-4), update, done });
  }

  private at(t0: number, fn: () => void): void {
    this.add(t0, 0, () => {}, fn);
  }

  /**
   * Plays one pulse's events. The order on screen is the order in the list; the only liberty
   * taken is that a latch is shown letting go right before the platform it holds starts to move.
   */
  play(events: GameEvent[], hooks: PlayHooks): void {
    if (!this.level) return;
    this.playing = true;
    const hop = tune.hop_time;
    let heatEnd = 0.25;
    let cursor = 0;
    let chainFrom: string | null = null;
    const pendingLatch = new Map<string, string>(); // platform -> latch that released it

    for (const b of this.balls) {
      b.readyAt = 0;
      b.planPos = null;
    }

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'pulse': {
          const s = this.sources.get(ev.source)!;
          this.at(0, () => {
            s.flash = 1;
            s.ripplePhase = 0;
          });
          break;
        }
        case 'heat': {
          const edge = this.edges.get(ev.edge)!;
          const from = this.nodePos.get(ev.from)!;
          const to = this.nodePos.get(ev.to)!;
          const t0 = (ev.step - 1) * hop;
          const size = 0.07 + ev.heat * 0.022;
          const mat = new THREE.MeshBasicMaterial({ color: HOT });
          const blob = this.own(new THREE.Mesh(this.gBall, mat), false, true);
          blob.scale.setScalar(size / BALL_R);
          blob.visible = false;
          this.world.add(blob);
          this.add(
            t0,
            hop,
            (k) => {
              blob.visible = true;
              blob.position.lerpVectors(from, to, k);
              blob.position.z += 0.05;
              edge.glow = Math.max(edge.glow, 0.35 + 0.65 * k);
            },
            () => {
              this.world.remove(blob);
              mat.dispose();
              edge.glow = 1;
              const node = this.nodeGlow.get(ev.to);
              if (node) node.glow = 1;
            },
          );
          heatEnd = Math.max(heatEnd, ev.step * hop);
          break;
        }
        case 'charge': {
          const latch = this.latches.get(ev.latch)!;
          this.at(ev.step * hop, () => {
            latch.lit = Math.min(ev.charge, ev.threshold);
            latch.glow = Math.max(latch.glow, Math.min(1, ev.charge / ev.threshold));
            latch.flash = 0.6;
            latch.pips.forEach((p, n) => (p.material = n < latch.lit ? this.mPipOn : this.mPipOff));
          });
          break;
        }
        case 'latchOpen':
          pendingLatch.set(ev.platform, ev.latch);
          cursor = Math.max(cursor, heatEnd + 0.12);
          break;
        case 'tilt': {
          cursor = Math.max(cursor, heatEnd + 0.12);
          const p = this.platforms.get(ev.platform)!;
          const latchId = pendingLatch.get(ev.platform);
          if (ev.cause === 'latch' && latchId) {
            const latch = this.latches.get(latchId)!;
            const t0 = cursor;
            this.add(t0, tune.latch_time, (k) => {
              latch.flash = Math.max(latch.flash, k);
              latch.retract = k < 0.55 ? 0 : easeInOut((k - 0.55) / 0.45);
            });
            cursor += tune.latch_time;
          } else {
            // a balance giving way: a short shudder, the spring collapses
            const t0 = cursor;
            const support = p.support;
            this.add(t0, 0.3, (k) => {
              p.angle = Math.sin(k * Math.PI * 5) * 0.025 * (1 - k);
              p.group.rotation.z = p.angle;
              if (support) support.scale.y = 1 - 0.55 * k;
            });
            cursor += 0.3;
          }
          const target = this.tiltAngle(p.def);
          this.add(cursor, tune.tilt_time, (k) => {
            p.angle = target * easeOutBack(k);
            p.group.rotation.z = p.angle;
          });
          p.plannedTilt = true;
          // the balls start to roll a little before the platform has settled
          cursor += tune.tilt_time * 0.7;
          chainFrom = null;
          break;
        }
        case 'edge': {
          const edge = this.edges.get(ev.edge)!;
          const from = edge.openness;
          const to = ev.closed ? 0 : 1;
          this.add(
            cursor - tune.tilt_time * 0.45,
            tune.switch_time,
            (k) => (edge.openness = from + (to - from) * easeOutBack(k)),
            () => {
              edge.openness = to;
              edge.glow = Math.max(edge.glow, ev.closed ? 0.9 : 0.5);
            },
          );
          break;
        }
        case 'balls': {
          // a group that runs straight on through a chute keeps flowing: no pause between hops
          const flowing = chainFrom === ev.from;
          const start = cursor;
          const moved = this.scheduleBalls(ev.from, ev.to, start, flowing, hooks);
          chainFrom = typeof ev.to === 'string' && ev.to !== 'bin' && ev.to !== 'void' ? ev.to : null;
          const next = events[i + 1];
          const continues = next && next.type === 'balls' && next.from === ev.to;
          if (!continues) {
            cursor = Math.max(cursor, moved) + 0.12;
            chainFrom = null;
          }
          break;
        }
        case 'settle':
          break;
      }
    }
    if (!events.some((e) => e.type === 'heat')) {
      // the pulse had nowhere to go: the open contacts at the source spark, so the reason shows
      const pulse = events.find((e) => e.type === 'pulse');
      const id = pulse && pulse.type === 'pulse' ? pulse.source : '';
      for (const def of this.level.edges) {
        const edge = this.edges.get(def.id)!;
        if ((def.a === id || def.b === id) && edge.openness > 0.5) {
          this.add(0.12, 0.5, (k) => (edge.glow = Math.max(edge.glow, Math.sin(k * Math.PI * 3) > 0 ? 0.9 : 0.2)));
        }
      }
      heatEnd = 0.7;
    }
    const end = Math.max(cursor, heatEnd + 0.35);
    this.at(end, () => {
      this.playing = false;
      hooks.onDone();
    });
  }

  /** Schedules every ball resting on (or flowing through) `from` to travel to `to`. Returns the end time. */
  private scheduleBalls(from: string, to: Target, start: number, flowing: boolean, hooks: PlayHooks): number {
    const src = this.platforms.get(from)!;
    const srcAngle = this.tiltAngle(src.def);
    const dir = src.def.low === 'right' ? 1 : -1;
    const lowEnd = this.onDeck(src, dir * (src.def.width / 2 + BALL_R * 0.4), DECK_THICK / 2 + BALL_R, srcAngle);
    const group = this.balls.filter((b) => b.holder === from);
    const startOf = (b: BallView) => b.planPos ?? this.slotPos(src, b.slot, srcAngle);
    group.sort((a, b) => startOf(a).distanceTo(lowEnd) - startOf(b).distanceTo(lowEnd));

    const dst = to !== 'bin' && to !== 'void' ? this.platforms.get(to)! : null;
    let nextSlot = 0;
    if (to === 'bin') nextSlot = this.balls.filter((b) => b.holder === 'bin').length;
    else if (dst) nextSlot = this.balls.filter((b) => b.holder === to).length;

    let end = start;
    group.forEach((ball, i) => {
      const p0 = startOf(ball);
      const p1 = lowEnd.clone();
      p1.z = p0.z;
      let p2: THREE.Vector3;
      let rests = true;
      const slot = nextSlot + i;
      if (to === 'bin') p2 = this.binSlot(slot);
      else if (to === 'void') {
        p2 = new THREE.Vector3(p1.x + dir * 0.3, -0.9, p1.z);
        rests = false;
      } else if (dst!.plannedTilt) {
        // lands on a chute: wherever it comes down on the slope, then it runs on
        const a = this.tiltAngle(dst!.def);
        const lx = THREE.MathUtils.clamp((p1.x - dst!.def.pos[0]) / Math.cos(a), -dst!.def.width / 2 + 0.2, dst!.def.width / 2 - 0.2);
        p2 = this.onDeck(dst!, lx, DECK_THICK / 2 + BALL_R, a, p0.z - DECK_Z);
        rests = false;
      } else {
        p2 = this.slotPos(dst!, slot, 0);
      }

      const t0 = flowing ? ball.readyAt : Math.max(start, ball.readyAt) + i * tune.ball_stagger;
      const roll = THREE.MathUtils.clamp(p0.distanceTo(p1) * tune.ball_roll_time, 0.1, 0.7);
      const fall = Math.max(0.16, Math.sqrt(Math.max(0.05, p1.y - p2.y)) * tune.ball_fall_time);
      const mesh = ball.mesh;
      this.add(
        t0,
        roll,
        (k) => {
          ball.moving = true;
          mesh.position.lerpVectors(p0, p1, flowing ? k : k * k);
        },
      );
      this.add(
        t0 + roll,
        fall,
        (k) => {
          ball.moving = true;
          mesh.position.set(
            p1.x + (p2.x - p1.x) * k,
            p1.y + (p2.y - p1.y) * k * k,
            p1.z + (p2.z - p1.z) * k,
          );
        },
        () => {
          mesh.position.copy(p2);
          if (to === 'bin') {
            this.binCount++;
            hooks.onBin(this.binCount);
          }
          if (to === 'void') mesh.visible = false;
        },
      );
      let done = t0 + roll + fall;
      if (rests) {
        // a small settle bounce, purely for the eye
        const hopH = Math.min(0.09, 0.03 + (p1.y - p2.y) * 0.02);
        this.add(
          done,
          0.2,
          (k) => (mesh.position.y = p2.y + Math.sin(k * Math.PI) * hopH * (1 - k * 0.5)),
          () => {
            mesh.position.copy(p2);
            ball.rest = to;
            ball.restSlot = slot;
            ball.moving = false;
          },
        );
        done += 0.2;
      }
      ball.holder = to;
      ball.slot = slot;
      ball.readyAt = t0 + roll + fall;
      ball.planPos = rests ? null : p2;
      end = Math.max(end, done);
    });
    return end;
  }

  // ---- the frame -------------------------------------------------------------------------

  /** Advances every animation by dt seconds. */
  advance(dt: number): void {
    this.time += dt;
    const live: Tween[] = [];
    // tweens run in the order they were scheduled, so later events win on the same frame
    for (const tw of this.tweens) {
      if (this.time < tw.t0) {
        live.push(tw);
        continue;
      }
      const k = Math.min(1, (this.time - tw.t0) / tw.dur);
      tw.update(k);
      if (k >= 1) tw.done?.();
      else live.push(tw);
    }
    this.tweens = live;

    const cool = Math.exp(-dt / tune.glow_decay);
    for (const e of this.edges.values()) {
      e.glow *= cool;
      const open = e.openness > 0.5;
      for (const m of e.mats) {
        m.emissiveIntensity = e.glow * 2.6;
        m.color.set(open ? '#7d5236' : '#c47a45');
      }
    }
    for (const n of this.nodeGlow.values()) {
      n.glow *= cool;
      n.mat.emissiveIntensity = n.glow * 3;
    }
    for (const l of this.latches.values()) {
      l.flash *= Math.exp(-dt / 0.25);
      l.mat.emissiveIntensity = l.glow * 1.5 + l.flash * 3.5;
      l.block.position.z = -l.retract * (DECK_DEPTH + 0.5);
      l.block.visible = l.retract < 0.98;
    }
    const breathe = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    for (const s of this.sources.values()) {
      s.flash *= Math.exp(-dt / 0.3);
      const mat = s.core.material as THREE.MeshStandardMaterial;
      const idle = this.interactive && !this.playing ? 1.1 + breathe * 0.9 : 0.35;
      mat.emissiveIntensity = idle + s.flash * 6;
      s.core.scale.set(1 + s.flash * 0.12, 1 + s.flash * 0.12, 0.45 - s.flash * 0.2);
      if (s.ripplePhase < 1) {
        s.ripplePhase = Math.min(1, s.ripplePhase + dt / 0.6);
        const rm = s.ripple.material as THREE.MeshBasicMaterial;
        s.ripple.scale.setScalar(1 + s.ripplePhase * 1.6);
        rm.opacity = (1 - s.ripplePhase) * 0.9;
      }
    }
    this.syncBalls();
    this.syncLinks();

    const sway = Math.sin(this.time * 0.28) * tune.camera_sway;
    this.camera.position.x = this.camBase.x + sway;
    this.camera.lookAt(this.camTarget);
  }

  private camBase = new THREE.Vector3();
  private camTarget = new THREE.Vector3(0, 3.95, 0.1);

  /** Fits the whole case in the window at any aspect, leaving room for the HUD. */
  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // the case sits between the HUD's top band and its bottom band, whatever the window's shape
    const top = Math.min(96, h * 0.12);
    const bottom = Math.min(178, h * 0.22);
    const unitsPerPx = Math.max(9.1 / (h - top - bottom), 5.9 / w);
    const total = unitsPerPx * h;
    const dist = total / 2 / half;
    const centre = -0.5 - bottom * unitsPerPx + total / 2;
    this.camTarget.set(0, centre, 0.1);
    this.camBase.set(0.5, centre + 0.35, dist);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.composer && this.bloom) {
      this.bloom.strength = tune.bloom;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** The source under a screen point, or null. */
  pickSource(clientX: number, clientY: number): string | null {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.sources.values()].map((s) => s.hit),
      false,
    );
    return hits.length > 0 ? (hits[0].object.userData.source as string) : null;
  }

  /** Screen position (CSS pixels) of a source's button, for a check that taps like a player. */
  sourceScreen(id: string): { x: number; y: number } | null {
    const pos = this.nodePos.get(id);
    return pos && this.sources.has(id) ? this.project(pos.x, pos.y, 0.15) : null;
  }

  /** Screen position (CSS pixels) of a point in the diorama. */
  project(x: number, y: number, z = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }
}
