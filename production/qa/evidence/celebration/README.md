# Win celebration: evidence (2026-11-22)

Three proposals for the moment between the last robot's exit and the win pop-up, chosen in
Settings → Test lab → Look → "Win celebration". Values: `celebration` in `data/config.json`.

| File | What it shows |
|---|---|
| `confetti-win.jpg`, `confetti-perfect.jpg` | **Confetti**: flecks in the level's robot colours shoot up from the exit and flutter down. Three stars: twice the flecks, gold among them, a second shower from the middle |
| `wave-win.jpg`, `wave-perfect.jpg` | **Light wave**: the tiles light up in a ring that runs from the exit to the far corner. Three stars: one ring per robot colour, then a gold one |
| `hop-win.jpg`, `hop-perfect.jpg` | **Victory hop**: the robots jump out of the exit once more, spin and dive back in. Three stars: higher, two spins, a burst per colour |
| `calm-win.jpg`, `calm-perfect.jpg` | Reduced motion (`prefers-reduced-motion`, or the game's own setting): whichever variant is chosen, the tiles glow once (green, gold for three stars) and nothing moves |

Each file is eight frames of one real win of level 26 (five robots, three colours) in the
single-file build at 390×844: 0.05, 0.2, 0.35, 0.5, 0.7, 0.9, 1.2 and 1.6 seconds after the
celebration starts. "win" is a two-star win (8 moves, shortest is 7), "perfect" the shortest
solution. The game's clock was stepped by hand for these, so the times are exact.

## What stills cannot show

Timing, easing and whether it *feels* like a reward. Frames prove that each effect appears, where,
in which colours, and that the pop-up arrives while it plays; they do not prove that it feels good.
That needs eyes on a phone.

## Frame rate

Not measured on a phone: this was built in a container without a graphics card. There the
browser draws the 8×8 test board (12 robots) at 0.5 frames per second with or without a
celebration, which says nothing about a phone. What could be measured is what a celebration adds
to a frame on that largest board:

| | Draw calls | Triangles | Script time per frame (desktop CPU) |
|---|---|---|---|
| Board alone (8×8, 12 robots) | 128 | 1,109,630 | n/a |
| + Confetti, three stars (150 flecks) | +1 | +300 | 0.03 ms mean, 0.3 ms worst |
| + Light wave, three stars | +1 | +1,026 | 0.01 ms mean, 0.1 ms worst |
| + Victory hop, three stars | +0 (the robots' own) and at most 42 short-lived flecks | +0 | under 0.01 ms mean, 0.7 ms worst |

Confetti and the wave are one instanced mesh each. The added load is about a thousandth of what
the board already draws, so a phone that plays the game smoothly will play the celebration
smoothly; that is an inference from these numbers, not a measurement on a device.

## Checks that ran

- `npm run test:unit`: `tests/unit/celebration.test.ts` (when it starts, three stars, calm version,
  sound off, skip, cancel, saved choice).
- `tests/integration/celebration.spec.ts`: each variant in the build, tap to skip, leaving before
  the pop-up, reduced motion, sound off, the test-lab choice.
- The existing browser checks that win a level (`tests/integration/boot.spec.ts`).
