import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import type { CelebrationPlan } from '../game/celebration';
import type { RobotView } from './robot';

const CFG = CONFIG.celebration;

/** What a celebration needs to know about the board it plays on. */
export interface CelebrationStage {
  /** The group the effect's meshes are added to; it is the board's own, so they share its place. */
  readonly group: THREE.Object3D;
  readonly width: number;
  readonly height: number;
  /** Cells that hold an obstacle, row by row. */
  readonly walls: readonly boolean[];
  readonly exitX: number;
  readonly exitY: number;
  /** World x and z of a cell's centre. */
  readonly cellX: (x: number) => number;
  readonly cellZ: (y: number) => number;
  /** Distance between two neighbouring cells. */
  readonly pitch: number;
  /** Height of the tiles' top face. */
  readonly floorY: number;
  /** The level's robots, in id order. All of them are in the exit when the celebration starts. */
  readonly robots: readonly RobotView[];
  /** Seconds until the last robot has finished sinking into the exit. */
  readonly settle: number;
  /** A small pulse of the exit pad. */
  readonly pulseExit: () => void;
  /** A small burst of flecks in a robot's colour. */
  readonly burst: (x: number, z: number, color: Color) => void;
}

/** A small repeatable random source, so every celebration looks the same and needs no seed from outside. */
function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOutBack = (k: number): number => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);

/** The robot colours of the level, each once, in the order red, blue, yellow. */
function levelColors(stage: CelebrationStage): Color[] {
  return (['red', 'blue', 'yellow'] as const).filter((c) => stage.robots.some((r) => r.color === c));
}

