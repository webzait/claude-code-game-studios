# Themes — the garden theme was removed

TURNFLOCK has one look: the harbour and its flock robots. There is no theme choice in the
settings and no theme register.

## What happened

From 2026-11-24 the game had a second look, a garden with flock chicks, which became the main
theme, with the robots one tap away under Settings → Game → Theme. On **2026-11-25** the owner
dropped it: *"Ik wil helemaal geen Kippen thema meer. Wel wil ik denk ik een aantal nieuwe
elementen behouden voor de robotthema, zoals de wolkjes bij het botsen."* The robots will be
developed further later.

Everything of the garden was taken out of the tree: its code (`src/render/parts/garden/`,
`src/ui/themes/garden/`, the chick model, the garden cards on the parts page), its pictures
(`assets/turnflock/garden/`), its data (`data/themes/garden/`), its designs and reference pictures
(`design/themes/`, `design/reference/turnflock/garden/`, `design/reference/turnflock/chicks/`), its
evidence (`production/qa/evidence/garden-*`), its tests and the `build:single:garden` build. The
robot look is back as it was before the garden: robot app icon and favicon, robot logo, robot coin,
the robot level screen and the robot celebration.

**To find it again:** the last commit with the garden theme is `808d855` (main, 2026-11-25,
"Merge pull request #34 … garden-exit-yellow"). The theme work started at `d9497e7`.

## Why the register went too

The register (`src/render/themes.ts`) looked up, per part, the theme's build function and fell back
to the robot part. With one theme it only added a layer between the board and the robot parts, and its
automatic pick-up of files in theme folders could quietly pull in a stray file. The board now calls the
robot parts directly, as it did before the theme work; that is the smaller and safer state to keep. A
new theme would bring its own register back, from the history above, if the owner asks for one.

## What was kept from the garden

- **The cloud puff on a bump.** When a robot runs into an obstacle or the rim, the owner's cloud picture
  (from `21-sheet-effects`) pops up where it touches, swells, rises and breaks into balls that drift
  apart. With Reduce motion on (or the device asking for less motion) it only fades in and out.
  Code: `src/render/bumpCloud.ts`; pictures: `assets/turnflock/fx/bump-cloud.webp` and
  `bump-cloud-ball.webp`; tuning: `data/fx_bump_cloud.json` (each value explained in the file).
  Tests: `tests/unit/bump-cloud.test.ts`.

## Saves

The save format went from version 9 to 10: `settings.theme` and `settings.themeChosen` are gone. A save of
version 8 or 9 (with `theme: garden` or `robot`) opens in the robots with progress, coins, paid rewards
and settings intact; the stored theme is dropped. A test lab choice of the "Garden stars" celebration
falls back to the default celebration. Test: `tests/unit/save-theme.test.ts`.
