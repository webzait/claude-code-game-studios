# Garden theme — the glowing tile and the hint

Part of the garden board (`garden-board.md`). Reference: `design/reference/turnflock/garden/12-sheet-tile-highlight`.
Code: `src/render/parts/garden/highlight.ts`. Data: `data/themes/garden/highlight.json`.
Parts page: `src/parts/garden-board/highlight.ts`. Tests: `tests/unit/garden-highlight.test.ts`.
Evidence: `production/qa/evidence/garden-board/` (`compare-garden-tile-highlight`, `garden-glow-source`,
`garden-glow-pulse`, `garden-hint`, `crop-glow-picture-vs-code`, `game-size-glow-6x6`).

## What it is

- `buildHighlightTile(alt, pegs)` — the ordinary grass tile (`buildFloorTile(alt, pegs)`, light or
  dark) with a glow on it, at `userData.glow`. As in the reference the tile itself is not
  recoloured; the inner glow turns its edge yellow. Because it builds on `buildFloorTile`, it
  follows the grass tile when that becomes a picture (other session).
- `buildTileGlow(map?)` — the glow alone: a flat patch `body + 2 × reach` wide, `lift` above the
  tile top. A cream line 0.04 cell wide exactly on the tile outline, a yellow halo out to
  `reach` (0.16 cell), and yellow fading inward over 0.12 cell. Normal blending (the earlier
  additive glow washed out on the light tile). Its material is its own, for pulsing.
- `glowPulse(t)` — opacity `t` seconds after the glow lit: a cosine swing `high → low → high`
  (1 → 0.6 → 1) in `pulse.seconds` (1.1 s). The game sets `glow.material.opacity = glowPulse(t)`.
- `glowAt(d)` — the glow's colour and opacity at distance `d` from the tile outline.
- `hintGlowCells(events, width)` — the cells to light for one hinted command.

## The glow's profile (the formula)

`glow.profile` is a list of stops `[d, colour, opacity]`, `d` in cells from the tile outline
(negative inside). Between stops colour and opacity are interpolated linearly; before the first
and after the last the end stop holds (opacity 0). The texture (512 px) is painted by evaluating
`glowAt(roundedSquareDistance(x, y, body / 2, radius))` per pixel, so the line lies on the grass
tile's own outline (`tile.json` `body`, `radius`).

The stops were measured from the reference by `assets/turnflock/garden/board/highlight/cutout.py`:
a rounded rectangle fitted to the line (centre line 88.5 × 83.5 px, corner radius 23 px, so about
98 px per cell), and per 1 px band of distance the mean colour and opacity (halo: from the blue
channel against white; inner glow: from the red channel against the green top).

## Picture or code

The brief asked for the cut-out picture as the texture where that holds up. It was tried:
`assets/turnflock/garden/board/highlight/glow-rim.png` (128 px, 11.5 KB), shown on the parts page
next to the code glow, on the same 6×6 board under the game camera on a 390 px phone.

- **Sharpness.** Reference: about 98 px per cell. Game: a tile is 37 to 65 CSS px on a 390 px
  phone (47 px on 6×6), so 111 to 195 device pixels at 3×: the picture is stretched up to 2×.
  Under the tilted game camera the result is *usable*: the line is a little softer, nothing is
  blurry. Sharpness alone would not rule the picture out.
- **What does.** The picture has no transparency: the glow sits on white, and the line is as white
  as the background, so it cannot be keyed out; it can only be cut along a fitted outline. Then
  the halo is missing on the left (it runs off the picture), the line is wider at the bottom than
  at the top, the grass mottling of the top stays in the inner glow, and the outline (slightly
  wider than tall, rounder corners) does not quite match our tile. It would also be the one
  board part that is a file, not code.

So the game uses the glow in code, built from the measured profile: it looks the same at game
size (see `crop-glow-picture-vs-code`), fits the tile exactly, and stays sharp. The cut-out stays
in `assets/` for the comparison on the parts page only; it is not in the game build.

## Readability at game size

On the 6×6 board on a 390 px phone (tile 47 px) the cream line reads clearly on light and dark
tiles; the yellow halo is subtle on the light tile and clearer on the dark tile and the grass
bed. The pulse (never below 0.6) keeps the line visible at its lowest point and adds motion,
which is what draws the eye.

## Hint in the garden (proposal)

The robot hint (`boardView.showHint`) draws, per robot, an arrow from the robot along its way
(moved or exited), a bump bar (blocked), and quarter arcs for turns.

Proposal for the garden: **the cells the chicks will walk to glow**, instead of arrows.

- For each chick that moves or exits, its destination cell gets `buildTileGlow()`
  (`hintGlowCells` gives the cells from the engine's preview events, each once).
- A chick that is blocked lights nothing: it stays where it is. (The bump bar could stay; the
  owner decides. Without it, "nothing lights" itself says "this one does not move".)
- Turns: keep the robot theme's turn arcs for chicks that turn, so a turn without a step is still
  shown.
- The glows pulse together (`glowPulse`), from when the hint appears until it is cleared.

The worked example on the parts page (`garden-hint`): one command, three chicks. (1,3) facing east
walks to (2,3), a dark tile; (3,2) facing north walks to (3,1), a light tile; (5,4) walks into the
rim and stays. `hintGlowCells` → cells 20 and 9: those two glow. The chicks there are yellow
stand-ins; the real chicks are another session's.

**The rule of the hint does not change** — which command it hints and when it shows are
untouched; only its picture changes. The theme session wires it: in `showHint`, for the garden,
lay `buildTileGlow()` on each `hintGlowCells` cell and pulse it, in place of the arrow shapes.

## Tuning knobs

| Key | Value | What it does |
|---|---|---|
| `glow.profile` | 13 stops | Colour and opacity against distance to the tile outline (measured) |
| `glow.reach` | 0.16 | How far out the glow patch reaches (cells); the last stop must not exceed it |
| `glow.lift` | 0.02 | Height above the tile top, so the fur does not poke through the line |
| `glow.texture` | 512 | Painted texture size in pixels |
| `glow.pulse.seconds` | 1.1 | One pulse cycle |
| `glow.pulse.low`, `.high` | 0.6, 1.0 | Opacity range of the pulse |
| `cutout.file`, `.pixels` | — | The cut-out picture, parts page only |
