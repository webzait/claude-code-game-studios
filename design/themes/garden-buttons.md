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
