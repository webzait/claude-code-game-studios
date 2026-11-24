# Garden theme — the glowing tile and the hint

Part of the garden board (`garden-board.md`). Reference: `design/reference/turnflock/garden/12-sheet-tile-highlight`.
Code: `src/render/parts/garden/highlight.ts`. Data: `data/themes/garden/highlight.json`.
Picture and the script that makes it: `assets/turnflock/garden/board/highlight/`.
Parts page: `src/parts/garden-board/highlight.ts`. Tests: `tests/unit/garden-highlight.test.ts`.
Evidence: `production/qa/evidence/garden-board/highlight/`.

## Approach: the owner's picture is the part

The glow is the owner's own picture, cut out and laid on the tile as a texture. A version painted
in code stays as an option (`style: 'painted'`), not the default.

- `buildTileGlow(style = glow.style)` — a flat patch `body + 2 × reach` cells wide (1.22 cells),
  `lift` above the tile top, with the glow rim as its texture. `'picture'` (default): the cut-out
  `glow-rim.webp`; `'painted'`: painted from `glow.profile`. Its material is its own, for pulsing.
  Normal (not additive) blending, so it reads on light grass too.
- `buildHighlightTile(alt, pegs, style)` — the ordinary grass tile (`buildFloorTile(alt, pegs)`,
  light or dark) with that glow on it, at `userData.glow`. As in the reference, the tile itself is
  not recoloured: the inner glow makes its edge yellow. Built on `buildFloorTile`, so it follows the
  grass tile when that turns into a picture (other session). Contract unchanged: same names, the
  first two parameters as before, a new optional third.
- `glowPulse(t)` — opacity `t` seconds after lighting: `high → low → high` (1 → 0.6 → 1) in
  `pulse.seconds` (1.1 s), a cosine. The game sets `glow.material.opacity = glowPulse(t)`.
- `glowPictureReady` — resolves when the picture has loaded. A glow made before then shows the
  painted glow and switches to the picture as soon as it is in (a few milliseconds in the
  single-file build, where it is inlined), so nothing ever shows an empty glow.
- `hintGlowCells(events, width)` — the cells to light for one hinted command.

## Cutting the picture out

The reference is 120 × 116 px with no transparency: the glow sits on white, and the glow's bright
line is as white as the background, so keying out white would erase the line. `cutout.py` works
along the tile outline instead:

1. A rounded rectangle fitted to the line's centre (88.5 × 83.5 px, corner radius 23 px, so about
   98 px per cell). For every pixel, `d` = distance to that outline.
2. Outside the line: the halo over white, alpha from the blue channel against the halo yellow
   (236, 236, 40), colour that yellow — so no white fringe. On the line, and where it blends into
   the halo: opaque, its own colour. Inside: the yellow fading into the green top, alpha from the
   red channel against the green found 15 px further in along the outline's normal (the green is
   darker at the top than lower down), colour the inner yellow.
3. The top-right quarter is the whole one (on the left the halo runs off the picture, at the
   bottom the line is wider), so it is mirrored to all four corners: the rim is even all round.
4. Mapped onto a square for `body + 2 × reach`, sampled 4× finer, premultiplied, scaled down with
   Lanczos to 176 px, WebP with alpha (quality 90). **10.5 kB** (about 14 kB as base64 in the
   single-file HTML).

176 px is twice the largest on-screen size: the biggest tile on a 390 px phone is 65 CSS px, and
the glow patch is 1.22/0.9 × 65 ≈ 88 px: 2 texture pixels per CSS pixel, 2 per 3 device pixels on a
3× screen. Checked at full 3× resolution on 4×4 (`crop-4x4-3x`): clean, no blur, no steps.

## What differs from the reference (honest)

- **Sharpness.** The source has only ~98 px per cell; the cut-out is scaled up from that, so the
  cream line is a little softer than the painted one can be. Under the game camera (30°, perspective)
  it does not look blurry, stretched or jagged (evidence: `game-size-*`, `picture-vs-code-6x6`).
- **Mirrored.** All four corners are the reference's top-right corner; the reference's small
  unevenness (wider bottom line) is gone on purpose.
