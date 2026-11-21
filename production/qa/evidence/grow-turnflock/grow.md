# Turnflock grown into the project root

From `prototypes/turnflock/` at commit c19e244 (tag `one-shot/turnflock`). The prototype folder is unchanged.

| Step | Result |
|---|---|
| Same-seed reference replay | NOT ASSESSED: the studio's replay script drives a one-shot's `config.js` and `window.game` hook; this prototype was already Vite + TypeScript and has neither. The game has no randomness; determinism is covered by unit tests instead. |
| Copy | By hand, not `one-shot-grow.sh copy` (same reason). Code to `src/`, tests to `tests/unit/`, level tools to `tools/level-design/`. |
| TypeScript | Already TypeScript; `tsc --noEmit` clean with `strict`. Nothing typed `Loose`. |
| Values in data | Levels in `data/levels.json`; colours, timings, camera, stars and the exit rule in `data/config.json` (`data/config-notes.md`). |
| Rules under test | Vitest: 57 passed (engine rules, session, solver, all five levels). Playwright on the single-file build at 390×844: 3 passed (`@boot`, level 1 played to a win through the buttons, undo/restart/out of moves). |
| Build | `npm run build` and `npm run build:single` pass. |
| Record | `one-shot-grow.sh record`: `engine.name: Web`, version 8.3.8 written to `project.yaml`; CLAUDE.md Technology Stack filled. |
| Seen | `grown-level-5.png`: level 5 from `dist-single/index.html`, no console errors. |

Not assessed: play on a real phone; the same-seed replay (above).
