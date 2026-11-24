import * as THREE from 'three';
import { Piece, type FxCost, type FxFrame, type FxOptions, type GardenFxAssets } from './effects';
import { easeOut, easeOutBack, envelope, fxSeconds, randomSource, smooth, span, starSpots } from './effectsPlan';
import { fadePicture, pictureMaterial } from './pictures';

/**
 * The garden effects made from the owner's own pictures (assets/turnflock/garden/effects/), the
 * standard look. Every picture is a flat card that faces the game camera (a billboard), moved
 * by scaling, fading, turning and rising. The blue ring lies flat on the board instead, so it
 * can really turn. Nothing is drawn in code: the sparks and the closing flash reuse the twinkle
 * picture.
 *
 * Cards are pulled `pictures.lift` cells towards the camera: seen from the camera they still sit
 * on their cell, but they do not cut into the tiles.
 */

const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const qz = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

/** A card `w` by `h` whose point `anchor` (0..1 from the left, 0..1 from the top) is at its origin. */
function card(w: number, h: number, anchor: readonly number[] = [0.5, 0.5]): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(w, h).translate((0.5 - anchor[0]) * w, (anchor[1] - 0.5) * h, 0);
}

/** Base of the picture effects: cards lifted towards the camera, their own geometries. */
abstract class PicturePiece extends Piece {
  protected geometries: THREE.BufferGeometry[] = [];
  /** Where a card's anchor goes: the cell, pulled towards the camera. */
  protected readonly base: THREE.Vector3;

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions) {
    super(assets, frame, x, z, 0, options);
    this.base = this.toward.clone().multiplyScalar(assets.config.pictures.lift * this.p);
  }

  protected geometry<G extends THREE.BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }

  protected picture(name: keyof GardenFxAssets['pictures']['textures']): THREE.MeshBasicMaterial {
    return this.material(pictureMaterial(this.assets.pictures.textures[name]));
  }

  dispose(): void {
    super.dispose();
    for (const g of this.geometries) g.dispose();
  }
}

/**
 * The green beam: the owner's picture of a ring with a column of light. It snaps open (wider
 * than tall), the column stretches up, flickers a little while sparks rise through it, then it
 * narrows and fades.
 */
export class PictureBeamFx extends PicturePiece {
  readonly kind = 'beam' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private sparks: THREE.InstancedMesh;
  private sparkPlan: { x: number; born: number; speed: number; size: number }[] = [];

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, options);
    const b = assets.config.pictures.beam;
    this.seconds = fxSeconds('beam', this.calm, assets.config);
    const w = b.width * this.p;
    this.beamMat = this.picture('beam');
    this.beam = this.add(new THREE.Mesh(this.geometry(card(w, w * b.aspect, b.anchor)), this.beamMat), 5);
    this.beam.position.copy(this.base);
    this.beam.quaternion.copy(this.face);
    const random = randomSource(5);
    const count = this.calm ? 0 : b.sparks;
    for (let i = 0; i < count; i++) this.sparkPlan.push({ x: (random() - 0.5) * 0.6, born: 0.12 + random() * 0.45, speed: 0.6 + random() * 0.5, size: 0.7 + random() * 0.6 });
    this.sparks = this.add(new THREE.InstancedMesh(this.geometry(card(1, 1)), this.picture('twinkle'), Math.max(count, 1)), 6);
    this.sparks.count = count;
    this.cost = { drawCalls: count ? 2 : 1, particles: count, triangles: 2 + count * 2 };
  }

  update(t: number): void {
    const b = this.assets.config.pictures.beam;
    const u = Math.min(t / this.seconds, 1);
    if (this.calm) {
      // Quiet: the picture fades in and out where it is.
      fadePicture(this.beamMat, envelope(u, 0.3, 0.6));
      return;
    }
    const open = easeOutBack(span(u, 0, 0.2));
    const rise = easeOut(span(u, 0.04, 0.4));
    const narrow = 1 - 0.25 * smooth(span(u, 0.6, 1));
    const flicker = 1 + 0.03 * Math.sin(t * 31) * envelope(u, 0.2, 0.7);
    this.beam.scale.set(Math.max(open * narrow * flicker, 0.0001), Math.max(open * (0.4 + 0.6 * rise) * (1 + b.stretch * smooth(span(u, 0.3, 0.75))), 0.0001), 1);
    fadePicture(this.beamMat, 1 - smooth(span(u, 0.62, 1)));
    // Sparks: twinkles drift up through the column and wink out.
    const w = b.width * this.p;
    this.sparkPlan.forEach((s, i) => {
      const age = (u - s.born) / 0.42;
      const size = age > 0 && age < 1 ? Math.sin(Math.PI * age) * b.sparkSize * s.size * this.p : 0.0001;
      v3.copy(this.base).addScaledVector(this.right, s.x * w).addScaledVector(this.up, age * w * 0.9 * s.speed).addScaledVector(this.toward, 0.02 * this.p);
      q4.copy(this.face).multiply(qz.setFromAxisAngle(Z, age * 1.5));
      this.sparks.setMatrixAt(i, m4.compose(v3, q4, s3.setScalar(size)));
    });
    this.sparks.instanceMatrix.needsUpdate = true;
  }
}

