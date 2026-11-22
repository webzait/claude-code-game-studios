# Evidence — findings B7 and B8 (settings choices), 2026-11-22

Screenshots of the running game (`dist-single/index.html`, Chromium with SwiftShader, device scale 2)
at 320×568 and 390×844. Level 40 is the 8×8 board with all three colours: the smallest cells in the game.

## B7 — Vibration removed

| File | Shows |
|---|---|
| `before-settings-*.png` | Settings before: the Vibration switch is there |
| `b7-settings-no-vibration-*.png` | Settings after B7: Sound and Reduce motion only |
| `parts-page-settings-mockup-390x844.png` | The mock-up on the parts page: no Vibration, no Larger text, no "New idea" labels |

## B8 — Colour shapes

| File | Shows |
|---|---|
| `after-settings-shapes-off-*.png`, `after-settings-shapes-on-*.png` | The new row with its preview, switched off (default) and on |
| `before-level40-*.png` | Level 40 before the change |
| `level40-shapes-off-*.png`, `level40-shapes-on-*.png` | Level 40 with the setting off and on |
| `level40-off-vs-on-*.png` | The two side by side |
| `robots-zoom-off-vs-on-390x844.png` | The robots enlarged twice, off and on |
| `live-switch-on-level-in-progress-390x844.png` | Switched on while a level was in progress (one move played): robots and buttons changed at once |
| `lab-variants-builtin-faceup-symbol-shapes-on.png` | The test lab's other robots with the setting on: built-in robot, "Face up", "Symbol" |

## Colour-blindness simulation

`cvd.py` (in this folder) applies the Machado, Oliveira & Fernandes (2009) matrices at full
severity in linear RGB, plus a luminance-only greyscale. Each `sim-<kind>-off-vs-on-<size>.png`
shows the same screenshot with the setting off (left) and on (right).

What they show:

- **Protanopia, deuteranopia**: red turns dark olive, yellow stays a bright yellow, blue stays blue.
  With this palette the three colours still differ, red and yellow by lightness only. With the
  setting on, each robot also carries the shape of its button (disc, square, diamond).
- **Tritanopia**: the colours shift but stay apart.
- **Greyscale**: with the setting off, red and blue robots and their buttons are the same grey and
  cannot be matched; with it on, disc and square tell them apart. This is the case the setting is for.
- Seen in passing, not changed (outside these findings): in the protanopia and deuteranopia
  simulations the green exit turns the same yellow as a yellow robot. It keeps its check mark.

Not checked: a real phone, and a person who is colour-blind. A simulation is an approximation.
