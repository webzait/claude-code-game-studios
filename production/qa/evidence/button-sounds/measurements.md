# Button sounds: measurements

Written by `npm run sounds` from the same samples the game plays (48 kHz, volume included).
`Heard` is the time until the sound has fallen for good below a tenth of its peak; `onset` the time until it first reaches half its peak;
`edge` the first or last sample as a share of the peak (0 = starts and ends on silence, so no click).
Volume `audio.volume` = 0.16; full scale is 1 (0 dB).

## Classic (`classic`, timing `tap`, gain 1, pitch 0)

| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |
|---|---|---|---|---|---|---|---|
| tap | 50 ms | 20 ms | 5.3 ms | 0.154 | -16.3 dB | -27.3 dB | 0.0000 |
| turn | 120 ms | 75 ms | 5.6 ms | 0.152 | -16.4 dB | -27.7 dB | 0.0000 |
| step | 60 ms | 22 ms | 4.7 ms | 0.147 | -16.7 dB | -26.1 dB | 0.0000 |
| bump | 90 ms | 30 ms | 5.0 ms | 0.160 | -15.9 dB | -24.0 dB | 0.0000 |
| deny | 90 ms | 30 ms | 5.0 ms | 0.160 | -15.9 dB | -24.0 dB | 0.0000 |

A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): 0.638 (-3.9 dB).

## Wood (`wood`, timing `motion`, gain 1, pitch 0)

| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |
|---|---|---|---|---|---|---|---|
| tap | 40 ms | 11 ms | 1.0 ms | 0.074 | -22.6 dB | -33.3 dB | 0.0000 |
| press-red | 120 ms | 31 ms | 1.3 ms | 0.150 | -16.5 dB | -28.5 dB | 0.0000 |
| press-blue | 130 ms | 34 ms | 1.1 ms | 0.140 | -17.1 dB | -28.5 dB | 0.0000 |
| press-yellow | 110 ms | 29 ms | 1.1 ms | 0.143 | -16.9 dB | -28.5 dB | 0.0000 |
| press-forward | 150 ms | 37 ms | 1.6 ms | 0.169 | -15.4 dB | -27.9 dB | 0.0000 |
| turn | 90 ms | 69 ms | 1.0 ms | 0.046 | -26.8 dB | -37.5 dB | 0.0000 |
| step | 90 ms | 23 ms | 3.2 ms | 0.087 | -21.2 dB | -32.3 dB | 0.0000 |
| bump | 110 ms | 31 ms | 1.3 ms | 0.091 | -20.8 dB | -30.9 dB | 0.0000 |
| deny | 150 ms | 106 ms | 1.0 ms | 0.103 | -19.7 dB | -30.6 dB | 0.0000 |

A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): 0.579 (-4.7 dB).

## Bubble (`bubble`, timing `motion`, gain 1.1, pitch 0)

| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |
|---|---|---|---|---|---|---|---|
| tap | 50 ms | 15 ms | 1.7 ms | 0.076 | -22.3 dB | -33.2 dB | 0.0000 |
| press-red | 160 ms | 42 ms | 1.5 ms | 0.140 | -17.1 dB | -28.7 dB | 0.0000 |
| press-blue | 160 ms | 41 ms | 1.7 ms | 0.147 | -16.6 dB | -28.6 dB | 0.0000 |
| press-yellow | 160 ms | 42 ms | 1.5 ms | 0.143 | -16.9 dB | -28.6 dB | 0.0000 |
| press-forward | 170 ms | 42 ms | 2.9 ms | 0.181 | -14.8 dB | -27.6 dB | 0.0000 |
| turn | 70 ms | 20 ms | 2.4 ms | 0.052 | -25.7 dB | -36.7 dB | 0.0000 |
| step | 70 ms | 20 ms | 1.6 ms | 0.070 | -23.1 dB | -34.3 dB | 0.0000 |
| bump | 100 ms | 26 ms | 1.3 ms | 0.093 | -20.6 dB | -31.3 dB | 0.0000 |
| deny | 200 ms | 120 ms | 2.6 ms | 0.123 | -18.2 dB | -29.5 dB | 0.0000 |

A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): 0.593 (-4.5 dB).

## Switch (`switch`, timing `motion`, gain 1.5, pitch 0)

| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |
|---|---|---|---|---|---|---|---|
| tap | 30 ms | 9 ms | 0.8 ms | 0.073 | -22.7 dB | -33.8 dB | 0.0000 |
| press-red | 60 ms | 15 ms | 0.8 ms | 0.137 | -17.3 dB | -29.7 dB | 0.0000 |
| press-blue | 60 ms | 15 ms | 0.9 ms | 0.126 | -18.0 dB | -29.6 dB | 0.0000 |
| press-yellow | 60 ms | 15 ms | 0.6 ms | 0.129 | -17.8 dB | -29.6 dB | 0.0000 |
| press-forward | 90 ms | 47 ms | 1.0 ms | 0.156 | -16.1 dB | -28.4 dB | 0.0000 |
| turn | 78 ms | 73 ms | 0.7 ms | 0.026 | -31.8 dB | -45.6 dB | 0.0000 |
| step | 70 ms | 21 ms | 1.3 ms | 0.095 | -20.5 dB | -29.9 dB | 0.0000 |
| bump | 70 ms | 19 ms | 0.9 ms | 0.090 | -21.0 dB | -30.4 dB | 0.0000 |
| deny | 130 ms | 95 ms | 1.4 ms | 0.096 | -20.4 dB | -29.3 dB | 0.0000 |

A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): 0.569 (-4.9 dB).

## Kalimba (`kalimba`, timing `motion`, gain 1.1, pitch 0)

| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |
|---|---|---|---|---|---|---|---|
| tap | 90 ms | 25 ms | 1.6 ms | 0.058 | -24.7 dB | -35.6 dB | 0.0000 |
| press-red | 300 ms | 73 ms | 2.1 ms | 0.138 | -17.2 dB | -29.5 dB | 0.0000 |
| press-blue | 300 ms | 73 ms | 1.9 ms | 0.137 | -17.3 dB | -29.5 dB | 0.0000 |
| press-yellow | 300 ms | 72 ms | 1.6 ms | 0.141 | -17.0 dB | -29.5 dB | 0.0000 |
| press-forward | 320 ms | 75 ms | 2.6 ms | 0.156 | -16.1 dB | -28.7 dB | 0.0000 |
| turn | 80 ms | 22 ms | 1.6 ms | 0.035 | -29.1 dB | -39.3 dB | 0.0000 |
| step | 90 ms | 27 ms | 3.2 ms | 0.053 | -25.5 dB | -35.6 dB | 0.0000 |
| bump | 120 ms | 33 ms | 1.8 ms | 0.076 | -22.4 dB | -32.9 dB | 0.0000 |
| deny | 180 ms | 115 ms | 2.7 ms | 0.100 | -20.0 dB | -30.9 dB | 0.0000 |

A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): 0.551 (-5.2 dB).
