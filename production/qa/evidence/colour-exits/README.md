# Evidence: page 4, an exit per colour (2026-11-22)

Taken from the single-file build at 390×844, device scale 2, in Chromium with software WebGL, by
`SHOTS_OUT=production/qa/evidence/colour-exits node tools/level-design/screenshots.mjs 61 62 64 65 66 71 76 78 80`.

- `level-NN-<id>.png` — the level as it opens; `level-NN-<id>-won.png` — the end card after the stored
  witness was played in the running game.
- `shapes/` — level 65 with the "Colour shapes" setting on: each exit shows its colour's shape in place of the tick.
- `select-page-*.png` — the level selection as the script found it.

Played to a win with the stored witness, in the running game, with no page errors: levels 61, 62, 63, 64, 65,
66, 71, 76, 78 and 80 (63 in an earlier run of the same script). Level 80 is the 8×8 board with ten robots and
three exits.

Not judged here: the look on a real phone, and whether a player understands a coloured exit without being told.
