# Garden theme — the board

Part of the garden (chick) theme. Built loose, on the parts page only; the theme session
puts it into the game. References: `design/reference/turnflock/garden/` 01, 02, 03, 11, 12, 13.

## What there is, and who works on it

Each part has its own code file, data file, parts-page card file and test file, so each can be
worked out in its own session without touching the others.

| Part | Function | Code (`src/render/parts/garden/`) | Data (`data/themes/garden/`) | Parts page (`src/parts/garden-board/`) | Tests (`tests/unit/`) |
|---|---|---|---|---|---|
| Grass tile, light and dark | `buildFloorTile(alt, pegs)` | `grass.ts` | `tile.json` | `tile.ts` | `garden-tile.test.ts` |
| Glowing tile, hint glow | `buildHighlightTile(alt, pegs)`, `buildTileGlow()`, `hintGlowCells` | `highlight.ts` | `highlight.json` | `highlight.ts` | `garden-highlight.test.ts` |
| Dirt tile (new type) | `buildDirtTile(alt, pegs)` | `dirt.ts` | `dirt.json` | `dirt.ts` | `garden-dirt.test.ts` |
| Rim, underlay, whole board | `buildRim`, `buildUnderlay`, `boardFootprint`, `boardPixels` | `rim.ts`, `underlay.ts`, `layout.ts` | `rim.json`, `underlay.json` | `rim.ts` | `garden-rim.test.ts` |

Shared, changed only when every part needs it: `board.ts` (the contract: it re-exports every
part under the robot theme's names), `geometry.ts`, `paint.ts`, `src/parts/garden-board/render.ts`,
`index.ts`, `garden-board.css` and `tests/unit/garden-helpers.ts`. The glowing and dirt tiles and
the rim's inner grass read the grass tile's body and fur from `grass.ts` and `tile.json`, and only
read them.

The robot counterparts are in `src/render/parts/board.ts`: `buildFloorTile`, `buildRim`,
`buildUnderlay`, `boardFootprint`, `boardPixels`, with the same signatures. Same units: one cell = 1,
the floor at y = 0, the tile top at 0.2, so a chick stands where a robot stands.

## How it is made

- **Grass tile.** A rounded cushion 0.9 wide inside the 1-cell square (the grass bed shows
  between tiles), a large rounded shoulder, and two bands of grass blades: one draped over the
  shoulder (the fuzzy outline seen from above) and one up the side. The top is a 512 px
  texture painted at start-up: mottled lime, fine fur strokes, six faint clovers. The dark tile
  is 10% darker and has its texture turned half round.
- **Glowing tile.** The grass tile a little brighter and yellower, with a flat patch of additive
  light on top: a bright yellow-green line on the tile outline fading outward. Its material is
  its own, so it can pulse (`glow.pulse`).
- **Dirt tile.** A soil floor, sunk 0.045 into a frame of rounded clay blocks (three per side,
  one per corner), short grass round the foot and tufts over the near edge.
- **Rim.** Three bundles of four thin twigs, twisted round the rim's centre line (a rounded
  rectangle from `boardFootprint`), each bundle twisting on itself, three fine twigs winding the
  other way over them, and a core of the same bark. The bark is glossy (clearcoat) and painted at
  1024 px; the upper side of each twig is brighter. The twist count round the whole rim is a
  whole number, so the braid closes without a seam on every board from 4×4 to 8×8, square or not.
  Grass grows against its inside. Leaves, vines and white flowers sit at fixed fractions of each
  side (`decor.clusters`), modelled on `03-rim-vines`: never random, the same every load.
- **Underlay.** A plate tucked under the braid; its top is the grass bed (deeper green, dense
  short blades, repeating every cell), its sides dark soil.

All textures are painted on a canvas from fixed seeds when the module loads: nothing is added to
the single-file build but code (no image files). The reference pictures appear only on the parts
page, as 700 px WebP copies in `src/parts/garden/` (about 117 KB together).

## Cost on a phone

Measured on the parts page (fused, as the game fuses the board):

| | Garden | Robot |
|---|---|---|
| One tile | 300 triangles | 216 triangles |
| Dirt tile | about 1,900 triangles (the clay blocks) | — |
| Rim 6×6 | about 39,100 triangles, 3 draw calls | 4,704 triangles, 1 draw call |
| Board 4×4, fused | 33,908 triangles, 5 draw calls | 7,596 triangles, 3 draw calls |
| Board 6×6 with two glowing tiles | 50,230 triangles, 7 draw calls | 12,732 triangles, 3 draw calls |
| Board 8×8, fused | 69,120 triangles, 5 draw calls | 19,596 triangles, 3 draw calls |

Most of the triangles are the full braid of thin twigs the owner asked for (2026-11-24). It is a
single draw call; a phone draws 70,000 triangles easily, the number of draws matters more. A test
keeps an 8×8 board under 70,000. The textures are painted at start-up at up to 1024 px (about
4 MB of graphics memory each), and add nothing to the file size.

## Notes for the theme session

- `fuse` keeps one mesh per material but drops `customDepthMaterial`: after fusing, give the fur
  mesh `customDepthMaterial` back (the `furDepth` idea in `board.ts`), or its shadow is square.
- `boardSize()` in `boardView.ts` adds `PARTS.underlay.lip`; for the garden use the garden
  `boardFootprint` (its underlay sits under the braid, `lip` is negative).
- The game's hemisphere light has a blue ground colour (`light.ground`); the parts page uses the
  same. A warmer ground tone would suit the garden better; that is the theme session's call.

## Hint in the garden (proposal)

The robot hint draws arrows and arcs on the board. In the garden the proposal is to light the
cells the flock will step onto with the glowing tile's glow (`hintGlowCells` gives them from the
engine's preview events; a blocked chick lights nothing) and keep the turn arcs for chicks that
only turn. The rule of the hint does not change, only its picture.

## Dirt tile: what it could mean (proposals — the rules are unchanged)

The game has no dirt tile. Ideas, from small to large; the owner decides:

1. **Decoration only.** Dirt cells are floor like grass, used to draw paths through a level.
   No rule change; gives level art variety.
2. **Seed bed.** A chick that walks over a dirt cell plants it: it turns into grass. Clearing a
   level with every dirt cell planted gives a bonus (a star condition). The core moves stay the
   same; it adds an optional goal.
3. **Mud.** A chick that steps on dirt stops there for the rest of that command (it does not
   slide on in a later step). This changes movement and needs the solver and level checks.

Recommendation: 1 now (free), 2 as a later optional goal.

## Where it still differs from the references

- The tile's fur is short and reads as a soft, slightly lighter edge at game size; in `02-tile-grass`
  the fur is longer and more visible. Longer fur cards stick out between tiles at 30° tilt.
- The braid now has twelve thin twigs and fine twigs over them, with gloss; the reference reads
  smoother and more orange, as if the twigs were polished. Ours is a little narrower (about 0.45
  of a cell against 0.5).
- The reference board uses one tile colour; ours has the light/dark checkerboard as asked.
- The clover pattern is faint by design; at game size it is barely visible, as in the reference.
- The dirt tile's clay blocks are a little smaller and more separate than in `13-sheet-tile-dirt`.
