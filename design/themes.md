# Themes — the contract for theme parts

TURNFLOCK can be played in more than one look. A theme changes **only how the game
looks**: levels, rules, moves, coins and progress are the same in every theme.

| Theme id | Name in the settings | What it is |
|---|---|---|
| `robot` | Robots | The harbour and its flock robots. The base every other theme falls back to. Unchanged by the theme work. |
| `garden` | Garden | A sunny garden with flock chicks. Reference pictures: `design/reference/turnflock/garden/` (see its README). |

## How the player switches

Settings → Game → **Theme** (Robots / Garden). The choice is saved
(`settings.theme` in the save, format version 8) and takes effect at once: the page
gets the theme's colours and the board is rebuilt, without a reload.

A fresh save starts in the build's default theme:

| Command | File | Starts in |
|---|---|---|
| `npm run build:single` | `dist-single/index.html` | `robot` |
| `npm run build:single:garden` | `dist-single-garden/index.html` | `garden` |

Both are the same code; only the default differs (`__TF_DEFAULT_THEME__`, set in
`vite.config.ts`, read in `src/game/theme.ts`). A player of either can switch.

## The register

`src/render/themes.ts` is the one place that says, per part of the look, what the
active theme uses. Whatever a theme does not supply yet is **the robot part**, so a
theme is always complete and playable. Parts are found by where they are — no list
to update when a part is added:

| Slot | Kind | Supplied by the garden theme as | Robot counterpart |
|---|---|---|---|
| `robot` — flock member (robot / chick) | 3D | `buildPartsRobot`, `buildRobot` | `src/render/robot.ts` |
| `floorTile` — floor tile | 3D | `buildFloorTile` | `src/render/parts/board.ts` |
| `rim` — rim | 3D | `buildRim`, `boardFootprint` (the camera frames on its outside) | `src/render/parts/board.ts` |
| `underlay` — base plate under the board | 3D | `buildUnderlay`, `underlayLip` (negative: under the rim) | `src/render/parts/board.ts` |
| `obstacle` — obstacle | 3D | `buildObstacle`, `obstaclesFor(level)` (a different obstacle per cell) | `src/render/parts/board.ts` |
| `exit` — exit | 3D | `buildExit` | `src/render/parts/board.ts` |
| `turnTile` — turn tile | 3D | `buildTurnTile` | `src/render/parts/board.ts` |
| `plate` — pressure plate | 3D | `buildPlate` | `src/render/parts/board.ts` |
| `gate` — gate | 3D | `buildGate`, `gateDoorScale` | `src/render/parts/board.ts` |
| `effects` — effects during play | 3D | `playEffects` (beam on the exit, cloud on a bump) | flecks in `BoardView.burst` |
| `hint` — the hint's picture | 3D | `hintGlow` (light on the cells stepped onto) | arrows in `BoardView.showHint` |
| `backdrop` — background | 2D | `src/ui/themes/garden/garden-scene.css` (or `backdrop.css`) | `src/ui/tf-scene.css` |
| `decor` — foreground decor | 2D | `garden-scene.css` + `applyGardenDecor` (a picture per place) | `.tf-decor-*` in `src/ui/style.css` |
| `levelScreen` — level screen (the path) | 2D | `src/ui/themes/garden/tf-levels-garden.css` + `gardenPathModel()` | `src/ui/tf-levels.css` |
| `colours` — base colours | data | `data/themes/garden/colours.json` | — |
| `light` — light on the board | data | `data/themes/garden/light.json` | `light` in `data/config.json` |
| `sounds` — button and move sounds | data | `data/themes/garden/sounds.json`: `{ "set": "<id>" }`, a set in `data/sound-sets.json` | the set chosen in the test lab |

**Not theme slots.** By the owner's decision (2026-11-24) buttons and icons, and the
settings screens and pop-ups, are the robot theme's in every theme; the register has
no slot for them. The level screen is a slot: it has its own session.

While a theme has its own sound set, that set plays and the test lab's
"Button sounds" choice applies only in the robot theme (owner, 2026-11-24).

The theme choice stays in the player's settings (Settings → Game → Theme), not only
in the test lab (owner, 2026-11-24).

`slotStatus()` in the register tells, per slot, whether a theme supplies it (`own`)
or shows the robot part (`robot`); `tests/unit/theme.test.ts` checks the fallback.

**Two versions of a part.** A theme folder may hold alternatives (the garden keeps modelled
versions next to the picture versions). When two files export the same register name with
different functions, `src/render/parts/<theme>/register.ts` decides: its exports win. A unit test
(`tests/unit/theme.test.ts`) fails while such a clash is not settled there. The garden's
`register.ts` picks the grass tile from the owner's picture and the picture exit, turn tile,
plate and gate, and keeps their flat pictures out of the fused board.

**Effects and hint during play** (owner, 2026-11-24). Two register hooks, both empty in the robot
theme so it keeps its own: `playEffects` (garden: a beam of light when a chick goes into the exit,
in place of the robot flecks, and a cloud puff where one bumps) and `hintGlow` (garden: the hint
lights the cells the flock will step onto instead of drawing arrows; turn arcs and bump marks stay).
In the garden the garden celebration plays by default; the test lab's Win celebration still
overrides it, and "Garden stars" can be picked in the robot theme too.


