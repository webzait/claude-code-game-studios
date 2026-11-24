# Garden theme — board effects

Part of the garden (chick) theme. Reference: `design/reference/turnflock/garden/21-sheet-effects.png`
(green beam on a ring, star sparkle, cloud puff, blue ring). Built on its own; the theme session
wires it into the game. The robot theme is unchanged.

## What the player sees

| Effect | Where it belongs (proposal) | Length (calm) | Beginning → middle → end |
|---|---|---|---|
| **Beam** | A chick reaches the exit (where the robot theme pops the pad and bursts flecks) | 0.9 s (0.7 s) | ring snaps open → column of light stretches up, flickers, sparks rise → narrows and fades |
| **Stars** | The win celebration; earning stars on the win pop-up | 1.0 s (0.8 s) | stars pop out of a point → fly apart in a loose triangle, wobble, rise, twinkles flash → shrink away |
| **Cloud** | A chick bumps into an obstacle or the board edge (at the contact point, half a cell ahead) | 0.7 s (0.5 s) | cloud pops up → swells and rises → breaks into its balls, which drift apart and shrink |
| **Blue ring** | A new element the game does not have: see *Proposal: portals* | 1.0 s (0.8 s) | ring opens with a pop → turns → pulls itself shut with a flash |

All effects are short enough not to hold up play: the longest is 1 s, and none blocks input.

### Garden celebration (in place of the robot confetti)

`GardenCelebrationFx` — the same shape as `CelebrationFx` (`src/render/celebration.ts`): built
from a `CelebrationStage` and a `CelebrationPlan`, moved on with `update(dt)`, ended with
`dispose()`. Timing from `planGardenCelebration` (same decisions as `planCelebration`: stars,
calm, sound; own lengths), so `CelebrationRun` drives it unchanged.

- 1–2 stars (1.5 s): beam on the exit, three stars burst from it, a wave of twinkles runs over
  every free tile from the exit to the far corner.
- 3 stars (2.1 s): five stars, and a second burst of five over the middle of the board.
- Calm (0.9 s): beam and stars fade in and out where they are; no wave, no flight.

The blue ring is deliberately not in the celebration: it is kept for the element it belongs to.

## Look: the owner's pictures (standard) or code

Owner's direction (2026-11-24): **the picture is the effect.** The four effects are the owner's own
pictures, cut out with a transparent background (`assets/turnflock/garden/effects/*.webp`):
`beam`, `star` (one, animated as many), `twinkle` (one), `cloud`, `cloud-ball` (one, animated as
many), `ring`. Motion comes from moving those pictures: flat cards facing the game camera
(billboards), scaled, faded, turned and lifted. The blue ring lies flat on the board (stretched
back to a circle, so the camera foreshortens it like a real ring) and really turns. Nothing is
drawn in code in this look: sparks and the closing flash reuse the twinkle picture.

The sheet is small (each effect about 60 px), so the pictures were first 4× enlargements of the
crops (`tools/asset-pipeline/cut-garden-effects.py`) and are now redrawn at 8× resolution, one
sub-session per effect, matched against the sheet (`tools/asset-pipeline/garden-effects-hd/`).
Framing is identical in both, so the config does not change.

The earlier code-built version (3D stars, spheres, torus, light column) stays as a choice
(`look: "code"` in the config, or `GardenEffects.look`), with the same timings.

Cards are pulled `pictures.lift` cells towards the camera: seen from the camera they still sit on
their cell, but they do not cut into the tiles.

## Calm versions (reduced motion)

`prefers-reduced-motion` or the game's *Reduce motion* setting → `GardenEffects.reduced = true`
(or `calm` per effect): every effect fades in and out where it is, shorter, without flight,
spin, swelling or sparks. The celebration plan's `calm` does the same for the celebration.

## Contract with the theme session

- `src/render/parts/garden/gardenEffects.ts` — `GardenEffects(parent, { pitch, floorY, tilt? })`:
  `play(kind, x, z, { calm?, scale?, count? })`, `update(dt)` every frame, `clear()`,
  `dispose()`, `reduced`, `look`, `cost`. Positions are world x and z of a cell centre
  (`cellX`, `cellZ` in `BoardView`), sizes in cells × `pitch`, heights from `floorY`.
  It lives in the board group, like `burst` and `pulseExit` in `BoardView`.
