import * as THREE from 'three';
import cloudUrl from '../../assets/turnflock/fx/bump-cloud.webp';
import cloudBallUrl from '../../assets/turnflock/fx/bump-cloud-ball.webp';
import FX from '../../data/fx_bump_cloud.json';

/**
 * The cloud puff where a robot bumps into an obstacle or the rim. Kept from the garden theme when
 * that theme was removed (owner, 2026-11-25; design/themes.md). The owner's cloud picture pops up,
 * swells and rises a little; then it breaks into its balls (copies of the cut ball picture placed on
 * the picture's own balls), which drift apart and shrink away one after the other. With reduced
 * motion it only fades in and out where it is.
 *
 * Every picture is a flat card facing the game camera, pulled a little towards it so it does not
 * cut into the tiles. Tuning: data/fx_bump_cloud.json.
 */

/** The tuning values of the cloud (data/fx_bump_cloud.json). */
export type BumpCloudConfig = typeof FX;

/** Where the clouds are drawn: the board's cell pitch, its floor height and the camera's tilt from straight down (degrees). */
export interface BumpCloudFrame {
  readonly pitch: number;
  readonly floorY: number;
  readonly tilt: number;
}

/** The balls of the owner's cloud picture, measured on the picture: centre (x right, y up) and radius, in picture widths. */
const CLOUD_BALLS = [
  { x: 0.001, y: 0.228, r: 0.232 },
  { x: -0.294, y: -0.059, r: 0.184 },
  { x: 0.273, y: 0.036, r: 0.168 },
  { x: -0.286, y: 0.132, r: 0.128 },
  { x: 0.017, y: -0.012, r: 0.128 },
  { x: -0.071, y: -0.251, r: 0.184 },
  { x: 0.209, y: -0.219, r: 0.147 },
];

const clamp01 = (k: number): number => (k < 0 ? 0 : k > 1 ? 1 : k);
/** Where `t` is between `from` and `to`, as 0..1. */
const span = (t: number, from: number, to: number): number => clamp01((t - from) / Math.max(to - from, 1e-6));
/** Overshoots a little and settles at 1: a pop. */
const easeOutBack = (k: number): number => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
/** Fast start, soft end. */
const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3);
/** Soft start and end. */
const smooth = (k: number): number => k * k * (3 - 2 * k);
/** 0 at the start, 1 from `attack` until `release`, back to 0 at the end of `u` (0..1). */
function envelope(u: number, attack: number, release: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < attack) return smooth(u / attack);
  if (u > release) return smooth((1 - u) / (1 - release));
  return 1;
}

/** How long one puff plays, in seconds. */
export function bumpCloudSeconds(calm: boolean, config: BumpCloudConfig = FX): number {
  return calm ? config.calm_seconds : config.seconds;
}

/** The turn that makes a card in the xy plane face a camera tilted `tilt` degrees from straight down. */
function facing(tilt: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -((90 - tilt) * Math.PI) / 180);
}

/** A card `w` by `h` whose point `anchor` (0..1 from the left, 0..1 from the top) is at its origin. */
function card(w: number, h: number, anchor: readonly number[] = [0.5, 0.5]): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(w, h).translate((0.5 - anchor[0]) * w, (anchor[1] - 0.5) * h, 0);
}

/** The cloud picture and the picture of one of its balls, as textures. */
export interface BumpCloudPictures {
  readonly cloud: THREE.Texture;
  readonly ball: THREE.Texture;
}

/** The two pictures as textures, made once and shared by every board (they are part of the build). */
let textures: BumpCloudPictures | null = null;
function pictures(): BumpCloudPictures {
  if (textures) return textures;
  const loader = new THREE.TextureLoader();
  const load = (url: string): THREE.Texture => {
    const texture = loader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Premultiplied and mipmapped: no dark or light fringe where the picture fades out, at any size.
    texture.premultiplyAlpha = true;
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  };
  textures = { cloud: load(cloudUrl), ball: load(cloudBallUrl) };
  return textures;
}

/** A material for one premultiplied picture; fade it with `fade`. */
function pictureMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

/** How much of a premultiplied picture shows, 0 to 1: colour and alpha scale together. */
function fade(material: THREE.MeshBasicMaterial, k: number): void {
  material.color.setScalar(k);
  material.opacity = k;
}

const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

