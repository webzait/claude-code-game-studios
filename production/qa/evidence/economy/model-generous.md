# Economiemodel: A. Ruim

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261122). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen staan in `tools/economy/sets.json`. Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.

10 munten per ster; de eerste twee Undo's van een level zijn gratis; +3 moves kost 20.

Start 100 · 1 ster 10 · 2 sterren 20 · 3 sterren 30 · winst met hint betaalt naar sterren · Undo 5 (eerste 2 per level gratis) · hint 10 · +3 moves 20

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 969 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1069 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 1099 | 46 | 46 | 25 / 21 / 0 | 0.0 | nooit | 1153 | 0 / 0 / 0 |
| Gewone speler | 2.24 | 897 | 487 | 487 | 224 / 160 / 103 | 0.0 | nooit | 511 | 0 / 0 / 0 |
| Speler met moeite | 2.07 | 828 | 1135 | 901 | 497 / 291 / 113 | 22.1 | level 24 (16–34), 98% van de runs | 27 | 273 / 270 / 440 |
| Jonge tikker | 2.15 | 860 | 1913 | 938 | 784 / 120 / 34 | 118.7 | level 9 (6–13), 100% van de runs | 22 | 1083 / 1075 / 1285 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 |
| Puzzelaar | 27.8 | 0.9 | 0 | 27.1 | 1.4 | 0 |
| Gewone speler | 23.1 | 9.8 | 0 | 21.7 | 14.6 | 0 |
| Speler met moeite | 20.7 | 23.3 | 24 | 20.7 | 33.5 | 249 |
| Jonge tikker | 21.5 | 41.2 | 350 | 21.5 | 54.4 | 733 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 127 | 129 | 125 | 120 | 108 |
| 2 | Quarter Turn | 1.8 | 153 | 158 | 147 | 134 | 107 |
| 3 | Follow the Arrow | 3.1 | 178 | 186 | 164 | 139 | 96 |
| 4 | Everyone Steps | 2.1 | 204 | 214 | 185 | 151 | 93 |
| 5 | Lean on It | 2.7 | 229 | 242 | 204 | 158 | 86 |
| 6 | Two Minds | 3.1 | 255 | 270 | 222 | 163 | 77 |
| 7 | Side Door | 4.2 | 279 | 297 | 235 | 161 | 61 |
| 8 | Wait Your Turn | 3.8 | 304 | 324 | 250 | 161 | 52 |
| 9 | One Color Turns | 4.8 | 328 | 351 | 261 | 153 | 41 |
| 10 | Four Doors | 4.0 | 353 | 378 | 276 | 153 | 36 |
| 11 | Use the Wall | 4.8 | 377 | 405 | 287 | 147 | 31 |
| 12 | Three of a Kind | 4.3 | 402 | 432 | 300 | 144 | 29 |
| 13 | Close Quarters | 4.9 | 426 | 458 | 311 | 136 | 26 |
| 14 | Long Way Round | 5.5 | 450 | 484 | 319 | 126 | 24 |
| 15 | After You | 4.8 | 475 | 511 | 331 | 120 | 24 |
| 16 | Queue Up | 6.3 | 498 | 537 | 336 | 105 | 23 |
| 17 | The Corridor | 5.1 | 522 | 563 | 346 | 100 | 23 |
| 18 | Traffic Jam | 6.4 | 546 | 588 | 352 | 86 | 22 |
| 19 | Staircase | 3.6 | 571 | 616 | 368 | 90 | 26 |
| 20 | One Command, Many Consequences | 7.9 | 594 | 639 | 367 | 70 | 22 |
| 21 | Easy Does It | 4.4 | 618 | 666 | 381 | 70 | 24 |
| 22 | Parking Spot | 4.6 | 643 | 693 | 393 | 69 | 25 |
| 23 | All Together Now | 4.8 | 667 | 720 | 405 | 67 | 24 |
| 24 | Wide Open | 5.0 | 692 | 746 | 415 | 64 | 24 |
| 25 | Centre Stage | 5.0 | 716 | 773 | 426 | 62 | 24 |
| 26 | Peel Off | 5.7 | 740 | 799 | 434 | 56 | 23 |
| 27 | Three Rights | 5.1 | 764 | 825 | 444 | 55 | 24 |
| 28 | Elbow Room | 5.9 | 788 | 851 | 451 | 48 | 23 |
| 29 | The Long Hall | 5.6 | 812 | 877 | 459 | 46 | 23 |
| 30 | Gridlock | 6.6 | 835 | 902 | 464 | 40 | 22 |
| 31 | Tight Squeeze | 5.8 | 859 | 928 | 471 | 39 | 23 |
| 32 | Two Lanes | 7.0 | 882 | 952 | 474 | 33 | 22 |
| 33 | Back of the Line | 5.7 | 906 | 978 | 481 | 34 | 23 |
| 34 | Full House | 6.2 | 930 | 1004 | 486 | 32 | 22 |
| 35 | Roundabout | 7.0 | 953 | 1028 | 490 | 29 | 22 |
| 36 | Colour Guard | 7.4 | 976 | 1052 | 491 | 27 | 21 |
| 37 | Single File | 5.9 | 999 | 1078 | 498 | 29 | 22 |
| 38 | Patience | 7.6 | 1022 | 1102 | 498 | 26 | 21 |
| 39 | Detour | 4.8 | 1047 | 1129 | 510 | 30 | 23 |
| 40 | Grand Parade | 7.4 | 1069 | 1153 | 511 | 27 | 22 |