- `src/render/parts/garden/celebration.ts` — `GardenCelebrationFx(stage, plan, assets?, look?)`.
- `src/render/parts/garden/effectsPlan.ts` — timing and layout without drawing
  (`planGardenCelebration`, `gardenCelebrationCues`, `sparkleWave`, …), unit-tested.
- Tuning: `data/themes/garden/effects.json` (camelCase keys, like `data/config.json` and
  `data/parts.json`; sizes in cells, times in seconds).

Suggested wiring (theme session): exit reached → `play('beam', exitX, exitZ)`; bump →
`play('cloud', x + dx·pitch/2, z + dz·pitch/2)`; win → `GardenCelebrationFx` instead of
`CelebrationFx`; earning a star on the pop-up → a 2D version of the star picture (not built here).

## Cost (measured)

Per effect while it plays, picture look (code look in brackets):

| Effect | Draw calls | Moving pieces | Triangles |
|---|---|---|---|
| Beam | 2 (6) | 6 sparks (15) | 14 (~2.5k) |
| Stars | 2 (3) | 3 stars + 4 twinkles | 14 (~3.3k) |
| Cloud | 2 (2, shared by all puffs) | 1 + 7 balls (10) | 16 (~4k) |
| Ring | 2 (4) | 0 | 4 (~4.4k) |
| Celebration (3 stars) | ~7 | ~70 | ~140 |

For comparison, the robot theme: a robot's `burst` is 14 separate meshes (14 draw calls); the
confetti celebration is 1 draw call with 70–150 pieces.

Load test on the largest board (8×8, phone size 390×520 CSS px at 2× = 780×1040), in the
headless test browser, which renders in software (SwiftShader, no GPU) — so absolute frame rates
are far below a phone; the comparison between rows is what counts:

| Moment | Picture look | Code look |
|---|---|---|
| Bare stand-in board | 8.5–9.3 fps, 70 calls | same |
| Busiest play moment (3 steps in a row: 12 chicks bump, 4 reach the exit, 4 star bursts) | 7.1–7.4 fps, 190 calls, ~4.8k triangles | 3.2–3.6 fps, 188 calls, ~221k triangles |
| Same + 3-star celebration | 7.0–7.1 fps, 201–211 calls | 2.1–2.3 fps, 318 calls, ~374k triangles |

Updating the effects costs 0.2–0.5 ms per frame on average. The picture look costs the frame
rate little (−20 % against the bare board in software rendering); the 70 calls of the bare board
are the stand-in lawn, not the effects. Pictures add ~74 kB (4× cuts) to the single HTML file;
the 8× redraws add more (see the parts sheet for current sizes).

## Proposal: portals (blue ring) — not built

The blue ring looks like a place where something disappears and reappears. Proposal for the
owner: **portal pairs**. Two blue rings on the board are linked; a chick that steps onto one
leaves through the other, keeping its heading, in the same step. Effect: the ring closes on the
chick at the entry (the ring's closing half) and opens at the exit (its opening half).
Questions for the owner: may a portal exit be blocked (then the chick bumps: cloud)? Do several
pairs need colours? Does a chick count as "moved" for the step counter?
The core rules are not changed: this needs the owner's decision.

## Where it deviates from the sheet (honest)

- The beam and cloud are flat cards: from the game camera they look like the picture (drawn
  from a low side view), not like a ring lying in perspective on the tile.
- The cloud breaks up into copies of one ball; the balls of the sheet differ slightly in shading.
- The celebration's twinkles are the sheet's small twinkle, which is very small on the sheet.

## Parts sheet

`npx vite build --mode parts` → `dist-parts/parts.html`, section *Tuinthema · effecten*: play
buttons per effect, *Alle vier*, calm, pause and step, look switch (picture/code), the cut
pictures next to the sheet with their sizes, frames over time per effect, the garden celebration
on the 8×8 board with 1/2/3 stars, and the load test. Evidence:
`production/qa/evidence/garden-effects/`.
