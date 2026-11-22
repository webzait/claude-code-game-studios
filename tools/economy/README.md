# Economy model

What kinds of player earn and spend over the levels, where the wallet runs short and how many coins they
would have to add. The reasoning and the conclusions are in `design/economy.md`; nothing here ships in the game.

| Command | What it does |
|---|---|
| `npm run economy` | Runs every rule set over levels 1–40 and 1–60 and writes the tables to `production/qa/evidence/economy/`. |
| `npm run economy -- --print` | Also prints the summary. |
| `npm run economy -- --runs=500` | Fewer or more runs per player type (default 2000). The seed is fixed, so the tables are the same every time. |

## Files

- `sets.json` — the rule sets: the first economy, the proposals, and `recommended`, which a unit test keeps
  equal to `coins` in `data/config.json`. To try other amounts, edit a set or add one and run again.
- `players.json` — the player types. Each habit is a pair: its value on a level of difficulty score 0 and of
  score 10, a straight line between. `perfect` is the chance of the shortest solution, `undos` and `hints` are
  averages per level, `extraMoves` is the chance of wanting "+3 moves". **These are assumptions, not measurements.**
- `model.ts` — the model. It plays no boards: it draws what a player wants on each level and counts every coin
  with the game's own functions (`src/game/coins.ts`), so a change of formula there changes the model too.
- `run.ts` — runs it and writes the tables.

Difficulty per level is the score in `design/level-report.md` (`npm run measure`); a level that is not in the
report stops the run. Levels come from `data/levels.json` (and from `data/levels-upcoming.json` when that file exists; it holds levels that are certified but not in the game yet). The tables cover two ranges: the first two pages, and the first three. Page 4 is not in them yet.

## What the model assumes

- A player wants the same help whatever it costs. Real players take fewer Undos when they cost more
  (Restart is free); `model-sensitivity.md` shows how much the answer leans on that.
- A help the wallet cannot pay is skipped and the level is still won: a refused "+3 moves" becomes a free
  retry that wins on the last move of the budget.
- Free Undos (`freeUndosPerLevel`) are counted once per level, though the game grants them again after a Restart.
- Every level is won once, in order; nobody replays an earlier level for a better result.
