# Economiemodel: C. Krap

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261122). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen staan in `tools/economy/sets.json`. Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.

10 munten per ster, maar alle hulp kost het dubbele en een winst met hint betaalt alleen de 10.

Start 30 · 1 ster 10 · 2 sterren 20 · 3 sterren 30 · winst met hint betaalt alleen 10 · Undo 10 · hint 20 · +3 moves 50

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 969 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 999 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 1064 | 446 | 446 | 405 / 42 / 0 | 0.0 | nooit | 648 | 0 / 0 / 0 |
| Gewone speler | 2.36 | 896 | 1686 | 902 | 811 / 76 / 15 | 46.9 | level 7 (2–14), 100% van de runs | 25 | 931 / 930 / 1200 |
| Speler met moeite | 2.21 | 868 | 3127 | 877 | 852 / 25 / 1 | 145.4 | level 3 (1–5), 100% van de runs | 21 | 2553 / 2550 / 2880 |
| Jonge tikker | 2.19 | 875 | 4751 | 884 | 881 / 3 / 0 | 280.4 | level 1 (1–2), 100% van de runs | 21 | 4229 / 4220 / 4620 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 |
| Puzzelaar | 27.1 | 9.3 | 0 | 26.1 | 13.0 | 0 |
| Gewone speler | 22.4 | 36.0 | 315 | 22.4 | 48.3 | 616 |
| Speler met moeite | 21.9 | 66.9 | 1020 | 21.6 | 89.5 | 1533 |
| Jonge tikker | 22.2 | 105.1 | 1814 | 21.5 | 132.5 | 2415 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 57 | 58 | 47 | 37 | 27 |
| 2 | Quarter Turn | 1.8 | 83 | 82 | 54 | 35 | 25 |
| 3 | Follow the Arrow | 3.1 | 108 | 103 | 53 | 28 | 23 |
| 4 | Everyone Steps | 2.1 | 134 | 126 | 60 | 30 | 24 |
| 5 | Lean on It | 2.7 | 159 | 148 | 61 | 28 | 23 |
| 6 | Two Minds | 3.1 | 185 | 168 | 60 | 27 | 23 |
| 7 | Side Door | 4.2 | 209 | 186 | 53 | 24 | 22 |
| 8 | Wait Your Turn | 3.8 | 234 | 205 | 50 | 24 | 22 |
| 9 | One Color Turns | 4.8 | 258 | 221 | 44 | 23 | 22 |
| 10 | Four Doors | 4.0 | 283 | 240 | 43 | 24 | 23 |
| 11 | Use the Wall | 4.8 | 307 | 256 | 40 | 23 | 22 |
| 12 | Three of a Kind | 4.3 | 332 | 273 | 38 | 24 | 22 |
| 13 | Close Quarters | 4.9 | 356 | 289 | 35 | 23 | 22 |
| 14 | Long Way Round | 5.5 | 380 | 303 | 32 | 22 | 22 |
| 15 | After You | 4.8 | 405 | 320 | 32 | 23 | 22 |
| 16 | Queue Up | 6.3 | 428 | 332 | 29 | 22 | 21 |
| 17 | The Corridor | 5.1 | 452 | 348 | 30 | 23 | 22 |
| 18 | Traffic Jam | 6.4 | 476 | 359 | 27 | 22 | 21 |
| 19 | Staircase | 3.6 | 501 | 378 | 33 | 24 | 23 |
| 20 | One Command, Many Consequences | 7.9 | 524 | 385 | 25 | 21 | 21 |
| 21 | Easy Does It | 4.4 | 548 | 402 | 29 | 23 | 22 |
| 22 | Parking Spot | 4.6 | 573 | 419 | 30 | 23 | 22 |
| 23 | All Together Now | 4.8 | 597 | 435 | 31 | 23 | 22 |
| 24 | Wide Open | 5.0 | 622 | 451 | 30 | 23 | 22 |
| 25 | Centre Stage | 5.0 | 646 | 466 | 30 | 23 | 22 |
| 26 | Peel Off | 5.7 | 670 | 480 | 29 | 22 | 22 |
| 27 | Three Rights | 5.1 | 694 | 496 | 29 | 23 | 22 |
| 28 | Elbow Room | 5.9 | 718 | 509 | 28 | 22 | 22 |
| 29 | The Long Hall | 5.6 | 742 | 523 | 28 | 22 | 22 |
| 30 | Gridlock | 6.6 | 765 | 533 | 26 | 22 | 21 |
| 31 | Tight Squeeze | 5.8 | 789 | 547 | 27 | 22 | 22 |
| 32 | Two Lanes | 7.0 | 812 | 557 | 25 | 21 | 21 |
| 33 | Back of the Line | 5.7 | 836 | 571 | 27 | 22 | 22 |
| 34 | Full House | 6.2 | 860 | 583 | 26 | 22 | 21 |
| 35 | Roundabout | 7.0 | 883 | 593 | 25 | 21 | 21 |
| 36 | Colour Guard | 7.4 | 906 | 602 | 24 | 21 | 21 |
| 37 | Single File | 5.9 | 929 | 614 | 26 | 22 | 22 |
| 38 | Patience | 7.6 | 952 | 623 | 24 | 21 | 21 |
| 39 | Detour | 4.8 | 977 | 639 | 28 | 23 | 22 |
| 40 | Grand Parade | 7.4 | 999 | 648 | 25 | 21 | 21 |

