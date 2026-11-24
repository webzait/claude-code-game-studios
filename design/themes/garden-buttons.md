# Garden theme — buttons, icons and top bar

Part of the garden (chick) theme. References: `design/reference/turnflock/garden/18-sheet-action-buttons`,
`19-sheet-play-and-round-buttons`, `20-sheet-icons-coin-star-gem-heart`. Built loose, not yet in the game: the theme
session switches it on by importing `src/ui/themes/garden/buttons.css` and setting `data-theme="garden"` on the root element.

## Contract

| What | Where |
|---|---|
| Style, only under `[data-theme="garden"]` | `src/ui/themes/garden/buttons.css` |
| Colours and measures (source) | `data/themes/garden/buttons.json` |
| Generated tokens and pictures (18 symbols, coin, star, empty star, gem, heart, chick, star strips) | `src/ui/themes/garden/buttons-tokens.css`, `*.svg` — written by `npx tsx tools/asset-pipeline/garden-buttons/build.ts` |
| Parts sheet section | `src/parts/gardenButtons.ts`, `src/parts/garden-buttons.css` |
| Tests | `tests/unit/garden-buttons.test.ts` |
| Evidence | `production/qa/evidence/garden-buttons/` |

The markup is the game's own (`index.html`, `hud.ts`, `endCard.ts`, `coins.ts`, `settingsView.ts`); nothing in it changes.
A symbol is swapped by painting the garden picture as the background of the button's own `<svg>` and hiding that SVG's
drawing (`--g-glyph`, `--g-own`); the coin `<img>` keeps its box and shows the garden coin as background
(`object-position` moves the robot picture out). The CSS never sets a size, margin or gap, so touch targets and the
space between helpers and commands (B11) are the game's; a unit test enforces both this and the `[data-theme]` scope.

## Decisions

- **Command colours stay the chicks' colours.** RED, BLUE and YELLOW keep the game's `--c-main`
  (`#f1454b`, `#2e84f1`, `#f4c62f`, checked by a test); FORWARD keeps the dark slate. From reference 18 come the shape
  (rounder: radius ≥ 0.34 × face height), the pillow rim, the stronger gloss, the dark outline and the fat white symbols.
  The sheet's blue is used where no chick colour is meant: Retry/Levels on the pop-up ("main", `#3f6bd6`).
- **Yellow:** white symbol with a navy ring, the treatment of the Play button in reference 19, so it reads on yellow.
- **Helpers (Undo, Restart, Hint) and every neutral button:** the white "cloud" buttons of reference 19 — blue rim,
  navy symbol. They stay rounder than the commands, so the two kinds still read apart (B9).
- **Symbols:** turn = the clockwise C-arrow of 18; forward/next/back = the block arrow of 18; Restart = the ring of 18;
  Play = the triangle; Levels on the pop-up = the home of 19; settings = the gear of 19. Undo (hook arrow) and Hint (bulb)
  are drawn in the same style.
- **Play** is the yellow pill of 19 with a navy-ringed white word; Next and the plus button are leaf green with a
  dark-green ring (white alone is too faint on green).
- **Top bar:** a cream plate with a warm edge, a leaf-green level medal, a cream counter, a chick for "chicks home".
- **Pictures are SVG, not cut-outs.** The sheets are 129–197 px wide; cut out they would be blurry on a phone. Total
  added: 27.6 KB of SVG + 17 KB CSS (uncompressed; much less gzipped), against the robot coin webp they replace in this
  theme. No images of the owner's sheets go into the game build.

## Not decided here (owner)

- **Gem and heart** exist only as loose pictures. Proposal — gem: a rare reward for a perfect streak or a path
  milestone, spent on cosmetics (a chick colour, a garden ornament), never on puzzle help. Heart: "favourite" on a
  level, or a thank-you after a solve without help. No lives, no new currency (the coin economy is another session's).
- Sound and home round buttons are on the sheet only; the game has no such buttons.

## Known differences from the references

- The faces are flatter than the sheet's soft clay render (CSS gradients, not a 3D render); the rim and gloss are close.
- Command buttons are wide (the game's layout), the sheet's are square.
- The win pop-up card, the reward plate and the level path are not restyled here (other parts).
