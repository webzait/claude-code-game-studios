# Level design tools

Everything here uses the game's own rules (`src/engine/engine.ts`); nothing in this folder ships in the game.

| Command | What it does |
|---|---|
| `npm run solve` | Shortest solution of every level, or of the boards in a JSON file (`{ "name": ["row", …] }`). |
| `npm run measure` | Measures every level and writes `design/level-report.md`. `-- --print` shows one line per level. |
| `npm run generate -- <idea> [key=value …]` | Proposes candidate boards for one idea. Without arguments: lists the ideas. |
| `tsx tools/level-design/compose.ts spec.json` | The older aid: robots for a hand-drawn board and a given command list. |

## Files

- `graph.ts` — every position reachable within the move budget, and from each the distance to a win.
- `measure.ts` — the numbers of one level (length, number of shortest solutions, search size, dead positions,
  fatal presses, forced commands, moves that look wrong, order freedom) and the 0–10 difficulty score.
- `generate.ts` — random boards for a recipe, sieved, measured, tidied (walls that change nothing are removed).
  With `planTurns` in the recipe it works backwards from an intended solution, which gives boards that walk more and spin less.
- `fast.ts` — a copy of the rules on flat arrays, used only to sieve candidates quickly. It decides nothing:
  survivors are measured on the real engine, and `tests/unit/level-tools.test.ts` compares it with the engine move for move.
- `ideas.json` — one recipe per idea the current rules offer.
- `report.ts` — the report. Idea, origin and one sentence per level come from `design/levels-catalog.json`.

Tuning values (score weights, search limits, rejection thresholds) are in `data/config.json` under `levelDesign`,
described in `data/config-notes.md`.

## Making a level

1. `npm run generate -- queue size=6x5 seed=3 tries=1500 keep=8 planTurns=2..4` — read the candidates; each comes
   with its numbers and one shortest solution. Any recipe field can be overridden (`red=3`, `par=7..9`,
   `require.bumpSteps=1..`). The same seed gives the same candidates.
2. Pick the one that shows its idea most plainly. Tidy it by hand if needed (mirror it, move a robot, drop a wall)
   and check the result with `npm run solve -- file.json`.
3. Add it to `data/levels.json` with `par` and `witness` from the solver, and to `design/levels-catalog.json`
   with its idea, its origin (`hand`, `tidied`, `generated`) and one sentence.
4. `npm run test:unit` certifies it (the witness wins, `par` is the true shortest solution, two independent searches agree);
   `npm run measure` rewrites the report.

Turn tiles: a recipe's `tiles` (a number or range) places them, `require.tileTurns=2..` asks that the solution really uses them,
and the tidy step removes tiles, like walls, that change nothing.

A generated board is a proposal. The generator rejects what is unsolvable, trivial (one repeated command, or winnable
in almost any order), too loose (too many shortest solutions), beyond its search limit, or missing the idea's own
mark (for example no robot ever waiting behind another in a queue level). Whether a board is *good* is for a person to say.

## Seeing the levels

`npm run build:single && node tools/level-design/screenshots.mjs [level numbers…]` opens the built game at phone
size, screenshots both pages of the level selection and the chosen levels, plays each with its stored witness and
fails if one is not won. Pictures go to `production/qa/evidence/levels/`.
