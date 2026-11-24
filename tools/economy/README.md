# Economy model

What kinds of player earn and spend over the levels, where the wallet runs short and how many coins they
would have to add. The reasoning and the conclusions are in `design/economy.md`; nothing here ships in the game.

| Command | What it does |
|---|---|
| `npm run economy` | Runs every tuning of `data/config.json` over levels 1–20, 1–40 and all levels, and writes the tables to `production/qa/evidence/economy-tighten/`. |
| `npm run economy -- --print` | Also prints the summary. |
| `npm run economy -- --runs=500` | Fewer or more runs per player type (default 2000). The seed is fixed, so the tables are the same every time. |

## Files

- The tunings are the game's own data: `coins`, `shop.packs` and `economy` in `data/config.json` (`TUNINGS` in `src/game/coins.ts`). To try other amounts, edit them there and run again.
- `sets.json` — the record of the first round's proposals (`design/economy-round1.md`); its tables are in `production/qa/evidence/economy/`. No longer run.
- `players.json` — the player types. Each habit is a pair: its value on a level of difficulty score 0 and of
  score 10, a straight line between. `perfect` is the chance of the shortest solution, `undos` and `hints` are
  averages per level, `extraMoves` is the chance of wanting "+3 moves". **These are assumptions, not measurements.**
- `model.ts` — the model. It plays no boards: it draws what a player wants on each level and counts every coin
  with the game's own functions (`src/game/coins.ts`), so a change of formula there changes the model too.
- `run.ts` — runs it and writes the tables.

Difficulty per level is the score in `design/level-report.md` (`npm run measure`); a level that is not in the report stops the run. Levels come from `data/levels.json`.

The summary (`model-summary.md`) puts the tunings side by side: the amounts, what one help costs in euro from a pack, how much help ten levels of earnings buy, the level of the first shortfall, the wallet over the levels and what buying everything would cost. Each player is run twice: wanting the same help whatever it costs, and price-aware (`priceAware` in `model.ts`: a help three times as dear is taken a third as often).

## What the model assumes

- A player wants the same help whatever it costs. Real players take fewer Undos when they cost more
  (Restart is free); the price-aware rows and `model-sensitivity.md` show how much the answer leans on that.
- A help the wallet cannot pay is skipped and the level is still won: a refused "+3 moves" becomes a free
  retry that wins on the last move of the budget.
- Free Undos (`freeUndosPerLevel`) are counted once per level, though the game grants them again after a Restart.
- Every level is won once, in order; nobody replays an earlier level for a better result.
