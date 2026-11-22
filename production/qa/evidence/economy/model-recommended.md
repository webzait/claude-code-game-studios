# Economiemodel: B. Aanbevolen

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261122). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen staan in `tools/economy/sets.json`. Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.

10 munten per ster; Undo 5 (een halve ster), hint 20 (twee sterren), +3 moves 40 (vier sterren). Een winst met hint betaalt gewoon naar sterren.

Start 50 · 1 ster 10 · 2 sterren 20 · 3 sterren 30 · winst met hint betaalt naar sterren · Undo 5 · hint 20 · +3 moves 40

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 969 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1019 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 1099 | 244 | 244 | 202 / 42 / 0 | 0.0 | nooit | 905 | 0 / 0 / 0 |
| Gewone speler | 2.30 | 919 | 1080 | 920 | 547 / 253 / 120 | 6.9 | level 21 (9–36), 86% van de runs | 49 | 172 / 155 / 360 |
| Speler met moeite | 2.20 | 879 | 2119 | 905 | 760 / 126 / 20 | 73.1 | level 7 (3–11), 100% van de runs | 24 | 1304 / 1300 / 1570 |
| Jonge tikker | 2.19 | 876 | 3115 | 905 | 873 / 29 / 3 | 192.5 | level 3 (1–5), 100% van de runs | 21 | 2335 / 2325 / 2640 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 |
| Puzzelaar | 27.8 | 5.1 | 0 | 27.1 | 7.1 | 0 |
| Gewone speler | 23.4 | 23.0 | 29 | 22.6 | 31.0 | 143 |
| Speler met moeite | 22.3 | 45.1 | 460 | 21.7 | 60.9 | 844 |
| Jonge tikker | 22.3 | 68.4 | 943 | 21.5 | 87.4 | 1392 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 77 | 78 | 70 | 62 | 48 |
| 2 | Quarter Turn | 1.8 | 103 | 105 | 84 | 65 | 42 |
| 3 | Follow the Arrow | 3.1 | 128 | 130 | 91 | 58 | 33 |
| 4 | Everyone Steps | 2.1 | 154 | 156 | 104 | 60 | 32 |
| 5 | Lean on It | 2.7 | 179 | 181 | 113 | 57 | 29 |
| 6 | Two Minds | 3.1 | 205 | 205 | 120 | 53 | 28 |
| 7 | Side Door | 4.2 | 229 | 228 | 120 | 45 | 25 |
| 8 | Wait Your Turn | 3.8 | 254 | 251 | 123 | 41 | 25 |
| 9 | One Color Turns | 4.8 | 278 | 273 | 121 | 35 | 23 |
| 10 | Four Doors | 4.0 | 303 | 296 | 123 | 35 | 24 |
| 11 | Use the Wall | 4.8 | 327 | 318 | 121 | 32 | 23 |
| 12 | Three of a Kind | 4.3 | 352 | 340 | 121 | 32 | 23 |
| 13 | Close Quarters | 4.9 | 376 | 362 | 119 | 30 | 23 |
| 14 | Long Way Round | 5.5 | 400 | 382 | 113 | 28 | 22 |
| 15 | After You | 4.8 | 425 | 405 | 112 | 29 | 23 |
| 16 | Queue Up | 6.3 | 448 | 424 | 104 | 26 | 22 |
| 17 | The Corridor | 5.1 | 472 | 446 | 103 | 27 | 22 |
| 18 | Traffic Jam | 6.4 | 496 | 465 | 95 | 25 | 22 |
| 19 | Staircase | 3.6 | 521 | 488 | 101 | 30 | 24 |
| 20 | One Command, Many Consequences | 7.9 | 544 | 505 | 87 | 24 | 21 |
| 21 | Easy Does It | 4.4 | 568 | 527 | 91 | 28 | 23 |
| 22 | Parking Spot | 4.6 | 593 | 549 | 92 | 29 | 23 |
| 23 | All Together Now | 4.8 | 617 | 571 | 93 | 29 | 23 |
| 24 | Wide Open | 5.0 | 642 | 592 | 92 | 29 | 23 |
| 25 | Centre Stage | 5.0 | 666 | 614 | 91 | 29 | 23 |
| 26 | Peel Off | 5.7 | 690 | 634 | 88 | 27 | 22 |
| 27 | Three Rights | 5.1 | 714 | 656 | 86 | 28 | 23 |
| 28 | Elbow Room | 5.9 | 738 | 676 | 83 | 26 | 22 |
| 29 | The Long Hall | 5.6 | 762 | 696 | 81 | 26 | 22 |
| 30 | Gridlock | 6.6 | 785 | 715 | 76 | 25 | 21 |
| 31 | Tight Squeeze | 5.8 | 809 | 735 | 74 | 26 | 22 |
| 32 | Two Lanes | 7.0 | 832 | 753 | 68 | 24 | 21 |
| 33 | Back of the Line | 5.7 | 856 | 774 | 67 | 25 | 22 |
| 34 | Full House | 6.2 | 880 | 793 | 63 | 25 | 22 |
| 35 | Roundabout | 7.0 | 903 | 811 | 59 | 24 | 21 |
| 36 | Colour Guard | 7.4 | 926 | 829 | 53 | 23 | 21 |
| 37 | Single File | 5.9 | 949 | 848 | 53 | 25 | 22 |
| 38 | Patience | 7.6 | 972 | 866 | 49 | 23 | 21 |
| 39 | Detour | 4.8 | 997 | 887 | 54 | 27 | 23 |
| 40 | Grand Parade | 7.4 | 1019 | 905 | 49 | 24 | 21 |

