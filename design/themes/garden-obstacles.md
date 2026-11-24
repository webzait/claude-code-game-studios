# Garden theme — obstacles

Part of the garden (chick) theme. Built standalone; not in the game yet — the
theme session swaps it in. Reference pictures: `design/reference/turnflock/garden/`
`04-rock`, `14-sheet-rock`, `15-sheet-rock-mossy`, `05-stump`, `16-sheet-stump`,
`06-bush-flowers`, `17-sheet-bushes-plants`.

## Default: the owner's pictures (decision 2026-11-24)

The owner's picture is the part. `tools/asset-pipeline/garden-obstacles.py` cuts each
one out of the reference picture (background made transparent with an un-mixed edge,
no halo; the baked soft shadow kept as semi-transparent lavender), scales it with
premultiplied alpha and saves a WebP in `assets/turnflock/garden/obstacles/`. It also
writes `data/themes/garden/obstacle-sprites.json` (picture size, where the object and
its foot sit in the picture). Rerun the tool after changing a source picture.

| Kind | Source | Picture | Size |
|---|---|---|---|
| `rock` | `14-sheet-rock` (only plain rock; 96 px wide), kept at 2x | 192×166 | 9.4 kB |
| `rockMossy` | `04-rock` (1254 px; that rock has moss) | 224×190 | 10.3 kB |
| `stump` | `05-stump` (1254 px) | 224×192 | 13.7 kB |
| `bushWhite` | `06-bush-flowers` (1254 px) | 224×222 | 16.7 kB |
| `bushPink` | `06-bush-flowers`, white flowers retinted pink / lilac / light pink as on `17-sheet-bushes-plants` (whose pink bush is only 83 px) | 224×222 | 16.7 kB |
| **Obstacles together** | | | **66.9 kB** |
| `plant-sprig`, `plant-grass` | `17-sheet-bushes-plants`, 2x | ~120×102 | 6.5 / 6.2 kB |
| `plant-flower-white`, `plant-flower-pink` | biggest flower of `06-bush-flowers` (pink: retinted) | 128×114 | 5.8 / 6.5 kB |

The game shows an obstacle about 45–50 CSS px wide; 224 px is about 1.5x that on a
3x phone screen, so it stays sharp.

### In the game: a card facing the camera

`buildObstacle(kind?, turn?)` in `src/render/parts/garden/obstacles.ts` returns a group
with one quad (2 triangles) carrying the picture: unlit, not tone-mapped (the owner's
colours exactly), alpha-tested and blended, one shared material per kind. The card is
square to the game camera (30° from straight down, looking towards -z;
`CONFIG.board.roomy.tilt`), so the picture is seen undistorted. Its object width is
`sprite.width[kind]` cells (0.80–0.88); the object's foot line lies on the floor
`sprite.footForward` (0.26) towards the camera from the cell centre; the whole card is
then moved `sprite.lift` (0.3) along the view towards the camera, which changes nothing
on screen but keeps a robot standing behind from cutting into the top of the picture.
An odd `turn` mirrors the stump and bushes (lit from the front); the rocks are never
mirrored (the light comes from one side).

**For the theme session:** place it exactly like the robot block. The card casts no
shadow (the shadow is in the picture): `fuse()` in `kit.ts` sets `castShadow` on every
merged mesh, so either add the obstacle groups to `boardGroup` outside the fused group,
or set `castShadow = false` on the fused meshes that use a `garden-obstacle-*` material.
Add them row by row from the back (as `boardView` does), so overlapping cards blend in
the right order. If the camera tilt changes, the cards follow `CONFIG.board.roomy.tilt`.

**Why not code:** the code models (below) are true 3D but do not match the pictures
closely enough; the owner turned them down.

## Alternative: modelled in code

`buildObstacleModel(kind?, turn?, detail?)` (`obstacleModels.ts`, plants in `plants.ts`)
keeps the code-built versions as an option. Description follows.

### What the code models are

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

### Contract (code models)

- `src/render/parts/garden/obstacleModels.ts` exports `buildObstacleModel(kind?, turn?, detail?)`,
  the counterpart of `buildObstacle()` in `src/render/parts/board.ts`: a `THREE.Group`
  standing on y = 0, centred on the cell, in cells (1 unit = one cell), placed at
  `PARTS.floorTile.height` exactly like the robot block. Called with no arguments it
  gives the plain rock.
- `src/render/parts/garden/obstacleChoice.ts` exports `chooseObstacles(levelId, width, height, walls)`,
  one `{ kind, turn }` per wall cell (`null` elsewhere). In `boardView.ts` the swap is:
  call it once per level, then `buildObstacle(choice.kind, choice.turn)` (picture) or `buildObstacleModel(...)` per wall cell.
- Every obstacle uses at most two of three shared materials (stone, wood, plant; all vertex
  colours), so the fused board draws all garden obstacles in at most three draw calls.
- Sizes, colours, weights and mesh density live in `data/themes/garden/obstacles.json`.

## Variety rule (no randomness; applies to both)

Walls are visited row by row from the top left. For each wall cell:

1. `h = cellHash(levelId, x, y)` — FNV-1a over `"levelId:x:y"` with a final mix; the same on every device.
2. Family (rock, bush, stump) is drawn by weight (`choice.families`, now 0.40 / 0.35 / 0.25)
   from the low 16 bits of `h`, **leaving out the families of the wall directly left and directly
   above** (already chosen). So two walls that touch are never the same family. With three
   families and at most two taken there is always one left.
3. Variant within the family (`choice.variants`: plain or mossy rock, white or pink bush) from bits 16–23.
4. Quarter turn from bits 24–25, so two copies of one kind still differ (pictures: an odd turn mirrors the stump and the bushes).

A level therefore always looks the same, a long wall alternates (bush, stump, rock, …), and
different levels get different layouts. Tested in `tests/unit/garden-obstacles.test.ts`
over all shipped levels and an all-wall board.

### Size and cost (code models)

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

### Known differences of the code models from the pictures

- Rock: the chunks are softer and more even than the picture's few big blocks; no fine surface pitting.
- Moss: a scalloped cap, not the separate rounded leaflets of the picture.
- Stump: rings and notches are a little shallower; the leaves at the foot are flatter and darker
  than the picture's plump bright leaves; no small sprout clusters as full as in the picture.
- Bush: leaves are thinner and longer than the picture's plump round leaves, and the lowest row
  hangs a little, so the outline is less round.

## Known differences of the pictures from the originals

- Plain rock: the owner's only plain rock is the 96 px sheet cut, so at 2x it is softer
  than the others and keeps that sheet's dark purple line along its foot and a slightly
  stepped top edge.
- Mossy rock: a couple of light pixels remain at the very ends of the foot, where the
  rock's dark contact line stops.
- Pink bush: retinted from the white bush, so it is the same bush with pink, lilac and
  light-pink flowers rather than the sheet's slightly different pink bush.
- The baked shadow is kept but slightly lighter and more lavender than in the original,
  so it reads on green grass.
- A picture always shows the object from the front, while the board is seen from above:
  usual for this style, but the stump's top and the bush's crown are seen less from above
  than the tiles around them.
