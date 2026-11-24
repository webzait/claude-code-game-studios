# Garden theme — logo

Part of the garden (chick) theme. Source: the owner's `design/reference/turnflock/garden/26-logo-garden.webp`
(1783×882, transparent): TURNFLOCK lettering with the blue, red and yellow chicks, each with a triangle
mark, and a golden ring. This is the owner's improved version (2026-11-24); it replaced the first one
(play marks on the chicks) under the same file name.
Shown on the parts sheet (`npx vite build --mode parts`, sections "Tuinthema · logo …"); not yet in the
game — the theme session (`claude/turnflock-theme-garden`) wires it in.

## The file

`assets/turnflock/garden/logo/logo-garden.webp` — **560×299, WebP with alpha, 38 728 bytes (38 KB)**;
the robot logo `assets/turnflock/brand/logo.webp` is 768×360, 45 150 bytes (44 KB). 560 px is pixel
ratio 2 for the largest phone size (265 CSS px wide on 390 and 430 wide screens); inlined in the single
file it adds about 52 KB. Built by `assets/turnflock/garden/logo/build-logo-garden.py`, the same steps as
the robot logo: the cut-out haze (alpha ≤ 6, 20 942 px) and 186 loose specks are removed, the body's 99%
alpha (253) is made fully opaque, the empty margin is trimmed, and it is scaled down with premultiplied
alpha. Letters and figures are not changed. The edge was checked on sky and lawn at 4× zoom: no white or
grey halo (edge pixels are on average no lighter than the artwork next to them).

## In the game (for the theme session)

- `src/ui/themes/garden/logo.ts` — `showGardenLogo(img, screen)` puts the picture in the level screen's
  `<img class="tf-levels-logo">` (src, width, height) and the sizing values on the screen;
  `showRobotLogo(img, url)` puts index.html's robot logo back on a theme switch. Values:
  `data/themes/garden/logo.json`. Tests: `tests/unit/garden-logo.test.ts`.
- `src/ui/themes/garden/tf-logo-garden.css` — rules under `[data-theme="garden"]` only. The garden logo is
  **as wide as the robot logo** in every layout (row, band, tablet), so the word reads the same size; it is
  about 14% higher (×1.139) because the chicks stand on the letters. The band height `--tl-logo-h` is the robot's
  formula times `--tg-logo-grow`, so the header and the improve grid make room by themselves. The file
  repeats the robot formula from `src/ui/tf-levels.css`: change both together.
- Tuning: `widthVsRobot` (1 = same width as the robot logo), `shadow` (the soft green drop shadow, the same
  as the garden level screen's).

## Fit on the level screen (measured, `production/qa/evidence/garden-logo/measurements.json`)

On the garden level screen of `claude/turnflock-garden-levels` (the owner's level-path backdrop,
25-backdrop-level-path), level 17:

| Screen | Logo (CSS px) | Logo → star button | Logo → path | Overlaps |
|---|---|---|---|---|
| 320×568 | 107×57 (robot 107×50) | 5 px | 74 px | none |
| 390×844 | 265×141 (robot 265×124) | 9 px | 81 px | none |
| 430×932 | 265×141 | 9 px | 114 px | none |
| 768×1024 | 320×171, beside coins and star button | — (same row) | 176 px | none |
| 320×568, improve grid | 107×57 | 5 px | 108 px | none |

The path moves down 18 px on 390×844; the balls shrink a little there (current 105 instead of 109 px).
The Play button is unchanged on every size.

## App icon and favicon

Not part of this session: the owner makes the garden app icon in a separate session. The robot icons
(`assets/turnflock/brand/icon-180.png`, `favicon-64.png`) are unchanged.