/**
 * The star sparkle: copies of the owner's star picture pop out of a point, fly apart in a loose
 * triangle, wobble and rise, with twinkles round them; then they shrink away.
 */
export class PictureStarsFx extends PicturePiece {
  readonly kind = 'stars' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private stars: THREE.InstancedMesh;
  private starMat: THREE.MeshBasicMaterial;
  private twinkles: THREE.InstancedMesh;
  private twinkleMat: THREE.MeshBasicMaterial;
  private spots: ReturnType<typeof starSpots>;
  private twinklePlan: { x: number; y: number; at: number; size: number }[] = [];

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, options);
    const s = assets.config.stars;
    const pic = assets.config.pictures.star;
    this.seconds = fxSeconds('stars', this.calm, assets.config);
    this.spots = starSpots(options.count ?? s.count);
    this.starMat = this.picture('star');
    this.stars = this.add(new THREE.InstancedMesh(this.geometry(card(1, pic.aspect)), this.starMat, this.spots.length), 6);
    const random = randomSource(9);
    for (let i = 0; i < s.twinkles; i++) {
      const a = (i / s.twinkles) * Math.PI * 2 + 0.6;
      this.twinklePlan.push({ x: Math.cos(a) * (0.75 + random() * 0.35), y: 0.7 + Math.sin(a) * (0.6 + random() * 0.3), at: 0.12 + random() * 0.4, size: 0.7 + random() * 0.5 });
    }
    this.twinkleMat = this.picture('twinkle');
    this.twinkles = this.add(new THREE.InstancedMesh(this.geometry(card(1, 1)), this.twinkleMat, s.twinkles), 7);
    this.cost = { drawCalls: 2, particles: this.spots.length + s.twinkles, triangles: (this.spots.length + s.twinkles) * 2 };
  }

  update(t: number): void {
    const s = this.assets.config.stars;
    const pic = this.assets.config.pictures.star;
    const u = Math.min(t / this.seconds, 1);
    const size = pic.size * this.p;
    const spread = pic.spread * this.p;
    const lift = pic.lift * this.p;
    if (this.calm) {
      const k = envelope(u, 0.3, 0.65);
      fadePicture(this.starMat, k);
      fadePicture(this.twinkleMat, k);
    } else {
      fadePicture(this.starMat, 1);
      fadePicture(this.twinkleMat, 1);
    }
    this.spots.forEach((spot, i) => {
      let pop = 1;
      let fly = 1;
      let gone = 1;
      let wobble = 0;
      let rise = 0;
      if (!this.calm) {
        const at = (t - spot.delay) / this.seconds;
        pop = easeOutBack(span(at, 0, 0.24));
        fly = easeOut(span(at, 0, 0.42));
        gone = 1 - smooth(span(u, 0.72 + spot.delay * 0.3, 0.97));
        wobble = ((s.wobble * Math.PI) / 180) * Math.sin(t * 9 + i * 2) * (1 - u);
        rise = s.rise * this.p * easeOut(u);
      }
      v3.copy(this.base).addScaledVector(this.right, spot.x * spread * fly).addScaledVector(this.up, lift * fly + spot.y * spread * fly + rise);
      q4.copy(this.face).multiply(qz.setFromAxisAngle(Z, wobble));
      this.stars.setMatrixAt(i, m4.compose(v3, q4, s3.setScalar(Math.max(size * spot.size * pop * gone, 0.0001))));
    });
    this.twinklePlan.forEach((tw, i) => {
      const k = this.calm ? 1 : span(u, tw.at, tw.at + 0.4);
      const flash = this.calm ? 0.8 : Math.sin(Math.PI * k) * (0.8 + 0.2 * Math.sin(t * 30 + i));
      v3.copy(this.base)
        .addScaledVector(this.right, tw.x * spread)
        .addScaledVector(this.up, lift + tw.y * spread + (this.calm ? 0 : s.rise * this.p * u))
        .addScaledVector(this.toward, 0.03 * this.p);
      q4.copy(this.face).multiply(qz.setFromAxisAngle(Z, this.calm ? 0 : k * 0.8));
      this.twinkles.setMatrixAt(i, m4.compose(v3, q4, s3.setScalar(Math.max(pic.twinkleSize * tw.size * this.p * flash, 0.0001))));
    });
    this.stars.instanceMatrix.needsUpdate = true;
    this.twinkles.instanceMatrix.needsUpdate = true;
  }
}

