# data/config.json

| Key | Meaning |
|---|---|
| `colors` | Brand palette (red, blue, yellow, green, orange, purple) and board colours |
| `anim.turnTime`, `moveTime`, `exitTime`, `undoTime` | Animation lengths in seconds |
| `anim.bumpDistance` | How far, in cells, a blocked robot lunges before springing back |
| `anim.hopHeight` | Hop height, in cells, while stepping |
| `anim.queueSpeedup` | Extra playback speed per queued command, so fast tapping never waits |
| `anim.replayGap` | Pause in seconds between commands during a replay |
| `camera.marginX`, `marginY` | Space kept free left/right and above/below the board inside the play zone, in CSS pixels (blueprint: 12 and 18) |
| `camera.fov` | Vertical opening angle of the game camera in degrees. Larger = stronger depth effect (near edge of the board larger than the far edge); small values approach a flat, parallel view |
| `board.roomy`, `board.classic` | The two board framings of the test lab: camera tilt from straight down (degrees), frame width in cells, and whether the board sits against the top |
| `coins.start` | Coins a new player begins with |
| `coins.win`, `perSpareMove`, `perfect` | Reward for a win: base, per unused move, and bonus for the shortest solution |
| `coins.hintCost`, `extraMovesCost` | Price of revealing the next move, and of the extra moves when out of moves |
| `coins.undoCost` | Price of one Undo: taking back one command. Paid per step undone, on the Undo button and on the Undo of the out-of-moves pop-up alike. 0 makes Undo free again (the rule before finding B4) |
| `coins.freeUndosPerLevel` | Undos that cost nothing in each attempt at a level; the count starts again at a Restart or when the level is opened. 0 = every Undo is paid. Restart is always free, whatever these two say |
| `levelsPerPage` | Level tiles per page of the grid view of the level selection (test view only: test lab "Level screen: Grid" or "Unlock all levels") |
| `levelsAhead` | Locked levels shown after the current one on the level selection (the path). Completed levels are not shown (finding B2) |
| `levelPath.layout` | Shape of the path: `winding` (the steps sway left and right) or `straight` (one column) |
| `levelPath.playAgainWhenComplete` | `false`: with every level completed the screen only shows that state. `true`: it also offers a "Play again from level 1" button |
| `stars.three`, `stars.two` | Moves over par that still earn 3 and 2 stars |
| `lowMoves` | Moves left at which the counter turns into a warning |
| `rules.exitAcceptsMany` | `true`: several robots may enter the exit in one turn |

| `moveSlack` | Moves allowed over the shortest solution (the move budget is par + this) |
| `hintPicture` | The hint drawn on the board (finding B1), in cells: `arrow` is the ghost arrow from a robot to the cell it will step to (`from`, `neck`, `tip` along the way, `shaft` and `head` half-widths); `bump` the mark at the edge where a robot will be blocked; `turn` the quarter arc round a robot the command turns, from its old heading to its new one (`startGap`, `endGap`, `head` in degrees). `opacity`, the white `outline` width, the `lift` above the tiles, and `pulse` (length in seconds, how far the marks slide, how much they fade; off with reduced motion) |
| `extraMoves` | Extra moves offered when out of moves, if proven to be enough |
| `scan.maxVisited` | Positions a hint or rescue check may examine before it reports "could not finish" |
| `lab.yellowEarlyLevels` | Levels recoloured blue to yellow by the "Yellow early" test switch |
| `lab.slackOptions`, `lab.speedOptions` | Choices offered in the test lab |
| `lab.certifyMaxVisited` | Positions examined when re-checking a level under a test rule |
| `audio.volume` | Loudness of the sound effects |
| `colourShapes.red`, `.blue`, `.yellow` | The shape that goes with each robot colour when the player's "Colour shapes" setting is on: `circle`, `square` or `diamond` (outlines in `src/ui/colourShapes.ts`). Shown on the robots, on the matching command buttons and in the settings preview; each colour needs a shape of its own |

`data/levels.json`: `par` is the solver's shortest solution and `witness` is one command list that wins; both are checked by the tests. Cell codes: `..` floor, `##` wall, `EX` exit, `@@` turn tile, `r^ b> yv r<` robots.

`data/levels-upcoming.json`: levels in the same format that are certified by the tests but not loaded by the game (page 3, waiting for the turn tile to be drawn). Move them into `data/levels.json` to ship them.

