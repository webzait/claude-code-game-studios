import * as THREE from 'three';
import beamUrl from '../../../../assets/turnflock/garden/effects/beam.webp';
import starUrl from '../../../../assets/turnflock/garden/effects/star.webp';
import twinkleUrl from '../../../../assets/turnflock/garden/effects/twinkle.webp';
import cloudUrl from '../../../../assets/turnflock/garden/effects/cloud.webp';
import cloudBallUrl from '../../../../assets/turnflock/garden/effects/cloud-ball.webp';
import ringUrl from '../../../../assets/turnflock/garden/effects/ring.webp';

/**
 * The owner's effect pictures, made from the high-resolution elements in
 * design/reference/turnflock/garden/elements/ by tools/asset-pipeline/garden-effects-from-elements.py,
 * as textures. They load in the background; `ready`
 * settles once all are in (a picture that has not loaded yet simply draws nothing).
 */
export const PICTURE_URLS = { beam: beamUrl, star: starUrl, twinkle: twinkleUrl, cloud: cloudUrl, cloudBall: cloudBallUrl, ring: ringUrl } as const;
/** One of the pictures. */
export type PictureName = keyof typeof PICTURE_URLS;

/** The picture textures of one board. */
export class GardenPictures {
  readonly textures = {} as Record<PictureName, THREE.Texture>;
  /** Settles when every picture has loaded (or failed). */
  readonly ready: Promise<void>;

  constructor(loader: THREE.TextureLoader = new THREE.TextureLoader()) {
    const loads: Promise<void>[] = [];
    for (const name of Object.keys(PICTURE_URLS) as PictureName[]) {
      loads.push(
        new Promise<void>((done) => {
          const texture = loader.load(PICTURE_URLS[name], () => done(), undefined, () => done());
          texture.colorSpace = THREE.SRGBColorSpace;
          // Filtered and mipmapped with colour premultiplied by alpha: no dark or light fringe
          // where the picture fades out, at any size on screen.
          texture.premultiplyAlpha = true;
          texture.anisotropy = 4;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          this.textures[name] = texture;
        }),
      );
    }
    this.ready = Promise.all(loads).then(() => undefined);
  }

  dispose(): void {
    for (const t of Object.values(this.textures)) t.dispose();
  }
}

/**
 * A material for one premultiplied picture. Fade it with `fadePicture`: colour and alpha are
 * scaled together, as premultiplied colour needs.
 */
export function pictureMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
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

/** Set how much of a picture shows, 0 to 1. */
export function fadePicture(material: THREE.MeshBasicMaterial, k: number): void {
  material.color.setScalar(k);
  material.opacity = k;
}
