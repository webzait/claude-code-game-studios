# Evidence — background music

Design note: `design/music.md`. Date: 2026-11-22.

| File | What it shows |
|---|---|
| `measurements.json` | `npm run music:measure`: per variant the length, loudness, highest sample, the jump at the loop point, quietest and loudest second, share of energy in the lowest and highest range, and how the voices balance |
| `luisterpagina.html` | The listening page (Dutch, for the owner): the three variants from the game's own synth and scores, the game's volume, and the sound effects to try on top. `npm run music:listen` rebuilds it |
| `settings-music-on.png`, `settings-music-off.png` | The settings screen with the new Music switch, on and off (Sound switched off in the second: the two are independent) |
| `lab-music-variants.png` | The test lab's "Background music" choice |

The screenshots are taken by `tests/integration/music.spec.ts`, which also checks in a real browser
that the music waits for the first touch, reaches the speakers, stops in the background, follows the
Music switch and is remembered.

**No listening result is recorded here.** The agent that made the music cannot hear; the owner's
verdict on how it sounds is still open.
