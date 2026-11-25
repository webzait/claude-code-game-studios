# Garden theme — the star coin

**Owner's decision (2026-11-24):** the garden theme keeps the robot theme's buttons and icons, with
one exception: the coin. In the garden every coin is the owner's **stermunt** (gold coin with a star).

## Pictures

Cut from `design/reference/turnflock/garden/elements/stermunt.png` by
`tools/asset-pipeline/garden-coin.py` (nothing drawn; alpha cleaned, centred square crop,
premultiplied scaling).

| File | Size | Bytes | Used for |
|---|---|---|---|
| `assets/turnflock/garden/coin/star-coin.webp` | 96 × 96 | 4 878 | every coin place |
| `assets/turnflock/garden/coin/star-coin-small.webp` | 48 × 48 | 2 372 | the Undo and Hint price tags |
| `assets/turnflock/ui/coin.webp` (robot, unchanged) | 144 × 144 | 8 110 | robot theme |

- **Size.** The biggest coin on screen is the win reward, 40 CSS px (`parts.json` `coins.reward.icon`);
  the large cut is a little over twice that. Both garden cuts together are 7.2 kB, less than the robot coin.
- **Edge.** The source's soft rim is already the coin's own orange (no white or grey mixed in), so it is
  kept: no halo on light or dark. The coin's inside, which the source leaves at alpha 252–253, is made fully
  opaque; the faint haze around the coin (alpha < 8) is dropped.
- **Small sizes.** The Undo and Hint price tags show the coin at about 24 CSS px. They use the 48 px cut,
  lightly sharpened, so the star stays crisp; at 2× and 3× phones the star is clearly recognisable
  (`production/qa/evidence/garden-coin/star-coin-beside-robot-coin.png`). The other price tag (the
  extra-moves offer, the pop-up's Undo) is 32 CSS px and uses the large cut.

## How it is switched

Every coin in the game is one element, `<i class="tf-coin-ico" aria-hidden="true">` (`COIN` and
`coinIcon()` in `src/ui/coins.ts`). Its picture comes from the style sheet: the robot coin in
`src/ui/tf-coins.css`, the star coin in `src/ui/themes/garden/coin.css`, every rule under
`[data-theme="garden"]`. A theme switch therefore changes every coin at once, with no new markup. The
register lists this as the 2D slot `coin` (`src/render/themes.ts`).

Coin places, all through that element: the counter in the top bar (level screen, level, test shop),
the price tags on Undo and Hint, the extra-moves offer and the pop-up's Undo, the win pop-up's reward,
the coins flying to the counter, the "Get coins" link, the test shop's packs and confirm sheet, and the
coin explainer. The parts sheet (`src/parts/`) still shows the robot coin's pictures side by side on
purpose; it is not the game.

## Checks

- `tests/unit/garden-coin.test.ts` — every coin markup is the themeable element (never an `<img>`), no
  game file but `tf-coins.css` names the robot coin, the garden sheet swaps the coin (and the small cut on
  the tool price tags) in the garden only, and the slot reports `own` for the garden.
- `tests/integration/garden-coin.spec.ts` — in both single-file builds, visits every coin place and
  compares the picture each coin really draws with the file on disk; also switches the robot build to
  Garden in the settings and back. Seen failing with `coin.css` removed.
- Evidence (`production/qa/evidence/garden-coin/`): `garden-*` every coin place at 320×568 and 390×844;
  `robot-before-*` / `robot-after-*` the same places in the robot theme before and after this change
  (pixel-identical except the board's sparkles, and the flying-coin still, which freezes the flight
  differently in the old markup); `star-coin-beside-robot-coin.png`. Made with
  `COIN_SHOTS=production/qa/evidence/garden-coin COIN_SIZES=320x568,390x844 npx playwright test tests/integration/garden-coin.spec.ts`
  and `python3 tools/asset-pipeline/garden-coin-sheet.py`.

The coin economy (amounts, prices, rewards) is untouched.