## Levels 1 tot 60

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 1451 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1501 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 1646 | 370 | 370 | 308 / 62 / 0 | 0.0 | nooit | 1325 | 0 / 0 / 0 |
| Gewone speler | 2.30 | 1378 | 1648 | 1378 | 831 / 376 / 171 | 11.9 | level 24 (10–40), 95% van de runs | 50 | 295 / 285 / 530 |
| Speler met moeite | 2.20 | 1317 | 3230 | 1342 | 1141 / 177 / 24 | 115.2 | level 7 (3–11), 100% van de runs | 25 | 2030 / 2025 / 2360 |
| Jonge tikker | 2.19 | 1312 | 4739 | 1341 | 1303 / 35 / 3 | 297.6 | level 3 (1–5), 100% van de runs | 22 | 3591 / 3590 / 3940 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 | 24.1 | 0.0 | 0 |
| Puzzelaar | 27.8 | 5.1 | 0 | 27.1 | 7.1 | 0 | 27.3 | 6.3 | 0 |
| Gewone speler | 23.4 | 23.0 | 29 | 22.6 | 31.0 | 143 | 22.9 | 28.4 | 124 |
| Speler met moeite | 22.3 | 45.1 | 460 | 21.7 | 60.9 | 844 | 21.9 | 55.5 | 726 |
| Jonge tikker | 22.3 | 68.4 | 943 | 21.5 | 87.4 | 1392 | 21.8 | 81.2 | 1256 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 77 | 78 | 70 | 62 | 48 |
| 2 | Quarter Turn | 1.8 | 103 | 105 | 84 | 65 | 42 |
| 3 | Follow the Arrow | 3.1 | 128 | 130 | 91 | 58 | 33 |
| 4 | Everyone Steps | 2.1 | 154 | 156 | 104 | 60 | 32 |
| 5 | Lean on It | 2.7 | 179 | 181 | 113 | 57 | 29 |
| 6 | Two Minds | 3.1 | 205 | 205 | 120 | 53 | 28 |
| 7 | Side Door | 4.2 | 229 | 228 | 120 | 45 | 25 |
| 8 | Wait Your Turn | 3.8 | 254 | 251 | 123 | 41 | 25 |
| 9 | One Color Turns | 4.8 | 278 | 273 | 121 | 35 | 23 |
| 10 | Four Doors | 4.0 | 303 | 296 | 123 | 35 | 24 |
| 11 | Use the Wall | 4.8 | 327 | 318 | 121 | 32 | 23 |
| 12 | Three of a Kind | 4.3 | 352 | 340 | 121 | 32 | 23 |
| 13 | Close Quarters | 4.9 | 376 | 362 | 119 | 30 | 23 |
| 14 | Long Way Round | 5.5 | 400 | 382 | 113 | 28 | 22 |
| 15 | After You | 4.8 | 425 | 405 | 112 | 29 | 23 |
| 16 | Queue Up | 6.3 | 448 | 424 | 104 | 26 | 22 |
| 17 | The Corridor | 5.1 | 472 | 446 | 103 | 27 | 22 |
| 18 | Traffic Jam | 6.4 | 496 | 465 | 95 | 25 | 22 |
| 19 | Staircase | 3.6 | 521 | 488 | 101 | 30 | 24 |
| 20 | One Command, Many Consequences | 7.9 | 544 | 505 | 87 | 24 | 21 |
| 21 | Easy Does It | 4.4 | 568 | 527 | 91 | 28 | 23 |
| 22 | Parking Spot | 4.6 | 593 | 549 | 92 | 29 | 23 |
| 23 | All Together Now | 4.8 | 617 | 571 | 93 | 29 | 23 |
| 24 | Wide Open | 5.0 | 642 | 592 | 92 | 29 | 23 |
| 25 | Centre Stage | 5.0 | 666 | 614 | 91 | 29 | 23 |
| 26 | Peel Off | 5.7 | 690 | 634 | 88 | 27 | 22 |
| 27 | Three Rights | 5.1 | 714 | 656 | 86 | 28 | 23 |
| 28 | Elbow Room | 5.9 | 738 | 676 | 83 | 26 | 22 |
| 29 | The Long Hall | 5.6 | 762 | 696 | 81 | 26 | 22 |
| 30 | Gridlock | 6.6 | 785 | 715 | 76 | 25 | 21 |
| 31 | Tight Squeeze | 5.8 | 809 | 735 | 74 | 26 | 22 |
| 32 | Two Lanes | 7.0 | 832 | 753 | 68 | 24 | 21 |
| 33 | Back of the Line | 5.7 | 856 | 774 | 67 | 25 | 22 |
| 34 | Full House | 6.2 | 880 | 793 | 63 | 25 | 22 |
| 35 | Roundabout | 7.0 | 903 | 811 | 59 | 24 | 21 |
| 36 | Colour Guard | 7.4 | 926 | 829 | 53 | 23 | 21 |
| 37 | Single File | 5.9 | 949 | 848 | 53 | 25 | 22 |
| 38 | Patience | 7.6 | 972 | 866 | 49 | 23 | 21 |
| 39 | Detour | 4.8 | 997 | 887 | 54 | 27 | 23 |
| 40 | Grand Parade | 7.4 | 1019 | 905 | 49 | 24 | 21 |
| 41 | Turntable | 0.7 | 1046 | 933 | 70 | 40 | 30 |
| 42 | Corner Piece | 2.3 | 1072 | 959 | 82 | 44 | 30 |
| 43 | Two for One | 3.1 | 1097 | 984 | 89 | 43 | 27 |
| 44 | Mind the Tile | 4.1 | 1122 | 1007 | 91 | 38 | 25 |
| 45 | Bank Shot | 3.7 | 1147 | 1030 | 96 | 37 | 25 |
| 46 | Merge Lane | 5.2 | 1171 | 1052 | 92 | 31 | 23 |
| 47 | Standoff | 5.2 | 1195 | 1073 | 88 | 29 | 22 |
| 48 | Switchback | 5.1 | 1220 | 1095 | 87 | 28 | 23 |
| 49 | Three Way | 6.0 | 1243 | 1114 | 81 | 26 | 22 |
| 50 | Open Floor | 6.8 | 1266 | 1133 | 74 | 25 | 21 |
| 51 | Carousel | 5.5 | 1290 | 1153 | 73 | 26 | 22 |
| 52 | Spiral In | 5.6 | 1314 | 1174 | 71 | 26 | 22 |
| 53 | Long Table | 7.0 | 1337 | 1193 | 64 | 24 | 21 |
| 54 | Pinball | 5.8 | 1361 | 1213 | 63 | 25 | 22 |
| 55 | Crowded Corner | 7.0 | 1385 | 1231 | 57 | 24 | 21 |
| 56 | Tricolour | 7.4 | 1408 | 1249 | 53 | 23 | 21 |
| 57 | Cliff Walk | 6.9 | 1431 | 1267 | 50 | 23 | 21 |
| 58 | Whirl | 8.5 | 1453 | 1283 | 44 | 22 | 21 |
| 59 | Conga Line | 3.6 | 1478 | 1307 | 53 | 29 | 24 |
| 60 | Grand Finale | 6.7 | 1501 | 1325 | 50 | 25 | 22 |