/** The balls of the owner's cloud picture, measured on the cut picture: centre (x right, y up) and radius, in picture widths. */
const CLOUD_BALLS = [
  { x: 0.082, y: 0.27, r: 0.19 },
  { x: -0.279, y: 0.018, r: 0.19 },
  { x: 0.258, y: 0.105, r: 0.175 },
  { x: 0.258, y: -0.147, r: 0.15 },
  { x: -0.04, y: -0.239, r: 0.175 },
  { x: -0.225, y: -0.158, r: 0.16 },
  { x: 0.007, y: 0.053, r: 0.09 },
];

/**
 * The cloud puff: the owner's cloud picture pops up, swells and rises a little; then it breaks
 * into its balls (copies of the cut ball picture, placed on the picture's own balls), which
 * drift apart and shrink away one after the other.
 */
export class PictureCloudFx extends PicturePiece {
  readonly kind = 'cloud' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private cloud: THREE.Mesh;
  private cloudMat: THREE.MeshBasicMaterial;
  private balls: THREE.InstancedMesh;

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, options);
    const c = assets.config.pictures.cloud;
    this.seconds = fxSeconds('cloud', this.calm, assets.config);
    const w = c.width * this.p;
    this.balls = this.add(new THREE.InstancedMesh(this.geometry(card(1, 1)), this.picture('cloudBall'), CLOUD_BALLS.length), 5);
    if (this.calm) this.balls.count = 0;
    this.cloudMat = this.picture('cloud');
    this.cloud = this.add(new THREE.Mesh(this.geometry(card(w, w * c.aspect, c.anchor)), this.cloudMat), 6);
    this.cloud.quaternion.copy(this.face);
    this.cost = { drawCalls: this.calm ? 1 : 2, particles: this.calm ? 1 : 1 + CLOUD_BALLS.length, triangles: 2 + CLOUD_BALLS.length * 2 };
  }

  update(t: number): void {
    const c = this.assets.config.pictures.cloud;
    const cfg = this.assets.config.cloud;
    const u = Math.min(t / this.seconds, 1);
    const w = c.width * this.p;
    const lift = cfg.lift * this.p;
    if (this.calm) {
      this.cloud.position.copy(this.base).addScaledVector(this.up, lift);
      fadePicture(this.cloudMat, envelope(u, 0.3, 0.6));
      return;
    }
    const pop = easeOutBack(span(u, 0, 0.24));
    const swell = 1 + cfg.grow * 0.5 * easeOut(span(u, 0.1, 0.5));
    const rise = cfg.rise * this.p * easeOut(u);
    // The whole picture, until it breaks up.
    const whole = 1 - smooth(span(u, 0.4, 0.52));
    this.cloud.position.copy(this.base).addScaledVector(this.up, lift + rise);
    this.cloud.scale.setScalar(Math.max(pop * swell, 0.0001));
    fadePicture(this.cloudMat, whole);
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
      this.balls.setMatrixAt(i, m4.compose(v3, this.face, s3.setScalar(Math.max(ball.r * 2 * w * swell * shown * c.ballSize, 0.0001))));
    });
    this.balls.instanceMatrix.needsUpdate = true;
  }
}

