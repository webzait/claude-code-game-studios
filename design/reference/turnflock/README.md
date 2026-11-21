# Turnflock visual references

Supplied by the project owner; the target for the standalone parts in `src/render/parts/`.

- `asset-sheet-elements.png` — wireframe asset sheet: Flockbots, obstacle, exit, buttons, with sizes (1 cell = 56 px).
- `board-assembly.png` — the modular board: floor tile, obstacle, exit, straight rim, corner, underlay (30 mm cell).
- `screen-wireframe.png` — the gameplay screen. Ignore the logo, "Prismport / Beacon Bay", the lighthouse and the level dots 1–5: there is no story layer.
- `styled-reference.jpg` — the finished look to aim for: gloss, colour, shading. Same exclusions.
- `flockbot-styled.png` — the Flockbot on its own in the finished look: a squarer cube with subtle rounding, framed face window, ear disc, four feet.

Colour tokens live in `data/config.json` (`colors.kit`, `colors.robots`) and the button tones in `src/parts/parts.css`.

## source/

The owner's original, full-size images from the Asset Kit, kept as the starting point for the game's smaller copies in `assets/turnflock/`: `harbor-original.png` (harbour backdrop) and `bush-original.png` (transparent bush). Not loaded by the game.
