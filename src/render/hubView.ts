import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config';
import { buildRobot, type RobotView } from './robot';

/**
 * Beacon Bay in miniature: a pier, the lighthouse and Pip with two friends.
 * `stage` is how far the lighthouse is restored: 0 dark, 1 lamp repaired, 2 lit.
 */
export class HubView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private lampMat: THREE.MeshStandardMaterial;
  private lampGroup = new THREE.Group();
  private beams = new THREE.Group();
  private glow: THREE.Mesh;
  private bots: RobotView[] = [];
  private stage = 0;
  private shown = 0;
  private time = 0;
  private last = 0;
  private running = false;
  private reduced = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const c = CONFIG.colors;
    const mat = (color: string, roughness = 0.7): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness });
    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#CFE6E8', 1.5));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.8);
    sun.position.set(-5, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 5;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
    this.scene.add(sun);

    // Water, island and pier.
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.2, 64), mat('#7FD3DA', 0.35));
    water.position.set(0.5, -0.2, 0.1);
    water.receiveShadow = true;
    const island = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.5, 48), mat('#F1E7D3'));
    island.position.set(-0.9, 0, -0.4);
    island.receiveShadow = true;
    island.castShadow = true;
    const pier = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.3, 1.5, 4, 0.1), mat(c.boardFrame, 0.65));
    pier.position.set(1.7, 0.08, 0.9);
    pier.receiveShadow = true;
    pier.castShadow = true;
    this.scene.add(water, island, pier);
    for (const x of [0.4, 1.3, 2.2, 3.1]) {
      const tile = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.06, 0.8, 3, 0.03), mat(c.tileA));
      tile.position.set(x, 0.25, 0.9);
      tile.receiveShadow = true;
      this.scene.add(tile);
    }

    // Lighthouse: white tower with red bands, gallery, lamp room and cap.
    const house = new THREE.Group();
    house.position.set(-1.1, 0.25, -0.6);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.4, 40), mat('#FBFAF6', 0.5));
    tower.position.y = 1.2;
    tower.castShadow = true;
    house.add(tower);
    for (const [y, r1, r2] of [[0.55, 0.555, 0.6], [1.5, 0.475, 0.52]] as const) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r1 + 0.005, r2 + 0.005, 0.42, 40), mat(c.red, 0.5));
      band.position.y = y;
      house.add(band);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 40), mat(c.ink, 0.6));
    gallery.position.y = 2.46;
    gallery.castShadow = true;
    this.lampMat = new THREE.MeshStandardMaterial({ color: '#8E97A6', roughness: 0.4, emissive: '#FFD12F', emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.46, 24), this.lampMat);
    this.lampGroup.position.y = 2.75;
    this.lampGroup.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.4, 32), mat(c.red, 0.5));
    cap.position.y = 3.18;
    cap.castShadow = true;
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.42, 0.06, 3, 0.05), mat(c.blue, 0.5));
    door.position.set(0.18, 0.22, 0.58);
    door.rotation.y = 0.3;
    house.add(gallery, this.lampGroup, cap, door);
    // Two soft light beams and a halo, shown once the lighthouse is lit.
    const beamMat = new THREE.MeshBasicMaterial({ color: '#FFE78A', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
    for (const dir of [1, -1]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 24, 1, true), beamMat);
      beam.rotation.z = (dir * Math.PI) / 2;
      beam.position.x = dir * -1.7 * -1;
      this.beams.add(beam);
    }
    this.beams.position.y = 2.75;
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshBasicMaterial({ color: '#FFE78A', transparent: true, opacity: 0, depthWrite: false }));
    this.glow.position.y = 2.75;
    house.add(this.beams, this.glow);
    this.scene.add(house);

    // Pip greets the camera; two friends wait on the pier.
    const cast: [Parameters<typeof buildRobot>[1], number, number, number][] = [
      ['red', 0.55, 0.95, 3.63],
      ['blue', 1.9, 0.75, 3.25],
      ['yellow', 2.8, 1.05, 4.0],
    ];
    cast.forEach(([color, x, z, angle], i) => {
      const bot = buildRobot(i, color);
      bot.root.position.set(x, 0.28, z);
      bot.body.rotation.y = angle;
      if (i > 0) bot.root.scale.setScalar(0.86);
      this.bots.push(bot);
      this.scene.add(bot.root);
    });

    this.camera.position.set(6.2, 7.6, 11.6);
    this.camera.lookAt(0.5, 1.0, 0.1);
    this.apply(0);
  }

  /** Reduced motion: no bobbing, no turning beam. */
  setReduced(reduced: boolean): void {
    this.reduced = reduced;
  }

  /** Set how far the lighthouse is restored. With `animate`, it brightens over a moment. */
  setStage(stage: number, animate: boolean): void {
    this.stage = stage;
    if (!animate) {
      this.shown = stage;
      this.apply(stage);
    }
  }

  private apply(level: number): void {
    const repaired = Math.min(Math.max(level, 0), 1);
    const lit = Math.min(Math.max(level - 1, 0), 1);
    this.lampMat.color.set(repaired > 0.5 ? '#FFF3B8' : '#8E97A6');
    this.lampMat.emissiveIntensity = 0.25 * repaired + 1.6 * lit;
    this.lampGroup.rotation.z = (1 - repaired) * 0.35;
    this.lampGroup.position.x = (1 - repaired) * 0.12;
    this.beams.visible = lit > 0.02;
    this.beams.scale.setScalar(Math.max(lit, 0.001));
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.35 * lit;
  }

  /** Match the canvas size. */
  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the scene in frame on tall and wide canvases alike.
    this.camera.fov = Math.min(w / h < 1.15 ? 34 / Math.max(w / h, 0.5) : 30, 56);
    this.camera.updateProjectionMatrix();
  }

  /** Start or stop drawing; the hub only renders while it is on screen. */
  setActive(active: boolean): void {
    if (active === this.running) return;
    this.running = active;
    if (active) {
      this.last = 0;
      this.resize();
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  private frame(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000 || 0, 0.05);
    this.last = now;
    this.time += dt;
    if (this.shown !== this.stage) {
      const speed = 1 / (CONFIG.milestoneTime * 0.6);
      this.shown += Math.sign(this.stage - this.shown) * Math.min(Math.abs(this.stage - this.shown), dt * speed);
      this.apply(this.shown);
    }
    if (!this.reduced) {
      this.beams.rotation.y = this.time * 0.9;
      this.bots.forEach((bot, i) => {
        bot.body.position.y = Math.abs(Math.sin(this.time * 2.2 + i * 1.3)) * (i === 0 ? 0.09 : 0.04);
      });
    }
    for (const bot of this.bots) {
      bot.blinkIn -= dt;
      const closed = bot.blinkIn < 0.11;
      for (const lid of bot.lids) lid.visible = closed;
      if (bot.blinkIn < 0) bot.blinkIn = 2.2 + bot.id * 0.7;
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }
}
