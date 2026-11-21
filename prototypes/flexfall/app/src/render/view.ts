// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The 3D view: a toy tray on a table. It only reads the world; it never changes it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Tuning } from '../sim/types';
import { anchorTarget, gradAt, heightAt, type World } from '../sim/world';

const COL = {
  table: 0xdcd0bd, tray: 0xf6eedf, trayDark: 0xc9b99d, valley: 0x08343c, mid: 0x15626a, peak: 0x4fb3a6,
  brass: 0xc9a25a, up: 0xf06a55, down: 0x2a9d9a, hole: 0x08181c, rim: 0xf6eee0, wall: 0xeadcc4,
};
const SEG_X = 48, SEG_Z = 66, RING_SEG = 72, FLOOR_BOTTOM = -2.3, WALL_T = 0.32, RIM_Y = 0.95;

interface AnchorView { group: THREE.Group; cap: THREE.Mesh; arrow: THREE.Mesh; ring: THREE.Mesh; pop: number; mat: THREE.MeshPhysicalMaterial }
interface Ghost { color: THREE.Color; x: number; z: number; y: number; tx: number; tz: number; ty: number; t: number }

export class View {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 120);
  private readonly levelGroup = new THREE.Group();
  private world: World | null = null;
  private floor: THREE.Mesh | null = null;
  private skirt: THREE.Mesh | null = null;
  private marbles: THREE.InstancedMesh | null = null;
  private anchors: AnchorView[] = [];
  private catchRings: { mesh: THREE.Mesh; pulse: number }[] = [];
  private quats: THREE.Quaternion[] = [];
  private prevX = new Float64Array(0); private prevZ = new Float64Array(0);
  private lastAnchorSum = NaN;
  private ghosts: Ghost[] = [];
  private ghostMesh: THREE.InstancedMesh | null = null;
  private colors: THREE.Color[] = [];
  private time = 0;
  private readonly gridTex: THREE.Texture;
  private readonly marbleTex: THREE.Texture;
  /** Index of the clamp under the pointer, or -1. */
  hover = -1;

  constructor(canvas: HTMLCanvasElement, private readonly tune: Tuning, private readonly cheap: boolean, private readonly palette: number[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !cheap, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(cheap ? 0.5 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !cheap;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.scene.background = new THREE.Color(COL.table);
    this.scene.fog = new THREE.Fog(COL.table, 60, 120);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb8c4c8, 0.55));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.3);
    key.position.set(-6, 14, -5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 9; sc.bottom = -9; sc.near = 2; sc.far = 34;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe6ff, 0.5); fill.position.set(7, 6, 8); this.scene.add(fill);

    const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: COL.table, roughness: 0.95 }));
    table.rotation.x = -Math.PI / 2; table.position.y = FLOOR_BOTTOM - 0.02; table.receiveShadow = true;
    this.scene.add(table, this.levelGroup);

    this.gridTex = gridTexture(); this.marbleTex = marbleTexture();
  }

  /** Build everything for a level. Called on every start and restart. */
  setWorld(w: World): void {
    this.world = w; this.levelGroup.clear(); this.anchors = []; this.catchRings = []; this.ghosts = []; this.lastAnchorSum = NaN;
    const W = w.halfW * 2, D = w.halfD * 2, R = this.tune.marble_radius;

    // The tray: back and side walls solid, the front one glass so the catcher stays in view.
    const trayMat = new THREE.MeshPhysicalMaterial({ color: COL.tray, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const wallH = RIM_Y - FLOOR_BOTTOM;
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh => {
      const m = new THREE.Mesh(roundedBox(sx, sy, sz, 0.12), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      this.levelGroup.add(m); return m;
    };
    const cy = FLOOR_BOTTOM + wallH / 2;
    box(W + WALL_T * 2, wallH, WALL_T, 0, cy, -w.halfD - WALL_T / 2, trayMat);
    box(WALL_T, wallH, D + WALL_T, -w.halfW - WALL_T / 2, cy, WALL_T / 2 - WALL_T / 2, trayMat);
    box(WALL_T, wallH, D + WALL_T, w.halfW + WALL_T / 2, cy, 0, trayMat);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false });
    const front = box(W + WALL_T * 2, wallH, WALL_T * 0.6, 0, cy, w.halfD + WALL_T * 0.3, glass);
    front.castShadow = false; front.renderOrder = 5;
    const plinth = box(W + WALL_T * 2 + 0.5, 0.36, D + WALL_T * 2 + 0.5, 0, FLOOR_BOTTOM + 0.16, 0, new THREE.MeshPhysicalMaterial({ color: COL.trayDark, roughness: 0.5, clearcoat: 0.2 }));
    plinth.castShadow = true;

    // The rubber floor: a grid of vertices lifted to the height field every time a clamp moves.
    const geo = new THREE.PlaneGeometry(W, D, SEG_X, SEG_Z); geo.rotateX(-Math.PI / 2);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.gridTex.repeat.set(W * 2, D * 2); // one cell per half unit
    this.floor = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, map: this.gridTex, roughness: 0.58, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x9fe3d8) }));
    this.floor.receiveShadow = true; this.levelGroup.add(this.floor);
    // A skirt under the front edge, seen through the glass.
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG_X + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEG_X; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    sg.setIndex(idx);
    this.skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: COL.valley, roughness: 0.8 }));
    this.levelGroup.add(this.skirt);

    // Catchers: a dark hole with a pale rim, set at the lip of its dimple.
    for (const c of w.level.catchers) {
      const g = new THREE.Group();
      const hole = new THREE.Mesh(new THREE.CircleGeometry(c.r, 48), new THREE.MeshBasicMaterial({ color: COL.hole }));
      hole.rotation.x = -Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.RingGeometry(c.r * 0.55, c.r, 48), new THREE.MeshBasicMaterial({ color: 0x123138 }));
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.004;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.04, 0.06, 12, 56), new THREE.MeshPhysicalMaterial({ color: COL.rim, roughness: 0.3, clearcoat: 0.8 }));
      rim.rotation.x = -Math.PI / 2; rim.castShadow = true;
      const pulse = new THREE.Mesh(new THREE.RingGeometry(c.r + 0.1, c.r + 0.2, 56), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.03;
      g.add(hole, inner, rim, pulse);
      g.position.set(c.x, heightAt(w, c.x + c.r, c.z) - 0.02, c.z);
      this.levelGroup.add(g); this.catchRings.push({ mesh: pulse, pulse: 0 });
    }

    // Walls and pegs.
    const wallMat = new THREE.MeshPhysicalMaterial({ color: COL.wall, roughness: 0.5, clearcoat: 0.3 });
    for (const s of w.level.walls ?? []) {
      const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
      let top = -Infinity;
      for (let u = 0; u <= 1; u += 0.1) top = Math.max(top, heightAt(w, s.x1 + (s.x2 - s.x1) * u, s.z1 + (s.z2 - s.z1) * u));
      top += 0.5;
      const m = new THREE.Mesh(roundedBox(len + s.t * 2, top - FLOOR_BOTTOM, s.t * 2, s.t * 0.9), wallMat);
      m.position.set((s.x1 + s.x2) / 2, (top + FLOOR_BOTTOM) / 2, (s.z1 + s.z2) / 2);
      m.rotation.y = -Math.atan2(s.z2 - s.z1, s.x2 - s.x1); m.castShadow = true; m.receiveShadow = true;
      this.levelGroup.add(m);
    }
    const pegMat = new THREE.MeshPhysicalMaterial({ color: COL.brass, roughness: 0.28, metalness: 0.85 });
    for (const p of w.level.pegs ?? []) {
      const top = heightAt(w, p.x, p.z) + 0.55;
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(p.r, top - FLOOR_BOTTOM - p.r * 2, 6, 18), pegMat);
      m.position.set(p.x, (top + FLOOR_BOTTOM) / 2, p.z); m.castShadow = true; this.levelGroup.add(m);
    }

    // Clamps: a brass foot on the rubber, a stem, a coloured knob, and an arrow for the next tap.
    const brass = new THREE.MeshPhysicalMaterial({ color: COL.brass, roughness: 0.3, metalness: 0.85 });
    for (const a of w.level.anchors) {
      const group = new THREE.Group();
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(this.tune.anchor_radius * 0.9, this.tune.anchor_radius, 0.1, 28), brass); foot.position.y = 0.05;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(this.tune.anchor_radius * 0.72, 0.045, 10, 28), brass); collar.rotation.x = Math.PI / 2; collar.position.y = 0.11;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 14), brass); stem.position.y = 0.35;
      const mat = new THREE.MeshPhysicalMaterial({ color: COL.up, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), mat); cap.position.y = 0.68; cap.scale.y = 0.8;
      // A flat chevron that always faces the camera: which way the next tap moves the floor.
      const tri = new THREE.Shape(); tri.moveTo(0, 0.2); tri.lineTo(-0.2, -0.1); tri.lineTo(-0.07, -0.1); tri.lineTo(0, 0.02); tri.lineTo(0.07, -0.1); tri.lineTo(0.2, -0.1); tri.closePath();
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.95, depthTest: false }));
      arrow.position.y = 1.3; arrow.renderOrder = 10;
      for (const m of [foot, collar, stem, cap]) m.castShadow = true;
      group.add(foot, collar, stem, cap, arrow);
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((RING_SEG + 1) * 2 * 3), 3));
      const ri: number[] = [];
      for (let i = 0; i < RING_SEG; i++) ri.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      rg.setIndex(ri);
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
      ring.frustumCulled = false; ring.renderOrder = 2;
      group.position.set(a.x, 0, a.z);
      this.levelGroup.add(group, ring);
      this.anchors.push({ group, cap, arrow, ring, pop: 0, mat });
    }

    // Marbles: one instanced mesh, glossy glass with a band so rolling shows.
    const mm = new THREE.MeshPhysicalMaterial({ map: this.marbleTex, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
    const sphere = new THREE.SphereGeometry(R, this.cheap ? 10 : 22, this.cheap ? 8 : 16);
    this.marbles = new THREE.InstancedMesh(sphere, mm, Math.max(1, w.n));
    this.marbles.castShadow = true; this.marbles.receiveShadow = true; this.marbles.frustumCulled = false;
    this.ghostMesh = new THREE.InstancedMesh(sphere, mm, 24); this.ghostMesh.frustumCulled = false; this.ghostMesh.count = 0;
    this.quats = []; this.colors = [];
    const seedQ = new THREE.Euler();
    for (let i = 0; i < w.n; i++) {
      seedQ.set(i * 1.7, i * 2.3, i * 0.9); this.quats.push(new THREE.Quaternion().setFromEuler(seedQ));
      const c = new THREE.Color(this.palette[(i * 7 + (i >> 2)) % this.palette.length]);
      this.colors.push(c); this.marbles.setColorAt(i, c);
    }
    this.ghostMesh.setColorAt(0, new THREE.Color(0xffffff));
    this.levelGroup.add(this.marbles, this.ghostMesh);
    this.prevX = w.px.slice(); this.prevZ = w.pz.slice();
    this.resize();
  }

  /** Remember where the marbles are before a tick, so frames can be drawn between ticks. */
  snapshot(): void {
    if (!this.world) return;
    this.prevX.set(this.world.px); this.prevZ.set(this.world.pz);
  }

  /** A marble was caught: let it drop into the hole. */
  onCatch(id: number, catcher: number, x: number, z: number): void {
    const w = this.world; if (!w || this.ghosts.length >= 24) return;
    const c = w.level.catchers[catcher];
    this.ghosts.push({ color: this.colors[id], x, z, y: heightAt(w, x, z) + this.tune.marble_radius, tx: c.x, tz: c.z, ty: heightAt(w, c.x, c.z) - 0.5, t: 0 });
    if (this.catchRings[catcher]) this.catchRings[catcher].pulse = 1;
  }
  /** A clamp was tapped: pop its knob. */
  onTap(i: number): void { if (this.anchors[i]) this.anchors[i].pop = 1; }

  resize(): void {
    const w = this.world; if (!w) return;
    const cw = window.innerWidth, ch = window.innerHeight;
    this.renderer.setSize(cw, ch, false);
    this.camera.aspect = cw / ch;
    // Fit the whole tray under the HUD: search the distance, then slide the aim to centre it.
    const elev = 63 * Math.PI / 180, dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    const target = new THREE.Vector3(0, -0.3, 0);
    const top = 1 - 2 * Math.min(0.24, 172 / ch), bottom = -0.95, side = 0.95;
    const corners: THREE.Vector3[] = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) for (const y of [FLOOR_BOTTOM, RIM_Y])
      corners.push(new THREE.Vector3(x * (w.halfW + WALL_T), y, z * (w.halfD + WALL_T)));
    const v = new THREE.Vector3();
    const bounds = (dist: number): { x: number; y0: number; y1: number } => {
      this.camera.position.copy(target).addScaledVector(dir, dist); this.camera.lookAt(target);
      this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix();
      let x = 0, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) { v.copy(c).project(this.camera); x = Math.max(x, Math.abs(v.x)); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      return { x, y0, y1 };
    };
    let dist = 30;
    for (let it = 0; it < 4; it++) {
      let lo = 8, hi = 90;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, b = bounds(mid);
        if (b.x > side || b.y1 - b.y0 > top - bottom) lo = mid; else hi = mid;
      }
      dist = hi;
      const b = bounds(dist), off = (b.y0 + b.y1) / 2 - (top + bottom) / 2;
      target.z += off * dist * Math.tan(this.camera.fov * Math.PI / 360) / Math.sin(elev) * -1;
    }
    bounds(dist);
    const fog = this.scene.fog as THREE.Fog; fog.near = dist + 14; fog.far = dist + 60; this.camera.far = dist + 90; this.camera.updateProjectionMatrix();
  }

  /** Where a floor point lands on screen, in CSS pixels. */
  project(x: number, z: number, lift = 0): { x: number; y: number } {
    const w = this.world!;
    const v = new THREE.Vector3(x, heightAt(w, x, z) + lift, z).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  }

  /** The clamp nearest a screen point, within a finger's reach, or -1. */
  pick(sx: number, sy: number): number {
    const w = this.world; if (!w) return -1;
    let best = -1, bd = Math.max(46, Math.min(window.innerWidth, window.innerHeight) * 0.085);
    w.level.anchors.forEach((a, i) => {
      for (const lift of [0.1, 0.7]) {
        const p = this.project(a.x, a.z, lift), d = Math.hypot(p.x - sx, p.y - sy);
        if (d < bd) { bd = d; best = i; }
      }
    });
    return best;
  }

  /** Draw a frame. alpha: how far between the last two ticks; canTap: clamps invite a tap. */
  draw(alpha: number, dt: number, canTap: boolean): void {
    const w = this.world; if (!w || !this.floor || !this.marbles || !this.skirt || !this.ghostMesh) return;
    this.time += dt;
    const R = this.tune.marble_radius;
    // Floor: only when a clamp moved.
    let sum = 0; for (let i = 0; i < w.aHeight.length; i++) sum += w.aHeight[i] * (i + 1.37);
    const moved = sum !== this.lastAnchorSum; this.lastAnchorSum = sum;
    if (moved) {
      const pos = this.floor.geometry.attributes.position as THREE.BufferAttribute, nor = this.floor.geometry.attributes.normal as THREE.BufferAttribute;
      const col = this.floor.geometry.attributes.color as THREE.BufferAttribute;
      const lo = new THREE.Color(COL.valley), mid = new THREE.Color(COL.mid), hi = new THREE.Color(COL.peak), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), h = heightAt(w, x, z), g = gradAt(w, x, z);
        pos.setY(i, h);
        const l = 1 / Math.sqrt(1 + g.gx * g.gx + g.gz * g.gz); nor.setXYZ(i, -g.gx * l, l, -g.gz * l);
        if (h < 0) c.copy(mid).lerp(lo, Math.min(1, -h / 1.3)); else c.copy(mid).lerp(hi, Math.min(1, h / 1.0));
        col.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = true; nor.needsUpdate = true; col.needsUpdate = true;
      const sp = this.skirt.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i <= SEG_X; i++) {
        const x = -w.halfW + (i / SEG_X) * w.halfW * 2;
        sp.setXYZ(i * 2, x, heightAt(w, x, w.halfD), w.halfD); sp.setXYZ(i * 2 + 1, x, FLOOR_BOTTOM, w.halfD);
      }
      sp.needsUpdate = true; this.skirt.geometry.computeVertexNormals();
    }
    // Clamps and their influence rings.
    this.anchors.forEach((av, i) => {
      const a = w.level.anchors[i], h = heightAt(w, a.x, a.z);
      av.group.position.y = h;
      const next = a.heights[(w.aIndex[i] + 1) % a.heights.length], goesUp = next > anchorTarget(w, i);
      const mx = Math.max(...a.heights), mn = Math.min(...a.heights), k = mx > mn ? (w.aHeight[i] - mn) / (mx - mn) : (mx > 0 ? 1 : 0);
      av.mat.color.set(COL.down).lerp(new THREE.Color(COL.up), Math.max(0, Math.min(1, k)));
      av.pop = Math.max(0, av.pop - dt * 4);
      const s = 1 + av.pop * 0.35 + (this.hover === i && canTap ? 0.12 : 0);
      av.cap.scale.set(s, 0.8 * s, s);
      av.arrow.quaternion.copy(this.camera.quaternion); if (!goesUp) av.arrow.rotateZ(Math.PI);
      av.arrow.position.y = 1.3 + (canTap ? Math.sin(this.time * 4 + i) * 0.06 * (goesUp ? 1 : -1) : 0);
      (av.arrow.material as THREE.MeshBasicMaterial).opacity = canTap ? 0.95 : 0.25;
      const rm = av.ring.material as THREE.MeshBasicMaterial;
      rm.opacity = canTap ? (this.hover === i ? 0.5 : 0.16 + 0.08 * Math.sin(this.time * 2.4 + i * 1.3)) : 0.07;
      if (moved) {
        const rp = av.ring.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j <= RING_SEG; j++) {
          const ang = (j / RING_SEG) * Math.PI * 2, cx = Math.cos(ang), cz = Math.sin(ang);
          for (let e = 0; e < 2; e++) {
            const rr = a.r * 0.97 - e * 0.07;
            const x = Math.max(-w.halfW, Math.min(w.halfW, a.x + cx * rr)), z = Math.max(-w.halfD, Math.min(w.halfD, a.z + cz * rr));
            rp.setXYZ(j * 2 + e, x, heightAt(w, x, z) + 0.025, z);
          }
        }
        rp.needsUpdate = true;
      }
    });
    // Marbles: placed on the floor along its normal, rolled by how far they moved.
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion(), axis = new THREE.Vector3();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < w.n; i++) {
      if (!w.alive[i]) { this.marbles.setMatrixAt(i, zero); continue; }
      const x = this.prevX[i] + (w.px[i] - this.prevX[i]) * alpha, z = this.prevZ[i] + (w.pz[i] - this.prevZ[i]) * alpha;
      const dx = (w.px[i] - this.prevX[i]), dz = (w.pz[i] - this.prevZ[i]), d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1e-6 && dt > 0) { axis.set(dz / d, 0, -dx / d); q.setFromAxisAngle(axis, d / R * Math.min(1, dt * 60)); this.quats[i].premultiply(q); }
      const g = gradAt(w, x, z), l = 1 / Math.sqrt(1 + g.gx * g.gx + g.gz * g.gz);
      p.set(x - g.gx * l * R, heightAt(w, x, z) + l * R, z - g.gz * l * R);
      m4.compose(p, this.quats[i], sc); this.marbles.setMatrixAt(i, m4);
    }
    this.marbles.instanceMatrix.needsUpdate = true;
    // Caught marbles dropping into the hole.
    let gi = 0;
    for (let i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].t += dt * 3.2; if (this.ghosts[i].t >= 1) this.ghosts.splice(i, 1); }
    for (const gh of this.ghosts) {
      const t = gh.t, e = t * t;
      p.set(gh.x + (gh.tx - gh.x) * t, gh.y + (gh.ty - gh.y) * e, gh.z + (gh.tz - gh.z) * t);
      const s = 1 - e * 0.7; sc.set(s, s, s); m4.compose(p, q.identity(), sc);
      this.ghostMesh.setMatrixAt(gi, m4); this.ghostMesh.setColorAt(gi, gh.color); gi++;
    }
    sc.set(1, 1, 1);
    this.ghostMesh.count = gi; this.ghostMesh.instanceMatrix.needsUpdate = true;
    if (this.ghostMesh.instanceColor) this.ghostMesh.instanceColor.needsUpdate = true;
    for (const cr of this.catchRings) {
      cr.pulse = Math.max(0, cr.pulse - dt * 2.5);
      const s = 1 + (1 - cr.pulse) * 0.5; cr.mesh.scale.set(s, s, 1);
      (cr.mesh.material as THREE.MeshBasicMaterial).opacity = cr.pulse * 0.7;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

/** A box with softly rounded vertical edges and a small bevel. */
function roundedBox(sx: number, sy: number, sz: number, r: number): THREE.BufferGeometry {
  r = Math.min(r, sx / 2 - 0.001, sz / 2 - 0.001);
  const s = new THREE.Shape(), hx = sx / 2, hz = sz / 2;
  s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.quadraticCurveTo(hx, -hz, hx, -hz + r);
  s.lineTo(hx, hz - r); s.quadraticCurveTo(hx, hz, hx - r, hz); s.lineTo(-hx + r, hz);
  s.quadraticCurveTo(-hx, hz, -hx, hz - r); s.lineTo(-hx, -hz + r); s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
  const bevel = Math.min(0.05, r * 0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: sy - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, -sy / 2 + bevel, 0);
  return g;
}

/** Fine pale lines on white: multiplied over the floor colour, they show how the rubber stretches. */
function gridTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** A glass marble's inside: a pale swirl band across the sphere, tinted by the instance colour. */
function marbleTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#dedede'; g.fillRect(0, 0, 256, 128);
  const grad = g.createLinearGradient(0, 14, 0, 114);
  grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, 30);
  for (let x = 0; x <= 256; x += 8) g.lineTo(x, 30 + Math.sin(x / 256 * Math.PI * 2) * 14);
  for (let x = 256; x >= 0; x -= 8) g.lineTo(x, 98 + Math.sin(x / 256 * Math.PI * 2) * 14);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
