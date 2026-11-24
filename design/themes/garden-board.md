# Garden theme — the board

Part of the garden (chick) theme. Built loose, on the parts page only; the theme session
puts it into the game. References: `design/reference/turnflock/garden/` 01, 02, 03, 11, 12, 13.

## What there is

| Part | Function (`src/render/parts/garden/board.ts`) | Robot counterpart (`src/render/parts/board.ts`) |
|---|---|---|
| Grass tile, light and dark | `buildFloorTile(alt, pegs)` | `buildFloorTile(alt, pegs)` |
| Glowing tile | `buildHighlightTile(alt, pegs)`, the glow alone `buildTileGlow()` | — (the robot hint draws arrows) |
| Dirt tile (new type) | `buildDirtTile(alt, pegs)` | — |
| Twig rim with leaves and flowers | `buildRim(cols, rows, gap)` | `buildRim(cols, rows, gap)` |
| Underlay with grass bed | `buildUnderlay(cols, rows, gap, pegs)` | `buildUnderlay(cols, rows, gap, pegs)` |
| Board size | `boardFootprint`, `boardPixels` | same names, same signatures |
| Hint cells | `hintGlowCells(events, width)` | — |

Same units as the robot parts: one cell = 1, the floor at y = 0, the tile top at 0.2, so a
chick stands where a robot stands. Every size and colour is in `data/themes/garden/board.json`;
the plain arithmetic (rim path, decoration places, hint cells) is in `layout.ts` and unit-tested
in `tests/unit/garden-board.test.ts`.

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
- **Rim.** Three twigs twisted round the rim's centre line (a rounded rectangle from
  `boardFootprint`), with a dark core between them. The twist count round the whole rim is a
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
| Dirt tile | 1,918 triangles (the clay blocks) | — |
| Rim 6×6 | 13,632 triangles | 4,704 triangles |
| Board 4×4, fused | 16,220 triangles, 5 draw calls | 7,596 triangles, 3 draw calls |
| Board 6×6 with two glowing tiles, fused | 24,754 triangles, 7 draw calls | 12,732 triangles, 3 draw calls |
| Board 8×8, fused | 35,724 triangles, 5 draw calls | 19,596 triangles, 3 draw calls |

The five draws are: grass tiles, grass fur, grass bed, bark, leaves/flowers/soil. A glowing tile
adds one draw per glow (each has its own material so it can pulse); a dirt tile adds one
material. Under 36,000 triangles is checked by a test.

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
- The braid is a rope of three thick twigs; the reference rim reads as a bundle of many fine
  twigs with glossy highlights. Ours is a little narrower (about 0.45 of a cell against 0.5).
- The reference board uses one tile colour; ours has the light/dark checkerboard as asked.
- The clover pattern is faint by design; at game size it is barely visible, as in the reference.
- The dirt tile's clay blocks are a little smaller and more separate than in `13-sheet-tile-dirt`.
