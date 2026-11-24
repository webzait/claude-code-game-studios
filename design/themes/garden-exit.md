# Garden theme — exit, gazebo goal and special tiles

Part of the garden (chick) theme. Built on its own, not yet in the game: the theme
session swaps these in for their robot counterparts. Owner's pictures:
`design/reference/turnflock/garden/22-sheet-exit-pad-states`, `24-sheet-gazebo-goal`,
`08-gazebo`.

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
| `entered` | a chick went in through this exit less than `flashSeconds` (0.9 s) ago | rays |
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
