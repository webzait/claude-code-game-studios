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

## What it is now

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

## Evidence

`production/qa/evidence/garden-board/bed/`: levels 1, 7 and 11 at 390×844 with
deviceScaleFactor 3 (`in-game-*`). The reference, the old bed and the new bed side by side
(`compare-*`, at half size). A close-up at 1:1 device pixels next to the reference at the same
cell size (`closeup-level01-bed`, with the first try between). The patch repeated 2×2 (`bed-texture-2x2-repeat`).

## Where it still differs from the reference

- **Wider gaps.** The game's gaps between tiles, plus the tile sides seen at the 30° tilt, show
  about twice as much bed as the reference does. That is the tile's size, set in `tile.json` and
  owned by the tile session, not the bed. With narrow gaps, as in the reference, the bed would show
  mostly as light blade tips against the tile edges.
- **Paler tiles.** The game's tiles are a little paler and less yellow than the reference
  (scene light), so the bed is matched to the game's tiles, not to the reference's.
- **Painted shading.** The reference has a slightly darker band where the bed meets the rim. The
  game gets that from the rim picture's own shading.
