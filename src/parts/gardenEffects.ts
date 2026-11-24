import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import { planCelebration } from '../game/celebration';
import type { CelebrationStage } from '../render/celebration';
import { GardenCelebrationFx } from '../render/parts/garden/celebration';
import { GardenFxAssets, type GardenFx } from '../render/parts/garden/effects';
import { PICTURE_URLS, type PictureName } from '../render/parts/garden/pictures';
import { GardenEffects, type GardenFxLook } from '../render/parts/garden/gardenEffects';
import { GARDEN_FX_KINDS, GARDEN_FX_NAMES, fxSeconds, planGardenCelebration, type GardenFxKind } from '../render/parts/garden/effectsPlan';
import sheetPicture from '../../design/reference/turnflock/garden/21-sheet-effects.png';
import './gardenEffects.css';

/**
 * The garden effects section of the parts sheet: each effect on its own with a play button, the
 * calm version, frames over time, the sheet picture beside them, the garden celebration on the
 * largest board, and a load test. The lawn under the effects is a plain stand-in: the garden
 * board is another session's part.
 */

const PITCH = 1 + CONFIG.board.grid.gap;
const TILT = CONFIG.board.roomy.tilt;
const LAWN = { top: '#8BCB4F', alt: '#80C247', side: '#5E9E33', rock: '#A9A8B4' };

/** The device asks for less motion. */
const prefersCalm = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A lit scene like the game's: sky and ground light, a sun, soft reflections. */
function gardenScene(renderer: THREE.WebGLRenderer): THREE.Scene {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = CONFIG.light.reflections;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
  const sun = new THREE.DirectionalLight('#FFFFFF', CONFIG.light.sun);
  sun.position.set(-4.5, 9, 3.5);
  scene.add(sun);
  return scene;
}

/** A stand-in lawn of `cols` by `rows` grass tiles, top face at y = 0, with stand-in rocks on `rocks` (cell indices). */
function lawn(cols: number, rows: number, rocks: number[] = []): THREE.Group {
  const group = new THREE.Group();
  const tile = new THREE.BoxGeometry(1, 0.2, 1).translate(0, -0.1, 0);
  const top = new THREE.MeshStandardMaterial({ color: LAWN.top, roughness: 0.9 });
  const alt = new THREE.MeshStandardMaterial({ color: LAWN.alt, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(cols * PITCH + 0.2, 0.24, rows * PITCH + 0.2).translate(0, -0.14, 0), new THREE.MeshStandardMaterial({ color: LAWN.side, roughness: 1 }));
  group.add(base);
  const rock = new THREE.SphereGeometry(0.36, 24, 14).scale(1, 0.7, 0.9).translate(0, 0.18, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: LAWN.rock, roughness: 0.8 });
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const m = new THREE.Mesh(tile, (x + y) % 2 ? alt : top);
      m.position.set(cellX(x, cols), 0, cellZ(y, rows));
      group.add(m);
      if (rocks.includes(y * cols + x)) {
        const r = new THREE.Mesh(rock, rockMat);
        r.position.copy(m.position);
        group.add(r);
      }
    }
  return group;
}

const cellX = (x: number, cols: number): number => (x - (cols - 1) / 2) * PITCH;
const cellZ = (y: number, rows: number): number => (y - (rows - 1) / 2) * PITCH;

/** A perspective camera like the game's: tilted `TILT` degrees from straight down, framing `span` world units. */
function gameCamera(aspect: number, span: number, lookY = 0.3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, 0.1, 200);
  const fit = span / 2 / Math.tan(((CONFIG.camera.fov / 2) * Math.PI) / 180) / Math.min(aspect, 1);
  const dir = new THREE.Vector3(0, Math.cos((TILT * Math.PI) / 180), Math.sin((TILT * Math.PI) / 180));
  camera.position.copy(dir.multiplyScalar(fit * 1.08)).add(new THREE.Vector3(0, lookY, 0));
  camera.lookAt(0, lookY, 0);
  return camera;
}

