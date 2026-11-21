// PROTOTYPE - NOT FOR PRODUCTION
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, SYMBOLS, theme, tune, type ColorId } from '../config';
import type { LevelDef } from '../levels/types';
import type { World } from '../physics/world';
import { symbolPoints } from './symbols';

const WALL_T = 0.55;
const WALL_H = 0.6;
const BASE_H = 0.5;
const BUMPER_H = 0.62;
const SINK_TIME = 0.32;

interface BumperView {
  body: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
  symbol: THREE.Mesh;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  color: ColorId;
  r: number;
  /** Seconds since this bumper's last pulse started (drives the shock ring). */
  fx: number;
}

interface Pop {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Three.js presentation of a World: a soft 2.5D diorama. Reads the simulation, never changes it. */
export class View {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 1, 200);
  private board = new THREE.Group();
  private marbles: THREE.InstancedMesh | null = null;
  private marbleGeo = new THREE.SphereGeometry(tune.marbleRadius, 28, 20);
  private marbleMat = new THREE.MeshPhysicalMaterial({
    color: theme.marble,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0.45,
    iridescenceIOR: 1.35,
    envMapIntensity: 1.1,
  });
  private bumpers: BumperView[] = [];
  private pops: Pop[] = [];
  private sink: Float32Array = new Float32Array(0);
  private sinkFrom: Float32Array = new Float32Array(0);
  private dummy = new THREE.Object3D();
  private size = { w: 10, h: 10 };
  private bounce = 0;
  private bounceV = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const cheap = new URLSearchParams(location.search).has('cheap');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !cheap, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(cheap ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = !cheap;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b8, 0.95));
    const sun = new THREE.DirectionalLight(0xfff6ea, 2.0);
    sun.position.set(-4.5, 10, -5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 5;
    this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -BASE_H;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(this.board);
  }

  /** Maps tray coordinates to scene coordinates (tray centred on the origin). */
  private px(x: number): number { return x - this.size.w / 2; }
  private pz(y: number): number { return y - this.size.h / 2; }

  /** Rebuilds the diorama for a level. */
  load(level: LevelDef, world: World): void {
    this.disposeBoard();
    this.size = level.size;
    const { w, h } = level.size;

    // Tray body: one extruded frame, floor with real cut-outs for the catchers.
    const outer = roundedRect(-w / 2 - WALL_T, -h / 2 - WALL_T, w + WALL_T * 2, h + WALL_T * 2, 0.9);
    outer.holes.push(roundedRect(-w / 2, -h / 2, w, h, 0.1));
    const frameGeo = new THREE.ExtrudeGeometry(outer, { depth: BASE_H + WALL_H - 0.1, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 10 });
    frameGeo.rotateX(-Math.PI / 2);
    frameGeo.translate(0, -BASE_H, 0);
    const wallMat = new THREE.MeshPhysicalMaterial({ color: theme.wall, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const frame = new THREE.Mesh(frameGeo, wallMat);
    frame.castShadow = frame.receiveShadow = true;
    this.board.add(frame);

    const floorShape = roundedRect(-w / 2 - 0.4, -h / 2 - 0.4, w + 0.8, h + 0.8, 0.1);
    for (const c of level.catchers) {
      // Shape y is -z after the rotation below.
      floorShape.holes.push(roundedRect(this.px(c.x), -this.pz(c.y + c.h) - 0.25, c.w, c.h + 0.25, 0.16));
    }
    const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: BASE_H - 0.02, bevelEnabled: false, curveSegments: 8 });
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, -BASE_H + 0.02, 0);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.78 }));
    floor.receiveShadow = true;
    this.board.add(floor);

    const pocketMat = new THREE.MeshStandardMaterial({ color: theme.pocket, roughness: 0.9 });
    for (const c of level.catchers) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(c.w + 0.3, c.h + 0.5), pocketMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(this.px(c.x + c.w / 2), -BASE_H + 0.06, this.pz(c.y + c.h / 2) + 0.1);
      p.receiveShadow = true;
      this.board.add(p);
      // A quiet outline on the floor marks the goal without adding a colour.
      const rim = roundedRect(-c.w / 2 - 0.14, -c.h / 2 - 0.46, c.w + 0.28, c.h + 0.6, 0.26);
      rim.holes.push(roundedRect(-c.w / 2 - 0.05, -c.h / 2 - 0.45, c.w + 0.1, c.h + 0.5, 0.2));
      const rimMesh = new THREE.Mesh(new THREE.ShapeGeometry(rim, 8), new THREE.MeshBasicMaterial({ color: 0x8e96a6 }));
      rimMesh.rotation.x = -Math.PI / 2;
      rimMesh.position.set(this.px(c.x + c.w / 2), 0.004, this.pz(c.y + c.h / 2));
      this.board.add(rimMesh);
    }

    const obMat = new THREE.MeshPhysicalMaterial({ color: theme.obstacle, roughness: 0.55, clearcoat: 0.2 });
    for (const o of level.obstacles) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(o.w, 0.56, o.h, 4, 0.1), obMat);
      m.position.set(this.px(o.x + o.w / 2), 0.28, this.pz(o.y + o.h / 2));
      m.castShadow = m.receiveShadow = true;
      this.board.add(m);
    }

    // Bumpers: a rubber dome with its symbol on top, on a fixed footprint ring.
    const profile: THREE.Vector2[] = [new THREE.Vector2(0, BUMPER_H), new THREE.Vector2(0.56, BUMPER_H)];
    for (let i = 1; i <= 10; i++) {
      const t = (i / 10) * (Math.PI / 2);
      profile.push(new THREE.Vector2(0.56 + 0.44 * Math.sin(t), 0.2 + (BUMPER_H - 0.2) * Math.cos(t)));
    }
    profile.push(new THREE.Vector2(1, 0));
    profile.reverse(); // bottom to top, so the lathe's normals face outwards
    const domeGeo = new THREE.LatheGeometry(profile, 48);
    this.bumpers = [];
    for (const b of level.bumpers) {
      const color = new THREE.Color(COLORS[b.color]);
      const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35, emissive: color, emissiveIntensity: 0 });
      const body = new THREE.Mesh(domeGeo, mat);
      body.position.set(this.px(b.x), 0, this.pz(b.y));
      body.scale.set(b.r, 1, b.r);
      body.castShadow = body.receiveShadow = true;
      this.board.add(body);

      const foot = new THREE.Mesh(new THREE.CircleGeometry(b.r + 0.07, 48), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.62) }));
      foot.rotation.x = -Math.PI / 2;
      foot.position.set(this.px(b.x), 0.006, this.pz(b.y));
      this.board.add(foot);

      const shape = new THREE.Shape(symbolPoints(SYMBOLS[b.color]).map(([x, y]) => new THREE.Vector2(x, y)));
      const symbol = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      symbol.rotation.x = -Math.PI / 2;
      symbol.position.set(this.px(b.x), BUMPER_H + 0.006, this.pz(b.y));
      symbol.scale.setScalar(b.r * 0.34);
      this.board.add(symbol);

      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(this.px(b.x), 0.012, this.pz(b.y));
      this.board.add(ring);
      this.bumpers.push({ body, mat, symbol, ring, ringMat, color: b.color, r: b.r, fx: 99 });
    }

    const n = world.marbles.length;
    this.marbles = new THREE.InstancedMesh(this.marbleGeo, this.marbleMat, n);
    this.marbles.castShadow = true;
    this.marbles.receiveShadow = true;
    this.marbles.frustumCulled = false;
    this.board.add(this.marbles);
    this.sink = new Float32Array(n).fill(-1);
    this.sinkFrom = new Float32Array(n * 2);
    this.fit();
  }

  /** A colour was pulsed: start the shock rings and the tray's little spring. */
  pulse(color: ColorId): void {
    for (const b of this.bumpers) if (b.color === color) b.fx = 0;
    this.bounceV = -1.6;
  }

  /** A marble dropped into a catcher at tray position (x, y). */
  collect(id: number, x: number, y: number): void {
    this.sink[id] = 0;
    this.sinkFrom[id * 2] = x;
    this.sinkFrom[id * 2 + 1] = y;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 32), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(this.px(x), 0.02, this.pz(Math.min(y, this.size.h - 0.3)));
    this.board.add(mesh);
    this.pops.push({ mesh, mat, t: 0 });
  }

  /**
   * Draws one frame. `prev` holds marble positions one fixed step ago and
   * `alpha` blends towards the current ones, so motion stays smooth at any refresh rate.
   */
  render(world: World, prev: Float32Array, alpha: number, dt: number): void {
    const mesh = this.marbles;
    if (!mesh) return;
    const d = this.dummy;
    const r = tune.marbleRadius;
    for (const m of world.marbles) {
      const i = m.id;
      if (m.alive) {
        const x = prev[i * 2] + (m.x - prev[i * 2]) * alpha;
        const y = prev[i * 2 + 1] + (m.y - prev[i * 2 + 1]) * alpha;
        d.position.set(this.px(x), r, this.pz(y));
        d.scale.setScalar(1);
      } else {
        let t = this.sink[i];
        if (t < 0) t = SINK_TIME; // collected before this view saw it
        else if (t < SINK_TIME) this.sink[i] = t = Math.min(SINK_TIME, t + dt);
        const k = t / SINK_TIME;
        d.position.set(this.px(this.sinkFrom[i * 2]), r - k * k * (BASE_H + 0.3), this.pz(this.sinkFrom[i * 2 + 1]));
        d.scale.setScalar(k >= 1 ? 0 : 1 - 0.35 * k);
      }
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.bumpers.length; i++) {
      const v = this.bumpers[i];
      const b = world.bumpers[i];
      const s = b.radius;
      v.body.scale.set(s, 1 + 0.22 * b.amount, s);
      v.symbol.position.y = BUMPER_H * (1 + 0.22 * b.amount) + 0.006;
      v.symbol.scale.setScalar(v.r * 0.34 * (1 + 0.25 * b.amount));
      v.mat.emissiveIntensity = 0.38 * b.amount;
      v.fx += dt;
      const k = v.fx / 0.45;
      if (k < 1) {
        const rr = v.r * (1 + tune.pulseExpand * 1.7 * (1 - (1 - k) * (1 - k)));
        v.ring.scale.set(rr, rr, 1);
        v.ringMat.opacity = 0.42 * (1 - k);
        v.ring.visible = true;
      } else v.ring.visible = false;
    }

    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt;
      const k = p.t / 0.4;
      if (k >= 1) {
        this.board.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mat.dispose();
        this.pops.splice(i, 1);
      } else {
        const s = 0.25 + 0.6 * k;
        p.mesh.scale.set(s, s, 1);
        p.mat.opacity = 0.9 * (1 - k);
      }
    }

    // Critically-damped spring: the whole tray dips a few millimetres on a burst.
    for (let left = Math.min(dt, 0.1); left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      this.bounceV += (-220 * this.bounce - 24 * this.bounceV) * h;
      this.bounce += this.bounceV * h;
    }
    this.board.position.y = this.bounce;

    this.renderer.render(this.scene, this.camera);
  }

  /** True while an effect is still animating after the simulation has settled. */
  get animating(): boolean {
    if (this.pops.length > 0 || Math.abs(this.bounce) > 0.0005 || Math.abs(this.bounceV) > 0.005) return true;
    for (const b of this.bumpers) if (b.fx < 0.45) return true;
    for (let i = 0; i < this.sink.length; i++) if (this.sink[i] >= 0 && this.sink[i] < SINK_TIME) return true;
    return false;
  }

  /** Sizes the canvas to its box and frames the tray so it fills the view. */
  fit(): void {
    const box = this.canvas.parentElement!;
    const cw = Math.max(1, box.clientWidth);
    const ch = Math.max(1, box.clientHeight);
    this.renderer.setSize(cw, ch, false);
    this.camera.aspect = cw / ch;
    const elev = (63 * Math.PI) / 180;
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    const hw = this.size.w / 2 + WALL_T;
    const hh = this.size.h / 2 + WALL_T;
    const pts: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-BASE_H, WALL_H]) pts.push(new THREE.Vector3(sx * hw, y, sz * hh));
    const target = new THREE.Vector3(0, 0, 0);
    const v = new THREE.Vector3();
    const extent = (dist: number) => {
      this.camera.position.copy(target).addScaledVector(dir, dist);
      this.camera.lookAt(target);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      let minX = 1, maxX = -1, minY = 1, maxY = -1;
      for (const p of pts) {
        v.copy(p).project(this.camera);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      return { minX, maxX, minY, maxY };
    };
    let dist = 30;
    for (let pass = 0; pass < 3; pass++) {
      let lo = 8, hi = 160;
      for (let i = 0; i < 24; i++) {
        dist = (lo + hi) / 2;
        const e = extent(dist);
        if ((e.maxX - e.minX) / 2 > 0.965 || (e.maxY - e.minY) / 2 > 0.95) lo = dist;
        else hi = dist;
      }
      dist = hi;
      const e = extent(dist);
      // Re-centre vertically: the tilt makes the near edge take more screen than the far one.
      const offNdc = (e.maxY + e.minY) / 2;
      const worldPerNdc = dist * Math.tan((this.camera.fov * Math.PI) / 360);
      target.z -= (offNdc * worldPerNdc) / Math.sin(elev);
    }
    extent(dist);
  }

  /** Draw-call and triangle counts of the last frame (for the performance read-out). */
  stats(): { calls: number; triangles: number } {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }

  private disposeBoard(): void {
    this.board.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry !== this.marbleGeo) m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (mat !== this.marbleMat) mat.dispose();
    });
    this.board.clear();
    this.marbles = null;
    this.pops = [];
    this.bounce = this.bounceV = 0;
  }
}
