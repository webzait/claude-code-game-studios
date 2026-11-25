# Garden theme — the dirt tile

Part of the garden board (`design/themes/garden-board.md`). Reference: `13-sheet-tile-dirt` in
`design/reference/turnflock/garden/`. Built loose, on the parts page only; not in the game.

## What it is now: the owner's picture

`buildDirtTile(alt, pegs)` is the owner's picture on a plain block, not a model of it.

- **The picture.** `assets/turnflock/garden/board/dirt/dirt-tile.webp`, 256 × 320 px, 7.4 kB, one
  atlas: rows 0–255 the tile's top (the earthen floor in its frame of terracotta blocks, grass over
  the near corners), transparent outside the rounded corners; 16 rows of padding; rows 272–319 the
  band of the front wall (block faces, soil foot, grass at the corners). Made by `cut.py` next to it
  (`python3 assets/turnflock/garden/board/dirt/cut.py` from the repo root).
- **How it is cut.** The source is 105 × 105 px on white with a grey drop shadow. Tile pixels are
  told from paper and shadow by colour saturation (the tile is all warm clay, soil and grass; paper
  and shadow are colourless), so neither white nor grey ends up in the picture. The outermost pixel
  ring (half paper) is dropped and tile colours are bled outward under the transparent corners, so
  no halo appears when the texture is filtered. The top is cropped at the measured tile edges
  (x 4.5–98.5, y 5.5–86.5), stretched to a square (it is foreshortened in the picture, and the game's
  30° camera foreshortens it again by about the same amount) with Lanczos, and lightly sharpened
  (unsharp mask, radius 1.2, 45%). The front band (rows 86.5–97.6) is unrolled row by row to the
  full tile width.
- **The block.** Exactly the grass tile's size (the owner, 2026-11-25: "if it is used, it must be
  the same size as the grass tile"): a rounded square as wide as the grass tile's top
  (`image.top`, 1.0) with its corner radius (`image.topRadius`), `tile.height` (0.2) tall, 16 steps
  per corner. A test checks the two tiles measure the same. Its top carries the top of the
  picture; its side carries the band, running along the near wall, up the right, back along the far
  wall and down the left, mirrored on every other wall so it never jumps at a corner. A thin lip at
  the top edge catches a little light. 340 triangles, one material: every dirt tile on a board is
  one draw call together.
- **Light.** The picture is lit as the grass tiles are (standard material, same lights), so it sits
  in the same light as its neighbours. `picture.brightness` (1.05) brings its floor to the
  reference's colour under the parts page's light (measured: floor 204/121/55 in the reference).
- **No checkerboard.** The owner chose one grass tile everywhere, as in `01-board-full` (grass tile
  session, 2026-11-24). The dirt tile follows: `alt` is kept in the signature but gives the same
  tile. `picture.checker: true` brings back a second tile, 6% darker (`picture.altShade`) and
  mirrored left to right so the grass stays on the near side.
- **Loading.** The picture loads a moment after start-up. Until then the tile shows in a plain soil
  colour (`picture.fallback`); `dirtTileReady` (from `src/render/parts/garden/dirt.ts`) settles when
  the picture is on. In the game this is a flicker of a frame or two at most; anything that draws a
  single still (the parts page) must wait for it.
- **The earlier tile, modelled in code** (clay blocks, painted soil, grass tufts), stays available as
  `buildDirtTile(alt, pegs, 'modelled')` or `buildDirtTileModelled(alt, pegs)`, sizes under `dirt` in
  `data/themes/garden/dirt.json`. Its texture is painted only when it is first used.

The contract is unchanged: same name, the first two parameters the same, one cell = 1, floor at
y = 0, top at 0.2. `board.ts` re-exports it; `gardenBoardMaterials.dirt` is the picture material.

## Is the small picture sharp enough?

The top of the tile has about 94 × 81 source pixels. On a 390 px phone a tile is 37 to 65 CSS px
wide (8×8 to 4×4), so 111 to 196 device pixels on a 3× screen. At 8×8 and 6×6 the picture is shown
at or below 1.5× its own size and reads as crisp as the grass tiles beside it. At 4×4 on a 3× screen
it is stretched just over twice and is a little softer than the grass tile (whose texture is painted
at 1024 px), but not blurry or blocky: the clay blocks, the joints and the pebbles stay clear.
Upscaling further in the file (more than 256 px) would add bytes without adding detail. If the
owner wants it crisper at 4×4, the honest fix is a larger source picture of this tile (about 250 px
across); `cut.py` then needs only the new measurements in `picture.source`.

Evidence: `production/qa/evidence/garden-board/dirt/` (01 next to the reference, 02 and 03 under the
game camera at 4×4, 6×6 and 8×8, 04 the 4×4 centre at device pixels next to the reference).

