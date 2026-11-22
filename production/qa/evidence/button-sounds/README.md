# Button sounds (2026-11-22)

Evidence for `design/button-sounds.md`. Nobody has listened to these sounds yet: everything here is
measured or observed by automated checks. The judgement of how they sound is the owner's.

| File | What it shows |
|---|---|
| `measurements.md` | Every button sound of every set as the game plays it: length, time heard, onset, peak, level, silent edges. Written by `npm run sounds` |
| `listening-page.html` | The listening page as built by `npm run build:sounds` (one file, open it in a browser): every sound on its own button, whole moves, and twelve fast moves |
| `listening-page-390x844.png` | That page at phone width |
| `lab-sound-set-390x844.png` | Test lab, "Button sounds" switched from Classic to Wood |
| `settings-sound-off-390x844.png` | The player's Sound switch, off |

Browser checks (`tests/integration/sounds.spec.ts`, single-file build, Chromium): the lab offers all
five sets and keeps the choice; with each new set a tap on RED asks for `press-red` within 20 ms of
the touch, then `turn`, then `step` at least 0.1 s later; Classic still plays one sound per move; six
taps 60 ms apart never push the output above `audio.limits.busyPeak`; a disabled command button
answers with `deny`; with Sound off nothing is played and the setting survives a reload.

Size of the single-file build: 1,709,288 bytes before, 1,721,674 bytes after: the sounds, the test
lab choice and the checks' hooks add 12,386 bytes (0.7 %).
