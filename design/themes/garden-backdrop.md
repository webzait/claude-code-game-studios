# Garden theme — backdrop and edge decor

Part of the garden (chick) theme. Built on its own and shown on the parts sheet
(`npx vite build --mode parts`, cards *Tuinthema · …*); not in the playable game yet.
References: `design/reference/turnflock/garden/10-backdrop-garden`, `07-birdhouse`,
`09-flower-arch`, `06-bush-flowers`, `17-sheet-bushes-plants`.

## Files

| What | Where |
|---|---|
| Numbers (crops, rows, qualities, colours) | `data/themes/garden/backdrop.json` |
| Pictures (WebP, cut from the owner's pictures) | `src/ui/themes/garden/garden-*.webp` |
| Pipeline that makes them | `tools/asset-pipeline/build-garden-backdrop.py` |
| Stylesheet, all under `[data-theme="garden"]` | `src/ui/themes/garden/garden-scene.css` |
| Picture per decor place, `applyGardenDecor()` | `src/ui/themes/garden/gardenArt.ts` |
| Layout sums as functions | `src/ui/themes/garden/backdropLayout.ts` |
| Unit tests | `tests/unit/garden-backdrop.test.ts` |
| Parts sheet section | `src/parts/gardenBackdrop.ts`, `src/parts/garden-backdrop.css` |
| Evidence and its script | `production/qa/evidence/garden-backdrop/`, `tools/asset-pipeline/garden-backdrop-shots.mjs` |

## Backdrop

Same markup as the harbour (`index.html` `#backdrop`), so the theme switch is one attribute on
the root element; the harbour's `<i>` layers are hidden under the garden.

1. **Scene**: rows 0–1412 of the owner's backdrop, unchanged, always the screen's width
   (one scale both ways: never distorted, never an empty side).
2. **Anchor**: row 700 of the picture (the lawn just in front of the birdhouse posts and the
   arch) lies on the board's top edge, computed from the game's own zone clamps
   (top bar `clamp(56px, 11.4cqh, 96px)`, buttons `clamp(62px, 11cqh, 92px) + 88px`, board
   `min(100cqw, 560px) − 24px`). The birdhouses, gazebo and arch stand in the strip between
   the top bar and the board; the lawn edge (row 995) is behind the board, so the board lies
   where the lawn turns into the paved path.
3. **Paving**: rows 1180–1412 (three rows of stones) repeat downwards from the scene's last row.
   The tile's first 28 rows blend into the rows that follow it in the picture, so it continues
   both the scene and itself without a seam. The grass tuft between the stones is filled in
   the tile only, so the repeat does not show. The tile starts 2 px under the scene picture
   (no hairline at fractional pixel positions).
4. **Sky fill** above the scene (`#1C8EE2 → #159CFD`, the picture's own colours) is only for
   screens squatter than any phone; on every phone and portrait tablet the picture's top is
   above the screen (tested).

Where it falls (CSS px; rows of the picture):

| Screen | Board top | Gazebo base (row 610) | Lawn edge (row 995) | Scene ends | Paving tiles |
|---|---|---|---|---|---|
| 320×568 | 93 | 63 (behind the top bar) | 193 | 335 | 3 |
| 390×844 | 197 | 160 | 319 | 492 | 4 |
| 430×932 | 221 | 180 | 356 | 546 | 4 |
| 768×1024 | 202 | 129 | 443 | 783 | 2 |

Size: scene 104.6 kB + paving 13.8 kB = **118 kB** of WebP (about 158 kB once inlined as
base64 in the single HTML file). For comparison the harbour's three layers are 35 kB; the garden
keeps the owner's picture at its own resolution (941 px wide), because a blurred backdrop was
not acceptable. Quality 74 shows no difference from the original at 1:1.

Readability: the top bar, the buttons and the board are opaque panels; the hint line keeps its
white glow over the stones. No veil was needed.

## Edge decor

The same six `<img>` places as the robot theme's bushes and the same zone variables, each with
a garden picture of its own shape (`GARDEN_DECOR_ART`):

| Place | Picture | Source |
|---|---|---|
| `front-l` near, bottom left | corner growth: leaves and yellow flowers climbing the left edge and running along the bottom; its climbing arm stays left of the hint line (`min(…, edge / .34)`) | owner's `elements/hoekbegroeiing.png` (already transparent: cropped and scaled only) |
| `front-r` near, bottom right | round bush with white flowers | 06 |
| `back-l` under the board, left | rocks with a pink flower | left foot of 09, posts removed |
| `back-r` under the board, right | rocks with a pink flower | right foot of 09, posts removed |
| `sprig-tl` top-left corner | tree branch | top-left of 10, sky removed |
| `tuft-tr` above the board, right | flower bed (white and pink flowers, grass), small and mirrored | foot of 07, post removed |

Six pictures, 147 kB together (the corner growth is 43.5 kB: 660 × 577, about twice the 325 px it is shown at on a tablet). All pieces are scaled with premultiplied alpha, so no colour from transparent pixels bleeds into the edge. The white studio background and the painted floor shadow are
removed; a soft contact shadow is baked under each piece. `17-sheet-bushes-plants` is only
83 px high, too small to use sharp; it served as the reference for the kinds of plants.

**Safety** (parts sheet, *randversiering … veiligheidscontrole*, counted from 5 % opacity):
on 320×568, 353×768, 390×844, 430×932 and 768×1024 no decor pixel is drawn over any control,
none lies behind the board or behind loose text, and taps go through. Pieces do stand behind
the buttons (by design: they show in the gaps and corners).

**Corner growth, where it pays off most.** On a phone the near bottom-left place sits mostly
behind the action buttons, so only the climbing arm and a few flowers show; on the tablet it
shows in full. The picture is an L made to hug a right angle: it would read better on the
board's corners (outside the rim, two diagonal corners, mirrored) than on the screen's. The board
rim belongs to another part; the picture is ready for it (`garden-corner-growth.webp`).

## Motion

Off by default: the calm variant is the default. `.tf-bg-motion` on `.tf-bg` makes the sunlight
breathe slowly (11 s, one soft-light gradient) and `.tf-decor-sway` on the decor layer lets the
plants sway by at most 1.2° (the robot theme's rule). Both stop under
`prefers-reduced-motion: reduce`.

## Loose props: birdhouse and flower arch

`garden-birdhouse.webp` (42.7 kB) and `garden-flower-arch.webp` (69 kB), cut from 07 and 09.
Proposal: the arch is worth most as the frame of the win pop-up (the card under the arch, the
chicks walking through it) and as the gate at the end of the level path; the birdhouse as the
marker of the current step on the level screen. In the backdrop they are not needed separately:
they are already in the picture, and a separate layer only pays off if they have to move.

## Known differences from the reference

- On phones the picture's top (tree, sun rays, most of the sky) is above the screen or behind
  the top bar: the phone is narrower than the picture, and the scenery has to fit above the board.
- Below the scene the paving repeats every three stone rows and does not widen towards the
  viewer as in the reference; the corner flowers of the reference are replaced by the decor.
- On 320×568 the gazebo stands behind the top bar; only the arch and the birdhouse roofs show.
- Landscape screens are not tuned (the picture follows the width and gets very large).

## Owner's decisions (2026-11-24)

Agreed by the owner:
- Backdrop stays at 118 kB (full sharpness, quality 74); no smaller version.
- Flower arch: frame of the win pop-up and gate at the end of the level path. Birdhouse: marker
  of the current step on the level screen. For the sessions that own those screens.
- Motion stays off by default (calm variant); the option remains available.