## Levels 1 tot 60

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 1451 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1551 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 1646 | 71 | 71 | 40 / 31 / 0 | 0.0 | nooit | 1675 | 0 / 0 / 0 |
| Gewone speler | 2.24 | 1342 | 750 | 750 | 347 / 246 / 156 | 0.0 | nooit | 693 | 0 / 0 / 0 |
| Speler met moeite | 2.08 | 1248 | 1738 | 1320 | 754 / 415 / 151 | 39.8 | level 24 (16–34), 100% van de runs | 28 | 491 / 490 / 690 |
| Jonge tikker | 2.15 | 1293 | 2917 | 1370 | 1168 / 162 / 41 | 189.1 | level 9 (6–13), 100% van de runs | 22 | 1719 / 1725 / 1950 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 | 24.1 | 0.0 | 0 |
| Puzzelaar | 27.8 | 0.9 | 0 | 27.1 | 1.4 | 0 | 27.3 | 1.2 | 0 |
| Gewone speler | 23.1 | 9.8 | 0 | 21.7 | 14.6 | 0 | 22.2 | 13.1 | 0 |
| Speler met moeite | 20.7 | 23.3 | 24 | 20.7 | 33.5 | 249 | 21.0 | 30.2 | 219 |
| Jonge tikker | 21.5 | 41.2 | 350 | 21.5 | 54.4 | 733 | 21.7 | 50.2 | 636 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 127 | 129 | 125 | 120 | 108 |
| 2 | Quarter Turn | 1.8 | 153 | 158 | 147 | 134 | 107 |
| 3 | Follow the Arrow | 3.1 | 178 | 186 | 164 | 139 | 96 |
| 4 | Everyone Steps | 2.1 | 204 | 214 | 185 | 151 | 93 |
| 5 | Lean on It | 2.7 | 229 | 242 | 204 | 158 | 86 |
| 6 | Two Minds | 3.1 | 255 | 270 | 222 | 163 | 77 |
| 7 | Side Door | 4.2 | 279 | 297 | 235 | 161 | 61 |
| 8 | Wait Your Turn | 3.8 | 304 | 324 | 250 | 161 | 52 |
| 9 | One Color Turns | 4.8 | 328 | 351 | 261 | 153 | 41 |
| 10 | Four Doors | 4.0 | 353 | 378 | 276 | 153 | 36 |
| 11 | Use the Wall | 4.8 | 377 | 405 | 287 | 147 | 31 |
| 12 | Three of a Kind | 4.3 | 402 | 432 | 300 | 144 | 29 |
| 13 | Close Quarters | 4.9 | 426 | 458 | 311 | 136 | 26 |
| 14 | Long Way Round | 5.5 | 450 | 484 | 319 | 126 | 24 |
| 15 | After You | 4.8 | 475 | 511 | 331 | 120 | 24 |
| 16 | Queue Up | 6.3 | 498 | 537 | 336 | 105 | 23 |
| 17 | The Corridor | 5.1 | 522 | 563 | 346 | 100 | 23 |
| 18 | Traffic Jam | 6.4 | 546 | 588 | 352 | 86 | 22 |
| 19 | Staircase | 3.6 | 571 | 616 | 368 | 90 | 26 |
| 20 | One Command, Many Consequences | 7.9 | 594 | 639 | 367 | 70 | 22 |
| 21 | Easy Does It | 4.4 | 618 | 666 | 381 | 70 | 24 |
| 22 | Parking Spot | 4.6 | 643 | 693 | 393 | 69 | 25 |
| 23 | All Together Now | 4.8 | 667 | 720 | 405 | 67 | 24 |
| 24 | Wide Open | 5.0 | 692 | 746 | 415 | 64 | 24 |
| 25 | Centre Stage | 5.0 | 716 | 773 | 426 | 62 | 24 |
| 26 | Peel Off | 5.7 | 740 | 799 | 434 | 56 | 23 |
| 27 | Three Rights | 5.1 | 764 | 825 | 444 | 55 | 24 |
| 28 | Elbow Room | 5.9 | 788 | 851 | 451 | 48 | 23 |
| 29 | The Long Hall | 5.6 | 812 | 877 | 459 | 46 | 23 |
| 30 | Gridlock | 6.6 | 835 | 902 | 464 | 40 | 22 |
| 31 | Tight Squeeze | 5.8 | 859 | 928 | 471 | 39 | 23 |
| 32 | Two Lanes | 7.0 | 882 | 952 | 474 | 33 | 22 |
| 33 | Back of the Line | 5.7 | 906 | 978 | 481 | 34 | 23 |
| 34 | Full House | 6.2 | 930 | 1004 | 486 | 32 | 22 |
| 35 | Roundabout | 7.0 | 953 | 1028 | 490 | 29 | 22 |
| 36 | Colour Guard | 7.4 | 976 | 1052 | 491 | 27 | 21 |
| 37 | Single File | 5.9 | 999 | 1078 | 498 | 29 | 22 |
| 38 | Patience | 7.6 | 1022 | 1102 | 498 | 26 | 21 |
| 39 | Detour | 4.8 | 1047 | 1129 | 510 | 30 | 23 |
| 40 | Grand Parade | 7.4 | 1069 | 1153 | 511 | 27 | 22 |
| 41 | Turntable | 0.7 | 1096 | 1182 | 536 | 48 | 35 |
| 42 | Corner Piece | 2.3 | 1122 | 1211 | 557 | 59 | 36 |
| 43 | Two for One | 3.1 | 1147 | 1238 | 574 | 64 | 34 |
| 44 | Mind the Tile | 4.1 | 1172 | 1266 | 588 | 65 | 29 |
| 45 | Bank Shot | 3.7 | 1197 | 1293 | 603 | 67 | 28 |
| 46 | Merge Lane | 5.2 | 1221 | 1319 | 613 | 60 | 25 |
| 47 | Standoff | 5.2 | 1245 | 1346 | 622 | 56 | 24 |
| 48 | Switchback | 5.1 | 1270 | 1372 | 632 | 52 | 24 |
| 49 | Three Way | 6.0 | 1293 | 1398 | 639 | 45 | 23 |
| 50 | Open Floor | 6.8 | 1316 | 1423 | 642 | 38 | 22 |
| 51 | Carousel | 5.5 | 1340 | 1449 | 651 | 37 | 23 |
| 52 | Spiral In | 5.6 | 1364 | 1475 | 659 | 35 | 23 |
| 53 | Long Table | 7.0 | 1387 | 1500 | 661 | 30 | 22 |
| 54 | Pinball | 5.8 | 1411 | 1526 | 669 | 30 | 23 |
| 55 | Crowded Corner | 7.0 | 1435 | 1550 | 671 | 28 | 22 |
| 56 | Tricolour | 7.4 | 1458 | 1575 | 673 | 26 | 21 |
| 57 | Cliff Walk | 6.9 | 1481 | 1600 | 676 | 25 | 22 |
| 58 | Whirl | 8.5 | 1503 | 1623 | 673 | 23 | 21 |
| 59 | Conga Line | 3.6 | 1528 | 1650 | 689 | 32 | 25 |
| 60 | Grand Finale | 6.7 | 1551 | 1675 | 693 | 28 | 22 |