/** A flat tile with rounded corners, lying on the board, centred on its origin. */
function tileGeometry(size: number, radius: number): THREE.BufferGeometry {
  const h = size / 2;
  const s = new THREE.Shape();
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** One celebration on the board. `update` moves it on and says whether it is still playing. */
interface Effect {
  update(t: number, dt: number): void;
  dispose(): void;
}

/** A light on every free tile: one instanced mesh, so the largest board costs one draw call. */
class TileLights {
  readonly mesh: THREE.InstancedMesh;
  readonly cells: { x: number; z: number; distance: number }[] = [];
  readonly material: THREE.MeshBasicMaterial;
  private matrix = new THREE.Matrix4();
  private scale = new THREE.Vector3();
  private position = new THREE.Vector3();
  private noTurn = new THREE.Quaternion();
  /** Largest distance from the exit to a lit tile, in cells. */
  readonly reach: number;

  constructor(private stage: CelebrationStage, opacity: number) {
    const { width, height, walls, exitX, exitY } = stage;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if (walls[y * width + x] || (x === exitX && y === exitY)) continue;
        this.cells.push({ x: stage.cellX(x), z: stage.cellZ(y), distance: Math.hypot(x - exitX, y - exitY) });
      }
    this.reach = this.cells.reduce((m, c) => Math.max(m, c.distance), 1);
    this.material = new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(tileGeometry(stage.pitch * CFG.wave.tile, stage.pitch * 0.16), this.material, Math.max(this.cells.length, 1));
    this.mesh.count = this.cells.length;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    const white = new THREE.Color('#FFFFFF');
    for (let i = 0; i < this.cells.length; i++) {
      this.set(i, 0, 0);
      this.mesh.setColorAt(i, white);
    }
    stage.group.add(this.mesh);
  }

  /** Show tile `i` at `size` (0 to 1) and lifted by `lift`. */
  set(i: number, size: number, lift: number): void {
    const c = this.cells[i];
    this.position.set(c.x, this.stage.floorY + 0.012 + lift, c.z);
    const s = Math.max(size, 0.0001);
    this.scale.set(s, 1, s);
    this.mesh.setMatrixAt(i, this.matrix.compose(this.position, this.noTurn, this.scale));
  }

  flush(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.stage.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

/** Light wave: the tiles light up in a ring that runs from the exit to the far corner. Three stars send one ring per robot colour and a gold one. */
class WaveEffect implements Effect {
  private lights: TileLights;
  private colors: THREE.Color[];
  private speed: number;
  private mix = new THREE.Color();
  private white = new THREE.Color(CFG.white);

  constructor(private stage: CelebrationStage, plan: CelebrationPlan) {
    this.lights = new TileLights(stage, CFG.wave.opacity);
    const robots = levelColors(stage).map((c) => new THREE.Color(CONFIG.colors.robots[c].main));
    this.colors = plan.perfect ? [...robots, new THREE.Color(CFG.gold)] : [new THREE.Color(CONFIG.colors.kit.exitTop)];
    const run = plan.seconds - (this.colors.length - 1) * CFG.wave.gap;
    this.speed = (this.lights.reach + CFG.wave.width) / Math.max(run, 0.1);
    stage.pulseExit();
  }

  update(t: number): void {
    const { width, lift, gap } = CFG.wave;
    for (let i = 0; i < this.lights.cells.length; i++) {
      const d = this.lights.cells[i].distance;
      let best = 0;
      let color = this.colors[0];
      for (let w = 0; w < this.colors.length; w++) {
        const phase = ((t - w * gap) * this.speed - d) / width;
        if (phase <= 0 || phase >= 1) continue;
        const k = Math.sin(Math.PI * phase);
        if (k > best) {
          best = k;
          color = this.colors[w];
        }
      }
      this.lights.set(i, best, best * lift * this.stage.pitch);
      // The crest of the ring is nearly white: it reads as light, not as paint.
      this.lights.mesh.setColorAt(i, this.mix.copy(color).lerp(this.white, Math.max(0, best - 0.8) * 1.5));
    }
    this.lights.flush();
  }

  dispose(): void {
    this.lights.dispose();
  }
}

/** The quiet version for reduced motion: the whole board glows softly once. Nothing moves. */
class CalmEffect implements Effect {
  private lights: TileLights;

  constructor(stage: CelebrationStage, private plan: CelebrationPlan) {
    this.lights = new TileLights(stage, 0);
    const color = new THREE.Color(plan.perfect ? CFG.gold : CONFIG.colors.kit.exitTop);
    for (let i = 0; i < this.lights.cells.length; i++) {
      this.lights.set(i, 1, 0);
      this.lights.mesh.setColorAt(i, color);
    }
    this.lights.flush();
  }

  update(t: number): void {
    this.lights.material.opacity = CFG.calm.opacity * Math.sin(Math.PI * Math.min(t / this.plan.seconds, 1));
  }

  dispose(): void {
    this.lights.dispose();
  }
}

/** Confetti: paper flecks in the level's robot colours shoot up from the exit and flutter down over the board. Three stars add gold and a second shower. */
class ConfettiEffect implements Effect {
  private mesh: THREE.InstancedMesh;
  private count: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private turn: Float32Array;
  private born: Float32Array;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private euler = new THREE.Euler();
  private quaternion = new THREE.Quaternion();

  constructor(private stage: CelebrationStage, private plan: CelebrationPlan) {
    const c = CFG.confetti;
    const first = c.pieces;
    this.count = plan.perfect ? c.perfectPieces : first;
    const size = c.size * stage.pitch;
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size * 0.62), material, this.count);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.turn = new Float32Array(this.count * 4);
    this.born = new Float32Array(this.count);
    const random = randomSource(7);
    const palette = [...levelColors(stage).map((k) => CONFIG.colors.robots[k].main), CONFIG.colors.kit.exitTop, CFG.white, ...(plan.perfect ? [CFG.gold, CFG.gold] : [])].map((hex) => new THREE.Color(hex));
    const ex = stage.cellX(stage.exitX);
    const ez = stage.cellZ(stage.exitY);
    const cx = (stage.cellX(0) + stage.cellX(stage.width - 1)) / 2;
    const cz = (stage.cellZ(0) + stage.cellZ(stage.height - 1)) / 2;
    // The fountain leans from the exit towards the middle of the board, so a corner exit still showers the board.
    const lean = Math.hypot(cx - ex, cz - ez) || 1;
    const reach = Math.max(stage.width, stage.height) * stage.pitch;
    for (let i = 0; i < this.count; i++) {
      const second = i >= first;
      const angle = random() * Math.PI * 2;
      const out = (0.25 + random() * 0.75) * c.spread * reach;
      const toMiddle = second ? 0 : c.lean * reach;
      this.pos[i * 3] = second ? cx : ex;
      this.pos[i * 3 + 1] = stage.floorY + 0.3;
      this.pos[i * 3 + 2] = second ? cz : ez;
      this.vel[i * 3] = Math.cos(angle) * out + ((cx - ex) / lean) * toMiddle;
      this.vel[i * 3 + 1] = c.rise * (0.6 + random() * 0.4) * (second ? 1.15 : 1);
      this.vel[i * 3 + 2] = Math.sin(angle) * out + ((cz - ez) / lean) * toMiddle;
      this.turn[i * 4] = random() * 6;
      this.turn[i * 4 + 1] = random() * 6;
      this.turn[i * 4 + 2] = 5 + random() * 9;
      this.turn[i * 4 + 3] = 4 + random() * 8;
      this.born[i] = second ? c.secondBurst + random() * 0.1 : random() * 0.05;
      this.mesh.setColorAt(i, palette[i % palette.length]);
      this.place(i, 0);
    }
    stage.group.add(this.mesh);
    stage.pulseExit();
  }

  private place(i: number, size: number): void {
    this.position.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    this.euler.set(this.turn[i * 4], this.turn[i * 4 + 1], 0);
    const s = Math.max(size, 0.0001);
    this.scale.set(s, s, s);
    this.mesh.setMatrixAt(i, this.matrix.compose(this.position, this.quaternion.setFromEuler(this.euler), this.scale));
  }

  update(t: number, dt: number): void {
    const c = CFG.confetti;
    const slow = Math.exp(-c.drag * dt);
    const fade = Math.min(1, (this.plan.seconds - t) / c.fade);
    for (let i = 0; i < this.count; i++) {
      if (t < this.born[i]) continue;
      const p = i * 3;
      this.vel[p] *= slow;
      this.vel[p + 2] *= slow;
      // Paper: it shoots up freely and floats down no faster than `fall`.
      this.vel[p + 1] = Math.max(this.vel[p + 1] - c.gravity * dt, -c.fall);
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      this.turn[i * 4] += this.turn[i * 4 + 2] * dt;
      this.turn[i * 4 + 1] += this.turn[i * 4 + 3] * dt;
      const landed = this.pos[p + 1] < this.stage.floorY;
      this.place(i, landed ? 0 : Math.max(0, fade));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.stage.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

/** Victory hop: the robots jump out of the exit once more, one after the other, spin in the air and dive back in. Three stars jump higher, spin twice, and each colour's last robot lands in a burst of its colour. */
class HopEffect implements Effect {
  /** The robots in jumping order: those already in the exit first, those still sinking into it last. */
  private order: RobotView[];
  /** When each robot of `order` takes off, in seconds. */
  private takeOff: number[];
  private landed: boolean[];
  private ex: number;
  private ez: number;
  private toX: number;
  private toZ: number;

  constructor(private stage: CelebrationStage, private plan: CelebrationPlan) {
    const sinking = (view: RobotView): boolean => view.visibleScale > 0.001;
    this.order = [...stage.robots.filter((r) => !sinking(r)), ...stage.robots.filter(sinking)];
    const n = this.order.length;
    // Many robots take off closer together, so the whole row fits the celebration's length.
    const room = plan.seconds - stage.settle - CFG.hop.hopTime;
    const stagger = n > 1 ? Math.max(0, Math.min(CFG.hop.stagger, room / (n - 1))) : 0;
    this.takeOff = this.order.map((view, i) => (sinking(view) ? Math.max(i * stagger, stage.settle) : i * stagger));
    this.landed = this.order.map(() => false);
    this.ex = stage.cellX(stage.exitX);
    this.ez = stage.cellZ(stage.exitY);
    const cx = (stage.cellX(0) + stage.cellX(stage.width - 1)) / 2 - this.ex;
    const cz = (stage.cellZ(0) + stage.cellZ(stage.height - 1)) / 2 - this.ez;
    const length = Math.hypot(cx, cz);
    // Jumps fan out towards the middle of the board; with the exit in the middle, towards the player.
    this.toX = length > 0.01 ? cx / length : 0;
    this.toZ = length > 0.01 ? cz / length : 1;
  }

  update(t: number): void {
    const h = CFG.hop;
    const robots = this.order;
    const n = robots.length;
    for (let i = 0; i < n; i++) {
      const view = robots[i];
      const u = (t - this.takeOff[i]) / h.hopTime;
      if (u <= 0 || this.landed[i]) continue;
      if (u >= 1) {
        this.landed[i] = true;
        this.rest(view);
        this.stage.pulseExit();
        // One burst per colour, when its last robot lands: a full board of twelve robots costs no more than three.
        if (this.plan.perfect && !robots.slice(i + 1).some((later) => later.color === view.color)) this.stage.burst(this.ex, this.ez, view.color);
        continue;
      }
      // Each robot takes its own line in a fan of `fan` degrees around the way to the middle.
      const side = n > 1 ? (i / (n - 1) - 0.5) * ((h.fan * Math.PI) / 180) : 0;
      const dx = this.toX * Math.cos(side) - this.toZ * Math.sin(side);
      const dz = this.toX * Math.sin(side) + this.toZ * Math.cos(side);
      const arc = Math.sin(Math.PI * u);
      const out = arc * h.spread * this.stage.pitch;
      const size = u < 0.2 ? easeOutBack(u / 0.2) : u > 0.82 ? Math.max(0, 1 - (u - 0.82) / 0.18) : 1;
      view.root.position.set(this.ex + dx * out, this.stage.floorY, this.ez + dz * out);
      view.root.visible = true;
      view.visibleScale = size;
      view.body.scale.setScalar(Math.max(size, 0.0001));
      view.body.position.y = arc * (this.plan.perfect ? h.perfectHeight : h.height) * this.stage.pitch;
      view.body.rotation.y = -u * Math.PI * 2 * (this.plan.perfect ? h.perfectSpins : h.spins);
    }
  }

  /** Back in the exit, out of sight: where a collected robot belongs. */
  private rest(view: RobotView): void {
    view.root.position.set(this.ex, this.stage.floorY, this.ez);
    view.body.position.y = 0;
    view.body.rotation.y = 0;
    view.visibleScale = 0;
    view.body.scale.setScalar(0.0001);
    view.root.visible = false;
  }

  dispose(): void {
    this.order.forEach((view, i) => {
      if (!this.landed[i]) this.rest(view);
    });
  }
}

/**
 * The celebration that plays on the board when the last robot is in: one of the variants of
 * `planCelebration`, or the quiet glow when the plan asks for the calm version.
 */
export class CelebrationFx {
  private effect: Effect;
  private time = 0;

  constructor(stage: CelebrationStage, private plan: CelebrationPlan) {
    this.effect = plan.calm ? new CalmEffect(stage, plan) : plan.variant === 'wave' ? new WaveEffect(stage, plan) : plan.variant === 'hop' ? new HopEffect(stage, plan) : new ConfettiEffect(stage, plan);
    this.effect.update(0, 0);
  }

  /** Move on by `dt` seconds. False once the celebration is over; `dispose` it then. */
  update(dt: number): boolean {
    this.time += dt;
    if (this.time >= this.plan.seconds) return false;
    this.effect.update(this.time, dt);
    return true;
  }

  /** End now and leave the board as it was: effect meshes gone, collected robots out of sight. */
  dispose(): void {
    this.effect.dispose();
  }
}
