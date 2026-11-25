# Garden theme — the grass tile from the owner's picture

Part of the garden board (`garden-board.md`). Function: `buildFloorTile(alt, pegs)` in
`src/render/parts/garden/grass.ts`, data in `data/themes/garden/tile.json` (`image`), parts-page cards
in `src/parts/garden-board/tile.ts`, tests in `tests/unit/garden-tile.test.ts`.
References: `02-tile-grass` (source), `25-tile-grass-fur-small` and `26-tile-grass-fur` (the owner's
2026-11-25 wish: visible grass texture, a ragged edge, tiles closer together), `11-sheet-tile-grass`,
and `01-board-full` for how tiles sit on the board.

## What it is

The owner's picture, not a model of it. `assets/turnflock/garden/board/tile/cut.py` cuts
`02-tile-grass` into one atlas, `grass-tile.webp` (512 × 640 px, 67.8 kB). Before cutting it lifts
the picture's fine detail (the picture plus twice itself less a 5 px blur), so the grass strokes
and the blades of the side still read at game size: the owner's wish for grass texture.

Why not `26-tile-grass-fur` itself: it is 607 px wide and soft (an enlarged JPEG). Cut out, enlarged
and sharpened, its top still reads as a flat, pale field on the board (compare
`production/qa/evidence/garden-board/tile/source-26-left-vs-02-lifted-right-game-size.webp`). It
stays in `cut.py` as a choice (`python3 cut.py preview.png 26-tile-grass-fur.jpg`).

Why not "in four" (four corner pieces or a nine-part build): that pays off when the picture is
sharper than the tile needs or the tile changes shape. Neither holds: the cells are square, and one
512 px picture is already more than twice a tile on the phone. Four pieces would add seams and no
detail.

The pieces:

- **Top (rows 0–511).** The tile's top, cut out on a transparent ground. Alpha comes from how green a
  pixel is; the paper white is taken back out of the edge colours (no white halo), and transparent
  pixels take the colour of the nearest fur, so filtering adds no dark rim. The picture shows the tile
  tilted about 26° (nearly the game's 30°), so the top is stretched back to a square. Its front edge
  is hidden by the side on the picture: the outline there is the back edge mirrored, cross-faded in.
- **Side strip (rows 528–639).** The straight middle of the front side's fur, stretched back to its
  true height and made to repeat sideways without a seam.

In 3D: a rounded square 1.0 wide at the tile height (0.2) carries the top, its fur tips reaching
0.99 of a cell, so neighbours stand close as on `01-board-full` (0.07 cell of grass bed between fur
tips, it was 0.12; the gap setting `board.grid.gap` is unchanged). Under it a thin body (0.92 wide, straight sides from the floor to just under the top) wears the side strip, repeated a
whole number of times round the outline. 96 triangles, one material, so the whole board's tiles fuse
into one draw call (the robot tile: 216 triangles, one draw).

Every tile is the same, as on `01-board-full`: the owner chose this on 2026-11-24 (no light/dark
checkerboard). `buildFloorTile(alt, …)` keeps its `alt` parameter for the contract; with
`image.checker` set to true the alt tile is the same picture tinted (`altTint`, about 10% darker).
The owner also chose to keep the thin body with its side fur.

## Why a thin body and not a flat picture

Under the game's camera (30° from straight down) the front of a tile 0.2 high takes about a tenth of
the tile's height on screen, 4–6 px on a phone. A flat picture at y = 0.2 would show the grass bed
under its front edge, and its shadow would sit apart from it: the tile reads as a floating sticker.
The owner's picture shows that side as a dark band of fur; the thin body shows exactly that band, from
the same picture. Its cost is 40 triangles per tile and no extra draw.

## Sharpness

At game size a tile is 37 px (8×8) to 65 px (4×4) wide on a 390 px phone, so 111–195 device pixels at
3× density. The top texture is 512 px: more than twice the largest, with mipmaps and anisotropic
filtering for the tilt. The fur edge is blended (not cut at an alpha threshold), so it stays soft at
any size. Close up (about 800 px per tile on the parts page) it is a little soft but not blurred.

## Loading

The atlas is decoded before any tile is built (top-level `await` in `grass.ts`), so the first frame
already shows it; a 32 kB WebP decodes in a few milliseconds. Everything that imports `grass.ts`
waits for that. Outside a browser (unit tests) there is no image and the tile uses its vertex colours.
In the single-file build the atlas adds about 43 kB (base64). The game does not import it yet.

## Kept from the earlier version

`buildFloorTileCode(alt, pegs)` is the tile modelled in code (painted lawn texture and two bands of
grass-blade cards). `bodyRings`, `tileFur`, `furBand`, `furMesh`, `furMaterial`, `addPegs`, `altTint`,
`grassMaterial` and `grassTileTexture` stay as they were: the glowing tile, the dirt tile and the rim
use them.

## Where it still differs from the references

- The lighting is baked into the picture (light from the upper left); every tile shows the same light,
  the game's sun does not move it. On the board this is hardly visible.
- The side's fur strip has a smoother band in its middle (as on the picture) that, repeated round the
  tile, shows as a faint horizontal streak close up; at game size it is 1–2 px.
- `01-board-full` draws the tiles a touch flatter and less fuzzy than `02-tile-grass`; we follow
  `02-tile-grass`, and the owner chose to keep the side.
- The game's hemisphere light adds a little blue: the rendered top is about 3% darker and slightly less
  saturated than the picture (`image.light` is set to 1.04 to make up most of it).

## Notes for the theme session

- `fuse` drops `customDepthMaterial`. The tile's top is a rounded square close to the fur outline, so
  even then its shadow is the right shape.
- The material blends (`transparent`) and writes depth. Within a tile the side is drawn before the top.
- Pegs use the shared `plainMaterial` (the atlas has no peg colours).
