# TURNFLOCK — handover to a new session (2026-11-25)

Start here. This note carries what an earlier, very long coordinating session knew that is not
obvious from the code. The owner asked for a fresh session on this repository so the robot game can
be developed further without the confusion of that session's history.

## How to work with the owner

- **Write to the owner in Dutch**, in plain language, short. Code, commits and docs in the repo are
  in English (Conventional Commits).
- The owner wants **autonomy**: "Doe wat je handig lijkt, vraag dit soort dingen niet aan mij."
  Merge, test, publish and open pull requests without asking. Still ask before anything that cannot
  be undone (deleting artifacts, rewriting history) and before changing the core mechanic.
- **Merging to `main`:** the owner merged some pull requests and asked the coordinator to merge
  others ("doe #13"). Open a pull request yourself; merge it when the owner says so, or when the
  owner has clearly asked for the result to land.
- **One session per part.** For design work the owner likes a separate session per part, with the
  coordinating session merging and integrating. Parts are first built loose (shown on the parts
  page, `npm run build:parts`), then put into the game.
- **The owner's own pictures are the part.** When the owner supplies pictures, use them (cut out,
  transparent WebP, kept small) rather than rebuilding them in code; code only where a picture
  cannot work, and say why. Compare side by side with the owner's picture and be strict: the owner
  has rejected work that looked too unlike the example, or too blurred.
- **Report honestly:** what was tested and what was not (a real phone has never been checked),
  test counts, and anything you decided on the owner's behalf.

## Fixed limits (decided earlier; do not change without the owner)

- The core mechanic: RED / BLUE / YELLOW turn every robot of that colour 90° clockwise, then all
  robots step forward; FORWARD steps all without turning; each command costs a move; all robots
  must reach the exit within the move budget.
- No real payments, no ads, no outside services in the game. The coin shop is a **test shop**:
  nothing is charged, nothing leaves the device.
- Every level is provably solvable without coins. Restart is always free. A price is shown before
  the tap. A paid offer appears only when the solver proves it helps. No pressure tactics.
- No lore, story or world map; the screens are the level selection and the puzzle.
- The game ships as **one self-contained HTML file** (`npm run build:single` → `dist-single/index.html`).

## Where the game stands

- **Robots only.** The garden (chick) theme was built on 2026-11-24 and dropped on 2026-11-25; see
  `design/themes.md` for what was removed and how to find it in git history. Kept from it: the
  **cloud puff on a bump** (`src/render/bumpCloud.ts`). The owner wants to develop the robots further.
- **100 levels** in `data/levels.json` (pages of 20: basics, turn tile from 41, colour exits from
  61, pressure plate and gate from 81). Structure and difficulty: `design/level-structure.md`,
  tools in `tools/level-design/`.
- **Coin economy "Tight"**, confirmed by the owner: start 30, reward 10/20/30 per star count, Undo
  10, hint 75, +3 moves 150, test-shop packs 150/400/1100. Other tunings are selectable in the test
  lab. Reasoning: `design/economy.md`, `design/shop.md`.
- **Defaults chosen with the owner:** music "Meadow" (`design/music.md`), button sounds "wood"
  (`design/button-sounds.md`), win celebration "confetti". Alternatives stay in the test lab
  (Settings → Test lab).
- **Findings B1–B13** from the owner's play sessions and how each was handled:
  `production/findings.md`. Add new findings there.
- **Perks** were proposed and postponed: `design/perks-proposal.md`.
- Single file about 1.8 MB.

## Playable version

The owner plays the game at **https://claude.ai/artifact/S7ezM7NgJxm9TAwhgS6C9o** (private to the
owner). To update it from a new session, read it first with the Artifact tool, then publish to the
same URL. The page published there is built from `dist-single/index.html`: the `<style>` and
`<script>` blocks and the icon links from its head, then its body, plus
`<style>#app{padding-block:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-bottom));padding-inline:max(16px,env(safe-area-inset-left))}</style>`.
Never publish over a newer version made by another session without first taking over what is in
it: on 2026-11-24 a version with the owner's own work was overwritten that way and had to be rescued.

A separate garden copy (https://claude.ai/artifact/1EGpdZie5oeqYyhfh2kN1y) is obsolete; delete it
only if the owner asks.

## Checks before reporting

- `npx tsc --noEmit`, `npm run test:unit` (about 800 tests), `npm run build:single`.
- Browser tests: `npm run test:e2e` (slow in a cloud container: the run that plays all levels takes
  half an hour; a few tests have been timing-sensitive on a loaded machine).
- Play the build in a test browser and look at the screenshot yourself: at least level 1 to a win
  and a level with obstacles (18). Playwright in the cloud container needs
  `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`; the save lives in
  localStorage `turnflock.save` (`lab.unlockAll: true` and `lab.levelScreen: "grid"` open every level).
- Visual and UI changes need a retained screenshot in `production/qa/evidence/`.

## Open

- Next step is the owner's: further development of the robots, not yet specified.
- Proposal not yet made: which other garden elements (the light beam at the exit, the star
  celebration) could move to the robots. Ask the owner whether they want it.
- Never checked on a real phone.