/** One live 3D view with its own loop, which runs only while something plays. */
class LiveView {
  readonly canvas = document.createElement('canvas');
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly board = new THREE.Group();
  readonly effects: GardenEffects;
  celebration: GardenCelebrationFx | null = null;
  private last = 0;
  private running = false;
  /** Keep drawing until this time even with nothing playing (to measure the bare board). */
  holdUntil = 0;
  /** Time stands still: the effects stay where they are, to look at them closely. */
  paused = false;
  /** Seconds to move on at the next frame while paused (the Step button). */
  pendingStep = 0;
  /** Frames drawn and their times, for the frame-rate readout. */
  frames: number[] = [];
  /** Highest draw calls and triangles of one frame since the last `resetPeak`. */
  peak = { calls: 0, triangles: 0, particles: 0, updateMs: 0 };
  /** Time spent moving the effects on, all frames together, in ms. */
  updateTotal = 0;
  onFrame: (() => void) | null = null;

  constructor(width: number, height: number, span: number, readonly cols: number, readonly rows: number, rocks: number[] = [], lookY = 0.3) {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.scene = gardenScene(this.renderer);
    this.camera = gameCamera(width / height, span, lookY);
    this.board.add(lawn(cols, rows, rocks));
    this.scene.add(this.board);
    this.effects = new GardenEffects(this.board, { pitch: PITCH, floorY: 0 });
    // Start loading the pictures now, so the first effect played has them.
    void this.effects.assets.pictures.ready;
    this.draw();
  }

  /** Make sure the loop runs. */
  wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.tick(t));
  }

  resetPeak(): void {
    this.peak = { calls: 0, triangles: 0, particles: 0, updateMs: 0 };
    this.frames = [];
    this.updateTotal = 0;
  }

  private tick(now: number): void {
    const dt = this.paused ? this.pendingStep : Math.min((now - this.last) / 1000, 0.05);
    this.pendingStep = 0;
    this.last = now;
    const before = performance.now();
    this.effects.update(dt);
    if (this.celebration && !this.celebration.update(dt)) {
      this.celebration.dispose();
      this.celebration = null;
    }
    const spent = performance.now() - before;
    this.updateTotal += spent;
    this.draw();
    this.frames.push(now);
    const particles = this.effects.cost.particles + (this.celebration?.cost.particles ?? 0);
    const { calls, triangles } = this.renderer.info.render;
    this.peak = { calls: Math.max(this.peak.calls, calls), triangles: Math.max(this.peak.triangles, triangles), particles: Math.max(this.peak.particles, particles), updateMs: Math.max(this.peak.updateMs, spent) };
    this.onFrame?.();
    if (this.effects.active.length || this.celebration || now < this.holdUntil) requestAnimationFrame((t) => this.tick(t));
    else this.running = false;
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

/** Draws still frames of an effect at chosen moments, with one shared renderer. */
class StillPainter {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  private scene = gardenScene(this.renderer);
  private board = new THREE.Group();
  readonly assets = new GardenFxAssets();

  constructor(private size: number) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.board.add(lawn(3, 3));
    this.scene.add(this.board);
  }

  /** The effect `kind` at `t` seconds, seen with `camera`, as a canvas. */
  frame(kind: GardenFxKind, t: number, calm: boolean, camera: THREE.Camera, at: { x: number; z: number } = { x: 0, z: 0 }, look: GardenFxLook = 'picture'): HTMLCanvasElement {
    const effects = new GardenEffects(this.board, { pitch: PITCH, floorY: 0 }, this.assets, look);
    const fx: GardenFx = effects.play(kind, at.x, at.z, { calm });
    fx.update(t);
    this.renderer.render(this.scene, camera);
    effects.clear();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = this.size;
    canvas.getContext('2d')!.drawImage(this.renderer.domElement, 0, 0);
    return canvas;
  }
}

