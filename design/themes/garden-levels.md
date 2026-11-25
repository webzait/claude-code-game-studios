# Garden theme — level selection screen

Part of the garden (chick) theme. Reference: the owner's `23-sheet-level-path`, with
`24-sheet-gazebo-goal`, `08-gazebo` and `10-backdrop-garden` for the mood
(`design/reference/turnflock/garden/`). Built on its own on the parts sheet
(`npx vite build --mode parts`, section "Tuinthema · levelscherm"); not yet in the game.

## What it is

The same screen as the robot theme — the same HTML (`index.html`, `#map`) and the same code
(`renderLevels` in `src/ui/screens.ts`) — restyled under `[data-theme="garden"]`:

| Reference (23) | Garden screen |
|---|---|
| Green ball with a white check | A completed level (`.tf-levels-step.is-passed`), the last two below the current one |
| Yellow ball | The level to play now (`.is-current`), the one button on the path, with "LEVEL n" |
| Grey balls | The next levels (`.is-locked`), with their number and a small lock |
| Gazebo at the end | The end of the current garden (`.is-finish`): the owner's gazebo, cut out |
| Rail between the balls | The trail (`.tf-levels-trail`), a grey tube |

All modes work as in the robot theme: playing on, the star button that opens the levels
below three stars (the grid, on a lawn tray), and everything completed with "Choose a level".

## The gazebo: the end of a garden

The levels form **gardens of 20**, the size of one page of the level grid
(`levelsPerPage`). The path never runs past the end of the current garden; once that end is
within the path's reach (current + 5), the gazebo closes the path. After level 20 the next
garden starts with a fresh path (level 21 at the bottom, no gazebo yet). The last garden ends
at the gazebo too, even when it is shorter than 20.

This matches the 3D gazebo goal on the board (another session): reaching the gazebo on the
board ends a level; reaching the gazebo on the path ends a garden. Approved by the owner
(2026-11-24), together with the two pieces below.

**The gazebo lit.** A completed garden's gazebo is drawn lit (after `24-sheet-gazebo-goal`):
a green-gold glow behind it and a green check ball on its steps. It stands at the bottom of the
path, below the first levels of the next garden (`.is-finish.is-reached`), until two levels of
the new garden are completed and take its place. With everything completed the big lit gazebo
is the "All levels completed" picture (`.is-done`).

**The celebration.** Winning the last level of a garden shows "Garden N complete!" over the
level screen (`src/ui/themes/garden/gardenDone.ts`, `tf-garden-done.css`): the lit gazebo half
above a cream card, slowly turning rays, white, pink and yellow petals drifting down, the
garden's stars ("52 of 60 stars") and one button, "Next garden" ("Levels" after the last
garden, titled "All gardens complete!"). A dialog with focus on its button; under reduced motion
nothing turns or falls. No coins or other reward: that is an economy decision for the owner.
`chapterCompletedBy(index, total, 20)` tells which win completes a garden.

Logic: `pathScene(total, current, ahead, chapter, behind)` in `src/ui/levelPath.ts`
(tests: `tests/unit/garden-levels.test.ts`). With `chapter` and `behind` both 0 it is
exactly the robot path; the robot theme passes neither, so its markup is unchanged.

## Layout

A zigzag: every step after (and before) the current level sits alternately right and left of
the middle, so neighbours are far apart sideways and may overlap a third in height. That gives
eight balls (two done, the current one, five ahead) the room of five, so they stay large as on
the sheet. The current level stays in the middle, above the Play button. Sizes follow the
path's height (container units); on 320×568 a locked ball is about 34 px, the current one 64 px.

## Mood

