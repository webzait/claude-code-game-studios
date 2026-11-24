import * as THREE from 'three';
import type { CelebrationPlan } from '../../../game/celebration';
import type { CelebrationStage } from '../../celebration';
import { GardenFxAssets, type FxCost } from './effects';
import { GardenEffects, defaultLook, type GardenFxLook } from './gardenEffects';
import { pictureMaterial } from './pictures';
import { GARDEN_FX, gardenCelebrationCues, smooth, span, sparkleWave, type GardenCue, type SparkleCue } from './effectsPlan';

/**
 * The garden theme's win celebration, in place of the robot confetti: a beam rises from the exit,
 * stars burst out of it and a wave of twinkles runs over the lawn from the exit to the far corner.
 * Three stars: five stars, and a second burst of stars over the middle of the board. Calm (reduced motion): the beam and
 * the stars fade in and out where they are, no wave.
 *
 * Same shape as the robot theme's `CelebrationFx` (src/render/celebration.ts): built from a
 * `CelebrationStage` and a `CelebrationPlan` (`planGardenCelebration`), moved on with `update`,
 * ended with `dispose`, so the theme session can swap one for the other.
 */
export class GardenCelebrationFx {
  private time = 0;
  private effects: GardenEffects;
  private pending: GardenCue[];
  private sparkles: THREE.InstancedMesh | null = null;
  private sparkleMat: THREE.MeshBasicMaterial | null = null;
  private wave: (SparkleCue & { x: number; z: number })[] = [];
  private face: THREE.Quaternion;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private size = new THREE.Vector3();
  private exitX: number;
  private exitZ: number;
  private middleX: number;
  private middleZ: number;

  /** `assets` can be shared with the board's own garden effects; the celebration then leaves them alive on `dispose`. `look`: pictures (standard) or code. */
  constructor(
    private stage: CelebrationStage,
    private plan: CelebrationPlan,
    private shared?: GardenFxAssets,
    look: GardenFxLook = defaultLook(),
  ) {
    this.effects = new GardenEffects(stage.group, { pitch: stage.pitch, floorY: stage.floorY }, shared ?? new GardenFxAssets(), look);
    this.effects.reduced = plan.calm;
    this.pending = gardenCelebrationCues(plan).sort((a, b) => a.at - b.at);
    this.exitX = stage.cellX(stage.exitX);
    this.exitZ = stage.cellZ(stage.exitY);
    this.middleX = (stage.cellX(0) + stage.cellX(stage.width - 1)) / 2;
    this.middleZ = (stage.cellZ(0) + stage.cellZ(stage.height - 1)) / 2;
    this.face = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -((90 - GARDEN_FX.facingTilt) * Math.PI) / 180);
    const c = GARDEN_FX.celebration;
    if (!plan.calm) {
      const cues = sparkleWave(stage, c.sparkleAt, plan.seconds - 0.6);
      this.wave = cues.map((cue) => ({ ...cue, x: stage.cellX(cue.cellX), z: stage.cellZ(cue.cellY) }));
      // The twinkles are the owner's twinkle picture, or in the code look the painted one.
      this.sparkleMat =
        look === 'picture'
          ? pictureMaterial(this.effects.assets.pictures.textures.twinkle)
          : new THREE.MeshBasicMaterial({ map: this.effects.assets.code.twinkleTex, color: GARDEN_FX.stars.colors.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.sparkles = new THREE.InstancedMesh(this.effects.assets.quad, this.sparkleMat, Math.max(this.wave.length, 1));
      this.sparkles.count = this.wave.length;
      this.sparkles.frustumCulled = false;
      this.sparkles.renderOrder = 7;
      stage.group.add(this.sparkles);
    }
    stage.pulseExit();
    this.update(0);
  }

  /** Move on by `dt` seconds. False once the celebration is over; `dispose` it then. */
  update(dt: number): boolean {
    this.time += dt;
    if (this.time >= this.plan.seconds) return false;
    while (this.pending.length && this.pending[0].at <= this.time) {
      const cue = this.pending.shift()!;
      const middle = cue.where === 'middle';
      this.effects.play(cue.kind, middle ? this.middleX : this.exitX, middle ? this.middleZ : this.exitZ, { scale: cue.scale, count: cue.count });
    }
    this.effects.update(dt);
    if (this.sparkles) {
      const c = GARDEN_FX.celebration;
      const life = 0.55;
      this.wave.forEach((w, i) => {
        const k = span(this.time, w.at, w.at + life);
        // A twinkle pops up over its tile, turns a little and is gone.
        const s = k > 0 && k < 1 ? Math.sin(Math.PI * smooth(k)) * c.sparkleSize * this.stage.pitch : 0.0001;
        this.position.set(w.x, this.stage.floorY + 0.12 * this.stage.pitch + k * 0.15 * this.stage.pitch, w.z);
        this.sparkles!.setMatrixAt(i, this.matrix.compose(this.position, this.face, this.size.setScalar(s)));
      });
      this.sparkles.instanceMatrix.needsUpdate = true;
    }
    return true;
  }

  /** What the celebration costs right now. */
  get cost(): FxCost {
    const own = this.effects.cost;
    return { drawCalls: own.drawCalls + (this.sparkles ? 1 : 0), particles: own.particles + this.wave.length, triangles: own.triangles + this.wave.length * 2 };
  }

  /** End now and leave the board as it was. */
  dispose(): void {
    if (this.shared) this.effects.clear();
    else this.effects.dispose();
    if (this.sparkles) {
      this.stage.group.remove(this.sparkles);
      this.sparkles.dispose();
      this.sparkleMat?.dispose();
    }
  }
}
