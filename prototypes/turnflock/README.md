<!-- PROTOTYPE - NOT FOR PRODUCTION -->
# Turnflock — prototype

**Hypothesis:** one global colour command (turn one colour, everyone steps) is satisfying and
strategic enough that players want the next level. **Status:** first playable, waiting for a play
verdict. The design record is `design/game-brief.md`.

## Run it

```bash
cd prototypes/turnflock
npm install
npm run dev        # Mac: open the "Local" address; iPhone on the same Wi-Fi: open the "Network" address
npm test           # 57 rule, session and level tests
npm run solve      # shortest solution of every level, from the solver
npm run build      # production build in dist/ (npm run preview serves it)
```

Controls: the four buttons. On a keyboard: `1` red, `2` blue, `3` yellow, `Space` forward, `Z` undo, `R` restart.

## Rules (src/engine/engine.ts)

1. Robots of the commanded colour turn 90° clockwise (Forward turns nobody).
2. Every robot tries to step into the cell ahead.
3. Walls and the board edge block. Two robots wanting the same cell both stay.
4. A robot may enter an occupied cell only if its occupant really leaves that turn.
5. Swaps and closed cycles stay put.
6. A robot that steps onto the exit is collected. Several may enter in the same turn
   (`Rules.exitAcceptsMany`, the one interpretation not in the original brief).
7. Out of moves with robots left: the attempt fails.

## Layout

| Path | What |
|---|---|
| `src/engine/` | Pure deterministic rules: `step(board, state, command)` returns the new state and per-robot events |
| `src/solver/bfs.ts` | Breadth-first solver calling the same `step` |
| `src/levels/` | Levels as text grids, with `par` and `moveBudget` |
| `src/game/session.ts` | One attempt: undo history, command log, win and loss |
| `src/render/` | Three.js diorama; animates events after the state is final |
| `src/ui/` | HUD and result card |
| `src/config.ts` | Colours, animation timings, camera, star thresholds |
| `tools/` | `solve.ts` and `compose.ts`, the level design aids |
| `evidence/` | Screenshots from a real browser run at phone size |

## Levels

| # | Name | Robots | Par | Budget | Shortest solutions |
|---|---|---|---|---|---|
| 1 | Follow the Arrow | 3 | 7 | 9 | 1 |
| 2 | One Color Turns | 4 | 7 | 9 | 1 |
| 3 | Use the Wall | 4 | 8 | 10 | 2 |
| 4 | Traffic Jam | 6 | 8 | 10 | 1 |
| 5 | One Command, Many Consequences | 12 | 10 | 12 | 1 |

Levels 1–4 were drawn by hand and checked with the solver. Level 5's board and intended command
order were chosen by hand; the robot placement was picked from candidates `tools/compose.ts` proposed.

## Later (not built)

Hints ask the solver from the current state; extra moves raise `Session.bonusMoves`; skins swap
`src/render/robot.ts`; a daily challenge is another `Level`. Orange and purple are in `config.ts`.
