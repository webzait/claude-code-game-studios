# Logo evidence (2026-11-22)

Screenshots of the single-file build (`dist-single/index.html`) in Chromium, taken with Playwright.
"20 tiles" pages: the game has 10 levels today, so the page was filled with copies of the tiles in the
browser for the screenshot (with `lab.unlockAll` set in the save); the game itself is not changed.

| File | What it shows |
|---|---|
| `compare-layouts.png` | The two level-selection layouts side by side: A one row, B logo band (in the game) |
| `levels-band-map-<size>-full.png`, `-new.png` | Recommended layout B at 320×568, 390×844, 430×932, 768×1024, with 20 tiles and as a new player (pixel ratio 2) |
| `levels-row-map-<size>-full.png`, `-new.png` | Alternative layout A at the same sizes (pixel ratio 1) |
| `logo-sharpness-390-2x.png` | The logo in the band at pixel ratio 2, cropped |
| `readability.png` | The logo at 265 to 40 CSS px wide at pixel ratio 1, 2 and 3: the word reads down to about 64 px (2x/3x) and 80 px (1x) |
| `icons-180-64-32-16.png` | The app icon at 180, 64, 32 and 16 px |
| `option-opening-moment.png` | The optional opening moment frame by frame, and the same load under reduced motion |
| `puzzle-level-<size>-new.png` | The puzzle screen as shipped: no logo, board size unchanged (320×307 and 390×547 as before) |
| `not-recommended-*.png` | Mock-ups (logo injected for the screenshot only) of the puzzle screen, the settings About line and the end-of-round pop-up |
| `source-leftovers-removed.png` | The pixels removed from the owner's logo file |
