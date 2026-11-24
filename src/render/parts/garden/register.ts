/**
 * The garden theme's choices, where its folder holds more than one version of a part. The register
 * (src/render/themes.ts) reads every export of this folder; when two files export the same name,
 * this file decides (design/themes.md, "Two versions of a part").
 *
 * - Floor tile: the grass tile from the owner's picture (grass.ts), not the special tiles' stand-in.
 * - Exit, turn tile, pressure plate, gate: the owner's pictures (exitPictures.ts), the standard of
 *   design/themes/garden-exit.md; the modelled versions in exit.ts and specials.ts stay as alternatives.
 */
import type * as THREE from 'three';
import { buildFloorTile } from './grass';
import { buildGate as gatePicture, buildPlate as platePicture, buildTurnTile as turnPicture } from './exitPictures';
import { useGardenFloorTile } from './specials';

// The special tiles and the exit stand on the board session's grass tile.
useGardenFloorTile(buildFloorTile);

/**
 * The flat pictures inside a part are kept out of the fused board (`userData.keepApart`): fused,
 * they would cast a square shadow and lose their drawing order.
 */
function keepPicturesApart<T extends THREE.Object3D>(part: T): T {
  part.traverse((node) => {
    if (node.userData.sprite !== undefined) node.userData.keepApart = true;
  });
  return part;
}

export { buildFloorTile };
export { buildExit, gateDoorScale } from './exitPictures';
/** Garden turn tile (picture), with its picture kept out of the fused board. */
export const buildTurnTile: typeof turnPicture = (alt, pegs) => keepPicturesApart(turnPicture(alt, pegs));
/** Garden pressure plate (picture), with its picture kept out of the fused board. */
export const buildPlate: typeof platePicture = (alt, pegs) => keepPicturesApart(platePicture(alt, pegs));
/** Garden gate (picture), with its picture kept out of the fused board. */
export const buildGate: typeof gatePicture = (alt, pegs) => keepPicturesApart(gatePicture(alt, pegs));