function button(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `gfx-btn ${extra}`;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** A button that stops and restarts time in a live view. */
function pauseButton(view: LiveView): HTMLButtonElement {
  const b = button('Pauze', () => {
    view.paused = !view.paused;
    b.setAttribute('aria-pressed', String(view.paused));
    b.textContent = view.paused ? 'Verder' : 'Pauze';
    view.wake();
  }, 'gfx-pause');
  b.setAttribute('aria-pressed', 'false');
  return b;
}

/** Switch a live view between the owner's pictures (standard) and the code-built effects. */
function lookButton(view: LiveView): HTMLButtonElement {
  const label = (): string => (view.effects.look === 'picture' ? 'Uiterlijk: beeld' : 'Uiterlijk: code');
  const b = button(label(), () => {
    view.effects.clear();
    view.effects.look = view.effects.look === 'picture' ? 'code' : 'picture';
    b.textContent = label();
    b.setAttribute('aria-pressed', String(view.effects.look === 'code'));
  }, 'gfx-look');
  b.setAttribute('aria-pressed', 'false');
  return b;
}

/** While paused: move time on by one twentieth of a second. */
function stepButton(view: LiveView): HTMLButtonElement {
  return button('Stap ⅟₂₀ s', () => {
    view.pendingStep += 0.05;
    view.wake();
  }, 'gfx-step');
}

function section(id: string, title: string, intro: string): HTMLElement {
  const el = document.createElement('section');
  el.className = 'card wide gfx';
  el.id = id;
  el.innerHTML = `<h2>${title}</h2><p class="dims">${intro}</p>`;
  return el;
}

/** Where each effect goes on the 3x3 lawn when they play together; the cloud sits against the rock. */
const SPOTS: Record<GardenFxKind, { x: number; z: number }> = {
  beam: { x: cellX(0, 3), z: cellZ(0, 3) },
  stars: { x: cellX(2, 3), z: cellZ(0, 3) },
  cloud: { x: cellX(1, 3) + PITCH * 0.5, z: cellZ(2, 3) },
  ring: { x: cellX(0, 3), z: cellZ(2, 3) },
};

/** The effects one by one, live, with buttons. */
function playCard(sheet: HTMLElement): void {
  const el = section('garden-fx-play', 'Tuineffecten · afspelen', 'Onder de spelcamera (30° gekanteld, perspectief) op een tijdelijk grasveldje. Elke knop speelt één effect; "Rustig" speelt de versie voor minder beweging (staat aan als het toestel daarom vraagt).');
  const view = new LiveView(720, 540, 3.3 * PITCH, 3, 3, [2 * 3 + 2]);
  view.canvas.className = 'gfx-live';
  let calm = prefersCalm();
  const readout = document.createElement('p');
  readout.className = 'gfx-readout';
  const show = (): void => {
    const c = view.effects.cost;
    readout.textContent = `spelend: ${view.effects.active.length} · deeltjes ${c.particles} · tekenopdrachten nu ${view.renderer.info.render.calls} (waarvan grasveld ${view.board.children[0].children.length}) · driehoeken ${view.renderer.info.render.triangles.toLocaleString('nl')}`;
  };
  view.onFrame = show;
  const play = (kind: GardenFxKind, at = { x: 0, z: 0 }): void => {
    view.effects.play(kind, kind === 'cloud' && at.x === 0 ? SPOTS.cloud.x : at.x, kind === 'cloud' && at.x === 0 ? SPOTS.cloud.z : at.z, { calm });
    view.wake();
  };
  const bar = document.createElement('div');
  bar.className = 'gfx-bar';
  for (const kind of GARDEN_FX_KINDS) bar.appendChild(button(GARDEN_FX_NAMES[kind], () => play(kind), `gfx-${kind}`));
  bar.appendChild(button('Alle vier', () => GARDEN_FX_KINDS.forEach((k) => play(k, SPOTS[k])), 'gfx-all'));
  const calmBtn = button('', () => {
    calm = !calm;
    calmBtn.setAttribute('aria-pressed', String(calm));
    calmBtn.textContent = calm ? 'Rustig: aan' : 'Rustig: uit';
  }, 'gfx-calm');
  calmBtn.setAttribute('aria-pressed', String(calm));
  calmBtn.textContent = calm ? 'Rustig: aan' : 'Rustig: uit';
  bar.appendChild(calmBtn);
  bar.appendChild(pauseButton(view));
  bar.appendChild(stepButton(view));
  bar.appendChild(lookButton(view));
  const lengths = document.createElement('p');
  lengths.className = 'note';
  lengths.textContent = 'Lengte: ' + GARDEN_FX_KINDS.map((k) => `${GARDEN_FX_NAMES[k].toLowerCase()} ${fxSeconds(k, false)} s (rustig ${fxSeconds(k, true)} s)`).join(' · ') + '.';
  el.append(bar, view.canvas, readout, lengths);
  sheet.appendChild(el);
  show();
}

/** Where each cut picture sits on the sheet, in sheet pixels (as in tools/asset-pipeline/cut-garden-effects.py). */
const CUTS: Record<PictureName, { box: [number, number, number, number]; label: string }> = {
  beam: { box: [0, 3, 64, 72], label: 'Straal' },
  star: { box: [66, 32, 99, 66], label: 'Ster (één)' },
  twinkle: { box: [96, 9, 109, 23], label: 'Twinkeling' },
  cloud: { box: [119, 6, 175, 66], label: 'Wolkje' },
  cloudBall: { box: [133, 38, 157, 62], label: 'Wolkbolletje (één)' },
  ring: { box: [176, 4, 242, 72], label: 'Blauwe ring' },
};

/** The part of the sheet a cut came from, enlarged to `w` by `h`, as a canvas. */
function sheetCrop(sheet: HTMLImageElement, box: [number, number, number, number], w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, box[0], box[1], box[2] - box[0], box[3] - box[1], 0, 0, w, h);
  return c;
}

