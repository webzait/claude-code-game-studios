# TURNFLOCK — button sounds

Status: 2026-11-22. **Proposal: five sets are built, none is chosen yet.** The game still plays the
set it always had (`classic`) until the owner picks one. Nobody has listened to the four new sets:
they were made and measured by an agent that cannot hear. Which one sounds right is the owner's call.

## What the sets are

Every set answers the same moments, so they can be compared like for like.

| Set (`id`) | Character | Pitch? |
|---|---|---|
| **Classic** (`classic`) | The game's first sounds: one short beep per move, the same for every button. | yes |
| **Wood** (`wood`) | Soft wooden knocks, like tapping a toy block; each colour its own height. | barely |
| **Bubble** (`bubble`) | Bright, playful blips that slide upwards; the three colours form a major chord. | yes |
| **Switch** (`switch`) | Dry mechanical clicks, like keys and switches; no notes at all. | no |
| **Kalimba** (`kalimba`) | Warm plucked notes, like a thumb piano; the four buttons form a calm little scale. | yes |

"Pitch" matters for later: a set with clear notes (Bubble, Kalimba, Classic) can clash with
background music in another key; Wood and Switch fit under any music. Bubble's notes are C–E–G and
Kalimba's are G–A–C with forward on C, so music in C major or A minor sits well with both.

## The moments a set covers

| Sound | When |
|---|---|
| `press-red`, `press-blue`, `press-yellow` | The touch of a colour button. Related within a set, but each recognisably its own. |
| `press-forward` | The touch of FORWARD: lower and rounder than the colours. |
| `turn` | The robots of that colour start turning. Not played when no robot of that colour is left to turn. |
| `step` | The robots start stepping. |
| `bump` | An "impossible" move: the step in which no robot could move. |
| `deny` | A refused action: a command button touched while it cannot be used (level over, replay or check running), an Undo or extra moves the wallet cannot pay, a failed test purchase. |
| `tap` | Menu and tool buttons (Undo, Restart, settings, level choice). |

Shared by all sets and **not touched by this work**: `exit`, `win`, `fail`, `scan` (hint) and `coin`.
The win jingle and any celebration belong to another session; a set's loudness and pitch settings do
not reach them.

### Timing

Each set says when a move's sounds play (`timing` in `data/sound-sets.json`):

- `tap` (Classic): one sound at the touch, chosen from what the move will do, exactly as before.
- `motion` (the four new sets): the button sounds at the touch; `turn` and `step` sound when the board
  view starts the turn and the step. When taps are queued the animation speeds up and the sounds follow
  it; an Undo or Restart drops the queued moves and their sounds with them.

## Staying light

- **Direct**: sounds are ready-made buffers started in the tap's own handler; there is no effect in
  the chain that adds delay. Every button sound reaches half its peak within 8 ms of its start
  (`audio.limits.onsetMs`, unit-tested).
- **Short**: button sounds last at most 0.33 s on paper and are heard for 15–75 ms; robot sounds at
  most 0.13 s (`audio.limits`, unit-tested).
- **Fast tapping**: sounds of one group never overlap. A new button sound fades the previous one out
  in 12 ms, and so does a new robot sound. The same sound is not started again within 30 ms, and
  within 120 ms it plays at 70 % (`audio.rapid`).
- **Quiet robots**: `turn` and `step` are clearly softer than the buttons in the new sets (unit-tested),
  because they play on every move.
- **No clicks at the edges**: every layer fades in over at least 1 ms and ends on exact silence;
  every sound's first and last sample is 0 (unit-tested).

## Where things live

| What | Where |
|---|---|
| Recipes of every sound (schema below) | `data/sound-sets.json` |
| Volume, the default set, per-set loudness and pitch, fast-tapping rule, limits the tests hold the sounds to | `data/config.json` → `audio` (described in `data/config-notes.md`) |
| Synthesiser (recipe → samples, pure arithmetic) | `src/sound/synth.ts` |
| Catalogue, move plan, fast-tapping rule | `src/sound/sets.ts` |
| Measurements | `src/sound/report.ts`, `npm run sounds` |
| Player (Web Audio) | `src/audio.ts` |
| Test lab choice "Button sounds" | `src/ui/settingsView.ts`, saved as `lab.soundSet` |
| Listening page | `sounds.html`, `src/sounds-page/`; `npm run build:sounds` → `dist-sounds/sounds.html` |

All sounds are original and made in this repository by code. There are no sound files, nothing from
the internet or a sound library, and no outside service.

### Recipe schema (`data/sound-sets.json`)

Top level: one entry per set id. Each has `name` and `blurb` (test lab, English), `nl.name` and
`nl.blurb` (listening page), `timing` (`tap` or `motion`) and `sounds`.

`sounds` maps a sound name to a list of layers that are added together, or to the name of another
sound of the same set ("the same as"). A sound a set leaves out comes from `classic`. An empty list is
silence. A layer:

| Key | Meaning | Default |
|---|---|---|
| `wave` | `sine`, `triangle`, `square`, `saw` or `noise` | required |
| `freq` | Pitch in Hz at the start (ignored by noise) | 440 |
| `freqEnd`, `glide` | Pitch the layer glides to, and over how many seconds | steady; whole layer |
| `at` | Seconds after the start of the sound at which the layer begins | 0 |
| `length` | Seconds the layer lasts; it dies away to silence over this time | required |
| `attack` | Seconds of fade-in (at least 0.001) | 0.005 |
| `gain` | Loudness; 1 is one of the classic beeps | 1 |
| `filter` | `type` (`lowpass`, `highpass`, `bandpass`), `freq` in Hz, `q` | none; q 0.707 |
| `fm` | Bell colour: `ratio`, `index`, `decay` in seconds | none |

## Living next to music and the win celebration

- Sound effects have one volume control of their own (`audio.volume`). Music or a celebration built
  later gets its own control and can share the same audio output (`Sfx.context`).
- The Sound switch in the settings (`settings.mute`, already there and saved) silences the effects.
  Whether music gets a switch of its own is for the music session to decide.
- A busy moment (a button, a robot sound and the two loudest shared sounds together) peaks at about
  0.6 of full scale; music has to fit in what is left or the effects' volume has to come down a little.

## When the owner has chosen

1. Set `audio.set` in `data/config.json` to the chosen id. That makes it the default for every player
   and for the test lab; the unit tests check the id exists.
2. The other sets stay in the test lab until the owner says they may go. Removing one is deleting its
   entry in `data/sound-sets.json` and in `audio.sets`; a save that still names it falls back to the default.

## What was and was not checked

Checked by measurement and automated tests (`tests/unit/sound.test.ts`,
`tests/integration/sounds.spec.ts`, numbers in `production/qa/evidence/button-sounds/`): length,
peak level, onset, silent edges, that the colours differ, that the sets are about equally loud by
peak, that the right sound is asked for at the right moment in the real build, that sound really
leaves the page and stays under the limit during fast tapping, that the Sound switch silences it.

**Not checked, because it needs ears:** whether a set is pleasant, whether the colours are easy to
tell apart, whether Wood sounds like wood, whether anything irritates after a hundred moves, how it
sounds on a phone speaker (small speakers lose the low notes of `step` and `bump`), and the delay
between touch and sound on a real phone (iOS and Android add their own).
