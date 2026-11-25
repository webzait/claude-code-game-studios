# Garden theme — the grass bed between the tiles

Part of the garden board (`garden-board.md`). The grass bed is the green that shows between
the grass tiles and between the tiles and the rim. Every tile is one colour (no checkerboard),
so the bed is what separates the cells. Reference: `design/reference/turnflock/garden/01-board-full`.

## The owner's complaint (2026-11-24)

"Het grasbed lijkt te onscherp en steekt erg af." (The bed looks too blurred and stands out too
much.) In the game it was a blurred, blotchy, dark green surface. In the reference it is fresh
green with sharp, light blade tips, and it sits well next to the tiles.

## What was wrong

1. **Too little resolution.** The bed was a 128 px patch for one cell. On a phone (390 px wide
   at 3x, 30° camera tilt) one cell is about 190 device pixels, so the patch was stretched about
   1.5 times. It was also cut from a 23 px high strip of the reference and pasted together, so it
   was soft before it was stretched.
2. **Blotches.** The clumps cut from the strip had soft round edges and kept the strip's
   uneven light, which made dark and light patches.
3. **A grey haze over the green.** The bed used `MeshStandardMaterial`, so it took the scene's
   white highlights and the room environment reflection (`light.reflections`). That adds a grey
   to every pixel (blue went from 23 to 36 out of 255 when measured), which washes out the
   yellow-green and turns it dull olive.

## The flat bed (2026-11-24; since 2026-11-25 only the ground under the blades, at 256 px)

The first version (tufts of long blades, 384 px) was sharp, but the owner asked for "compacter
en hogere resolutie gras" (more compact grass at a higher resolution), and pointed to the fur
round the edge of their tile pictures (`02-tile-grass`, `11-sheet-tile-grass`). The bed now
follows that fur:

- **A drawn patch, not a cut-out one.** The reference shows too little plain bed to cut a clean
  repeating patch from it. `assets/turnflock/garden/board/bed/build-bed.py` draws one with short,
  leaf-shaped blades, about 0.045 to 0.07 of a cell long. Each is narrow at the root, widest at a
  third and comes to a point, like the tile's fur. They are packed close on a jittered grid with
  a step of 0.022 cells, each leaning up to 22° either way. Each is shaded from green at the
  root to a light lime tip, with a lit edge. They point away from the camera, so they read as
  standing grass. Everything is drawn at 3x and scaled down, so every edge is sharp.
- **Seamless, with no rows.** The grid wraps round the edges, and every blade and its wrapped
  copies are drawn back to front together. The overlap is then the same on both sides of an
  edge, so there is no seam.
- **Higher resolution.** The patch is 640 px and repeats every 1.25 cells (`bedRepeat`): 512 px
  per cell, or about 2.7 texels per device pixel on a phone. 1.25 is not a whole number of cells,
  so neighbouring gaps show different parts of the patch.
- **Matte material.** `MeshLambertMaterial`: diffuse light and shadows, but no highlights and no
  environment reflection, because grass does not shine. This takes away the grey haze, and it is
  cheaper on a phone than the standard material.
- **Colour and brightness.** `bedTone` 1.25. In the game the bed's green is about 0.8 of the
  tiles' green, a little brighter than the reference (0.71). It sits closer to the tiles, as the
  owner asked, and the tile shadows still separate the cells.

| | Before | First try (tufts) | Now (compact) |
|---|---|---|---|
| File | `board/rim/bed.webp`, 128 px, 1.7 kB | 384 px, 27 kB | `board/bed/bed.webp`, 640 px, 71 kB |
| Pixels per cell | 128 | 307 | 512 |
| Material | Standard | Lambert | Lambert |

**Size.** 71 kB is over the 30 kB guideline. Fine, dense blades do not compress well: WebP at
quality 55 still makes 56 kB and the blades visibly soften. A 512 px patch that repeats every
whole cell would be about 46 kB at the same sharpness, but then every gap would show the same
grass.

