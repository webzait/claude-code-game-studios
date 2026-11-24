# Garden theme — obstacles

Part of the garden (chick) theme. Built standalone; not in the game yet — the
theme session swaps it in. Reference pictures: `design/reference/turnflock/garden/`
`04-rock`, `14-sheet-rock`, `15-sheet-rock-mossy`, `05-stump`, `16-sheet-stump`,
`06-bush-flowers`, `17-sheet-bushes-plants`.

## Default: the owner's pictures (decision 2026-11-24)

The owner's picture is the part. The rocks and the stump were supplied already cut
out at 1254 px (`25`–`28` in the reference folder); they keep their own edge and get a
soft lavender contact shadow (`CONTACT_SHADOW`, the colour of the bushes' baked shadow)
so they sit on the tile. The bushes are cut by `tools/asset-pipeline/garden-obstacles.py`
out of the reference picture (background made transparent with an un-mixed edge,
no halo; the baked soft shadow kept as semi-transparent lavender), scales it with
premultiplied alpha and saves a WebP in `assets/turnflock/garden/obstacles/`. It also
writes `data/themes/garden/obstacle-sprites.json` (picture size, where the object and
its foot sit in the picture). Rerun the tool after changing a source picture.

| Kind | Source | Picture | Size |
|---|---|---|---|
| `rock` | `25-rock-hd` (1254 px, cut out by the owner) + contact shadow | 224×170 | 8.0 kB |
| `rockMossLight` | `26-rock-moss-light-hd` (sharp version of `04-rock`) + contact shadow | 224×157 | 8.3 kB |
| `rockMossy` | `27-rock-mossy-hd` (sharp version of `15-sheet-rock-mossy`) + contact shadow | 224×173 | 10.2 kB |
| `stump` | `28-stump-hd` (sharp version of `05-stump`) + contact shadow | 224×183 | 13.0 kB |
| `bushWhite` | `06-bush-flowers` (1254 px), baked shadow kept | 224×222 | 16.7 kB |
| `bushPink` | `06-bush-flowers`, white flowers retinted pink / lilac / light pink as on `17-sheet-bushes-plants` (whose pink bush is only 83 px) | 224×222 | 16.7 kB |
| **Obstacles together** | | | **73.0 kB** |
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
mirrored (their light comes from one side).

**For the theme session:** place it exactly like the robot block. The card casts no
shadow (the shadow is in the picture): `fuse()` in `kit.ts` sets `castShadow` on every
merged mesh, so either add the obstacle groups to `boardGroup` outside the fused group,
or set `castShadow = false` on the fused meshes that use a `garden-obstacle-*` material.
Add them row by row from the back (as `boardView` does), so overlapping cards blend in
the right order. Per level: `chooseObstacles(level.id, width, height, walls)` from
`obstacleChoice.ts`, then `buildObstacle(choice.kind, choice.turn)` per wall cell.
Settings (card size, foot, lift, mirroring, choice weights) are in
`data/themes/garden/obstacles.json`. If the camera tilt changes, the cards follow `CONFIG.board.roomy.tilt`.

## Variety rule (no randomness)

Walls are visited row by row from the top left. For each wall cell:

1. `h = cellHash(levelId, x, y)` — FNV-1a over `"levelId:x:y"` with a final mix; the same on every device.
2. Family (rock, bush, stump) is drawn by weight (`choice.families`, now 0.40 / 0.35 / 0.25)
   from the low 16 bits of `h`, **leaving out the families of the wall directly left and directly
   above** (already chosen). So two walls that touch are never the same family. With three
   families and at most two taken there is always one left.
3. Variant within the family (`choice.variants`: plain, lightly mossy or mossy rock at 0.4 / 0.3 / 0.3; white or pink bush) from bits 16–23.
4. Quarter turn from bits 24–25, so two copies of one kind still differ (an odd turn mirrors the stump and the bushes).

A level therefore always looks the same, a long wall alternates (bush, stump, rock, …), and
different levels get different layouts. Tested in `tests/unit/garden-obstacles.test.ts`
over all shipped levels and an all-wall board.

## Known differences of the pictures from the originals

- Rocks and stump: the contact shadow under them is added (the supplied cut-outs have
  none); everything else is the owner's picture, scaled down.
- Pink bush: retinted from the white bush, so it is the same bush with pink, lilac and
  light-pink flowers rather than the sheet's slightly different pink bush.
- The bushes' baked shadow is kept but slightly lighter and more lavender than in the
  original, so it reads on green grass.
- A picture always shows the object from the front, while the board is seen from above:
  usual for this style, but the stump's top and the bush's crown are seen less from above
  than the tiles around them.

## History

A first version modelled every obstacle in code (rock from faceted planes, stump as a
lathe, bush from leaf meshes). The owner chose the pictures instead and dropped the code
version (2026-11-24); it is in the git history (commit ed4ec7d) should it ever be wanted.
