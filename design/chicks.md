# Flock chicks — a second figure next to the Flockbot

**Status:** styling study, 2026-11-23. Only the chicks exist: no board, backdrop, obstacles or buttons
in this style. The Flockbot is still the game's figure; nothing about the rules changed.
**Owner's references:** `design/reference/turnflock/chicks/`; the latest and most complete is
the turnaround drawings of all three colours (`chick-*-turnaround.png`: front, three-quarter, side and
back), which the model follows.
**Evidence:** `production/qa/evidence/chicks/`.

## What it is

A round, smooth chick in clear, saturated red, blue and yellow, original to this project and built entirely in code
(`src/render/parts/chick.ts`, sizes in `data/parts.json` → `chick`, colours in `data/config.json` →
`colors.robots` and `colors.chicks`). It stands on y = 0, faces +z and is one cell wide across its wings,
like the Flockbot part.

| Part | Notes |
|---|---|
| Body | A ball, a little flatter underneath, with hardly any shine (an earlier glossier pass put a white haze over the colour; the owner rejected it). The belly is in its colouring, so it costs nothing to draw. Blue has a clear pale bib, as drawn; red and yellow only a hint (`colors.chicks.*.bellyMix`). |
| Tuft | Three feathers on the crown. |
| Eyes | After the owner's face close-up (`chick-red-face-closeup.jpg`): flat on the skin and built in layers so every edge is crisp. A thin dark rim, the white showing on the outside, a large black pupil turned towards the beak, a brown crescent low in it, one round glint. Two expressions: `open` and `happy` (squeezed shut, a dark bow). |
| Blush | A soft pink oval under each eye, lying on the skin and fading out at its edge. |
| Beak | A rounded upper half; under it the open mouth with a tongue inside the lower beak's rim. |
| Wings | A broad leaf of three feathers on each side, held out from the body, tips outwards and up. |
| Tail | Three small feathers low on the back, as in the turnaround; it sticks out just far enough to show from above. |
| Feet | Orange, three toes, on short legs. |
| Mark | A triangle on the forehead; see below. |

## Reading the heading

The whole chick turns with its heading, around the board's upright. A ball looks the same from every side,
so the heading is carried by things that break the round outline or sit on one side only:

1. the orange **beak** and the **eyes** in front,
2. the **tail** behind,
3. a **wing** on each side,
4. the **mark** on the forehead, a triangle with its tip towards the beak.

The game's camera looks down, 30° from straight down. From there the crown is what is seen most, so the
mark sits high on the forehead (`chick.symbol.elevation`), where it still faces the camera when the chick
looks away from the player. `symbolFacing` computes how squarely it faces the camera; a unit test keeps it
at 0.45 or more in all four headings (it is about 0.5 facing north, 0.99 facing south). Facing north the
player sees the chick's back: no eyes, the tail towards them, the triangle pointing up the screen.

Checked on screenshots at tile sizes of 46 and 42 px (`game-size-46-42px.png`) and in the game through the
test lab (`in-game-lab-chick-level12.png`).

## The mark on the forehead

Settled by the owner's turnaround drawings: every colour has the **same triangle**, white on red and blue,
dark on yellow. There is no mark of its own per colour (an earlier option; removed). The colour says which
chick it is, and the existing "Colour shapes" setting (`colourShapes`) puts the colour's shape under the
triangle for players who cannot tell the colours apart.

### Decided — the tip points to the beak

Owner's decision, 2026-11-23: the triangle's tip points towards the beak, so under the game's camera it
points where the chick will step in all four headings. (The turnaround drawings show it upright, tip to
the crown; under the game's camera that points against the step. `chick.symbol.tip` can still be set to
`crown`.)

## Weight

Two finenesses, in `chick.mesh`: `fine` for the parts sheet and close-ups, `game` for a board tile.
As the game draws one figure (fixed parts fused, mark and eyes apart):

| Figure | Triangles | Draw calls |
|---|---|---|
| Chick, `game` | about 12,000 | 5 (6 with a colour shape) |
| Chick, `fine` | see the parts sheet | 5 |
| Flockbot (today) | about 81,800 | 9 |

Twelve chicks on the largest board: about 144,000 triangles and 60 draw calls, against about 982,000 and
108 for twelve Flockbots. A unit test holds a chick on the board to 14,000 triangles and 5 draw calls.
Exact numbers are on the parts sheet (`#chick-cost`).

## Where to see it

- Parts sheet (`npm run build:parts`): a chick to turn around, each colour, the four headings under the
  game's camera, the three mark options, the weight table.
- Test lab → Look → Figure → Chick: the chicks in the current game. A chick that reaches the exit squeezes
  its eyes shut. Off by default; the choice is saved with the other lab choices.

## Known differences from the references

- The references are painted pictures with rim light and bounce light; the chick is a lit 3D model.
- The references look at the board from much lower than the game's camera does, so every face is in view.
  Under the game's camera a face shows only when the chick faces the player or sideways.
- The mark sits higher on the head than in the references, for the reason above, and seen from the front
  it is foreshortened. Its tip points to the beak (the owner's decision); in the turnarounds it stands upright.
- The wings are smaller than in the turnaround, to keep the chick inside one cell.
- The eyes are a little larger in the face than drawn, and are built from flat layers rather than painted.