## Where it still differs from the reference

- The reference is drawn from about the game's angle, with its own light from the upper left. On
  the block that painted light is combined with the scene light, so the front wall reads a touch
  darker than in the reference.
- The side walls (left, right and far) carry the same band as the front wall; the far one is never
  seen, the left and right only as a sliver at the board's edges.
- The tile's corners (radius 0.16 cell) are a little tighter than the grass tile's (0.21), as in the
  reference sheet, where the dirt tile is squarer than the grass tile.
- The grass at the near corners is part of the picture, not standing blades: it does not stick out
  past the tile's outline as the grass tiles' fur does.

## Cost on a phone

| | Picture tile (default) | Modelled tile |
|---|---|---|
| One tile | 340 triangles | 1,918 triangles |
| Draw calls on a fused board | +1 for all dirt tiles together | +1 (soil); clay and tufts share the plain and fur materials |
| File size | 7.4 kB WebP (about 10 kB as base64 in the single file) | 0 (painted at start-up, about 4 MB graphics memory) |
| Graphics memory | 256 × 320 with mipmaps, about 0.4 MB | 1024 × 1024, about 5.6 MB |

The game itself does not import the garden board yet, so `npm run build:single` is unchanged
today; once the theme session uses the tile, the single file grows by about 10 kB.

## What it could mean in the game (proposals — the rules are unchanged)

The game has no dirt tile. A reminder of the rules this has to fit: every command turns one colour
90° clockwise (or none, for Forward) and then every chick tries one step forward; chicks reach the
exit and are collected; the solver (BFS on the same engine) proves each level's shortest solution
and its budget (shortest plus two); levels are stored with a witness solution and certified by
`npm run certify`.

### 1. Decoration only

Dirt cells are floor exactly like grass. A level marks them only for the picture (a path to the
gazebo, a bed in a corner).

- **Levels:** one new optional field in the level format (a list of dirt cells, or a letter in the
  board text that the parser reads as floor). Existing levels are untouched; dirt can be added to
  any of them later as art.
- **Solver and checks:** nothing changes. The engine never sees the difference, so par, budgets and
  witness solutions stay valid; the level tools only need to pass the field through.
- **Player:** variety on the board, and paths can quietly hint at the route. Nothing new to learn.
- **Cost:** small; theme session only (draw `buildDirtTile` where a level says dirt).

### 2. Seed bed (an optional goal)

A chick that steps onto a dirt cell plants it: the cell turns to grass for the rest of the attempt.
Clearing a level with every dirt cell planted earns a bonus (for example a separate badge or a
fourth "garden" star); clearing it without is still a win.

- **Levels:** a new page of levels designed around beds placed off the shortest route, so planting
  all costs a few extra moves or a different order of commands. Old levels stay as they are.
- **Solver:** the win rule does not change, so par and budget stay as now. A second search answers
  "can every bed be planted within the budget?": the state adds a planted bit per dirt cell
  (states × 2^beds, fine for up to about 8 beds on these boards). `certify` must store a second
  witness for the planted goal, and the level tools must report how many extra moves it costs.
- **Undo, hint, extra moves:** Undo must unplant; the hint stays about the win, not the beds.
- **Player:** a reason to replay a solved level, without making the core harder.
- **Cost:** medium: engine (a planted set), level format, solver goal, certify, a planting animation
  (dirt to grass), the bonus in the economy (`design/economy.md`).

### 3. Mud

A chick that steps onto a dirt cell gets stuck: on the next command it turns (if its colour is
called) but does not step. After that it walks on normally.

- **Levels:** a new mechanic for a page of its own, as the turn tile, the exit per colour and the
  plate and gate each had. Mud lets one chick fall a step behind the flock, which opens new puzzles
  (holding one chick back while the others move on).
- **Solver:** the state adds a stuck flag per chick (at most × 2 per chick, in practice much less);
  BFS stays exact. The engine's step order needs a rule for a chick stepping into a stuck chick
  (it is blocked, as by any chick that does not move). Every level tool, the parser, certify and
  the move-preview events (the hint glow) must know mud.
- **Player:** one more rule to learn, and a hidden state (who is stuck) that must be drawn
  (for example a chick sunk a little, with mud splashes).
- **Cost:** large: engine, solver, tools, a page of new levels, an animation, a tutorial level.

### Advice

**1 now**: it costs nothing in rules or levels and gives the garden its paths. **2 later**, if the
garden theme needs replay value: it adds a goal without touching the core moves or any existing
level. **3 only as a planned new mechanic** with its own page, in the same way the turn tile was
agreed; it is a rule change, not theme art. The owner decides.
