# Garden theme — the rim, the underlay and the whole board

Part of the garden board (`design/themes/garden-board.md`, which this file does not change).
References: `design/reference/turnflock/garden/03-rim-vines` (the rim alone) and `01-board-full`
(the whole board). Built on the parts page only; nothing in the game changes.

## What changed

The owner did not like the rim rebuilt in code (a braid of thin twigs, about 39,000 triangles on
6×6): it did not look like the picture. The rim is now the owner's picture itself.

| | Before (code braid, now `buildRimModel`) | Now (picture, `buildRim`) |
|---|---|---|
| Rim 6×6 | 39,108 triangles, 3 draw calls | 56 triangles, 1 draw call |
| Board 8×8, fused | 69,120 triangles, 5 draw calls | 19,592 triangles, 5 draw calls (robot: 19,596 and 3) |
| Bytes in the single-file build | 0 (painted at start-up) | `rim-atlas.webp` 73 kB + `bed.webp` 2 kB (about 100 kB as base64) |
| Graphics memory | four 1024 px canvases (about 16 MB) | one 1024×788 texture with mipmaps (about 4 MB) |

`buildRim`, `buildUnderlay`, `boardFootprint` and `boardPixels` keep their names, parameters and
units (1 cell = 1, floor at y = 0, tile top at 0.2), so the theme session can still swap them with
the robot ones. `buildRimModel` keeps the code braid as a choice.

## How the rim is made

1. **Cut.** `assets/turnflock/garden/board/rim/build-rim.py` (Pillow, numpy, scipy) cuts
   `03-rim-vines` into pieces and packs them into `rim-atlas.webp`, and writes where each piece
   is (in the picture and in the atlas) to the `atlas` block of `data/themes/garden/rim.json`.
   - The off-white background and its soft drop shadow are removed by flood fill from the edge and
     the middle; the remaining outline gets a one-pixel feather inside it, and every see-through
     pixel takes the colour of the nearest solid one, so there is no white or grey halo when the
     texture is filtered or mipmapped.
   - The left flower sits on the drop shadow and its shaded petals cannot be told from it by
     colour, so it is replaced by a copy of the right flower (on clean ground), 10% larger; the
     braid behind the old petals is filled from plain braid lower down the same side.
   - The picture is drawn by hand: its sides wander a few pixels. Each straight side is shifted
     column by column (sub-pixel, tapering into the corners) so the braid's outside runs straight;
     without that, a repeated piece of braid meets a corner with a visible step.
   - Scale 0.8 of the source: the rim band is about 73 atlas px, about twice its size on a phone
     (a 4×4 board shows the rim 38 CSS px wide; 6×6 27; 8×8 22).
2. **Nine-part frame** (`rimQuads` in `src/render/parts/garden/layout.ts`). One scale for the whole
   picture (`image.pxPerCell`, 160 source px per cell), never stretched (a test checks it):
   - **Corners**: each corner of the board shows its own corner of the picture (the near corners
     are thicker, as in the picture, which shows the front of the braid there).
   - **Straight sides**: a plain stretch of the side's own braid (left: the right side's, mirrored,
     because the picture's left side has no plain stretch long enough), made seamless by blending
     its end into its start, repeated from corner to corner and cut short at the end.
   - **Leaves and flowers**: seven decorated pieces of the picture (two on top, two right with a
     flower, one bottom, two left with a flower; the two leaves at the top-left and bottom-left
     corners belong to their corners). Each keeps its place in the picture as a share of the
     straight run between the corners, so a board the size of the picture (about 5×5) shows the
     picture as it is and larger boards spread the same pieces out. Fixed, never random. Pieces
     overlap neighbours only by their faded ends; where a side is too short, they are pushed
     together, and if that is not enough the last in `image.decorOrder` is left out (on 4-row
     boards the lower leaves on the left side).
   - Pieces join with a 40 source px cross-fade (`atlas.fade`); a corner and the decorated piece
     next to it share those 40 px of the picture, so at the picture's own size they join exactly.
