# Garden theme: app icon and favicon

Part of the garden theme (`claude/turnflock-theme-garden`). Branch `claude/turnflock-garden-icon`.

## Source

`design/reference/turnflock/garden/27-app-icon-garden.webp`: the owner's icon picture, 1254x1254,
kept byte for byte as sent. It is a full scene: the red chick with the white triangle and the
yellow turn arrow, a star, the small blue chick and the garden behind it.

## What was made

`assets/turnflock/garden/icon/build-icon-garden.py` (Pillow) cuts, scales and rounds; it does not
redraw or recolour. The picture's edge has no frame, seam or stray pixels, so nothing else needed cleaning.

| File | Size | Crop | Format | Robot counterpart |
|---|---|---|---|---|
| `icon-180-garden.png` (home screen) | 180x180 | the whole picture | opaque, 128-colour palette | `brand/icon-180.png`: 7.6 KB |
| `favicon-64-garden.png` (tab) | 64x64 | 880 px square around the red chick | rounded corners (22%), 256-colour palette with alpha | `brand/favicon-64.png`: 7.6 KB |

Byte sizes: home-screen icon 15.3 KB (twice the robot's: the picture has far more detail than
the robot's plain sky), tab icon 3.9 KB (half the robot's, because of the palette). Inlined as
base64 in the single file, the two would add about 26 KB if both themes' icons ship.

## Legibility (evidence: `production/qa/evidence/garden-icon/`)

- **180**: the whole picture reads; a phone's rounded corners only cut sky and lawn.
- **64**: chick, triangle, eyes, beak, arrow and star all clear.
- **32**: red chick with white triangle and yellow arrow; eyes and beak still visible.
- **16**: a red ball with a white spot on blue with a yellow sweep; the eyes are a dark speck.
  Tighter crops (730 and 800 px) were tried: there the red fills the square and the shape is lost.
  The robot favicon at 16 is about as legible (red helmet, eyes, arrow gone).

## Shown on the parts sheet

`src/parts/gardenIcon.ts` and `gardenIcon.css`: two cards (`#garden-icon`, `#garden-icon-in-use`)
with both themes' icons at every size, on a home screen and in browser tabs. Screenshots:
`node tools/asset-pipeline/garden-icon-shots.mjs` after `npx vite build --mode parts`; size sheet:
`python3 assets/turnflock/garden/icon/icon-sheet.py`. Test: `tests/unit/garden-icon.test.ts`.

## Decision: one icon for the whole app, the garden chick (owner, 2026-11-24)

The owner chose option A (one icon for the whole app, not following the theme) with the garden
icon. `index.html` links `favicon-64-garden.png` and `icon-180-garden.png`, in both themes. The
robot icons stay in `assets/turnflock/brand/` (made by `build-logo.py`) but are no longer linked.
Players who already added the game to their home screen keep the robot icon until they add it again.

Options that were offered: A (one icon), B (tab follows the theme, home screen fixed; recommended),
C (both follow the theme; the home-screen icon would show whichever theme was on when it was added).

Single file: `npm run build:single` used to write the two `<link>` icons as PNG files next to
`index.html` (it did so for the robot icons too). At the owner's request (2026-11-24) the build now
puts them into the page as data URLs and drops the files: `tools/single-file/inlineLinkIcons.ts`, a Vite
plugin used in the single build only (test: `tests/unit/inline-link-icons.test.ts`). The single file
grows by 25.7 KB (1,767,898 to 1,793,572 bytes); the decoded icons are byte for byte the files in
`assets/turnflock/garden/icon/`. Evidence: `production/qa/evidence/garden-icon/single-file-icons-390.png`
(the game from `dist-single/index.html`, with both icons loaded from its own `<link>` tags).