Build: `python3 assets/turnflock/garden/board/bed/build-bed.py` (needs Pillow and numpy). The
seed is fixed, so every run writes the same file. If you change `REPEAT` there, change
`bedRepeat` in `data/themes/garden/underlay.json` to match.

`bed_patch()` and the line that wrote `bed.webp` were taken out of
`assets/turnflock/garden/board/rim/build-rim.py`. The rim script now writes only the rim atlas.
The parts page's rim card (`src/parts/garden-board/rim.ts`) now imports the bed from its new
place.

## The whole bed is blades (2026-11-25)

The owner said: "Het grasveld moet in zijn geheel uit sprieten bestaan. Hoeft niet perse op de
plekken waar tegels liggen. Goede resolutie net als in het voorbeeld." (The whole bed must be
made of blades, not under the tiles, at a good resolution as in the picture.) In `01-board-full`
the bed shows separate, upright blades with light tips everywhere, not a flat picture of blades.

**Approach: rows of blade cards.** `bladeFieldGeometry` (in `underlay.ts`) stands a row of
see-through cards every `blades.step` (0.03) cells, from the far rim to the near one. Each card
shows a row of upright blades from `blades.webp` and leans back from the camera by `lean` (45°),
so at the game's 30° tilt it is seen almost face-on (an upright card would show at half height,
one leaning back at 60° would be edge-on for the rows behind it). Each card fills exactly one
stretch of bed along its row (`bedSpans`): a row along a gap between two rows of tiles is one long
card the width of the bed; a row through a row of tiles is one short card per gap, its ends
`tuck` (0.02) inside the tile walls so no cut edge shows. Where tiles are, there is nothing.

Why cards and not one triangle per blade: one triangle per blade needs about 50,000 triangles
on an 8×8 board for the same density, and the 8×8 board's budget (the robot board,
19,596 triangles, `garden-rim.test.ts`) leaves about 13,000. Each card carries about 30 blades
in 2 triangles. Why cards and not the old flat picture: the blades of one row stand in front of
the rows behind and hide their roots, so the bed has depth and the light tips stand out, as in
the picture.

- **No rows or repeats in view.** Every row is jittered in depth (`jitter`), has its own height
  (`heightJitter`, ±20 %), its own strip of the atlas (4 `variants`) and its own offset along it.
  The cards in one row share the row's offset in world units, so a row's blades run on across
  a tile unbroken.
- **A little darker at the root.** Each card's bottom is shaded to `rootShade` (0.92, vertex
  colours), as the blades in front would shade it. The flat bed under the cards shows between
  them (`ground` 1.15 of its picture).
- **Taller against the braid.** Within `rimBand` (0.12) of the far rim the rows grow up to
  `rimHeight` (2) times taller; on the left and right the end of every row is a separate taller
  card. This replaces the separate fringe band (and `fringe.webp`) of the previous version, so it
  costs no extra draw call.
- **The picture.** `build-bed.py` writes `blades.webp`: 4 strips, each 0.5 cells wide (it
  repeats along a row) and 0.12 cells tall, at 1,024 px per cell (512 × 524 px). Blades are
  rooted on the strip's bottom edge, leaf-shaped, 0.012 to 0.018 cells wide, a root every 0.012
  cells, shaded from a green root to a light lime tip with a lit edge; a third of them stand
  behind, only a little darker (`BACK_SHADE` 0.86). The colours carry no blue: blue in the tips
  mixed with the dark roots into a dull, greyish olive.
- **Material.** `MeshLambertMaterial` with `alphaTest` 0.5 and `alphaToCoverage`, so the cut
  edges are antialiased by the renderer's multisampling instead of stair-stepped. Both faces,
  `tone` 1.4. The cards take the tiles' and chicks' shadows but cast none (a cut-out casts a
  square shadow). They are marked `userData.keepApart`, because `fuse` in `src/render/kit.ts`
  would turn their shadows on.
