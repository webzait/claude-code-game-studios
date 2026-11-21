# Flockbot look (design study)

The Flockbot redesigned after the owner's reference pictures of 2026-11-21: a rounded cube whose top
runs into the sides in one rounding, a visor sunk into the front with a soft lip, large eyes, white
ear discs, four small feet and a plain triangle on top. **Not wired into the game**: the game still
builds its robot from `src/render/parts/flockbot.ts` and `data/parts.json`.

- `flockbot.ts` — the model (a copy of the game's part, changed).
- `flockbot.json` — its dimensions, gloss and colours. `flockbot.symbol.style`: `"raised"` (plain
  raised triangle) or `"notch"` (the triangle cut into the top).
- `flockbot-3d.html` — the bot as a turntable in one self-contained file: open it from disk, drag to
  turn, pick a colour, save the model as `.glb`. Built from `viewer.html` and `viewer.ts` with
  `npx vite build -c prototypes/flockbot-look/vite.config.ts` (output in `dist/`, copied here).
- `index.html`, `main.ts` — the design sheet. Run `npx vite` in the repo root and open
  `/prototypes/flockbot-look/index.html`.
- `flockbot.mesh` in the data file sets how finely the body is meshed (`around` the outline, `up` each
  half). The study uses 384 by 112, about five times the game part's 176 by 56, for smooth highlights
  and a clean visor edge up close; the game would not need that at 42 to 53 px cells.

A picture of the sheet is in `production/qa/evidence/flockbot-look/design-sheet.png`, the large view alone in
`design-hero-2080px.png`.
