# Flockbot look (design study)

The Flockbot redesigned after the owner's reference pictures of 2026-11-21: a rounded cube whose top
runs into the sides in one rounding, a visor sunk into the front with a soft lip, large eyes, white
ear discs, four small feet and a plain triangle on top. **Not wired into the game**: the game still
builds its robot from `src/render/parts/flockbot.ts` and `data/parts.json`.

- `flockbot.ts` — the model (a copy of the game's part, changed).
- `flockbot.json` — its dimensions, gloss and colours. `flockbot.symbol.style`: `"raised"` (plain
  raised triangle) or `"notch"` (the triangle cut into the top).
- `index.html`, `main.ts` — the design sheet. Run `npx vite` in the repo root and open
  `/prototypes/flockbot-look/index.html`.

A picture of the sheet is in `production/qa/evidence/flockbot-look/design-sheet.png`.
