# Finding B13 — one screen over another

The owner's screenshot: `owner-screenshot-level-screen.png` (the garden level screen in the test grid,
inset as a frame over the puzzle's garden, the "Test view" tab over the star counter).

Every sheet shows BEFORE (top, the build before the fix, commit 2cdffd8) and AFTER (bottom).

| File | What |
|---|---|
| `owner-case-garden-grid-402x874.webp`, `owner-case-robot-grid-402x874.webp` | The owner's case: 402×874 with the artifact version's padding on `#app` (16 px on every side). Before reproduces the screenshot. |
| `artifact-notch-<theme>-<state>.webp` | Artifact padding (`max(16px, env(safe-area-inset-*))`) plus an emulated notch (59 px top, 34 px bottom), at 320×568, 390×844 and 430×932. |
| `plain-<theme>-<state>.webp` | The plain build without padding or notch, same sizes. |
| `transitions-artifact-notch-<theme>.webp` | Level screen, shop, puzzle, settings and test lab, 390×844 with artifact padding and notch. |

States: `path` (the normal path), `grid` (test view, all levels unlocked), `done` (all levels completed),
`improve` (levels to improve).

Measured (plain build, before against after, pixel diff): path, done and improve are identical in both
themes at all three sizes (the path differs only in the breathing glow of the current level); only the grid
changed, where the tray and its tab ran under the header in both themes. With the artifact padding and the
notch, before: 7 of 24 cases with a covered header control and every screen inset by the padding;
after: none, every screen fills the window. Guarded by `tests/integration/screens.spec.ts`.

Screenshots in headless Chromium (SwiftShader), deviceScaleFactor 1; the notch is emulated with
`Emulation.setSafeAreaInsetsOverride`. Not checked on a real phone or on the published artifact page.
