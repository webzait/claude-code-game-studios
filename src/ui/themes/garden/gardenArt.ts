// The garden theme's pictures, cut from the owner's own pictures by
// tools/asset-pipeline/build-garden-backdrop.py. The backdrop pictures are referenced
// from garden-scene.css; the decor pictures go into the same six <img> places as the
// robot theme's bushes (index.html .tf-decor-layer), chosen by place, not by data-art,
// because the garden gives every place its own picture.
import branch from './garden-branch.webp';
import bushWhite from './garden-bush-white.webp';
import clumpBirdhouse from './garden-clump-birdhouse.webp';
import rocksLeft from './garden-clump-rocks-left.webp';
import rocksRight from './garden-clump-rocks-right.webp';
import birdhouse from './garden-birdhouse.webp';
import flowerArch from './garden-flower-arch.webp';

/** The six decoration places of the scene, named as their CSS class (tf-decor-<place>). */
export const DECOR_PLACES = ['sprig-tl', 'tuft-tr', 'back-l', 'back-r', 'front-l', 'front-r'] as const;
/** One decoration place. */
export type DecorPlace = (typeof DECOR_PLACES)[number];

/** The garden picture for each decoration place. */
export const GARDEN_DECOR_ART: Readonly<Record<DecorPlace, string>> = {
  'sprig-tl': branch,
  'tuft-tr': clumpBirdhouse,
  'back-l': rocksLeft,
  'back-r': rocksRight,
  'front-l': clumpBirdhouse,
  'front-r': bushWhite,
};

/** The decoration pictures by name, for the parts sheet. */
export const GARDEN_DECOR_PIECES = { branch, bushWhite, clumpBirdhouse, rocksLeft, rocksRight } as const;

/** The two backdrop props as loose pictures: for a layered backdrop or other screens. */
export const GARDEN_PROPS = { birdhouse, flowerArch } as const;

/**
 * Put the garden pictures into a decoration layer (the theme switch calls this; the robot
 * pictures come back through the game's own data-art mapping).
 * @param layer The element holding the <img class="tf-decor-piece tf-decor-<place>"> pieces.
 */
export function applyGardenDecor(layer: ParentNode): void {
  for (const place of DECOR_PLACES) {
    const img = layer.querySelector<HTMLImageElement>(`img.tf-decor-${place}`);
    if (img) img.src = GARDEN_DECOR_ART[place];
  }
}