/** The cut pictures beside the sheet, and the effects at their fullest beside it. */
async function compareCard(el: HTMLElement, painter: StillPainter): Promise<void> {
  const img = document.createElement('img');
  img.src = sheetPicture;
  img.alt = 'Voorbeeld: groene lichtstraal, sterren, wolkje, blauwe ring';
  img.className = 'gfx-sheet';
  await img.decode().catch(() => undefined);
  el.appendChild(img);
  // Each cut picture: the original crop of the sheet, the WebP on white, the WebP on the lawn.
  const cuts = document.createElement('div');
  cuts.className = 'gfx-cuts';
  let total = 0;
  for (const name of Object.keys(CUTS) as PictureName[]) {
    const cut = CUTS[name];
    const url = PICTURE_URLS[name];
    const bytes = (await (await fetch(url)).blob()).size;
    total += bytes;
    const pic = new Image();
    pic.src = url;
    await pic.decode().catch(() => undefined);
    const fig = document.createElement('figure');
    fig.className = 'gfx-cut';
    const w = pic.naturalWidth;
    const h = pic.naturalHeight;
    const pair = document.createElement('div');
    pair.className = 'gfx-pair';
    const original = sheetCrop(img, cut.box, w, h);
    const onWhite = pic.cloneNode() as HTMLImageElement;
    onWhite.className = 'on-white';
    const onLawn = pic.cloneNode() as HTMLImageElement;
    onLawn.className = 'on-lawn';
    pair.append(original, onWhite, onLawn);
    fig.appendChild(pair);
    fig.insertAdjacentHTML('beforeend', `<figcaption>${cut.label}: ${w}×${h} px, ${(bytes / 1024).toFixed(1)} kB</figcaption>`);
    cuts.appendChild(fig);
  }
  const sum = document.createElement('p');
  sum.className = 'note';
  sum.textContent = `Per stuk: links het origineel (uitsnede van het voorbeeld, vergroot), midden de WebP op wit, rechts de WebP op gras. Samen ${(total / 1024).toFixed(1)} kB. Het voorbeeld is klein (elk effect ± 60 px); de WebP's zijn 4× vergroot met een nette rand, maar meer detail dan het voorbeeld hebben ze niet.`;
  el.append(cuts, sum);
  // The effects at their fullest, from close by and a little lower than the game's camera, as on the sheet.
  const peak: Record<GardenFxKind, number> = { beam: 0.45, stars: 0.5, cloud: 0.25, ring: 0.45 };
  for (const look of ['picture', 'code'] as const) {
    const row = document.createElement('div');
    row.className = 'gfx-row four';
    for (const kind of GARDEN_FX_KINDS) {
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const lookY = kind === 'beam' ? 0.45 : kind === 'stars' ? 0.75 : kind === 'cloud' ? 0.4 : 0.1;
      const elevation = kind === 'ring' ? 42 : 30;
      const dist = kind === 'beam' ? 3.6 : kind === 'stars' ? 3.6 : kind === 'cloud' ? 2.8 : 2.9;
      camera.position.set(0, lookY + Math.sin((elevation * Math.PI) / 180) * dist, Math.cos((elevation * Math.PI) / 180) * dist);
      camera.lookAt(0, lookY, 0);
      const fig = document.createElement('figure');
      fig.appendChild(painter.frame(kind, peak[kind] * fxSeconds(kind, false), false, camera, { x: 0, z: 0 }, look));
      fig.insertAdjacentHTML('beforeend', `<figcaption>${GARDEN_FX_NAMES[kind]} · ${look === 'picture' ? 'beeld (standaard)' : 'code-versie'}</figcaption>`);
      row.appendChild(fig);
    }
    el.appendChild(row);
  }
}