/**
 * The blue ring: the owner's picture laid flat on the board (stretched back to a circle, so
 * the game camera foreshortens it as it would a real ring), opening with a pop, turning, and
 * pulling itself shut with a flash made from the twinkle picture.
 */
export class PictureRingFx extends PicturePiece {
  readonly kind = 'ring' as const;
  readonly seconds: number;
  readonly cost: FxCost;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private flash: THREE.Mesh;
  private flashMat: THREE.MeshBasicMaterial;

  constructor(assets: GardenFxAssets, frame: FxFrame, x: number, z: number, options: FxOptions = {}) {
    super(assets, frame, x, z, options);
    const r = assets.config.pictures.ring;
    this.seconds = fxSeconds('ring', this.calm, assets.config);
    const w = r.width * this.p;
    const geometry = this.geometry(card(w, (w * r.aspect) / r.squash, r.centre));
    geometry.rotateX(-Math.PI / 2);
    this.ringMat = this.picture('ring');
    this.ring = this.add(new THREE.Mesh(geometry, this.ringMat), 4);
    this.ring.position.y = assets.config.ring.lift * 0.3 * this.p;
    this.flashMat = this.picture('twinkle');
    this.flash = this.add(new THREE.Mesh(this.geometry(card(1, 1)), this.flashMat), 7);
    this.flash.quaternion.copy(this.face);
    this.flash.position.copy(this.base).multiplyScalar(0.5);
    this.flash.visible = !this.calm;
    this.cost = { drawCalls: this.calm ? 1 : 2, particles: 0, triangles: 4 };
  }

  update(t: number): void {
    const r = this.assets.config.pictures.ring;
    const u = Math.min(t / this.seconds, 1);
    if (this.calm) {
      fadePicture(this.ringMat, envelope(u, 0.3, 0.65));
      return;
    }
    const open = easeOutBack(span(u, 0, 0.22));
    const close = 1 - smooth(span(u, 0.74, 0.95));
    const breathe = 1 + 0.04 * Math.sin(t * 12) * envelope(u, 0.2, 0.75);
    this.ring.scale.setScalar(Math.max(open * close * breathe, 0.0001));
    // It turns ever faster as it closes: the swirl is pulled in.
    this.ring.rotation.y = -r.turn * Math.PI * 2 * (u + 1.5 * u * u * u);
    fadePicture(this.ringMat, 1);
    const f = span(u, 0.8, 1);
    this.flash.scale.setScalar(Math.max(r.width * 0.9 * this.p * Math.sin(Math.PI * f), 0.0001));
    this.flash.quaternion.copy(this.face).multiply(qz.setFromAxisAngle(Z, f * 1.2));
    fadePicture(this.flashMat, Math.sin(Math.PI * f));
  }
}
