/**
 * Garden theme board parts: the grass tile, the glowing (highlighted) tile, the dirt tile, the
 * braided-twig rim with leaves and white flowers, and the underlay with its grass bed.
 *
 * Same contract as the robot theme's `src/render/parts/board.ts`: the same function names and
 * parameters, sizes in cells, the floor at y = 0 and the tile top at 0.2 (as the robot tile, so a
 * chick stands where a robot stands). The theme session can swap one module for the other.
 *
 * Each part lives in its own file, with its own data file in `data/themes/garden/`:
 * grass tile `grass.ts` (tile.json), glowing tile `highlight.ts` (highlight.json), dirt tile
 * `dirt.ts` (dirt.json), rim `rim.ts` (rim.json), underlay `underlay.ts` (underlay.json).
 * Shared helpers: `geometry.ts`, `paint.ts`, `layout.ts`. Design: `design/themes/garden-board.md`.
 */
import { barkMaterial, decorMaterial, leafMaterial, rimBoardMaterial, rimMaterial } from './rim';
import { bedMaterial } from './underlay';
import { dirtMaterial } from './dirt';
import { furMaterial, grassMaterial } from './grass';
import { plainMaterial } from './geometry';

export { buildFloorTile } from './grass';
export { buildHighlightTile, buildTileGlow, hintGlowCells, type HintStep } from './highlight';
export { buildDirtTile } from './dirt';
export { buildRim } from './rim';
export { buildUnderlay } from './underlay';
export { boardFootprint, boardPixels, rimDecorLayout } from './layout';

/**
 * The shared materials of the garden board, for the theme session (to fuse, dispose or tune them).
 * The rim (`buildRim`, the default, = `buildRimBoard`, owner's choice) is `rimBoard`, cut from
 * 01-board-full; `bark`, `decor` and `leaf` belong to the modelled braid (`buildRimModel`) and `rim`
 * to the rim from 03-rim-vines (`buildRimImage`), both kept as alternatives.
 */
export const gardenBoardMaterials = { grass: grassMaterial, fur: furMaterial, dirt: dirtMaterial, rimBoard: rimBoardMaterial, bark: barkMaterial, decor: decorMaterial, leaf: leafMaterial, rim: rimMaterial, bed: bedMaterial, plain: plainMaterial };