/** Frames over time for each effect, lively and calm, under the game camera. */
function timelineCard(el: HTMLElement, painter: StillPainter): void {
  const camera = gameCamera(1, 1.9 * PITCH, 0.45);
  const variants: { calm: boolean; look: GardenFxLook; label: string }[] = [
    { calm: false, look: 'picture', label: '' },
    { calm: true, look: 'picture', label: ' · rustig' },
    { calm: false, look: 'code', label: ' · code-versie' },
  ];
  for (const kind of GARDEN_FX_KINDS) {
    for (const { calm, look, label } of variants) {
      const seconds = fxSeconds(kind, calm);
      const row = document.createElement('div');
      row.className = 'gfx-strip';
      row.id = `garden-fx-strip-${kind}${calm ? '-calm' : ''}${look === 'code' ? '-code' : ''}`;
      row.insertAdjacentHTML('beforeend', `<h3>${GARDEN_FX_NAMES[kind]}${label}</h3>`);
      const frames = document.createElement('div');
      frames.className = 'gfx-frames';
      for (let i = 0; i < 7; i++) {
        const t = (i / 6) * seconds * 0.97;
        const fig = document.createElement('figure');
        fig.appendChild(painter.frame(kind, t, calm, camera, kind === 'cloud' ? { x: 0, z: 0.3 } : { x: 0, z: 0 }, look));
        fig.insertAdjacentHTML('beforeend', `<figcaption>${t.toFixed(2)} s</figcaption>`);
        frames.appendChild(fig);
      }
      row.appendChild(frames);
      el.appendChild(row);
    }
  }
}

const BIG = { cols: 8, rows: 8, exitX: 6, exitY: 1, rocks: [2 * 8 + 3, 4 * 8 + 1, 5 * 8 + 5, 6 * 8 + 2, 3 * 8 + 6] };

/** A celebration stage on the stand-in 8x8 lawn of a live view. */
function stageOf(view: LiveView): CelebrationStage {
  const walls = Array.from({ length: BIG.cols * BIG.rows }, (_, i) => BIG.rocks.includes(i));
  return {
    group: view.board,
    width: BIG.cols,
    height: BIG.rows,
    walls,
    exitX: BIG.exitX,
    exitY: BIG.exitY,
    cellX: (x) => cellX(x, BIG.cols),
    cellZ: (y) => cellZ(y, BIG.rows),
    pitch: PITCH,
    floorY: 0,
    robots: [],
    settle: 0,
    pulseExit: () => {},
    burst: () => {},
  };
}