- **No browser, no blades.** In the unit tests there is no picture, so `buildUnderlay` leaves the
  cards out (as the fringe band was before). `tests/unit/garden-bed-blades.test.ts` tests
  `bladeFieldGeometry` and `bedSpans` directly, and counts the cards into the 8×8 budget.

| | Before (flat bed and fringe) | Now (blade cards) |
|---|---|---|
| Pictures | `bed.webp` 71 kB + `fringe.webp` 10 kB | `bed.webp` 17 kB (256 px) + `blades.webp` 31 kB |
| Triangles on 8×8 | 322 + about 1,000 | 322 + 5,308 (4×4: 1,776; 6×5: 2,766) |
| Whole 8×8 board | about 7,300 | about 11,600 (budget 19,600) |
| Draw calls for the bed | 3 (bed, soil, fringe) | 3 (bed, soil, blades) |

`bed.webp` went from 640 to 256 px: only the shade between the blades shows of it now, and side
by side at 1:1 there was no visible difference. `blades.webp` is saved at WebP quality 62: 31 kB
instead of about 50, with colour and outline off by under 1.5 % on average.

**Colour.** The owner found the first version "veel te donker met teveel grijs" (far too dark,
too much grey). It had dark roots (`rootShade` 0.8), dark back blades (0.62) and pale, slightly
blue tips; mixed at phone size that read as dull olive, (103, 153, 19) on average in level 1. Not
the tiles' shadows: turning them off on the blades changed nothing measurable. Now the blades are
a clear mid green with little dark between them: (122, 182, 16) on average, between the picture's
bed (101, 161, 2) and the game's tiles (158, 197, 28)
(`closeup-level01-lighter-1to1`).

## Evidence

`production/qa/evidence/garden-board/bed-blades/` (the blade bed): levels 1, 7 and 11 at 390×844
with deviceScaleFactor 3 (`in-game-*`); the reference, the previous flat bed and the blade bed
side by side (`compare-*`); close-ups at 1:1 device pixels at a tile crossing and at the far rim,
next to the reference scaled to the same cell size (`closeup-level01-*-1to1`); the same spot drawn
at 2× and at 3× (`closeup-level01-2x-vs-3x-1to1`, see below, still the darker first colours); the
first, too dark colours next to the lighter ones (`closeup-level01-lighter-1to1`); the atlas at 2× (`blade-atlas-2x`).
Shots: `node assets/turnflock/garden/board/bed/bed-shots.mjs <dir> 0,6,10` after
`npm run build:single`.

`production/qa/evidence/garden-board/bed/`: the previous flat bed and fringe band.

## Where it still differs from the reference

- **Drawn at 2×.** The game draws at most 2 pixels per CSS pixel
  (`setPixelRatio(Math.min(devicePixelRatio, 2))` in `src/render/boardView.ts`, not the bed's file),
  and a 3× phone stretches that 1.5 times. The blades are then softer than they are: drawn at 3×
  they are clearly separate and pointed (`closeup-level01-2x-vs-3x-1to1`). Raising the limit to 3
  sharpens the whole board, at 2.25 times the pixels to draw. That is the owner's choice.
- **Finer than the picture.** The picture's bed blades are a little larger and fewer. Larger ones
  turned blocky at 2× (tried: 0.017 to 0.025 cells wide), so they are kept fine.

- **Wider gaps.** The game's gaps between tiles, plus the tile sides seen at the 30° tilt, show
  about twice as much bed as the reference does. That is the tile's size, set in `tile.json` and
  owned by the tile session, not the bed. With narrow gaps, as in the reference, the bed would show
  mostly as light blade tips against the tile edges.
- **Paler tiles.** The game's tiles are a little paler and less yellow than the reference
  (scene light), so the bed is matched to the game's tiles, not to the reference's.
- **Painted shading.** The reference has a slightly darker band where the bed meets the rim. The
  game gets that from the rim picture's own shading.
