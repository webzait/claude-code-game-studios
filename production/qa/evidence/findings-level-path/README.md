# Finding B2: level selection as a path (2026-11-22)

Screenshots of the single-file build (`dist-single/index.html`) in Chromium (SwiftShader), taken with
Playwright at pixel ratio 2. The states are made by filling `best` in the save (`turnflock.save`).

| File | What it shows |
|---|---|
| `new-<size>.png` | New player: level 1, nothing completed |
| `mid-<size>.png` | Mid-way: level 12 of 40, the next five locked |
| `end-<size>.png` | Level 39: one level ahead, then the finish |
| `last-<size>.png` | Level 40: only the finish ahead |
| `done-<size>.png` | Everything completed: the calm end state, no path; the main action is "Choose a level" |
| `unlock-<size>.png` | Test lab "Unlock all levels" on: the old paged grid, marked as a test view |
| `grid-<size>.png` | Test lab "Level screen: Grid": the old grid with its locks, marked as a test view |
| `improve/path-mid-<size>.png` | The star total as a button, with the number of levels that can be improved |
| `improve/improve-mid-<size>.png`, `improve-one-`, `improve-done-` | "Improve your stars": only the completed levels under three stars (5 and 1 of them); `improve-done-`: everything completed, so "Play a level again" shows every level |
| `improve/done-improvable-<size>.png`, `done-perfect-` | Everything completed, with stars left to earn and with every star: the main action is "Choose a level" |
| `improve/path-perfect-<size>.png` | Nothing to improve: the star total is not a button |
| `focus-current-390x844.png` | Keyboard focus on the current level, reduced motion on (no breathing halo) |
| `layout-b-straight/` | The alternative layout (one straight column, `levelPath.layout: "straight"`); the files in this folder's parent are the recommended winding layout |

Sizes: 320×568, 390×844, 430×932, 768×1024.

Not checked: a real phone (touch, safe areas, real GPU), a real screen reader (only the accessibility
tree was read), browsers other than Chromium.
