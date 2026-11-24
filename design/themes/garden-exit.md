# Garden theme — exit, gazebo goal and special tiles

Part of the garden (chick) theme. Built on its own, not yet in the game: the theme
session swaps these in for their robot counterparts. The standard is the owner's pictures
(next section); the modelled version after it is kept as an alternative. Owner's pictures:
`design/reference/turnflock/garden/22-sheet-exit-pad-states`, `24-sheet-gazebo-goal`,
`08-gazebo`.

## Standard: the owner's pictures are the parts (2026-11-24, course change)

The owner wants the garden parts to *be* their pictures, as the robot theme's backdrop,
bushes and coin are. So the standard version is the cut-out picture, shown flat in the game;
the modelled 3D version below stays as an alternative.

| What | Where |
|---|---|
| Cut-outs (WebP, transparent) | `assets/turnflock/garden/exit/` — 14 files, 66 kB together |
| Pipeline (re-runnable) | `tools/asset-pipeline/turnflock-garden-exit.py` (Pillow, numpy, scipy, opencv-python-headless) |
| Sizes and anchors, written by the pipeline | `data/themes/garden/exit-sprites.json` |
| Game parts (same names as `board.ts`) | `src/render/parts/garden/exitPictures.ts` — `buildExit`, `setExitLook`, `buildTurnTile`, `buildPlate`, `buildGate`, `gateDoorScale`, `buildGazebo`, `loadGardenExitPictures` |
| Parts sheet | `src/parts/garden-exit-pictures.ts` (cut-out next to the original, then at game size) |

**Cutting.** The background is found by flood fill from the picture's border (plus large
enclosed areas, such as the sky seen through the gazebo's arches); the edge band is un-mixed
from the background colour, so no white or grey halo is left; the painted soft shadow stays as
half-transparent shadow.

