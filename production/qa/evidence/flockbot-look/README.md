# Flockbot look: rounded cube, soft sheen, plain triangle

Owner request (2026-11-21): higher-resolution, more matt gloss; shape and edges closer to the buttons;
the arrow a triangle. Refined over four flat sketches and then the owner's reference pictures to: a
rounded cube whose top runs into the sides in one rounding (no rim line), taller, cuter, with a sunk
visor, white ear discs and four small feet.

Screenshots are of the single-file build (`npm run build:single`) opened from disk in headless
Chromium with software WebGL, level 10. `@2x` is device pixel ratio 2. "large" files are a 1100 px
wide page at pixel ratio 4, cropped.

| File | Shows |
|---|---|
| `before-game-53px@2x.png`, `before-large.png` | The robot before this change |
| `sketch-v1.png` … `sketch-v3.png`, `sketch.png` (v4), `sketch.html` | The four flat sketches shown to the owner, with their comments in the commit messages |
| `owner-reference.jpg` | The first reference picture the owner sent |
| `after-game-start-53px@2x.png`, `after-game-round1-53px@2x.png`, `after-game-round2-53px@2x.png` | The game on a 390 px wide phone: start, and after one and two rounds of red, blue, yellow, so every colour is seen in several headings |
| `after-game-round1-42px@2x.png` | The same on a 320 px wide screen (42 px cells) |
| `after-arrow-A-raised-large.png` | Arrow variant A, `symbol.style: "raised"` (the default) |
| `after-arrow-B-notch-large.png`, `after-arrow-B-notch-53px@2x.png` | Arrow variant B, `symbol.style: "notch"` |

## What was looked at

- Every robot stays inside its own cell in the headings shown; `tests/unit/heading.test.ts` checks all four.
- The sharp highlight spot is gone at both sizes; colours match the owner's tones.
- The triangle shows the heading at 53 px and 42 px in variant A; variant B is weak on yellow.

## Not checked

- A real phone or any GPU: everything here is software-rendered.
- The parts sheet (`npm run build:parts`) was not re-screenshotted.
- Frame rate: the mesh density and the number of draw calls per robot are unchanged, so no cost was measured.