- `board.<style>.spareAbove` — share of the spare stage height that goes above the board: 0 = against the HUD, 0.5 = centred, 1 = against the controls. Visual fidelity step 1 (2026-11-21).
- `board.grid` — the modular board in world units (blueprint v1): `tile` 1.0, `gap` between tiles 0.055, `rim` width 0.16, `rimHeight`, `underlay` thickness, `cornerRadius`; `wallFill` and `robotFill` are the share of a tile an obstacle (0.88–0.93) and a robot (0.82–0.88) fill; `wallHeight` scales the kit obstacle's height.
- `colors.kit` — fixed board colours from the style tokens (tiles, frame, obstacle, exit).
- `lab.previewMoves` — move budget on the board-size test boards (`data/test-boards.json`), which are not levels.
- `light` — scene lighting: hemisphere `sky`/`ground` colours and `ambient` strength, `sun` strength, `reflections` (environment map strength) and ground `shadow` opacity. Tuned on screenshots so top faces show their colour token without blowing out.
- `colors.robots` — per colour the top/main/side/deep tones the robot body is shaded with, plus eye colours. `robot` — lean towards the player (radians), eye size/spread/height, pupil size, gloss, how far the top lightens (`topLight`), arrow scale and offset.
- `robot.faceUp` — the heading style in which the whole robot turns and its face keeps looking up at the camera (test lab "Robot turns: Face up"; the default is "To player", the owner's choice of 2026-11-21). `followCamera` — share (0–1) of the camera's tilt the turning axis follows: at 1 the robot turns around the line of sight, so every heading is the same picture turned a quarter and the eyes are as large facing away as facing the player; at 0 it turns around the board's upright and a robot facing away shows less face. `extraLean` — radians added to `robot.lean` in this style only; negative shows more of the top, so the symbol is seen whole, at the cost of a slightly lower face (tuned on screenshots at 53 px and 42 px cells). `forward` — cells the robot is moved along its heading after it has been centred on its cell, for fine-tuning by eye.

## data/parts.json

Dimensions of the standalone game elements, in cell units (1 cell = `unitPx` 56 px on the asset sheet): the Flockbot's modules (shell, face, romp, feet, ears, symbol), floor tile, obstacle, exit, rim and underlay, and the three button sizes in CSS pixels. Shown one by one on the parts sheet (`npm run build:parts` → `dist-parts/parts.html`). The playable game reads the board, robot and button sizes from it, and from `coins` the sizes of the coin counter, plus button, price tags, offer and reward, and the lengths of the count-up (`countUpMs`) and the cannot-afford flash (`shortMs`).
- `flockbot.symbol.shape` — the "Colour shapes" plate on a robot's top, in cell units: `size` of the box the shape is drawn in, `raise` above the crown, and `triangle`, the size of the heading triangle lying on it (smaller than `symbol.size`, so it stays inside every shape). Tuned on screenshots at 320×568 and 390×844 on the 8×8 board of level 40, the smallest cells in the game (`production/qa/evidence/findings-settings-choices/`, 2026-11-22).
- `logo` — the owner's logo on the level selection (styles in `src/ui/tf-levels.css`, applied by `src/ui/logo.ts`; files in `assets/turnflock/brand/`, built by `build-logo.py` there). Heights are CSS pixels; the logo is 768:360, so its width is 2.13 times its height. Tuned on screenshots at 320×568, 390×844, 430×932 and 768×1024 (`production/qa/evidence/logo/`, 2026-11-22).
  - `logo.levels.layout` — `band`: the logo centred in a band of its own above the coins, progress and settings (on a screen 600 or wider it shares one line with them, centred). `row`: the logo in the old title's place in the one row. A screen lower than 562 px uses the row either way, because a full page of 20 tiles does not fit under a band there.
  - `logo.levels.bandMinHeight`, `bandMaxHeight`, `bandMaxHeightWide` — smallest and largest logo height in the band, on a phone and on a wide screen. 50 is what a 320×568 phone has room for with 20 tiles (the logo is 107 px wide there and the word reads well); 124 is 265 px wide, two thirds of a 390 screen. The word stops being readable below about 64 px logo width on a 2x or 3x phone screen (below about 80 px on a 1x screen); the smallest the game shows it is 80 px, in the row on a 320-wide screen (`production/qa/evidence/logo/readability.png`).
  - `logo.levels.tileComfort` — the tile height at which the logo starts to grow: the band takes what the screen has left once every tile is this high, up to its maximum; the tiles then share the rest. Higher = bigger tiles and a smaller logo on mid-size phones.
  - `logo.levels.rowMaxHeight` — largest logo height in the `row` layout (never more than 46 on a screen 620 or lower, so the row keeps its height).
  - `logo.intro` — the optional opening moment: `enabled` (off until the owner chooses it), `seconds` for the whole move, `scale` for how much larger the logo starts (1.35 fits a 390 screen). The level selection is already there and tappable underneath; it does not run under reduced motion.
