# data/config.json

| Key | Meaning |
|---|---|
| `colors` | Brand palette (red, blue, yellow, green, orange, purple) and board colours |
| `anim.turnTime`, `moveTime`, `exitTime`, `undoTime` | Animation lengths in seconds |
| `anim.bumpDistance` | How far, in cells, a blocked robot lunges before springing back |
| `anim.hopHeight` | Hop height, in cells, while stepping |
| `anim.queueSpeedup` | Extra playback speed per queued command, so fast tapping never waits |
| `anim.replayGap` | Pause in seconds between commands during a replay |
| `camera.fov`, `tilt`, `fill` | Field of view, tilt from straight down (degrees), share of the canvas the board may fill |
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

`data/levels.json`: `par` is the solver's shortest solution and `witness` is one command list that wins; both are checked by the tests.
