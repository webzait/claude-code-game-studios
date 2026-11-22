# Flockbot look: design study, not in the game

Owner request (2026-11-21): a new look for the Flockbot. Refined over four flat sketches and then the
owner's reference pictures to a rounded cube whose top runs into the sides in one rounding (no rim
line), with a visor sunk into the front, large eyes, white ear discs, four small feet and a plain
triangle on top. The owner then asked to keep it out of the game for now: the game's robot is
unchanged, and the design lives in `prototypes/flockbot-look/`.

| File | Shows |
|---|---|
| `design-sheet.png` | The 3D design on its own: three-quarter view, front, side, back, top, the game camera's angle, and blue and yellow. Rendered from `prototypes/flockbot-look/index.html` in headless Chromium with software WebGL, at pixel ratio 2, with the game's light settings |
| `design-hero-2080px.png` | The three-quarter view alone, 2080 px square |
| `mood-render-2400px.png` | Mood render from `prototypes/flockbot-look/render.html`: the three colours on board tiles, warm key light, cool rim light, 2400 by 1500 px. Its lighting is its own, not the game's |
| `viewer-phone.png`, `viewer-desktop.png` | The turntable (`prototypes/flockbot-look/flockbot-3d.html`) opened from disk at phone size, and at desktop size after choosing blue and dragging |
| `before-game-53px@2x.png`, `before-large.png` | The robot as it is in the game (unchanged) |
| `sketch-v1.png` … `sketch-v3.png`, `sketch.png` (v4), `sketch.html`, `v3-crop.png` | The four flat sketches shown to the owner |
| `owner-reference.jpg` | The first reference picture the owner sent |

## Not checked

- A real phone or any GPU: everything here is software-rendered.
- The design inside the game. An earlier commit on this branch (`feat: Flockbot as a rounded cube…`)
  had a first version in the game and was taken out again; from the game camera the face is a narrow
  strip, and the cube needed `board.grid.robotFill` 0.86 to stay inside its cell.
- The `"notch"` triangle on this final model.
- The turntable's "Download .glb" button and the file it writes.
- Touch gestures on the turntable (only a mouse drag was tried).