/** The garden celebration on the largest board, and the load test. */
function celebrationCard(sheet: HTMLElement): void {
  const el = section('garden-fx-celebration', 'Tuinviering · grootste bord (8×8)', 'De viering bij het halen van een level, met de tuineffecten in plaats van de robotconfetti. Kies het aantal sterren; "Rustig" speelt de versie voor minder beweging. Telefoonformaat 390×520 px onder de spelcamera.');
  const view = new LiveView(390, 520, BIG.cols * PITCH + 0.6, BIG.cols, BIG.rows, BIG.rocks, 0.2);
  view.canvas.className = 'gfx-live phone';
  let calm = prefersCalm();
  const readout = document.createElement('p');
  readout.className = 'gfx-readout';
  const stage = stageOf(view);
  const celebrate = (stars: 1 | 2 | 3): void => {
    view.celebration?.dispose();
    const robotPlan = planCelebration({ variant: 'confetti', stars, reduced: calm, muted: true });
    const plan = planGardenCelebration({ variant: robotPlan.variant, stars, reduced: calm, muted: true });
    view.celebration = new GardenCelebrationFx(stage, plan, view.effects.assets, view.effects.look);
    readout.textContent = `${stars} ster${stars > 1 ? 'ren' : ''}${calm ? ', rustig' : ''}: ${plan.seconds} s, pop-up na ${plan.cardDelay} s`;
    view.wake();
  };
  const bar = document.createElement('div');
  bar.className = 'gfx-bar';
  ([1, 2, 3] as const).forEach((n) => bar.appendChild(button(`${n} ster${n > 1 ? 'ren' : ''}`, () => celebrate(n), `gfx-stars-${n}`)));
  const calmBtn = button(calm ? 'Rustig: aan' : 'Rustig: uit', () => {
    calm = !calm;
    calmBtn.setAttribute('aria-pressed', String(calm));
    calmBtn.textContent = calm ? 'Rustig: aan' : 'Rustig: uit';
  }, 'gfx-calm');
  calmBtn.setAttribute('aria-pressed', String(calm));
  bar.appendChild(calmBtn);
  bar.appendChild(pauseButton(view));
  bar.appendChild(stepButton(view));
  bar.appendChild(lookButton(view));

  // Load test, in three parts of two seconds: the bare board; the busiest moment play can bring
  // (twelve chicks bump at once, four reach the exit, four star bursts); then that moment again
  // with the three-star celebration on top.
  const stress = document.createElement('p');
  // Measured with the look the view has (the pictures unless switched).
  stress.className = 'gfx-readout gfx-stress';
  const measure = (ms: number, start: () => void): Promise<{ fps: number; calls: number; triangles: number; particles: number; updateMs: number; updateAvg: number }> =>
    new Promise((done) => {
      view.resetPeak();
      start();
      view.holdUntil = performance.now() + ms;
      view.wake();
      setTimeout(() => {
        const f = view.frames;
        const fps = f.length > 1 ? ((f.length - 1) * 1000) / (f[f.length - 1] - f[0]) : 0;
        done({ fps: Math.round(fps * 10) / 10, ...view.peak, updateMs: Math.round(view.peak.updateMs * 100) / 100, updateAvg: Math.round((view.updateTotal / Math.max(f.length, 1)) * 100) / 100 });
      }, ms + 50);
    });
  const busiest = (): void => {
    for (let i = 0; i < 12; i++) view.effects.play('cloud', cellX(i % 8, BIG.cols) + PITCH * 0.5, cellZ(2 + Math.floor(i / 8) * 3, BIG.rows));
    for (let i = 0; i < 4; i++) view.effects.play('beam', cellX(i * 2, BIG.cols), cellZ(6, BIG.rows));
    for (let i = 0; i < 4; i++) view.effects.play('stars', cellX(i * 2 + 1, BIG.cols), cellZ(4, BIG.rows));
  };
  const runStress = async (): Promise<void> => {
    view.celebration?.dispose();
    view.celebration = null;
    view.effects.clear();
    stress.textContent = 'Bezig met meten…';
    const bare = await measure(2000, () => {});
    const busy = await measure(2000, () => {
      busiest();
      setTimeout(busiest, 700);
      setTimeout(busiest, 1400);
    });
    const all = await measure(2000, () => {
      busiest();
      view.celebration = new GardenCelebrationFx(stage, planGardenCelebration({ variant: 'confetti', stars: 3, reduced: false, muted: true }), view.effects.assets, view.effects.look);
      setTimeout(busiest, 900);
    });
    const result = { look: view.effects.look, bare, busy, all, pixels: `${view.canvas.width}x${view.canvas.height}` };
    (window as unknown as { __gardenFxStress?: typeof result }).__gardenFxStress = result;
    const line = (name: string, r: typeof bare): string => `${name}: ${r.fps} beelden/s, ${r.calls} tekenopdrachten, ${r.triangles.toLocaleString('nl')} driehoeken, ${r.particles} deeltjes, bijwerken gem. ${r.updateAvg} ms (hoogst ${r.updateMs} ms) per beeld`;
    stress.innerHTML = [`Belastingtest (uiterlijk: ${result.look === 'picture' ? 'beeld' : 'code'}) op ${result.pixels} pixels in deze browser:`, line('kaal bord', bare), line('drukste spelmoment (3 stappen na elkaar: 12 kuikens botsen, 4 bij de uitgang, 4× sterren)', busy), line('idem + viering met 3 sterren', all)].join('<br>');
  };
  bar.appendChild(button('Belastingtest', () => void runStress(), 'gfx-stress-btn'));
  el.append(bar, view.canvas, readout, stress);
  sheet.appendChild(el);
}

