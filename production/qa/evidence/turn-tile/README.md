# Turn tile and page 3 — evidence (2026-11-22)

All pictures are from the single-file build (`npm run build:single`) in headless Chromium with
software WebGL, 390×844 at 2× unless noted. Frame strips were taken with the page clock paused,
40 ms of game time per frame (30 ms for undo, 60 ms for replay).

| File | What it shows |
|---|---|
| `part-turn-tile-two-designs.png` | Parts page card: the built tile from four sides, then design A (built) and design B in a field at 53 and 42 px, free and with a robot on the tile |
| `level-41-turntable.png` … `level-60-grand-finale.png` | Every level of page 3 as it opens (the turn tiles' light is the opening cue) |
| `level-41-turntable-won.png`, `level-60-grand-finale-won.png` | Win pop-up after the stored solution |
| `strip-turn-level-41.png` | The tile's beat: the robot finishes its step, stands, is turned with the disc while the light flashes |
| `strip-undo-level-41.png` | Undo: turned back on the tile first, then gliding back |
| `strip-replay-level-41.png` | Replay of three moves including the tile |
| `strip-reduced-motion-level-41.png` | The same step with reduced motion: no hop, no overshoot |
| `strip-two-tiles-level-51.png` | Two robots arrive on two tiles in one step and are turned together (a third leaves by the exit) |
| `strip-bump-into-robot-on-tile-level-48.png` | A robot bumps into one standing on a tile: the one on the tile is not turned again |
| `strip-tile-then-exit-level-51.png` | A robot turned by a tile in the step before now faces the exit and leaves through it |
| `hint-shows-tile-turn.png` | The hint picture: arrow onto the tile and a second quarter arc for the tile's turn |
| `level-56-tricolour-*.png` | A three-colour level with two tiles: plain, with "Colour shapes", in a deuteranopia and a protanopia simulation; at the start and with a robot standing on a tile |
| `level-60-grand-finale-deuteranopia.png` | The largest board (8×8, cells about 42 px) in a red-green simulation |
| `select-at-level-41.png` | Level selection for a player who finished page 2: "Level 41 of 60" |
| `select-all-60-completed.png` | Level selection after all sixty: completed state, 180 of 180 stars |
| `lab-grid-page-3-unlocked.png` | Test lab grid with "unlock all": third page, levels 41 to 60 |
| `hand-42-lost.png`, `hand-42-dead-end-hint.png` | Level 42 played with a wrong first move: lost; the hint says so after one move |
| `hand-44-playing.png` | Level 44 with BLUE pressed one move early: a blue robot runs onto the tile and is turned away, one move left and no win (the level's trap) |
| `hand-44-won.png`, `hand-47-lost.png`, `hand-54-won.png`, `hand-58-won.png` | Levels played with own commands that are not the stored solution |