3. **In three.js** (`buildRim` in `src/render/parts/garden/rim.ts`): one mesh of flat quads at
   `image.height` = 0.3 (tiles at 0.2), layered 0.002 apart (braid, then decorated pieces, then
   corners), one `MeshBasicMaterial` (unlit: the light and shade are in the picture, so the colours
   are the owner's), `alphaTest` 0.02 so see-through pixels hide nothing. It casts a shadow through
   `rimDepthMaterial` (solid part only).

### Does a flat picture convince under the game camera?

Yes, and no body for the side is needed. The picture is already drawn from slightly in front: its
near side is about 117 px deep against 73 at the far side, because it shows the front of the braid.
Laid flat and seen from 30° off vertical, that front reads as the rim's thickness. Raised to 0.3,
the near edge appears about 0.17 cell further back, which is almost exactly the extra depth of the
near band, so it lands on the board's outside and nothing shows under it; the underlay stops under
the braid (`lip` -0.3). Seen from low down (the parts page's "front" view) it is plainly a sheet, but
the game never looks from there.

## Underlay and grass bed

`buildUnderlay` keeps its plate and soil sides; its top is now `bed.webp`, a 128 px repeating patch
built from the only stretch of plain bed in `01-board-full` (the strip between the rim and the first
row of tiles, too thin to repeat as it is): clumps of blades cut from the strip with a soft edge,
laid on the strip's own green in a fixed jittered grid that wraps round. The plate's corners are
rounder (`cornerRadius` 1.1) and it stops 0.3 inside the rim's outside, so no bed shows past the
picture's round corners or its thin far side. `bedTone` 1.2 brightens it against the scene light.

## Where it still differs from the references

- **Joins.** Where a decorated piece or a corner fades into the repeated braid the strands do not
  continue exactly; over 40 source px (0.25 cell, about 12 CSS px on a 6×6 board on a phone) the two braids blend. Visible on
  close inspection of the top view, hardly at game size. A vine that runs from a corner into the
  next piece (top-left) fades out and back in on boards larger than the picture.
- **The left flower** is a copy of the right one (see above), not the picture's own left flower.
- **Far side.** The picture's far band is thinner than its sides (0.44 cell against 0.58): the board
  looks as in the picture, but the rim's far edge is 0.14 inside the footprint's outside.
- **Near side.** The picture's near band reaches 0.15 cell past the footprint's outside (its front);
  under the game camera it lands on the outside line.
- **Grass bed.** The reference's bed has crisp blade tips; ours is softer and slightly blotchy at
  close range. Between tiles it is 3 px wide on a phone. With one tile colour for every cell (the
  owner's choice in the grass-tile session, `claude/turnflock-garden-board-tile` ecb6c6d) the bed is
  what separates the cells, so it may deserve a sharper source picture.
- **Scale on large boards.** The rim keeps one size per cell, as in both references (0.57 cell); on
  8×8 the leaves and flowers are therefore small on a phone (rim 22 CSS px).

## Notes for the theme session

- The rim and bed are images: `rimReady` and `bedReady` settle when they have loaded; a still drawn
  earlier shows no rim (the game draws every frame, so it only matters for one-off renders).
- `fuse` drops `customDepthMaterial`: give the rim mesh `rimDepthMaterial` back after fusing, or its
  shadow is a rectangle.
- `rimMaterial` is `transparent`; it is drawn after the opaque tiles, as it should be.
- `boardSize()` in `boardView.ts`: use the garden `boardFootprint` (the plate sits under the braid).
- Shared files I would have touched, but did not: `board.ts` re-exports `buildRim` (now the picture)
  and lists `bark` in `gardenBoardMaterials` (the code braid's); adding `rim: rimMaterial` there would
  help the theme session. `garden-board.md`'s cost table and "How it is made" still describe the code
  braid; this file supersedes them for the rim, underlay and board.

## Owner's decisions (2026-11-24)

- **Rim as it is now: accepted.** The joins between pieces are good enough; no further refinement.
- **Grass bed between the tiles: open.** With one tile colour for every cell the bed separates the
  cells; the owner does not know yet whether it needs a sharper or lighter bed or a picture of its
  own. Leave it as it is.
- **Thicker rim on large boards (8×8): not now, ask again later.** It would change the board's
  footprint. Ask the owner again when the theme goes into the game.

## In the game (2026-11-24)

The owner asked for the picture rim in the game. This branch merges `claude/turnflock-theme-garden`
(where the garden theme is in the game, with the code braid) and so the garden board in the game
now uses the picture rim and the picture grass bed: the theme's builders read `buildRim` and
`buildUnderlay` from `src/render/parts/garden/board.ts`, which now give the picture versions. No
other change was needed: `fuse` keeps a part's `customDepthMaterial`, so the rim's shadow follows
the picture, and the game draws every frame, so the pictures appear as soon as they have loaded.
Evidence: `production/qa/evidence/garden-board/rim/in-game-390x844-*.webp` (levels 1, 3, 5, 7, 11:
4×4, 5×4, 5×5, 6×6, 6×5, on a 390×844 phone at 3× pixel density).
