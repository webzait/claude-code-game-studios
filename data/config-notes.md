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
| `board.roomy`, `board.classic` | The two board framings of the test lab: camera tilt from straight down (degrees), frame width in cells, and whether the board sits against the top |
| `coins.start` | Coins a new player begins with |
| `coins.win`, `perSpareMove`, `perfect` | Reward for a win: base, per unused move, and bonus for the shortest solution |
| `coins.hintCost`, `extraMovesCost` | Price of revealing the next move, and of the extra moves when out of moves |
| `levelsPerPage` | Level tiles per page of the level selection |
| `stars.three`, `stars.two` | Moves over par that still earn 3 and 2 stars |
| `lowMoves` | Moves left at which the counter turns into a warning |
| `rules.exitAcceptsMany` | `true`: several robots may enter the exit in one turn |

| `moveSlack` | Moves allowed over the shortest solution (the move budget is par + this) |
| `extraMoves` | Extra moves offered when out of moves, if proven to be enough |
| `scan.maxVisited` | Positions a hint or rescue check may examine before it reports "could not finish" |
| `lab.yellowEarlyLevels` | Levels recoloured blue to yellow by the "Yellow early" test switch |
| `lab.slackOptions`, `lab.speedOptions` | Choices offered in the test lab |
| `lab.certifyMaxVisited` | Positions examined when re-checking a level under a test rule |
| `audio.volume` | Loudness of the sound effects |
| `haptics.move`, `haptics.win` | Vibration patterns in milliseconds (buzz, pause, buzz, …) for a move and for a win; used only when the player's Vibration setting is on and the device can vibrate |

`data/levels.json`: `par` is the solver's shortest solution and `witness` is one command list that wins; both are checked by the tests.

- `board.<style>.spareAbove` — share of the spare stage height that goes above the board: 0 = against the HUD, 0.5 = centred, 1 = against the controls. Visual fidelity step 1 (2026-11-21).
- `board.grid` — the modular board in world units (blueprint v1): `tile` 1.0, `gap` between tiles 0.055, `rim` width 0.16, `rimHeight`, `underlay` thickness, `cornerRadius`; `wallFill` and `robotFill` are the share of a tile an obstacle (0.88–0.93) and a robot (0.82–0.88) fill; `wallHeight` scales the kit obstacle's height.
- `colors.kit` — fixed board colours from the style tokens (tiles, frame, obstacle, exit).
- `lab.previewMoves` — move budget on the board-size test boards (`data/test-boards.json`), which are not levels.
- `light` — scene lighting: hemisphere `sky`/`ground` colours and `ambient` strength, `sun` strength, `reflections` (environment map strength) and ground `shadow` opacity. Tuned on screenshots so top faces show their colour token without blowing out.
- `colors.robots` — per colour the top/main/side/deep tones the robot body is shaded with, plus eye colours. `robot` — lean towards the player (radians), eye size/spread/height, pupil size, gloss, how far the top lightens (`topLight`), arrow scale and offset.
- `robot.faceUp` — the heading style in which the whole robot turns and its face keeps looking up at the camera (test lab "Robot turns: Face up", the default). `followCamera` — share (0–1) of the camera's tilt the turning axis follows: at 1 the robot turns around the line of sight, so every heading is the same picture turned a quarter and the eyes are as large facing away as facing the player; at 0 it turns around the board's upright and a robot facing away shows less face. `extraLean` — radians added to `robot.lean` in this style only; negative shows more of the top, so the symbol is seen whole, at the cost of a slightly lower face (tuned on screenshots at 53 px and 42 px cells). `forward` — cells the robot is moved along its heading after it has been centred on its cell, for fine-tuning by eye.

## data/parts.json

Dimensions of the standalone game elements, in cell units (1 cell = `unitPx` 56 px on the asset sheet): the Flockbot's modules (shell, face, romp, feet, ears, symbol), floor tile, obstacle, exit, rim and underlay, and the three button sizes in CSS pixels. Shown one by one on the parts sheet (`npm run build:parts` → `dist-parts/parts.html`). The playable game reads the board, robot and button sizes from it, and from `coins` the sizes of the coin counter, plus button, price tags, offer and reward, and the lengths of the count-up (`countUpMs`) and the cannot-afford flash (`shortMs`).
