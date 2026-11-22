# TURNFLOCK — background music

Status: 2026-11-22. Three variants are built and can be compared; **the owner has not chosen yet**.
Until then the game plays `meadow` (`music.variant` in `data/config.json`).

> **Nobody has listened to this yet.** The music was written and checked by an agent that cannot
> hear. Everything below that says "measured" is a number; whether a piece sounds pleasant, calm and
> cheerful is the owner's call and is still open.

## 1. What the music is for

Turnflock is a thinking game. The music should make the game feel friendly without asking for
attention: relaxed, cheerful, and still bearable after many minutes on one level.

Rules every variant keeps to:

- **Original and made here.** Each piece is a small score in `data/music.json` (chords, bar
  phrases, a tune) that `src/music/synth.ts` turns into sound from sine waves. No samples, no audio
  files, nothing from outside the repository, no existing melody.
- **Soft instruments only.** Sums of a few sine waves with a gentle start: nothing above about
  7 kHz, so nothing can sound sharp or hissy.
- **The key of the sound effects.** All sound effects of the game turn out to be notes of C major
  (unit-tested). The music uses only those seven notes, so an effect on top of the music is never
  out of tune with it.
- **About a minute before it repeats**, with a quieter stretch in the middle, so the repeat is not
  heard as one.
- **Under the effects.** The music's loudness stays below that of a sound effect.

## 2. The three variants

| | Meadow | Drift | Stroll |
|---|---|---|---|
| Idea | Light and sunny | Slow and floating | A cheerful walk |
| Tempo | 88 beats a minute | 66 | 100, with a light swing |
| Length of the loop | 65.5 s (24 bars) | 58.2 s (16 bars) | 57.6 s (24 bars) |
| Carries the piece | A wooden marimba pattern | Soft electric-piano chords, strummed | Bouncing bass and plucked chords on beats 2 and 4 |
| Tune | Thumb piano, from bar 9 on | A few long bell notes | Thumb piano, playful, with a rest in the middle |
| Underneath | Round bass, a faint held chord | Held chord, one bass note a bar | A light shaker; a marimba joins in the middle |
| Expected character | The middle road | The calmest; may be too sleepy | The liveliest; may be too busy for hard levels |

The "expected character" row is reasoning from the scores, not a listening result.

## 3. How it plays in the game

- **When.** On the level screen and the puzzle screen, and it carries on through the settings and
  the test lab so it does not drop out while the player is at the Music switch
  (`music.screens`). It fades in over 1.5 s.
- **First touch.** Browsers allow no sound before the player touches the page. The music is
  prepared while the page loads and starts at the first touch or key press.
- **Background.** When the tab or the app goes to the background the music is cut within 0.03 s and
  all audio work is paused; back in front it carries on from where it was.
- **Settings.** "Music" is its own switch under "Sound" in the settings. The two are independent:
  either can be off while the other is on. The choice is kept in the save (`settings.music`, save
  version 7; older saves get music on).
- **Comparing.** Test lab → Music → "Background music" switches between the three while playing.
- **Sound effects.** Effects and music share one audio context and are added together; nothing is
  turned down for the other. With the configured volumes the sum stays under full scale
  (section 4).

How it is made: the score is rendered once, in a background worker, to one stereo loop that the
browser repeats. Notes that still ring at the end of the loop are written on at its start, so the
last sample runs into the first like any sample into the next. That is why the loop has no seam.

## 4. What was measured

`npm run music:measure` (numbers in `production/qa/evidence/music/measurements.json`), the unit
tests in `tests/unit/music.test.ts` and the browser checks in `tests/integration/music.spec.ts`.

| Check | Meadow | Drift | Stroll | Passes when |
|---|---|---|---|---|
| Length | 65.455 s | 58.182 s | 57.600 s | exactly the bars at the tempo |
| Jump at the loop point | 0.002 | 0.002 | 0.001 | no larger than the largest jump inside the loop |
| Largest jump between two samples | 0.10 | 0.09 | 0.17 | under 0.25 (a click would be larger) |
| Highest sample, as rendered | 0.51 | 0.72 | 0.83 | at most 0.9 |
| Highest sample at game volume (0.5) | 0.26 | 0.36 | 0.42 | plus the loudest effect (0.32) under 1 |
| Loudness (rms), as rendered | 0.100 | 0.100 | 0.100 | all equal, so they compare fairly |
| Quietest / loudest second | 0.063 / 0.138 | 0.046 / 0.158 | 0.043 / 0.128 | no silent gap, no swell |
| Sound energy above 4 kHz | 0.003 % | 0.001 % | 0.1 % | under 1 % |
| Sound energy below 150 Hz | 13 % | 14 % | 17 % | reported only: a phone speaker hardly plays it |

In a real browser (headless Chromium, with a probe on the way to the speakers): no sound before
the first touch; sound after it; sound on the puzzle screen with effects on top, highest sample
under 1; silence and a paused audio context in the background, sound again in front; the Music
switch silences it, leaves Sound alone, and is still off after a reload; the test lab switches
between the three.

**Not checked, because it cannot be measured here:** how any of it sounds; how loud it is next to
the effects on a real phone speaker; whether a phone's silent switch or a phone call is handled
the way a player expects (iOS in particular); how long the preparation takes on a slow phone
(0.3 to 0.8 s on the development machine, in a background worker, so the game does not stutter
either way).

## 5. Cost

- **Size of the single file:** 1,709 kB before, 1,728 kB with music: **+18 kB (about 1 %)**, for
  all three variants, the synth and the worker. No audio file is shipped.
- **Memory while playing:** about 12 MB for the one loop that is loaded.
- **After the choice** the two other scores can be removed (about 2 kB each); the test-lab choice
  then goes too.

## 6. Open

1. **Which variant** becomes the game's music, or none of them as they are.
2. **Volume** next to the effects: `music.volume`, now 0.5.
3. Anything heard that the numbers cannot show: a note that grates, a tune that nags after a few
   minutes, too much or too little bass on a phone.

Listening page (the same synth and scores as the game, plus the game's sound effects to try on
top): `production/qa/evidence/music/luisterpagina.html`, rebuilt with `npm run music:listen`.
