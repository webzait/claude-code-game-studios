# Evidence: forty levels (2026-11-22)

Taken from the single-file build (`npm run build:single`) at 390×844, device scale 2, in Chromium with
software WebGL, by `node tools/level-design/screenshots.mjs`. Every level was opened through the level
selection with "unlock all" set in the save.

- `select-page-1.png`, `select-page-2.png` — the level selection, both pages of 20.
- `level-NN-<id>.png` — the level as it opens.
- `level-NN-<id>-won.png` — the end card after the stored witness was played in the running game.

Played to a win with the stored witness, in the running game, with no page errors:

| # | Level | Board | Moves | Robots home |
|--:|---|:-:|--:|--:|
| 1 | First Steps | 4×4 | 3 | 2/2 |
| 5 | Lean on It | 5×5 | 6 | 2/2 |
| 13 | Close Quarters | 4×4 | 6 | 4/4 |
| 17 | The Corridor | 4×7 | 8 | 4/4 |
| 23 | All Together Now | 6×5 | 7 | 6/6 |
| 24 | Wide Open | 7×5 | 7 | 4/4 |
| 28 | Elbow Room | 4×4 | 8 | 5/5 |
| 29 | The Long Hall | 8×4 | 8 | 6/6 |
| 35 | Roundabout | 7×7 | 9 | 7/7 |
| 40 | Grand Parade | 8×8 (the largest board) | 10 | 10/10 |

All ten are new levels. The Playwright check "every level can be played to a win in order"
(`tests/integration/boot.spec.ts`) plays all forty the same way.
