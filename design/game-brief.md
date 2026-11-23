# Game Brief: Turnflock

## In your words
TURNFLOCK, an original, colourful hybrid-casual puzzle game for iOS and Android. Small robots in three colours (red, blue, yellow) stand on a compact grid, each with its own facing shown by a clear arrow. The player gives global colour commands: RED/BLUE/YELLOW turns all robots of that colour 90° clockwise, then all robots try to step forward; FORWARD moves all robots without turning. Every action costs one move. Goal: get all robots to the green exit within a limited number of moves. High-quality minimalist 2.5D/3D diorama, calm light grey or off-white background, board large on screen, compact friendly robots with rounded shapes, small expressive eyes and clear direction arrows. Vite + TypeScript + Three.js, separate deterministic grid engine, BFS solver using the same rules, five hand-designed levels, automated tests, mobile portrait, one finger. Do not change the core mechanic without consulting; stop after the first playable prototype.

**Pitch:** One colour command turns one colour, but the whole flock steps — steer every robot home before the moves run out.

**Genre:** hybrid-casual grid puzzle

**Controls:** four big buttons (Red, Blue, Yellow, Forward); Undo, Restart, Replay. Keyboard on desktop: 1 2 3, Space, Z, R.

**Question:** is one global colour command satisfying and strategic enough that players immediately want the next level?

**Hooks:** you never move one robot; every command moves everyone, and turns are clockwise only.

## Look and references
- Look: minimalist diorama; off-white background, light grey rounded board, slate walls, green exit pad with a tick; compact rounded robots with eyes and a head arrow in #F04446 / #2675E8 / #FFD12F, exit #2FC56C. Every figure drawn, no emoji.
- References: the concept sketch "ONE COLOR COMMAND · ALL ROBOTS MOVE" (7×7 board, top-right exit).
- View: 2.5D/3D · Camera: fixed, tilted about 30° from straight down, board fills the screen width.

## First minute
Level 1 shows three red robots and only two buttons; Forward pulses softly. The robots walk up and wait at the wall; Red turns them all toward the exit and they file in. Level 2 adds blue, and the first press shows that everyone moves when one colour turns.

## Challenge
Each level has a move budget of the shortest solution plus two. Running out ends the attempt; Try again (Restart) is always free. Undo costs coins: 5 per step taken back (`coins.undoCost`), with the price on the button, also on the Undo of the out-of-moves pop-up; `coins.freeUndosPerLevel` (0) can give free ones per attempt. A player who cannot pay is told so and pointed at Restart. Changed on 2026-11-22 on the owner's instruction (finding B4); before that Undo was always free. Coins are only earned by playing: there is no shop, no advertising and nothing to buy. Level 4 needs the right order of three colours; level 5 has 12 robots and one shortest solution.

## Core loop
- Read the board: who is waiting at a wall, who is drifting away.
- Press one command; the whole flock turns and steps.
- Robots that reach the exit are collected; solve at par for three stars; next level.

## Goal & fail state
- All robots collected within the move budget. Out of moves with robots left = retry.

## Features
- [x] Deterministic grid engine (turn, simultaneous move, walls, conflicts, queues, no swaps or cycles, exit)
- [x] BFS solver on the same rules
- [x] Five levels with verified par and budget
- [x] Undo (costs coins since finding B4), Restart (free), Replay
- [x] 3D diorama with turn, step, bump and exit animations
- [x] Mobile portrait HUD: level, collected, moves left, four command buttons, Next level
- [x] Ten levels, each with a stored witness solution
- [x] Level selection as the start screen; settings; progress saved on the device with a versioned format
- [x] Hint (two steps) and +3 extra moves, offered only when proven to be enough
- [x] Test lab: exit rule, yellow early, spare moves, speed, board framing, unlock all
- [x] Level selection with a Continue button and pages of 20
- [x] Level selection as a path (finding B2): only the current level and the next `levelsAhead` (5) locked levels are shown, completed levels are not; progress as "Level N of 60" and the star total. The paged grid remains as a test view (test lab: "Level screen: Grid" or "Unlock all levels"). A completed level can be played again only through Replay right after the win
- [x] Robots always face the player with large eyes; the head arrow and pupils show the heading
- [x] Forty levels on two pages of 20, each page an arc; the first five teach the rules one at a time (`design/level-structure.md`)
- [x] Level design tools: measure every level, generate candidates per idea, report (`tools/level-design/`, `design/level-report.md`)
- [x] Turn tile (a tile that turns whoever steps onto it), agreed 2026-11-22: in the engine, drawn as a board part, and animated as a beat of its own after the step
- [x] Page 3: twenty turn-tile levels, levels 41 to 60, in the game
- [x] Exit per colour (an exit that takes one colour and is plain floor to the others), agreed 2026-11-22: in the engine and drawn in the robot colour
- [x] Page 4: twenty exit-per-colour levels, levels 61 to 80
- [x] Pressure plate and gate (a gate is open while a robot stands on a plate), agreed 2026-11-22: in the engine and drawn as a purple pair
- [x] Page 5: twenty plate-and-gate levels, levels 81 to 100; one hundred levels in all
- [x] Coins: earned per win by its stars (10, 20, 30), spent on Undo (5), the next-move hint (20) and extra moves (40); amounts reasoned in `design/economy.md`; no real shop, no ads
- [x] Win celebration (2026-11-22, proposals to choose from): between the last robot's exit and the win pop-up a short celebration plays on the board. Three variants in the test lab ("Win celebration"): Confetti, Light wave, Victory hop. Three stars is a little more exuberant; reduced motion gets one quiet glow; a tap skips it and the pop-up never waits a second. Values in `celebration` of `data/config.json`, logic in `src/game/celebration.ts`, effects in `src/render/celebration.ts`. The owner still picks the one that ships (`celebration.variant`)
- [x] Test shop (2026-11-22): pretend coin purchases behind a `PurchaseProvider` interface, "Get coins" links at the cannot-afford moments, a test ledger and switches in the test lab. Nothing is charged and nothing leaves the device; what a real shop needs and the economy note are in `design/shop.md`

## Keep
-

After play: Doorgaan (proceed). Next step chosen: make it a real project at the repo root.

## Avoid
- No lore or story layer: no Prismport, districts, lighthouse or other landmarks, no home hub. Only the level selection and the game itself. *(you said, after the Beacon Bay build)*
- Visual chaos, busy menus, generic stock graphics.
- Changing the core mechanic without consulting.

## Out of scope
- Rewarded ads, purchases, robot skins, daily challenges: later. Hints and extra moves exist as free prototype stubs.
- Orange and purple robots.

## Build order
1. Engine, solver, five levels, playable in the browser. (built)
2. Grown into the project root as a Web project: `src/`, `data/`, `tests/`. (built)
3. Ten levels, fair assistance, test lab. (built)
4. Story layer (home hub, lighthouse, districts) built, then removed on request. (done)
5. Level structure, difficulty measure, generator, 40 levels. New level elements proposed, not built: the owner decides. (built)

---
**Kill condition:** if the colour command still feels like trial and error after level tuning.

**Who it's for / what they feel:** casual puzzle players on a phone; "one tap, and the whole flock did what I planned".
