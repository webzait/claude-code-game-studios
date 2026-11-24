import * as THREE from 'three';
import { CODE_BUILDERS, CloudPool, GardenFxAssets, type FxCost, type FxFrame, type FxOptions, type GardenFx, type FxBuilder } from './effects';
import { GARDEN_FX, type GardenFxKind } from './effectsPlan';
import { PictureBeamFx, PictureCloudFx, PictureRingFx, PictureStarsFx } from './pictureEffects';

/** How the garden effects are drawn: the owner's pictures, or built in code. */
export type GardenFxLook = 'picture' | 'code';

/** The look the config asks for; the pictures unless it says `code`. */
export function defaultLook(look: string = GARDEN_FX.look): GardenFxLook {
  return look === 'code' ? 'code' : 'picture';
}

/** The picture effects by kind. */
export const PICTURE_BUILDERS: Record<GardenFxKind, FxBuilder> = { beam: PictureBeamFx, stars: PictureStarsFx, cloud: PictureCloudFx, ring: PictureRingFx };


/**
 * The garden effects on one board: start one with `play`, move them all on with `update` every
 * frame. Finished effects remove themselves. With `reduced` set, every effect plays its calm
 * version (the device's prefers-reduced-motion or the game's Reduce motion setting).
 */
export class GardenEffects {
  private playing: { fx: GardenFx; time: number }[] = [];
  /** Shared meshes for the cloud puffs, made at the first puff. */
  private clouds: CloudPool | null = null;
  /** Every effect plays its calm version. */
  reduced = false;

  /** `look`: the owner's pictures (the standard, data/themes/garden/effects.json `look`) or the code-built version. */
  constructor(
    private parent: THREE.Object3D,
    private frame: FxFrame,
    readonly assets: GardenFxAssets = new GardenFxAssets(),
    public look: GardenFxLook = defaultLook(),
  ) {}

  /** Start one effect at world x, z (a cell's centre, or the point where something bumps). */
  play(kind: GardenFxKind, x: number, z: number, options: FxOptions = {}): GardenFx {
    const code = this.look === 'code';
    if (code && kind === 'cloud' && !this.clouds) this.clouds = new CloudPool(this.parent, this.assets);
    const fx = new (code ? CODE_BUILDERS : PICTURE_BUILDERS)[kind](this.assets, this.frame, x, z, { ...options, calm: options.calm ?? this.reduced }, code ? (this.clouds ?? undefined) : undefined);
    this.parent.add(fx.group);
    fx.update(0);
    this.playing.push({ fx, time: 0 });
    return fx;
  }

  /** Move every effect on by `dt` seconds; finished ones are removed. */
  update(dt: number): void {
    for (let i = this.playing.length - 1; i >= 0; i--) {
      const run = this.playing[i];
      run.time += dt;
      if (run.time >= run.fx.seconds) {
        run.fx.dispose();
        this.playing.splice(i, 1);
      } else run.fx.update(run.time);
    }
  }

  /** Effects still playing. */
  get active(): readonly GardenFx[] {
    return this.playing.map((p) => p.fx);
  }

  /** What the playing effects cost together. */
  get cost(): FxCost {
    const pooled = this.clouds && this.clouds.balls.busy > 0 ? 2 : 0;
    return this.playing.reduce((sum, p) => ({ drawCalls: sum.drawCalls + p.fx.cost.drawCalls, particles: sum.particles + p.fx.cost.particles, triangles: sum.triangles + p.fx.cost.triangles }), { drawCalls: pooled, particles: 0, triangles: 0 });
  }

  /** Stop every effect at once and take the shared puff meshes off the board. */
  clear(): void {
    for (const p of this.playing) p.fx.dispose();
    this.playing = [];
    this.clouds?.dispose();
    this.clouds = null;
  }

  /** Stop everything and free the shared geometries and textures. */
  dispose(): void {
    this.clear();
    this.assets.dispose();
  }
}