/** Frames over time of the celebration, one star and three stars, on the phone-size board. */
function celebrationStripCard(el: HTMLElement, assets: GardenFxAssets): void {
  const view = new LiveView(390, 520, BIG.cols * PITCH + 0.6, BIG.cols, BIG.rows, BIG.rocks, 0.2);
  view.renderer.setPixelRatio(2);
  view.renderer.setSize(260, 346);
  const stage = stageOf(view);
  const cases: { label: string; stars: 1 | 3; calm: boolean }[] = [
    { label: '1 ster', stars: 1, calm: false },
    { label: '3 sterren', stars: 3, calm: false },
    { label: 'Rustig', stars: 3, calm: true },
  ];
  for (const c of cases) {
    const plan = planGardenCelebration({ variant: 'confetti', stars: c.stars, reduced: c.calm, muted: true });
    const row = document.createElement('div');
    row.className = 'gfx-strip';
    row.insertAdjacentHTML('beforeend', `<h3>${c.label} · ${plan.seconds} s</h3>`);
    const frames = document.createElement('div');
    frames.className = 'gfx-frames six';
    const fx = new GardenCelebrationFx(stage, plan, assets, 'picture');
    let t = 0;
    for (let i = 0; i < 6; i++) {
      const target = (i / 5) * plan.seconds * 0.97;
      // Small steps, as the game's frames would be.
      while (t < target - 1e-6) {
        const dt = Math.min(1 / 60, target - t);
        fx.update(dt);
        t += dt;
      }
      view.draw();
      const canvas = document.createElement('canvas');
      canvas.width = view.canvas.width;
      canvas.height = view.canvas.height;
      canvas.getContext('2d')!.drawImage(view.canvas, 0, 0);
      const fig = document.createElement('figure');
      fig.appendChild(canvas);
      fig.insertAdjacentHTML('beforeend', `<figcaption>${target.toFixed(2)} s</figcaption>`);
      frames.appendChild(fig);
    }
    fx.dispose();
    row.appendChild(frames);
    el.appendChild(row);
  }
  view.renderer.dispose();
}

/**
 * Add the garden effects section to the parts sheet. The live cards come at once; the cards of
 * still frames fill in once the pictures have loaded, and then `data-garden-ready` is set on the
 * body (for the evidence script).
 */
export function addGardenEffectCards(sheet: HTMLElement): void {
  const head = document.createElement('h2');
  head.className = 'gfx-head';
  head.id = 'garden-effects';
  head.textContent = 'Tuinthema · effecten';
  sheet.appendChild(head);
  playCard(sheet);
  const compare = section('garden-fx-compare', 'Tuineffecten · beelden van de eigenaar', 'De effecten zijn de beelden uit het voorbeeld (21-sheet-effects), uitgesneden met een doorzichtige achtergrond. Onderaan de effecten op hun volste moment: met de beelden (standaard) en, ter vergelijking, de eerdere code-versie.');
  const timeline = section('garden-fx-timeline', 'Tuineffecten · verloop', 'Elk effect in zeven beelden van begin tot eind, onder de spelcamera op één tegel: met de beelden, de rustige versie, en de code-versie.');
  sheet.append(compare, timeline);
  celebrationCard(sheet);
  const strip = section('garden-fx-celebration-strip', 'Tuinviering · verloop', 'De viering in zes beelden, met één ster, met drie sterren en rustig. Telefoonformaat, spelcamera, met de beelden.');
  sheet.appendChild(strip);
  const painter = new StillPainter(480);
  void painter.assets.pictures.ready.then(async () => {
    await compareCard(compare, painter);
    timelineCard(timeline, painter);
    celebrationStripCard(strip, painter.assets);
    document.body.dataset.gardenReady = 'true';
  });
}
