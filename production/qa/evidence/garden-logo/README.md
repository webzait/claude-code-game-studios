# Garden logo evidence (2026-11-24)

Parts sheet (`npx vite build --mode parts`) in Chromium at pixel ratio 2, taken with
`PAGE_SHOT_BROWSER=/opt/pw-browsers/chromium node tools/asset-pipeline/garden-logo-shots.mjs`.
Design: `design/themes/garden-logo.md`. Level screen background: the garden-levels session's
level-path backdrop (owner's 25-backdrop-level-path).

| File | What it shows |
|---|---|
| `logo-on-backgrounds.png` | The logo transparent, on sky and on lawn (edge check), and at the smallest size next to the robot logo |
| `levels-garden-<size>.png` | The garden level screen with the garden logo at 320×568, 390×844, 430×932, 768×1024 |
| `levels-all-sizes.png` | The four sizes side by side |
| `compare-robot-logo-and-grid.png` | 390×844 with the garden and with the robot logo; the improve grid at 320×568 |
| `logo-sharpness-390-2x.png` | The logo as shown on a 390 wide phone, pixel ratio 2 |
| `icon-proposals-sheet.png`, `icon-proposals-180-64-32-16.png` | App icon and favicon proposals A and B next to the current robot icons, at 180, 64, 32 and 16 px |
| `measurements.json` | Logo box and distances to the star button, path and dock per size; overlap checks (all false) |
