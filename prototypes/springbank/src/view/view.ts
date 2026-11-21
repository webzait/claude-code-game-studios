// PROTOTYPE - NOT FOR PRODUCTION
// The 3D picture of the 2D simulation: a 2.5D diorama cabinet drawn with three.js from plain
// geometry made here. It reads the Sim and never changes it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FREE, GOAL_H, HELD, Sim, TRAY_REST_Y, WALL_R, WORLD_H, WORLD_W, type SimEvent } from '../sim/sim.ts';
import { tune } from '../sim/tune.ts';

const COL = {
  bg: 0x0a1022, panel: 0x16224a, frame: 0x24356e, rail: 0x0e1630,
  copper: 0xc9713a, gold: 0xf0b445, ivory: 0xe6dfcc, hot: 0xfff1c4, heldTint: 0xffcf7a, chute: 0x5b74c9,
  goal: 0x2fd6c3, goalFull: 0x4a5a8a, peg: 0xd9a441, bar: 0x8fa3d9, door: 0xff6b5e, guide: 0x9ff3ea,
};
const BASE_Y = 0.2; // where the spring stands on its cart
const GUIDE_DOTS = 28;
const RINGS = 14;

function label(text: string, color = '#f6f0e0', px = 96): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  g.font = `700 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  c.width = Math.ceil(g.measureText(text).width) + 24; c.height = px + 24;
  g.font = `700 ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(c.width / c.height, 1, 1); s.renderOrder = 10;
  s.userData.aspect = c.width / c.height;
  return s;
}
function setLabel(s: THREE.Sprite, text: string, color: string, height: number): void {
  if (s.userData.text === text + color) return;
  const fresh = label(text, color);
  (s.material as THREE.SpriteMaterial).map?.dispose();
  s.material = fresh.material; s.userData.text = text + color;
  s.scale.set(fresh.userData.aspect * height, height, 1);
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(26, 1, 1, 200);
  private readonly cheap: boolean;
  private sim: Sim | null = null;
  private level = new THREE.Group(); // rebuilt for each level
  private balls!: THREE.InstancedMesh;
  private readonly tray = new THREE.Group();
  private readonly cart = new THREE.Group();
  private spring!: THREE.Mesh;
  private rim!: THREE.MeshStandardMaterial;
  private countLabel = label('0');
  private guide!: THREE.InstancedMesh;
  private apexMark!: THREE.Mesh;
  private goalParts: { fill: THREE.Mesh; mat: THREE.MeshStandardMaterial; text: THREE.Sprite; glow: number }[] = [];
  private barMeshes: THREE.Mesh[] = [];
  private rings: { mesh: THREE.Mesh; life: number; max: number; grow: number }[] = [];
  private flash = new THREE.PointLight(0xffe2a8, 0, 14, 1.6);
  private shake = 0;
  private kick = 0; private kickV = 0; // the tray's visual recoil after a launch
  private dip = 0; // a small visual dip on each catch
  private camBase = new THREE.Vector3();
  private time = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly c = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, cheap: boolean) {
    this.cheap = cheap;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !cheap, powerPreference: 'high-performance' }));
    r.setPixelRatio(cheap ? 0.5 : Math.min(devicePixelRatio || 1, 2));
    r.shadowMap.enabled = !cheap; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(COL.bg);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x1a1430, 0.7));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(1.5, 15, 13); sun.target.position.set(4.5, 7, 0);
    sun.castShadow = !cheap; sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0015; sun.shadow.radius = 3;
    this.scene.add(sun, sun.target, this.flash);

    this.buildCabinet(); this.buildTray(); this.buildEffects();
    this.scene.add(this.level);
  }

  // ---- Construction ------------------------------------------------------------------

  private std(color: number, metalness = 0.2, roughness = 0.5, emissive = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: new THREE.Color(color), emissiveIntensity: emissive });
  }
  private box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  /** A box lying along a segment, with rounded ends: every bar, wall and roof of the board. */
  private beam(x1: number, y1: number, x2: number, y2: number, mat: THREE.Material, depth = 0.9, r = WALL_R): THREE.Mesh {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const g = new THREE.CapsuleGeometry(r, len, 4, 10);
    const m = new THREE.Mesh(g, mat);
    m.scale.z = depth / (2 * r); m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  private buildCabinet(): void {
    const panel = this.std(COL.panel, 0.1, 0.85), frame = this.std(COL.frame, 0.35, 0.45);
    const back = this.box(WORLD_W + 1.2, WORLD_H + 6, 0.3, panel, WORLD_W / 2, WORLD_H / 2, -0.75);
    back.castShadow = false;
    this.scene.add(back);
    this.scene.add(this.box(0.5, WORLD_H + 6, 1.7, frame, -0.25, WORLD_H / 2, -0.05));
    this.scene.add(this.box(0.5, WORLD_H + 6, 1.7, frame, WORLD_W + 0.25, WORLD_H / 2, -0.05));
    this.scene.add(this.box(WORLD_W + 1, 0.16, 1.5, this.std(COL.rail, 0.6, 0.35), WORLD_W / 2, 0.02, 0)); // the tray's rail
    // faint height lines on the back panel, so a launch's reach can be read
    const line = new THREE.MeshBasicMaterial({ color: 0x2b3c7c });
    for (let y = 4; y <= 14; y += 2) { const l = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, 0.03), line); l.position.set(WORLD_W / 2, y, -0.59); this.scene.add(l); }
  }

  private buildTray(): void {
    const copper = this.std(COL.copper, 0.85, 0.28), gold = this.std(COL.gold, 0.9, 0.25);
    const w = tune.tray_width, wallH = 1.35;
    this.rim = this.std(COL.gold, 0.6, 0.3);
    this.tray.add(this.box(w + 0.5, 0.22, 1.15, copper, 0, -0.11, 0));
    for (const s of [-1, 1]) {
      this.tray.add(this.box(0.2, wallH, 1.15, copper, s * (w / 2 + 0.15), wallH / 2 - 0.05, 0));
      this.tray.add(this.box(0.3, 0.14, 1.25, this.rim, s * (w / 2 + 0.15), wallH, 0));
    }
    const backPlate = this.box(w + 0.3, wallH, 0.08, this.std(0x5a2f18, 0.5, 0.6), 0, wallH / 2, -0.5);
    this.tray.add(backPlate);
    // a badge on the tray's front carries the count of held balls
    this.tray.add(this.box(1.15, 0.62, 0.12, this.std(0x2a1408, 0.4, 0.5), 0, -0.5, 0.62));
    this.countLabel.position.set(0, -0.5, 0.75);
    this.tray.add(this.countLabel);
    // the spring: a helix one unit tall, stretched to the gap between cart and tray every frame
    const pts: THREE.Vector3[] = [];
    const turns = 5.5;
    for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 0.62, t, Math.sin(a) * 0.4)); }
    this.spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.085, 8), gold);
    this.spring.castShadow = true;
    this.cart.add(this.spring);
    this.cart.add(this.box(w + 0.2, 0.2, 1.1, this.std(0x3a4a86, 0.6, 0.4), 0, BASE_Y - 0.1, 0));
    for (const s of [-1, 1]) { // guide rods either side of the spring
      this.cart.add(this.box(0.1, TRAY_REST_Y - BASE_Y, 0.1, this.std(0x9aa7d6, 0.9, 0.3), s * (w / 2 - 0.1), (TRAY_REST_Y + BASE_Y) / 2 - 0.15, -0.3));
    }
    this.scene.add(this.tray, this.cart);
  }

  private buildEffects(): void {
    this.guide = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: COL.guide, transparent: true, opacity: 0.55, depthWrite: false }), GUIDE_DOTS);
    this.guide.frustumCulled = false;
    const tri = new THREE.Shape(); tri.moveTo(-0.34, -0.2); tri.lineTo(0, 0.2); tri.lineTo(0.34, -0.2); tri.lineTo(0, -0.06); tri.closePath();
    this.apexMark = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: COL.guide, transparent: true, opacity: 0.8, depthWrite: false }));
    this.apexMark.position.z = 0.3;
    this.scene.add(this.guide, this.apexMark);
    for (let i = 0; i < RINGS; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh.visible = false; mesh.position.z = 0.6;
      this.scene.add(mesh); this.rings.push({ mesh, life: 0, max: 1, grow: 1 });
    }
  }

  /** Build the level's goals, pegs, bars, chutes and balls. Called on every reset. */
  setSim(sim: Sim, labels: { text: string; x: number; y: number }[] = []): void {
    this.sim = sim;
    this.level.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.scene.remove(this.level);
    this.level = new THREE.Group(); this.scene.add(this.level);
    this.goalParts = []; this.barMeshes = [];
    this.shake = 0; this.kick = 0; this.kickV = 0; this.dip = 0;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    const lv = sim.level;

    const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.15, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, this.cheap ? 12 : 22, this.cheap ? 8 : 16), ballMat, sim.n);
    this.balls.castShadow = true; this.balls.frustumCulled = false;
    this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < sim.n; i++) this.balls.setColorAt(i, this.c.setHex(COL.ivory));
    this.level.add(this.balls);

    const chute = this.std(COL.chute, 0.5, 0.35, 0.15);
    for (const x of lv.streams) { // the chutes the stream falls from
      for (const s of [-1, 1]) this.level.add(this.beam(x + s * 0.95, WORLD_H + 1.5, x + s * 0.5, WORLD_H + 0.25, chute, 1.2, 0.14));
    }
    lv.goals.forEach((g) => {
      const mat = this.std(COL.goal, 0.3, 0.35, 0.35);
      const l = g.x - g.w / 2 - WALL_R, r = g.x + g.w / 2 + WALL_R, top = g.y + GOAL_H;
      this.level.add(this.beam(l, g.y, l, top, mat), this.beam(r, g.y, r, top, mat));
      this.level.add(this.beam(l, top, g.x, top + 0.45, mat), this.beam(g.x, top + 0.45, r, top, mat));
      const inner = this.box(g.w, GOAL_H, 0.1, this.std(0x0c2a3a, 0.2, 0.8), g.x, g.y + GOAL_H / 2, -0.4);
      const fill = this.box(g.w, GOAL_H, 0.12, this.std(COL.goal, 0.1, 0.5, 0.8), g.x, g.y, -0.34);
      fill.castShadow = false;
      const stem = this.box(0.14, WORLD_H + 3 - top, 0.14, this.std(COL.frame, 0.5, 0.4), g.x, (WORLD_H + 3 + top) / 2 + 0.4, -0.45);
      const text = label('0');
      text.position.set(g.x, g.y + GOAL_H / 2, 0.6);
      this.level.add(inner, fill, stem, text);
      this.goalParts.push({ fill, mat, text, glow: 0 });
    });
    const pegMat = this.std(COL.peg, 0.85, 0.25);
    for (const p of lv.pegs) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.9, 24), pegMat);
      m.rotation.x = Math.PI / 2; m.position.set(p.x, p.y, 0); m.castShadow = true; m.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(p.r * 0.96, 20, 12), pegMat); cap.scale.z = 0.35; cap.position.set(p.x, p.y, 0.45);
      this.level.add(m, cap);
    }
    lv.bars.forEach((b) => {
      const mat = b.move ? this.std(COL.door, 0.3, 0.4, 0.25) : this.std(COL.bar, 0.6, 0.35);
      const m = this.beam(b.x1, b.y1, b.x2, b.y2, mat, 1.0, WALL_R * 1.15);
      m.userData.home = m.position.clone();
      this.level.add(m); this.barMeshes.push(m);
      if (b.move) { // the track a sliding door runs on
        const tr = this.box(Math.abs(b.x2 - b.x1) + 2 * b.move.dx + 0.3, 0.05, 0.05, this.std(0x5a2a3a, 0.3, 0.6), (b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2, -0.55);
        this.level.add(tr);
      }
    });
    for (const l of labels) { const s = label(l.text, '#dfe6ff', 64); s.scale.set(s.userData.aspect * 0.42, 0.42, 1); s.position.set(l.x, l.y, 0.8); this.level.add(s); }
  }

  // ---- Per frame ---------------------------------------------------------------------

  resize(w: number, h: number, topPx: number): void {
    this.renderer.setSize(w, h, false);
    const cam = this.camera; cam.aspect = w / h;
    // fit the board: 10 units wide, and from the rail up to the chutes, below the HUD strip
    const t = Math.tan((cam.fov * Math.PI) / 360);
    const spanH = 17.4 / (1 - Math.min(0.2, topPx / h)), spanW = WORLD_W + 1.1;
    const d = Math.max(spanH / 2 / t, spanW / 2 / (t * cam.aspect));
    const visH = 2 * d * t, bottom = -1.5;
    const cy = Math.max(bottom + visH / 2, 8.3 + (visH - spanH) * 0.0); // extra room on a tall phone goes above the board
    this.camBase.set(WORLD_W / 2, cy - 1.1, d);
    cam.position.copy(this.camBase); cam.lookAt(WORLD_W / 2, cy + 0.25, 0);
    cam.userData.look = new THREE.Vector3(WORLD_W / 2, cy + 0.25, 0);
    cam.updateProjectionMatrix();
  }

  /** World x under a screen point, on the board's plane. */
  worldX(clientX: number, clientY: number, rect: DOMRect): number {
    const v = new THREE.Vector3(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camBase, dir = v.sub(o).normalize();
    return o.x + dir.x * (-o.z / dir.z);
  }

  /** React to what the simulation reported this step. */
  onEvent(e: SimEvent): void {
    if (e.type === 'launch') {
      const p = Math.sqrt(e.power);
      this.shake = Math.max(this.shake, tune.shake * (0.25 + 0.75 * p));
      this.kickV = 9 + 16 * p; this.flash.intensity = 30 + 120 * p;
      this.flash.position.set(e.x, e.y + 1.2, 1.5);
      this.ring(e.x, e.y + 0.6, 1.2 + 3.2 * p, 0.45, COL.gold);
      this.ring(e.x, e.y + 0.6, 0.8 + 1.8 * p, 0.3, 0xffffff);
    } else if (e.type === 'score') {
      this.ring(e.x, e.y, 0.55, 0.3, COL.goal);
      this.goalParts[e.goal].glow = 1;
    } else if (e.type === 'catch') this.dip = Math.min(0.12, this.dip + 0.05);
    else if (e.type === 'goalfull') { const g = this.sim!.level.goals[e.goal]; this.ring(g.x, g.y + 0.5, 1.6, 0.5, 0xffffff); }
  }

  private ring(x: number, y: number, grow: number, life: number, color: number): void {
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.life = r.max = life; r.grow = grow; r.mesh.visible = true;
    r.mesh.position.set(x, y, 0.6); (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  render(dt: number): void {
    const sim = this.sim; if (!sim) return;
    this.time += dt;
    const r = tune.ball_radius, m4 = this.m4;
    // balls
    for (let i = 0; i < sim.n; i++) {
      const st = sim.state[i], show = st === FREE || st === HELD;
      const s = show ? r : 0;
      m4.makeScale(s, s, s).setPosition(sim.x[i], sim.y[i] + (st === HELD ? this.kick - this.dip : 0), st === HELD ? 0 : 0.02 * ((i % 5) - 2));
      this.balls.setMatrixAt(i, m4);
      this.balls.setColorAt(i, this.c.setHex(st === HELD ? COL.heldTint : sim.flight[i] ? COL.hot : COL.ivory));
    }
    this.balls.instanceMatrix.needsUpdate = true;
    if (this.balls.instanceColor) this.balls.instanceColor.needsUpdate = true;

    // tray and spring: the spring's real compression, plus a damped recoil after a launch
    this.kickV += (-220 * this.kick - 11 * this.kickV) * dt; this.kick += this.kickV * dt;
    this.dip = Math.max(0, this.dip - dt * 0.9);
    const floor = sim.trayFloorY + this.kick - this.dip;
    this.tray.position.set(sim.trayX, floor, 0); this.cart.position.set(sim.trayX, 0, 0);
    this.spring.position.y = BASE_Y; this.spring.scale.y = Math.max(0.15, floor - 0.22 - BASE_Y);
    this.rim.emissiveIntensity = sim.catching ? 0.9 + 0.3 * Math.sin(this.time * 9) : 0.05;
    setLabel(this.countLabel, sim.held > 0 ? `${sim.held}` : ' ', sim.held >= sim.capacity ? '#ff9d8f' : '#ffe9bd', 0.5);

    // the guide: a dotted line straight up from the pile to the height the launch will reach
    const apex = sim.predictedApex();
    const from = sim.held > 0 ? sim.trayFloorY + sim.slotPos(sim.held - 1).y + r * 2 : 0;
    const gap = 0.42, phase = (this.time * 0.9) % gap;
    for (let k = 0; k < GUIDE_DOTS; k++) {
      const y = from + phase + k * gap, on = sim.held > 0 && y < apex - 0.25;
      const s = on ? 1 : 0;
      m4.makeScale(s, s, s).setPosition(sim.trayX, y, 0.3); this.guide.setMatrixAt(k, m4);
    }
    this.guide.instanceMatrix.needsUpdate = true;
    this.apexMark.visible = sim.held > 0 && apex > from + 0.5;
    this.apexMark.position.set(sim.trayX, apex, 0.3);

    // goals, bars, rings
    sim.level.goals.forEach((g, k) => {
      const p = this.goalParts[k], f = sim.goalCount[k] / g.capacity, full = f >= 1;
      p.fill.scale.y = Math.max(0.001, f); p.fill.position.y = g.y + (GOAL_H * f) / 2;
      p.glow = Math.max(0, p.glow - dt * 3);
      p.mat.color.setHex(full ? COL.goalFull : COL.goal); p.mat.emissive.setHex(full ? COL.goalFull : COL.goal);
      p.mat.emissiveIntensity = full ? 0.1 : 0.35 + p.glow * 1.2;
      setLabel(p.text, full ? 'vol' : `${g.capacity - sim.goalCount[k]}`, full ? '#9fb0e0' : '#ffffff', 0.7);
    });
    this.barMeshes.forEach((m, i) => { const o = sim.barOffset(i), h = m.userData.home as THREE.Vector3; m.position.set(h.x + o.dx, h.y + o.dy, 0); });
    for (const q of this.rings) {
      if (q.life <= 0) continue;
      q.life -= dt; const t = 1 - Math.max(0, q.life) / q.max, s = 0.2 + q.grow * (1 - (1 - t) * (1 - t));
      q.mesh.scale.set(s, s, 1); (q.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      if (q.life <= 0) q.mesh.visible = false;
    }
    this.flash.intensity *= Math.exp(-dt * 9);

    // a short, subtle camera kick: decays fast, never drifts
    this.shake *= Math.exp(-dt * 7.5);
    const sx = Math.sin(this.time * 71) * this.shake, sy = Math.cos(this.time * 93) * this.shake;
    this.camera.position.set(this.camBase.x + sx * 0.6, this.camBase.y + sy, this.camBase.z);
    this.camera.lookAt(this.camera.userData.look);
    this.renderer.render(this.scene, this.camera);
  }
}
