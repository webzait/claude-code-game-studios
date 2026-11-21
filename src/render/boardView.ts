import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import { DIR_DX, DIR_DY, type Color, type GameState, type RobotEvent } from '../engine/types';
import type { Level } from '../levels/parse';
import { buildRobot, type RobotView } from './robot';

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

/**
 * Three.js presentation of a level. It never decides anything: it shows a
 * `GameState` (`sync`) and animates the events of a step (`play`).
 */
export class BoardView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 100);
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
  private speedScale = 1;
  private reduced = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.boardGroup);
    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#D5DAE2', 1.55));
    this.sun = new THREE.DirectionalLight('#FFFFFF', 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 5;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.13 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.34;
    ground.receiveShadow = true;
    this.scene.add(ground);
    requestAnimationFrame((t) => this.frame(t));
  }

  private cellX(x: number): number {
    return x - ((this.level?.board.width ?? 1) - 1) / 2;
  }
  private cellZ(y: number): number {
    return y - ((this.level?.board.height ?? 1) - 1) / 2;
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
    const { width, height, walls, exitX, exitY } = level.board;
    const c = CONFIG.colors;
    const mat = (color: string, roughness = 0.8): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({ color, roughness });

    const frame = new THREE.Mesh(slab(width + 0.62, height + 0.62, 0.42, 0.34), mat(c.boardFrame, 0.65));
    frame.castShadow = true;
    frame.receiveShadow = true;
    const grout = new THREE.Mesh(slab(width + 0.1, height + 0.1, 0.16, 0.05), mat(c.boardGrout));
    grout.position.y = 0.012;
    grout.receiveShadow = true;
    this.boardGroup.add(frame, grout);

    const tileGeo = slab(0.94, 0.94, 0.1, 0.05);
    const wallGeo = new RoundedBoxGeometry(0.84, 0.46, 0.84, 5, 0.15);
    const tileA = mat(c.tileA);
    const tileB = mat(c.tileB);
    const wallMat = mat(c.wall, 0.6);
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
        }
      }
    }

    // Exit: green pad with a white tick and a slow pulse ring.
    const pad = new THREE.Group();
    pad.position.set(this.cellX(exitX), 0.04, this.cellZ(exitY));
    const padMesh = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.12, 0.86, 4, 0.06), mat(c.green, 0.45));
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

    for (const r of level.start.robots) {
      const view = buildRobot(r.id, r.color);
      this.robots.set(r.id, view);
      this.boardGroup.add(view.root);
    }
    this.sync(level.start, false);
    this.fitCamera();
  }

  /** Match the canvas size and frame the whole board. */
  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  }

  private fitCamera(): void {
    if (!this.level) return;
    const { width, height } = this.level.board;
    const tilt = (CONFIG.camera.tilt * Math.PI) / 180;
    const dir = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
    const hw = width / 2 + 0.36;
    const hd = height / 2 + 0.36;
    const corners: THREE.Vector3[] = [];
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-0.34, 0.85]) corners.push(new THREE.Vector3(x, y, z));
    const target = new THREE.Vector3(0, 0, 0);
    let dist = 30;
    const extent = (d: number): { x: number; top: number; bottom: number } => {
      this.camera.position.copy(target).addScaledVector(dir, d);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      let x = 0;
      let top = -Infinity;
      let bottom = Infinity;
      for (const corner of corners) {
        const p = corner.clone().project(this.camera);
        x = Math.max(x, Math.abs(p.x));
        top = Math.max(top, p.y);
        bottom = Math.min(bottom, p.y);
      }
      return { x, top, bottom };
    };
    for (let pass = 0; pass < 4; pass++) {
      let lo = 2;
      let hi = 80;
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        const e = extent(mid);
        if (Math.max(e.x, (e.top - e.bottom) / 2) > CONFIG.camera.fill) lo = mid;
        else hi = mid;
      }
      dist = hi;
      // Re-centre vertically: slide the look-at point along z.
      const e = extent(dist);
      const offCentre = (e.top + e.bottom) / 2;
      const halfHeight = Math.tan((CONFIG.camera.fov * Math.PI) / 360) * dist;
      target.z -= (offCentre * halfHeight) / Math.cos(tilt);
    }
    extent(dist);
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
    view.root.position.set(x, 0.06, z);
    view.angle = angle;
    view.visibleScale = scale;
    view.body.rotation.set(0, angle, 0);
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
            view.body.rotation.y = view.angle;
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
            view.antenna.rotation.x = arc * 0.45;
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
              view.body.rotation.y = view.angle - k * Math.PI * 2 * lively;
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
          // Heading is a multiple of 90 degrees, so the body's local z is the travel axis.
          view.body.scale.set(across, 1 + squash * 0.3, along);
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
    // Idle life: blinking and a slow antenna sway; exit ring breathes.
    for (const view of this.robots.values()) {
      view.blinkIn -= dt;
      const closed = view.blinkIn < 0.11;
      for (const lid of view.lids) lid.visible = closed;
      if (view.blinkIn < 0) view.blinkIn = 2.4 + ((view.id * 53 + Math.floor(this.time * 7)) % 17) / 5;
      if (!this.tweens.length) {
        view.antenna.rotation.z = Math.sin(this.time * 2.1 + view.id) * 0.08;
        view.antenna.rotation.x = 0;
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