/** One cloud puff at a point on the board. */
export class BumpCloud {
  readonly group = new THREE.Group();
  /** How long it plays, in seconds. */
  readonly seconds: number;
  private readonly p: number;
  private readonly face: THREE.Quaternion;
  private readonly right = new THREE.Vector3(1, 0, 0);
  private readonly up: THREE.Vector3;
  private readonly base: THREE.Vector3;
  private readonly cloud: THREE.Mesh;
  private readonly cloudMat: THREE.MeshBasicMaterial;
  private readonly balls: THREE.InstancedMesh;
  private readonly ballMat: THREE.MeshBasicMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];

  /** A puff at world `x`, `z`; `calm` is the quiet version for reduced motion. `tex`: the pictures (tests pass their own). */
  constructor(
    frame: BumpCloudFrame,
    x: number,
    z: number,
    readonly calm: boolean,
    private readonly config: BumpCloudConfig = FX,
    tex: BumpCloudPictures = pictures(),
  ) {
    this.p = frame.pitch;
    this.seconds = bumpCloudSeconds(calm, config);
    this.face = facing(frame.tilt);
    this.up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.face);
    const toward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.face);
    this.base = toward.multiplyScalar(config.toward_camera * this.p);
    this.group.position.set(x, frame.floorY, z);
    const w = config.width * this.p;
    this.ballMat = pictureMaterial(tex.ball);
    const ballCard = card(1, 1);
    this.geometries.push(ballCard);
    this.balls = new THREE.InstancedMesh(ballCard, this.ballMat, CLOUD_BALLS.length);
    this.balls.count = calm ? 0 : CLOUD_BALLS.length;
    this.cloudMat = pictureMaterial(tex.cloud);
    const cloudCard = card(w, w * config.aspect, config.anchor);
    this.geometries.push(cloudCard);
    this.cloud = new THREE.Mesh(cloudCard, this.cloudMat);
    this.cloud.quaternion.copy(this.face);
    for (const [mesh, order] of [[this.balls, 5], [this.cloud, 6]] as const) {
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      this.group.add(mesh);
    }
    this.update(0);
  }

  /** Show the puff `t` seconds after it started. */
  update(t: number): void {
    const c = this.config;
    const u = Math.min(t / this.seconds, 1);
    const w = c.width * this.p;
    const lift = c.lift * this.p;
    if (this.calm) {
      this.cloud.position.copy(this.base).addScaledVector(this.up, lift);
      fade(this.cloudMat, envelope(u, 0.3, 0.6));
      return;
    }
    const pop = easeOutBack(span(u, 0, 0.24));
    const swell = 1 + c.grow * 0.5 * easeOut(span(u, 0.1, 0.5));
    const rise = c.rise * this.p * easeOut(u);
    // The whole picture, until it breaks up.
    const whole = 1 - smooth(span(u, 0.4, 0.45));
    this.cloud.position.copy(this.base).addScaledVector(this.up, lift + rise);
    this.cloud.scale.setScalar(Math.max(pop * swell, 0.0001));
    fade(this.cloudMat, whole);
    // Its balls, from the moment it breaks up: they drift away from the middle and shrink.
    const centre = this.cloud.position;
    // The anchor is a little below the picture's centre: the balls are measured from the centre.
    const fromAnchor = (0.5 - c.anchor[1]) * w * c.aspect;
    CLOUD_BALLS.forEach((ball, i) => {
      const apart = easeOut(span(u, 0.4, 1)) * 0.55;
      const order = i / (CLOUD_BALLS.length - 1);
      const shrink = 1 - smooth(span(u, 0.55 + order * 0.15, 0.82 + order * 0.15));
      const shown = u >= 0.4 ? shrink : 0;
      v3.copy(centre)
        .addScaledVector(this.right, ball.x * w * swell * (1 + apart))
        .addScaledVector(this.up, fromAnchor * swell + ball.y * w * swell * (1 + apart) + apart * 0.1 * this.p);
      this.balls.setMatrixAt(i, m4.compose(v3, this.face, s3.setScalar(Math.max(ball.r * 2 * w * swell * shown * c.ball_size, 0.0001))));
    });
    this.balls.instanceMatrix.needsUpdate = true;
  }

  /** Take it off the board and free its geometries and materials (the shared pictures stay). */
  dispose(): void {
    this.group.removeFromParent();
    this.balls.dispose();
    this.cloudMat.dispose();
    this.ballMat.dispose();
    for (const g of this.geometries) g.dispose();
  }
}

/**
 * Every cloud puff on one board: start one with `bump`, move them on with `update` every frame.
 * Finished puffs remove themselves. With `reduced` set, new puffs play their calm version.
 */
export class BumpClouds {
  private playing: { cloud: BumpCloud; time: number }[] = [];
  /** New puffs play their calm version (the device's or the game's Reduce motion). */
  reduced = false;

  /** `textures`: the pictures to draw with; by default the game's own, loaded at the first puff. */
  constructor(
    private readonly parent: THREE.Object3D,
    private readonly frame: BumpCloudFrame,
    private readonly config: BumpCloudConfig = FX,
    private readonly textures?: BumpCloudPictures,
  ) {}

  /** A puff at world `x`, `z`: the point where a robot ran into something. */
  bump(x: number, z: number): BumpCloud {
    const cloud = new BumpCloud(this.frame, x, z, this.reduced, this.config, this.textures ?? pictures());
    this.parent.add(cloud.group);
    this.playing.push({ cloud, time: 0 });
    return cloud;
  }

  /** Move every puff on by `dt` seconds; finished ones are removed. */
  update(dt: number): void {
    for (let i = this.playing.length - 1; i >= 0; i--) {
      const run = this.playing[i];
      run.time += dt;
      if (run.time >= run.cloud.seconds) {
        run.cloud.dispose();
        this.playing.splice(i, 1);
      } else run.cloud.update(run.time);
    }
  }

  /** Puffs still playing. */
  get active(): number {
    return this.playing.length;
  }

  /** Stop every puff at once. */
  dispose(): void {
    for (const run of this.playing) run.cloud.dispose();
    this.playing = [];
  }
}
