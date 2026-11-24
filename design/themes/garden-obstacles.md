# Garden theme — obstacles

Part of the garden (chick) theme. Built standalone; not in the game yet — the
theme session swaps it in. Reference pictures: `design/reference/turnflock/garden/`
`04-rock`, `14-sheet-rock`, `15-sheet-rock-mossy`, `05-stump`, `16-sheet-stump`,
`06-bush-flowers`, `17-sheet-bushes-plants`.

## What there is

| Kind | Look |
|---|---|
| `rock` | Smooth, softly faceted grey rock: one big top facet, three rings of chunks, rounded edges, shallow cracks between chunks, flat foot. |
| `rockMossy` | The same rock with a thick lime moss cap in rounded lobes over the back shoulder, three small moss clumps lower down and green in part of the cracks. |
| `stump` | Orange-brown stump with vertical bark lines, a slight flare at the foot, tree rings on top, an outer band split by ten notches that run down the side as cracks; leaves standing round the foot. |
| `bushWhite` | Round bush of ~60 plump leaves laid like scales from the top (light at the top, dark at the bottom) with three white flowers. |
| `bushPink` | The same bush with pink and lilac flowers and one small white one. |

Loose plants (`plants.ts`): leaf, four-leaf sprig, grass tuft, flower (white,
pink, lilac). The stump and the bushes are built from them; the backdrop and the
board rim can reuse them.

## Contract with the theme session

- `src/render/parts/garden/obstacles.ts` exports `buildObstacle(kind?, turn?, detail?)`,
  the counterpart of `buildObstacle()` in `src/render/parts/board.ts`: a `THREE.Group`
  standing on y = 0, centred on the cell, in cells (1 unit = one cell), placed at
  `PARTS.floorTile.height` exactly like the robot block. Called with no arguments it
  gives the plain rock.
- `src/render/parts/garden/obstacleChoice.ts` exports `chooseObstacles(levelId, width, height, walls)`,
  one `{ kind, turn }` per wall cell (`null` elsewhere). In `boardView.ts` the swap is:
  call it once per level, then `buildObstacle(choice.kind, choice.turn)` per wall cell.
- Every obstacle uses at most two of three shared materials (stone, wood, plant; all vertex
  colours), so the fused board draws all garden obstacles in at most three draw calls.
- Sizes, colours, weights and mesh density live in `data/themes/garden/obstacles.json`.

## Variety rule (no randomness)

Walls are visited row by row from the top left. For each wall cell:

1. `h = cellHash(levelId, x, y)` — FNV-1a over `"levelId:x:y"` with a final mix; the same on every device.
2. Family (rock, bush, stump) is drawn by weight (`choice.families`, now 0.40 / 0.35 / 0.25)
   from the low 16 bits of `h`, **leaving out the families of the wall directly left and directly
   above** (already chosen). So two walls that touch are never the same family. With three
   families and at most two taken there is always one left.
3. Variant within the family (`choice.variants`: plain or mossy rock, white or pink bush) from bits 16–23.
4. Quarter turn from bits 24–25, so two copies of one kind still differ.

A level therefore always looks the same, a long wall alternates (bush, stump, rock, …), and
different levels get different layouts. Tested in `tests/unit/garden-obstacles.test.ts`
over all shipped levels and an all-wall board.

## Size and cost

Footprint 0.85–0.9 of a cell, height 0.57–0.70 (robot block 0.43, robot 0.82): high enough to
read as "blocked" from the 30° game camera, low enough not to hide a robot behind it.

`detail` scales mesh density: `detail.game` (0.5) for the board, `detail.closeUp` (1) for the
parts page. Triangles at game detail (close-up in brackets), from the parts page:

| Kind | Triangles | Meshes |
|---|---|---|
| Rock | 8,200 (33,200) | 1 |
| Mossy rock | 9,784 (39,632) | 2 |
| Stump | 6,368 (24,096) | 2 |
| Bush, white | 3,982 (11,628) | 1 |
| Bush, pink | 4,462 (12,420) | 1 |
| Robot block (for comparison) | 3,828 | 9 |

The shipped levels have at most 7 walls, so a garden board adds at most ~70k triangles (typically 2–4 walls: 15–35k), in
at most three draw calls after fusing (the robot block alone is nine meshes before fusing).
No textures, no image files: nothing added to the single HTML file except code and the JSON.

## Known differences from the pictures

- Rock: the chunks are softer and more even than the picture's few big blocks; no fine surface pitting.
- Moss: a scalloped cap, not the separate rounded leaflets of the picture.
- Stump: rings and notches are a little shallower; the leaves at the foot are flatter and darker
  than the picture's plump bright leaves; no small sprout clusters as full as in the picture.
- Bush: leaves are thinner and longer than the picture's plump round leaves, and the lowest row
  hangs a little, so the outline is less round.