- **Background:** built from the owner's level-path backdrop
  (`design/reference/turnflock/garden/25-backdrop-level-path.webp`, 956×1645) by
  `tools/asset-pipeline/build-garden-levels-backdrop.py` into `src/ui/themes/garden/levels-backdrop.webp`
  (WebP quality 76, 97 KB, about 130 KB inlined). It covers the screen, anchored at 40% height. A phone
  cuts off its edges, and the backdrop's birdhouse stood right at the left edge, so the owner asked for it
  to be seen (2026-11-25): the half birdhouse is covered with the mirrored strip next to it, and the
  owner's `07-birdhouse` (cut out) stands further in, on the lawn in front of the fence, visible on every
  phone. The flower arch on the right still shows only in part on a phone. Under the picture the same sky
  and lawn in plain colours, for the moment before it is decoded. `--tg-backdrop` can replace it. In the
  game, `style.css` makes `#map` transparent so the game's own backdrop shows; the theme session must let
  this picture show on the garden level screen instead (for example
  `[data-theme="garden"] #map.tf-levels-phone { background: … }` with the same value).
- **The garden's goal on the horizon** (owner's wish, 2026-11-25): while the path does not reach the end of
  the garden yet, the gazebo stands small in the middle of the fence line, so the screen always has it.
  Once the end is in sight it leaves the horizon and stands at the end of the path. Its place follows the
  backdrop's geometry (fence line at 37.2% of the picture's height, width 15% of the picture's width:
  `horizonGazebo` in the config); with another backdrop those two numbers change. On some levels the top
  step of the path stands partly in front of it.
- **Logo:** the owner's logo, unchanged (it may not be recoloured), with a soft green shadow.
  It still shows the red robot; a chick logo is the owner's call.
- **Header and dock:** white pills with a leaf-green edge; a warm cream dock.

## Files

| File | What |
|---|---|
| `src/ui/themes/garden/tf-levels-garden.css` | All garden styles, only under `[data-theme="garden"]` |
| `src/ui/themes/garden/levels.ts` | `applyGardenLevels(screen)`, `gardenPathModel()` |
| `src/ui/themes/garden/levels-backdrop.webp` | The level-path backdrop, 956×1645, 97 KB |
| `src/ui/themes/garden/levels-gazebo.webp` | The gazebo, 360×408, 32 KB (about 43 KB inlined) |
| `data/themes/garden/levels.json` | Garden size, completed levels shown, colours, gazebo size |
| `tools/asset-pipeline/build-garden-levels-backdrop.py` | The backdrop: owner's 25 with the birdhouse (07) moved in |
| `tools/asset-pipeline/garden_cutout.py` | Cutting artwork out of the owner's pictures (shared) |
| `tools/asset-pipeline/build-garden-gazebo.py` | Cuts the gazebo out of `08-gazebo.png` (background and arch openings transparent, ground shadow made see-through; artwork not redrawn or recoloured) |
| `src/ui/themes/garden/gardenDone.ts`, `tf-garden-done.css` | The "garden complete" celebration |
| `src/parts/gardenLevels.ts` | The parts sheet section (the game's own screen and code, made-up progress) |

## For the theme session (wiring it in)

1. Set `data-theme="garden"` on the root element and import `tf-levels-garden.css`.
2. Call `applyGardenLevels(el('map'))` once.
3. In `drawMap`, pass `...gardenPathModel()` to `renderLevels` (adds `chapter: 20, behind: 2`).
4. Let the level-path backdrop show on `#map` (see Mood).
5. After a win, if `chapterCompletedBy(index, LEVELS.length, 20)` is not 0, open the level screen
   with `showGardenDone(el('map'), { garden, last, ...gardenStars(stars, garden, 20) }, next)`
   and import `tf-garden-done.css`.

Cost: 2D only — no triangles or draw calls. Two pictures (97 KB + 32 KB, about 175 KB inlined), about 13 KB of CSS (uncompressed, comments included).

## Known differences from the reference

- The rail is grey all the way; on the sheet it is green between the completed balls.
- The balls carry level numbers (and a lock); the sheet's balls are plain.
- The path runs upwards in a zigzag; the sheet shows a straight row.
- The logo still has the robot.