## Levels 1 tot 60

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 1451 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1481 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 1594 | 679 | 679 | 617 / 62 / 0 | 0.0 | nooit | 945 | 0 / 0 / 0 |
| Gewone speler | 2.36 | 1344 | 2570 | 1348 | 1217 / 111 / 20 | 73.6 | level 7 (2–14), 100% van de runs | 26 | 1453 / 1450 / 1770 |
| Speler met moeite | 2.21 | 1301 | 4763 | 1310 | 1274 / 35 / 1 | 223.8 | level 3 (1–5), 100% van de runs | 22 | 3915 / 3910 / 4320 |
| Jonge tikker | 2.19 | 1311 | 7223 | 1319 | 1316 / 4 / 0 | 428.4 | level 1 (1–2), 100% van de runs | 21 | 6451 / 6450 / 6900 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 | 24.1 | 0.0 | 0 |
| Puzzelaar | 27.1 | 9.3 | 0 | 26.1 | 13.0 | 0 | 26.5 | 11.6 | 0 |
| Gewone speler | 22.4 | 36.0 | 315 | 22.4 | 48.3 | 616 | 22.4 | 44.2 | 521 |
| Speler met moeite | 21.9 | 66.9 | 1020 | 21.6 | 89.5 | 1533 | 21.6 | 81.8 | 1362 |
| Jonge tikker | 22.2 | 105.1 | 1814 | 21.5 | 132.5 | 2415 | 21.8 | 123.6 | 2223 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 57 | 58 | 47 | 37 | 27 |
| 2 | Quarter Turn | 1.8 | 83 | 82 | 54 | 35 | 25 |
| 3 | Follow the Arrow | 3.1 | 108 | 103 | 53 | 28 | 23 |
| 4 | Everyone Steps | 2.1 | 134 | 126 | 60 | 30 | 24 |
| 5 | Lean on It | 2.7 | 159 | 148 | 61 | 28 | 23 |
| 6 | Two Minds | 3.1 | 185 | 168 | 60 | 27 | 23 |
| 7 | Side Door | 4.2 | 209 | 186 | 53 | 24 | 22 |
| 8 | Wait Your Turn | 3.8 | 234 | 205 | 50 | 24 | 22 |
| 9 | One Color Turns | 4.8 | 258 | 221 | 44 | 23 | 22 |
| 10 | Four Doors | 4.0 | 283 | 240 | 43 | 24 | 23 |
| 11 | Use the Wall | 4.8 | 307 | 256 | 40 | 23 | 22 |
| 12 | Three of a Kind | 4.3 | 332 | 273 | 38 | 24 | 22 |
| 13 | Close Quarters | 4.9 | 356 | 289 | 35 | 23 | 22 |
| 14 | Long Way Round | 5.5 | 380 | 303 | 32 | 22 | 22 |
| 15 | After You | 4.8 | 405 | 320 | 32 | 23 | 22 |
| 16 | Queue Up | 6.3 | 428 | 332 | 29 | 22 | 21 |
| 17 | The Corridor | 5.1 | 452 | 348 | 30 | 23 | 22 |
| 18 | Traffic Jam | 6.4 | 476 | 359 | 27 | 22 | 21 |
| 19 | Staircase | 3.6 | 501 | 378 | 33 | 24 | 23 |
| 20 | One Command, Many Consequences | 7.9 | 524 | 385 | 25 | 21 | 21 |
| 21 | Easy Does It | 4.4 | 548 | 402 | 29 | 23 | 22 |
| 22 | Parking Spot | 4.6 | 573 | 419 | 30 | 23 | 22 |
| 23 | All Together Now | 4.8 | 597 | 435 | 31 | 23 | 22 |
| 24 | Wide Open | 5.0 | 622 | 451 | 30 | 23 | 22 |
| 25 | Centre Stage | 5.0 | 646 | 466 | 30 | 23 | 22 |
| 26 | Peel Off | 5.7 | 670 | 480 | 29 | 22 | 22 |
| 27 | Three Rights | 5.1 | 694 | 496 | 29 | 23 | 22 |
| 28 | Elbow Room | 5.9 | 718 | 509 | 28 | 22 | 22 |
| 29 | The Long Hall | 5.6 | 742 | 523 | 28 | 22 | 22 |
| 30 | Gridlock | 6.6 | 765 | 533 | 26 | 22 | 21 |
| 31 | Tight Squeeze | 5.8 | 789 | 547 | 27 | 22 | 22 |
| 32 | Two Lanes | 7.0 | 812 | 557 | 25 | 21 | 21 |
| 33 | Back of the Line | 5.7 | 836 | 571 | 27 | 22 | 22 |
| 34 | Full House | 6.2 | 860 | 583 | 26 | 22 | 21 |
| 35 | Roundabout | 7.0 | 883 | 593 | 25 | 21 | 21 |
| 36 | Colour Guard | 7.4 | 906 | 602 | 24 | 21 | 21 |
| 37 | Single File | 5.9 | 929 | 614 | 26 | 22 | 22 |
| 38 | Patience | 7.6 | 952 | 623 | 24 | 21 | 21 |
| 39 | Detour | 4.8 | 977 | 639 | 28 | 23 | 22 |
| 40 | Grand Parade | 7.4 | 999 | 648 | 25 | 21 | 21 |
| 41 | Turntable | 0.7 | 1026 | 675 | 42 | 33 | 26 |
| 42 | Corner Piece | 2.3 | 1052 | 699 | 48 | 30 | 24 |
| 43 | Two for One | 3.1 | 1077 | 720 | 49 | 27 | 23 |
| 44 | Mind the Tile | 4.1 | 1102 | 738 | 44 | 25 | 22 |
| 45 | Bank Shot | 3.7 | 1127 | 757 | 44 | 25 | 23 |
| 46 | Merge Lane | 5.2 | 1151 | 772 | 37 | 23 | 22 |
| 47 | Standoff | 5.2 | 1175 | 788 | 34 | 23 | 22 |
| 48 | Switchback | 5.1 | 1200 | 803 | 32 | 23 | 22 |
| 49 | Three Way | 6.0 | 1223 | 816 | 30 | 22 | 21 |
| 50 | Open Floor | 6.8 | 1246 | 827 | 27 | 22 | 21 |
| 51 | Carousel | 5.5 | 1270 | 840 | 28 | 22 | 22 |
| 52 | Spiral In | 5.6 | 1294 | 855 | 28 | 22 | 22 |
| 53 | Long Table | 7.0 | 1317 | 865 | 26 | 21 | 21 |
| 54 | Pinball | 5.8 | 1341 | 879 | 27 | 22 | 22 |
| 55 | Crowded Corner | 7.0 | 1365 | 889 | 25 | 21 | 21 |
| 56 | Tricolour | 7.4 | 1388 | 898 | 24 | 21 | 21 |
| 57 | Cliff Walk | 6.9 | 1411 | 908 | 25 | 21 | 21 |
| 58 | Whirl | 8.5 | 1433 | 914 | 23 | 21 | 21 |
| 59 | Conga Line | 3.6 | 1458 | 934 | 30 | 24 | 23 |
| 60 | Grand Finale | 6.7 | 1481 | 945 | 26 | 22 | 21 |
