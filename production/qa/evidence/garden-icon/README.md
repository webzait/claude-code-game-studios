# Evidence: garden app icon

See `design/themes/garden-icon.md`.

- `icons-180-64-32-16.png`: garden and robot icons at true size (180 touch icon, with a phone's
  rounding; tab icon 64, 32, 16, in a dark and light tab) and the tab icon enlarged pixel for pixel.
  Made by `python3 assets/turnflock/garden/icon/icon-sheet.py`.
- `garden-icon.png`, `garden-icon-in-use.png` (2x) and `-1x` versions: the two cards of the parts
  sheet. Made by `node tools/asset-pipeline/garden-icon-shots.mjs` after `npx vite build --mode parts`.
