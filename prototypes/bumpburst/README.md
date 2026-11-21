# BUMPBURST (prototype)

One color. One burst. Big chain reactions. The design record is `brief.md`.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 ; also prints a Network URL for an iPhone on the same Wi-Fi
npm test             # 44 automated checks (physics, rules, levels, determinism)
npm run solve        # plays every pulse order of every level in the real simulation
npm run build        # type-check + production build in dist/
npm run preview      # serves dist/ on http://localhost:4173 (and on the network)
npm run build:single # one self-contained dist-single/index.html that opens by double-click
```

Browser check (needs a global Playwright): start `npm run preview`, then
`NODE_PATH=$(npm root -g) npm run e2e`. It plays all five solutions through the real
buttons at four screen sizes and keeps screenshots in `evidence/`.

Useful URLs: `?level=3` opens a level directly, `?fps` shows frame time, sim time and draw calls,
`?cheap` turns off antialiasing and shadows.

## Controls

Tap a color button (or keys 1-3). R resets, M mutes, Enter confirms.

## Layout

| Folder | Holds |
|---|---|
| `src/config.ts` | every tuning value, colours, symbols, theme |
| `src/physics/` | deterministic fixed-step 2D simulation (no DOM) |
| `src/levels/` | level data with a stored solution each |
| `src/game/` | rules: pulse budget, input lock, win / loss, progress |
| `src/input/` | touch and keyboard to intents |
| `src/render/` | Three.js diorama (instanced marbles) |
| `src/ui/`, `src/audio/` | HUD and synthesised sound |
| `tools/` | solver, path tracer for level design, browser check |
