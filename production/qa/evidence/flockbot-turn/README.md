# Flockbot turn: the whole robot turns

Request: a colour command turns the whole robot (body, face, feet, symbol), not only the symbol.

Screenshots of the single-file build (`npm run build:single`), opened from disk in headless Chromium
(software WebGL), level 10. `@2x` files are at device pixel ratio 2; `@1x` files are the same pictures
halved, so a cell is its real size in CSS pixels: 53 px on a 390 px wide phone, 42 px on a 320 px one.
Animation frames were taken with the page clock frozen and stepped 50 ms at a time.

| File | Shows |
|---|---|
| `face-up-all-headings-53px@*.png` | The chosen style ("Face up"), start state and after one and two rounds of red, blue, yellow: every colour in all four headings |
| `face-up-all-headings-42px@*.png` | The same on a 320 px wide screen |
| `alternative-toward-player-53px@*.png` | The alternative ("To player"): the robot turns but always leans towards the player. Eyes are lost in three of four headings and the symbol is skewed on robots facing sideways |
| `before-symbol-only-53px@2x.png` | The previous behaviour ("Symbol"), still in the test lab |
| `turn-in-progress-53px@2x.png` | Red command, frame by frame: before, 50 ms (mid-turn), 100 ms (overshoot), 200 ms (settled, step starts), 300 ms (step, blocked robots lunge), end |
| `turn-halfway-53px@2x.png` | The 50 ms frame alone |
| `undo-53px@2x.png` | Undo of that command: 50 ms, 100 ms, end (robots turn back the short way) |
| `exit-hop-53px@2x.png` | Forward: two robots hop into the exit, spin and sink |
| `reduced-motion-53px@2x.png` | The game's reduced-motion setting on: the turn is still shown, without hops or squash |
| `built-in-robot-53px@2x.png` | The built-in robot (test lab "Robots: Built-in") with the same behaviour: start, mid-turn, after one round |
| `classic-camera-53px@2x.png` | Test lab "Board: Classic" (camera tilted 30 degrees) |

## What was looked at

- Each robot stays inside its own cell in every heading; none covers a neighbour, an obstacle or the exit tick.
- Eyes and symbol are both in view in every heading, the same size facing away as facing the player.
- The turn is clockwise, eases past the quarter and settles; the step follows.

## Not checked

- A real phone or any GPU: everything here is software-rendered in headless Chromium.
- The system reduced-motion preference on a device (it goes through the same code path as the game's own setting, which is shown).
- Feel of the turn at real frame rate; the frames above are stepped, not filmed.