**In the game.** Each picture is a quad that faces the game camera exactly (leant back 90° minus
`board.roomy.tilt`), on a grass tile, with its anchor (the pad's face centre) above the cell
centre. It is slid towards the camera just enough to clear the grass, which keeps where it is
seen. Under the game camera it therefore looks exactly as painted: not squashed or skewed.
Lying flat on the tile was rejected: the pictures are already drawn in perspective, so lying
flat would squash them twice. Each part is 2 triangles and one draw call on top of its tile
(robot exit: 3,386 triangles).

| Picture | Size | kB | Made from |
|---|---|---|---|
| `exit-grey`, `exit-green`, `exit-rays` | ~100×65 (rays 100×82) | 1.9–2.6 each | cut from `22-sheet-exit-pad-states` |
| `exit-red`, `-blue`, `-yellow` | 103×65 | ~2.2 each | green pad, lit face and joint glow retoned; yellow gets the owner's tick in dark ochre |
| `exit-shape-red`, `-blue`, `-yellow` | 103×65 | ~2 each | as above, tick painted out (inpaint), colour shape (`colourShapes`) stamped in |
| `turn` | 103×65 | ~2 | green pad retoned cream, tick painted out, the clockwise arrow of the owner's turn button (`18-sheet-action-buttons`) in leaf green |
| `plate` | 103×65 | ~2 | green pad, tick painted out, retoned lavender |
| `gate` | 110×82 | ~2.9 | a stretch of the back balustrade of `08-gazebo`, retoned lavender |
| `gazebo` | 320×359 | ~25 | `08-gazebo`, scaled down |
| `gazebo-goal` | 310×213 | ~15 | `24-sheet-gazebo-goal`, full size |

**Resolution.** The pad sheet is small: each pad is about 100 px wide in the owner's picture.
On a phone a cell is 42–53 CSS px, so the cut-out is 1.9–2.4× the shown size in CSS px, but
only 0.6–0.8× of the screen's device pixels at 3×. It does not look grainy at game size, but it
is softer than the modelled pad. A larger picture of the pad from the owner would make it sharper.

**What a picture cannot do, and what the code does instead.**
- The turn tile's disc cannot turn with the chick (a painted picture has no back side):
  `userData.disc` is an empty group, so the game's turning is harmless; the ring of light still flashes.
- There is no picture of a lit pad in a chick colour with rays: a colour exit keeps its own
  colour in the `rays` moment (only the shared exit shows the owner's rays).
- The gate opens by squashing the picture down along its own height (`gateDoorScale(true)` 0.12),
  leaving a low lavender line.
- The glow on the grass round a lit exit is a code-drawn soft patch (as on the robot pad),
  because the pad picture's own glow ends at the picture's edge.

## Alternative: the modelled 3D version

| What | Code | Robot counterpart |
|---|---|---|
| Exit pad, three looks | `src/render/parts/garden/exit.ts` — `buildExit(color?, look?)`, `setExitLook`, `exitLookOf`, `EXIT_MOMENT_LOOKS` | `buildExit(color?)` in `src/render/parts/board.ts` |
| Moment → look logic | `src/render/parts/garden/exitMoments.ts` — `exitMoment`, `exitLook` | — (the robot pad has one look) |
| Gazebo goal | `src/render/parts/garden/gazebo.ts` — `buildGazebo(goal?)` | — (new element) |
| Turn tile, plate, gate | `src/render/parts/garden/specials.ts` — `buildTurnTile`, `buildPlate`, `buildGate`, `gateDoorScale` | the same names in `board.ts` |
| Sizes and colours | `data/themes/garden/exit.json` | `data/parts.json`, `data/config.json` |
| Parts sheet section | `src/parts/garden-exit.ts`, `garden-exit.css` | — |
| Tests | `tests/unit/garden-exit.test.ts` | `tests/unit/parts.test.ts` |
| Evidence | `production/qa/evidence/garden-exit/` | — |

Keys in the data file are camelCase, like `data/parts.json`, which the parts mirror.

## Exit pad

A round stone plinth one cell across (0.95 cells), as high as a floor tile plus a
rounded cap ring (0.235 cells), so a chick steps onto it like onto the robot pad. Hewn
wall blocks (9) and curved cap blocks (11), offset like masonry, each block a little
different in tone; inside the cap a recessed face with a thick tick in relief.

Three looks, as on the sheet:

- `grey` — grey-blue face, pale grey tick, no light.
- `green` — lime face, lighter in the middle; white tick; the cap's inner edge and
  joints catch the green light; a soft patch of light round the pad
  (`userData.glow`, pulsed like the robot glow, `glowPulse`).
- `rays` — `green` plus three yellow rays fanned above the back of the pad
  (`userData.rays`). The rays lean back 60°, so under the game camera (30° from straight
  down) they read at full length above the pad, as on the sheet.

### Which look at which moment

| Moment (`exitMoment`) | When | Look |
|---|---|---|
| `waiting` | chicks this exit takes are still out | green |
| `entered` | a chick went in through this exit less than `flashSeconds` (0.9 s) ago | portal (picture version; proposal 2026-11-24, was rays) |
| `complete` | every chick is in — level won | rays (stays) |
| `spent` | this exit takes no one any more (colour exit whose chicks are all in), others still out | grey |

Why not grey while waiting (the order of the sheet): the exit must stay the clearest
thing on the board, and green is the exit colour of the robot theme and of the gazebo
picture. Grey then means "done here", which is also what a player needs on boards with
colour exits (levels 61–80). The table is data (`moments` in the data file), so the
other reading is one edit away.

Colour exits: the same stone; the face, the light in the joints and the glow take the
chick colour's tones (`colors.robots` for now — the chick session may set its own). A
yellow face gets a dark tick. With "Colour shapes" on, `userData.shape` replaces the tick,
as on the robot pad.

Contract kept: `userData.glow`, `userData.check`, `userData.shape` (colour exits).
Light (glow, rays) does not count towards the measured size. `setExitLook` only swaps
cached materials and geometry and toggles visibility.

## Gazebo goal

An eight-sided gazebo on a round lawn, about 3 cells across and 3 tall: cream columns
with bases and capitals, arches and a ring beam, a wooden balustrade on all sides but
the open front, two front steps, a red shingle roof in four tiers, golden finial, a red
flag with a white feather, flowering bushes, vines with white flowers on the columns,
two rocks. `buildGazebo(true)` puts the green exit pad with its tick on the floor under a
soft beam of light (`24-sheet-gazebo-goal`); `buildGazebo(false)` is the empty gazebo
(`08-gazebo`). `userData.flag`, `userData.pad`, `userData.beam` for animation.

**Proposal — where it belongs.** Not on the board (too big for a cell, and a chick inside
would be hidden). Two places:

1. **Level complete.** When the last chick is in, the pad is in its `rays` look; the
   end pop-up then shows the gazebo with the lit pad as its picture (rendered once from
   this part, or the owner's own picture). One instance, shown once.
2. **End of the level path.** The last node of a chapter is the gazebo, as on
   `23-sheet-level-path`. The level-screen session makes that 2D picture; this part can
   be rendered to an image for it at any size (the parts sheet shows 160, 96 and 64 px).

## Special tiles

No pictures from the owner; designed to sit with the garden pictures and to read as
clearly as the robot versions. Same moving parts as the robot versions.

- **Turn tile** — a cream stepping-stone disc with two leaf-green arrows chasing each
  other clockwise, in a ring of honey-coloured wooden planks (a garden lazy Susan). No
  chick colour. `userData.disc` turns, `userData.glow` (warm yellow ring) flashes.
- **Pressure plate** — a lavender push button in a log slice, with a small white fence
  on the button that says "this opens the fence". `userData.button` (with `restY`) sinks.
- **Gate** — a lavender picket pen around the cell with white rails and white post caps.
  `userData.door` sinks to `gateDoorScale(true)` (0.07), leaving its lavender foot as an
  outline on the grass.

Plate and gate share lavender: no chick, exit, flower or tile of the garden uses it.

The tiles stand on a simple stand-in grass tile (`buildStandInTile`). The theme session
calls `useGardenFloorTile(buildFloorTile)` with the board session's grass tile, and the
special tiles then stand on that.

## Cost (triangles · draw calls, including the stand-in tile)

| Part | Garden | Robot |
|---|---|---|
| Exit (green) | ~5,200 · 5 | 3,386 · 4 |
| Exit (rays) | ~5,900 · 6 | — |
| Turn tile | ~1,900 · 6 | 862 · 6 |
| Pressure plate | ~2,700 · 4 | 536 · 3 |
| Gate | ~4,200 · 2 | 4,308 · 4 |
| Gazebo (goal) | ~40,000 · 17 | — (one instance, not on the board) |

The exit costs more than the robot pad (round stone blocks need more stations); a board
has one to three. Budgets are held by the unit tests (`budget` in the data file).

## Known differences from the pictures

- Exit: the stone is a slightly cooler grey than the sheet; the sheet's rays have a soft
  golden glow round them, ours are clean shapes. The sheet's small chips on the wall are
  left out.
- Gazebo: roof a little pinker and taller in the middle than `08-gazebo`; arches less
  deep; bushes are rounder and less leafy; the beam is a soft cone, not the fan of rays of
  `24-sheet-gazebo-goal`; no fence and trees round it (those are backdrop).
- Special tiles: no reference. At 42 px the open and the shut gate differ less than the
  robot gate's solid block does; the plate's fence glyph is too small to read there.

### Picture version: what differs from the owner's pictures

- Exit pads and gazebos are the owner's pictures themselves. Only the cutting differs: the
  thin white rim the painter left round each object is gone, and so is the soft white vignette
  round `24-sheet-gazebo-goal`.
- Colour exits, colour shapes, turn tile, plate and gate are new combinations of the owner's
  pieces, not pictures the owner made: the retoned faces keep the owner's light pattern, but
  the inpainted area where the tick was is a little smoother than the rest of the face.
- The yellow exit's dark-ochre tick has less contrast than the white tick on the other colours.
- The pads are softer than the modelled pad at game size (see Resolution).

## Higher resolution, one part per session (2026-11-24)

The owner asked for higher resolution, each part worked out on its own. The pipeline is now
`tools/asset-pipeline/garden_exit/` — `lib.py` (shared), `enlarge.py` (edge-preserving
enlargement: Lanczos, then each soft edge turned into a ~1 px ramp between its two sides, no
ringing) and one module per part, run by `build.py [part…]`. Each part writes its WebP files and
its own size fragment `data/themes/garden/exit-sprites/<part>.json`; the game reads all fragments
and pictures with `import.meta.glob`, so a part changes without touching code. Comparisons per
part: `production/qa/evidence/garden-exit/hires/`.

| Part | Now | kB | How |
|---|---|---|---|
| Exit pads (grey, green, rays) | ~300 px (3×) | 4.3 / 5.8 / 10.3 | outline fitted to the owner's pad (two ellipses), rays traced, both drawn smooth at 3×; inside colour is the owner's painting, enlarged |
| Turn tile | 309×195 | 11.3 | pad enlarged, retoned cream at 3×; the owner's turn-button arrow traced (least-squares fit) and redrawn at 3× in leaf green |
| Pressure plate | 309×195 | 12.1 | pad enlarged, tick painted out at 3×, lavender; a raised lavender button drawn in the style of the owner's buttons |
| Gate | 300×195 | 7.2 | the balustrade of `08-gazebo` between two of its stone columns (mirrored inner halves), lavender #A77DF2 like the plate |
| Gazebo | 960×1069 | 87.4 | own cut (sky through the arches and between balusters transparent, shadow kept as real shadow) |
| Gazebo goal | 775×532 | 62.7 | `24-sheet-gazebo-goal` enlarged 2.5×; the plain 310 px cut kept as `gazebo-goal-small-original` (15 kB) |
| Colour exits and shapes | (pending) | — | a high-resolution version is ready as a draft; it waits for the owner's approval to replace `colour_exits.py` |

All pictures together: about 300 kB (the single-file game embeds them as base64, about a third
more). The source pad sheet is ~100 px per pad, so the pads are faithful enlargements: no detail
finer than the sheet's own pixels was invented.

## The owner's high-resolution elements (2026-11-24, later)

The owner then supplied loose elements as transparent PNGs (`design/reference/turnflock/garden/elements/`,
README there), among them the exit pad in its three looks at ~800 px ("checkpoint" inactief /
actief / opgelicht). Every pad-based part was redone from those, each in its own session; the
small sheet and the enlargement work above are superseded for the pads.

| Part | Output | kB | How |
|---|---|---|---|
| Exit pads | 326×209 / 327×215 / 328×318 | 7.6 / 9.8 / 18.7 | the owner's pictures, only downscaled (`checkpoints.shrink`); each look scaled on its own stone to 320 px; anchor on the fitted face centre |
| Colour exits and shapes | 327×215 each | 8.9–10.5 | green pad at full size: tick separated, painted out, face and joint glow retoned; shapes drawn at 8× on the face; yellow tick dark amber (2.9:1) |
| Turn tile | 327×215 | 8.5 | green pad at full size, face cream, the owner's traced turn arrow drawn crisp |
| Pressure plate | 327×215 | 8.6 | green pad at full size, tick painted out, lavender in CIE Lab, raised button drawn in the owner's button style |
| Gate, gazebo, gazebo goal | unchanged | | no new picture for these |

All derived pads line up exactly with the green pad (same size and anchor). The grey picture is
drawn slightly flatter than the green; at the owner's request ("trek recht als dat mooier is") it is stretched vertically by ~7 % (`LEVEL_GREY` in exit_pads.py) so its base lines up with the green and rays pads when the look changes (evidence: `elements/grey-levelled.png`).
The other elements (portals, stars, cloud) went to the effects session; gem, heart, star coin and the
corner growth are listed for the lead session.

## The owner's corrected exit pads (2026-11-24, exit-pads-v2)

The owner corrected the exit pad ("Ik heb een fout gemaakt bij het aanleveren. De eindtegel moet
worden bijgewerkt."): `design/reference/turnflock/garden/exit-pads-v2/` (README there). The pad is
now a square stone tile seen nearly from above, in four pictures; the round checkpoint pictures in
`elements/` are superseded. Every pad-based part is rebuilt from these.

**Cutting** (`checkpoints.py`). The pictures are 1254x1254 on white, not transparent:
- the body (stone tile, the rays' solid cores) is everything inside a sharp outline: the white is
  flood-filled from the border through every pixel that is not on a colour step (Sobel > 8 per
  px); shadow and light are smooth and let the flood through, the stone's outline stops it. The
  body is opened with a 25 px disc so the thin beam above the portal is light, not body. Opaque.
- outside the body, colour-to-alpha against the white: the glow round the rays and the beam stay
  half-transparent light, the soft shadow becomes a half-transparent dark shadow (kept: it reads
  as shadow on the grass). The white core of the portal's beam cannot be told from the white
  background; gaps up to 21 px across in the light are closed with the light either side.
- the 2 px band round the outline is un-mixed between the body colour just inside and the outside
  layer just outside: no white or grey rim on dark or on grass (#8BCB4F); checked in
  `production/qa/evidence/garden-exit/elements/exit-pads-v2-cut.png`.

**Size and lining up** (`exit_pads.py`). Each look is scaled so its stone tile is 320 px wide (one
cell, twice the largest phone cell at 3x), then stretched vertically to the green tile's height
(grey +3 %, portal +6 %, rays +9 %: the owner drew them in slightly different perspective), as the
owner chose for the first pads. The anchor is the green face's centre as a fraction of the tile
box, used for all four, so the stone does not move when the look changes (all four within 1 px).

| Picture | px | kB | Made from |
|---|---|---|---|
| `exit-grey` | 349×352 | 11.3 | checkpoint-inactief |
| `exit-green` | 362×362 | 14.9 | checkpoint-actief |
| `exit-rays` | 356×504 | 28.2 | checkpoint-opgelicht |
| `exit-portal` | 355×410 | 18.5 | checkpoint-portaal (new look) |
| `exit-red`, `-blue`, `-yellow` | 362×362 | 14.6–16.1 | green tile, same steps as before (`colour_exits.py`) |
| `exit-shape-red`, `-blue`, `-yellow` | 362×362 | 14.2–15.5 | as above, shape for the tick |
| `turn` | 362×362 | 13.8 | green tile, cream, the owner's turn arrow |
| `plate` | 362×362 | 14.0 | green tile, lavender, raised button |

All exit pictures together (with gate and gazebos, unchanged): 368 kB. The pictures are wider than
the stone because the soft shadow spreads past it.

**Portal: a fourth look.** `ExitLook` is now `grey | green | rays | portal`. Proposal: `entered`
(a chick has just gone in, 0.9 s) shows the portal; `complete` keeps the rays (celebrating). It is one
edit in `moments` (data/themes/garden/exit.json) to put it elsewhere. A colour exit has no portal
or rays in its own colour and keeps its colour at those moments. The modelled alternative has no
portal and shows it as green.

**What still differs.**
- The derived parts (colour exits, turn tile, plate) are new combinations of the owner's green
  tile, not pictures the owner made; the yellow exit's dark amber tick is 2.9:1 on the face.
- The four originals are not drawn identically (stone shapes and chips differ a little); after
  levelling the outline lines up but the stones inside can shift slightly when the look changes.
- The colour-to-alpha light is the least light that gives the picture over white: over dark it is
  a little dimmer than an additive glow would be.