- **Inner glow.** It keeps the original's slight mottling, as the picture does.
- **Shape.** The reference outline is a little wider than tall with rounder corners; it is mapped
  onto our square tile (radius 0.21 of 0.9), so the corners are a touch tighter than in the picture.
- **Tile top.** The reference's tile top is a deeper green gradient; ours is the grass tile's
  (another session's part).

## Readability at game size

On 4×4, 6×6 and 8×8 boards on a 390 px phone (tiles 65, 47 and 37 px): the cream line reads clearly
on light and dark tiles; the yellow halo is subtle on light tiles and clearer on dark tiles and the
grass bed. On 8×8 the glow is small but still the brightest thing on the board. The pulse (never
below 0.6) keeps the line visible at its lowest point and adds motion, which is what draws the eye.

## Hint in the garden (proposal)

The robot hint (`boardView.showHint`) draws, per robot, an arrow along its way (moved or exited),
a bump bar (blocked), and quarter arcs for turns.

Proposal for the garden: **the cells the chicks will walk to glow**, instead of arrows.

- Each chick that moves or exits: its destination cell gets `buildTileGlow()` (`hintGlowCells`
  gives the cells from the engine's preview events, each cell once).
- A chick that is blocked lights nothing: it stays where it is. (The bump bar could stay; owner's
  call. Without it, "nothing lights" itself says "this one does not move".)
- Turns: keep the turn arcs for chicks that turn, so a turn without a step is still shown.
- All glows pulse together (`glowPulse`) from when the hint appears until it is cleared.

Worked example on the parts page (`garden-hint`): one command, three chicks. (1,3) facing east walks
to (2,3), a dark tile; (3,2) facing north walks to (3,1), a light tile; (5,4) walks into the rim and
stays. `hintGlowCells` → cells 20 and 9: those two glow. The chicks there are yellow stand-ins.

**The rule of the hint does not change** — which command is hinted and when stay as they are; only
its picture changes. The theme session wires it: in `showHint`, for the garden, lay
`buildTileGlow()` on each `hintGlowCells` cell and pulse it, in place of the arrow shapes.

## The painted option and its formula

`glow.profile` is a list of stops `[d, colour, opacity]`, `d` in cells from the tile outline
(negative inside), measured from the same picture by `cutout.py` (mean colour and opacity per 1 px
band of `d`). Between stops, colour and opacity are interpolated linearly; beyond the ends the end
stop holds (opacity 0). The 512 px texture evaluates `glowAt(roundedSquareDistance(x, y, body/2,
radius))` per pixel, so its line lies exactly on the grass tile's outline.

## Cost

One glow: 2 triangles, its own material, so 1 extra draw call per lit cell (two for a typical hint).
The picture: 10.5 kB WebP. Nothing is in the game yet (`board.ts` of the garden is only on the parts
page), so the single-file game is unchanged for now.

## Tuning knobs

| Key | Value | What it does |
|---|---|---|
| `glow.style` | `picture` | Default look: the cut-out picture or the painted glow |
| `glow.profile` | 14 stops | Painted look: colour and opacity against distance to the outline |
| `glow.reach` | 0.16 | How far out the glow patch reaches (cells); picture and profile are made for it |
| `glow.lift` | 0.02 | Height above the tile top, so the fur does not poke through the line |
| `glow.texture` | 512 | Painted texture size in pixels |
| `glow.pulse.seconds` | 1.1 | One pulse cycle |
| `glow.pulse.low`, `.high` | 0.6, 1.0 | Opacity range of the pulse |
| `cutout.file`, `.pixels` | `glow-rim.webp`, 176 | The picture and its size (made by `cutout.py`) |

## For other sessions (not changed here)

- `assets/provenance.yaml` (shared) needs an entry for `turnflock/garden/board/highlight/glow-rim.webp`:
  origin the owner (12-sheet-tile-highlight), made by `cutout.py` in the same folder.
- `design/themes/garden-board.md` still describes the glow as "a little brighter and yellower ...
  additive light"; it should point here.
- The rim card (`src/parts/garden-board/rim.ts`) draws its 6×6 board with two lit cells before the
  picture has loaded, so there they show the painted glow.
