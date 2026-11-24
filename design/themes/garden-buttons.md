# Garden theme — buttons, icons and top bar: unchanged

**Owner's decision (2026-11-24):** the garden theme changes only the playing field (board), the backdrop, the sounds
and the chicks. Every button, every icon (coin, star) and the top bar keep the robot theme's look in the garden theme
too. The whole look of the controls stays as it is.

So there is no garden style for buttons or icons. Reference pictures 18 (action buttons), 19 (Play and round buttons)
and 20 (coin, star, gem, heart) in `design/reference/turnflock/garden/` are not used. A garden button style was built
on branch `claude/turnflock-garden-buttons` (commit bd5124e) and withdrawn in commit 6a08ad0; it stays in the
history should it ever be wanted.

For the theme session: do not restyle `tf-btn`, `tf-coin-*`, `tf-status-*`, `.back` or the star icons under
`[data-theme="garden"]`.

## Loose parts: gem and heart

The owner later supplied high-resolution pictures (`design/reference/turnflock/garden/elements/`) and asked for the new
elements only: `diamant.png` and `hart.png`. The star coin (`stermunt.png`) is not used: the game already has a coin,
and it keeps the robot theme's.

| Part | File | Size |
|---|---|---|
| Gem | `src/ui/themes/garden/gem.webp` (128 × 128, WebP with alpha) | 4.6 kB |
| Heart | `src/ui/themes/garden/heart.webp` (128 × 128, WebP with alpha) | 4.3 kB |

Made by `python3 tools/asset-pipeline/garden-icons.py`: specks below alpha 8 cleared, cropped to the shape, shrunk
premultiplied to twice the largest size an icon is shown at (64 CSS px). Shown on the parts sheet
(`src/parts/gardenIcons.ts`); evidence in `production/qa/evidence/garden-icons/`. Neither is in the game.

Proposal, for the owner to decide: gem — a rare reward for a perfect streak or a milestone on the level path, spent
on something for show (a chick colour, a garden ornament), never on puzzle help. Heart — not lives, but "favourite" on
a level, or a thank-you after a puzzle solved without help. No new currency; the coin economy is another session's.