## The contract, for a part session

**3D part.** A file in `src/render/parts/garden/` (any name, for example
`board.ts` or `chick.ts`) that exports a function with **the same name, parameters
and return value** as its robot counterpart. The register picks up every export
whose name is in the table above; other exports are ignored. In detail:

- Same grid. Sizes come from `data/parts.json` and `board.grid` in `data/config.json`
  and are shared by every theme: a garden tile is `floorTile.size` wide and
  `floorTile.height` high, so robots, chicks and every other part line up.
- Same moving pieces, in `userData`, as the robot part has them:
  `buildTurnTile` → `userData.disc` (turns) and `userData.glow` (flashes);
  `buildExit` → `userData.glow` (breathes, may be absent);
  `buildPlate` → `userData.button`; `buildGate` → `userData.door`.
  `buildPartsRobot`/`buildRobot` return a `RobotView` (`src/render/robot.ts`).
- Garden sizes and colours that are the part's own go in
  `data/themes/garden/<part>.json`, imported by the part itself.
- Do not change the robot part, `BoardView` or the register to make a part fit;
  if the contract is missing something, say so to the theme session.

**Picture parts (the garden's way).** The owner wants the garden parts to use the
owner's own pictures, like the robot theme does: cut-out WebP files with
transparency, not models rebuilt in code. A 3D slot's build function may therefore
return a picture instead of a model. `src/render/parts/sprite.ts` is the shared way
to do it; use it rather than a home-made version:

- **Files:** `assets/turnflock/garden/<part>/<name>.webp` (for example
  `assets/turnflock/garden/obstacles/rock.webp`), cut out with a transparent
  background, imported in the code (`import rock from '…/rock.webp'`) so the single
  file inlines it. Report each picture's size.
- **`spriteTexture(url)`** — one shared texture per picture: sRGB colour space,
  mipmaps with trilinear filtering and the device's best anisotropy (sharp up close,
  calm when small), clamped edges. It appears as soon as it has decoded.
- **`buildBillboard(texture, { width, height | aspect, foot, uv, facing, castShadow, lit })`**
  — an upright picture whose **foot stands on the tile** (the group's origin; `foot`
  pushes transparent space under the foot below the tile). It faces the camera every
  frame, pivoting on the foot (`facing: 'camera'`, the default; `'upright'` turns only
  around the vertical and looks squashed under the steep board camera). It casts a
  shadow shaped like the picture. It is marked `userData.keepApart`, so the board does
  not fuse it into the still geometry. Obstacles, the exit's gazebo, decor on the board.
- **`buildDecal(texture, { width, depth, y, uv, quarterTurns, lit })`** — a picture lying
  flat (tile faces, a pad under the exit). `uv` cuts part of one picture, and
  `quarterTurns` turns it, so **the rim is put together from corner and edge pieces of
  one picture**: one corner piece turned four times, one edge piece repeated per cell.
  Decals are still geometry and are fused per picture into one mesh.
- **Drawing order and edges:** every picture is a cut-out (`alphaTest` 0.5 with alpha
  to coverage, depth written, no blending). Pixels under the cut are not drawn at all,
  so chicks, robots and pictures overlap correctly by depth with no sorting, and there
  is no light seam around a picture; the renderer's antialiasing smooths the cut edge.
- **Light:** pictures are unlit by default (the light is painted in them); pass
  `lit: true` for one that should take the scene's light and shadows.
- **The chicks stay 3D**, because they turn to four headings; `buildPartsRobot` for the
  garden is a model, not a picture.
- `production/qa/evidence/garden-theme/sprite-probe-billboard.png` shows a probe
  obstacle drawn this way (an uncut reference picture, hence the white square; the probe
  is not in the code).

**2D part.** A style sheet `src/ui/themes/garden/<slot>.css` (file name from the
table). Every rule starts with `[data-theme="garden"]` — the attribute sits on the
root element (`<html>`) — so nothing changes in the robot theme. The sheet is loaded
automatically after the robot sheets, so equal specificity plus the attribute wins.
Pictures go in `assets/turnflock/garden/<part>/` and are referenced from the sheet
(`url('../../../../assets/turnflock/garden/backdrop/garden.webp')`), so the single-file
build inlines them. Base colours are
available as `var(--tf-theme-<key>)` from `data/themes/garden/colours.json`.

**Data.** `data/themes/garden/<part>.json`. Keys starting with `_` are notes.
`light.json` uses the keys of `ROBOT_LIGHT` in the register; a key left out keeps
the robot value. Every string in `colours.json` becomes `--tf-theme-<key>`.

**What the foundation already gives the garden** (this is not a part, and a part
session may replace it): `src/ui/themes/garden/base.css` paints a plain sky and lawn
from the base colours and hides the harbour pictures; `light.json` makes the light
warm and sunny with a green bounce. The backdrop session's `backdrop.css` takes over
the sky and lawn.

## Rules for every theme

- The robot theme looks exactly as before: theme work never edits robot parts.
  Evidence: `production/qa/evidence/garden-theme/` (`robot-before-*` and `robot-after-*`).
- The game stays one HTML file (`npm run build:single`); everything is in this repo.
- Colours that carry meaning (red, blue, yellow robots, their buttons and shapes)
  keep their meaning in every theme.
