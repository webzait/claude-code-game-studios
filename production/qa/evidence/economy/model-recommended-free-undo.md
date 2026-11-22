# Economiemodel: B+. Aanbevolen met 1 gratis Undo per level

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261122). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen staan in `tools/economy/sets.json`. Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.

Als B, maar de eerste Undo van elk level kost niets (een misgetikte zet is gratis terug te nemen).

Start 50 · 1 ster 10 · 2 sterren 20 · 3 sterren 30 · winst met hint betaalt naar sterren · Undo 5 (eerste 1 per level gratis) · hint 20 · +3 moves 40

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 969 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1019 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 1099 | 120 | 120 | 79 / 42 / 0 | 0.0 | nooit | 1029 | 0 / 0 / 0 |
| Gewone speler | 2.26 | 905 | 897 | 844 | 370 / 302 / 173 | 2.0 | level 29 (11–38), 48% van de runs | 111 | 54 / 0 / 180 |
| Speler met moeite | 2.19 | 875 | 1924 | 899 | 639 / 223 / 37 | 52.8 | level 8 (3–13), 100% van de runs | 26 | 1109 / 1105 / 1375 |
| Jonge tikker | 2.19 | 875 | 2916 | 903 | 843 / 54 / 7 | 157.3 | level 3 (1–6), 100% van de runs | 22 | 2135 / 2130 / 2440 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 |
| Puzzelaar | 27.8 | 2.4 | 0 | 27.1 | 3.7 | 0 |
| Gewone speler | 23.2 | 18.6 | 7 | 22.1 | 26.3 | 46 |
| Speler met moeite | 22.1 | 40.2 | 364 | 21.6 | 55.9 | 745 |
| Jonge tikker | 22.2 | 63.4 | 844 | 21.5 | 82.4 | 1292 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 77 | 79 | 73 | 66 | 52 |
| 2 | Quarter Turn | 1.8 | 103 | 107 | 91 | 72 | 47 |
| 3 | Follow the Arrow | 3.1 | 128 | 134 | 101 | 67 | 38 |
| 4 | Everyone Steps | 2.1 | 154 | 162 | 118 | 72 | 37 |
| 5 | Lean on It | 2.7 | 179 | 189 | 131 | 71 | 34 |
| 6 | Two Minds | 3.1 | 205 | 216 | 142 | 69 | 31 |
| 7 | Side Door | 4.2 | 229 | 241 | 146 | 60 | 28 |
| 8 | Wait Your Turn | 3.8 | 254 | 267 | 153 | 55 | 27 |
| 9 | One Color Turns | 4.8 | 278 | 292 | 155 | 47 | 25 |
| 10 | Four Doors | 4.0 | 303 | 318 | 160 | 45 | 26 |
| 11 | Use the Wall | 4.8 | 327 | 343 | 162 | 41 | 25 |
| 12 | Three of a Kind | 4.3 | 352 | 368 | 167 | 40 | 25 |
| 13 | Close Quarters | 4.9 | 376 | 393 | 167 | 36 | 24 |
| 14 | Long Way Round | 5.5 | 400 | 417 | 165 | 33 | 23 |
| 15 | After You | 4.8 | 425 | 442 | 167 | 33 | 24 |
| 16 | Queue Up | 6.3 | 448 | 466 | 161 | 29 | 22 |
| 17 | The Corridor | 5.1 | 472 | 490 | 162 | 31 | 23 |
| 18 | Traffic Jam | 6.4 | 496 | 513 | 156 | 28 | 22 |
| 19 | Staircase | 3.6 | 521 | 539 | 165 | 34 | 26 |
| 20 | One Command, Many Consequences | 7.9 | 544 | 560 | 151 | 27 | 22 |
| 21 | Easy Does It | 4.4 | 568 | 585 | 156 | 31 | 24 |
| 22 | Parking Spot | 4.6 | 593 | 610 | 160 | 32 | 25 |
| 23 | All Together Now | 4.8 | 617 | 635 | 163 | 33 | 24 |
| 24 | Wide Open | 5.0 | 642 | 659 | 164 | 32 | 24 |
| 25 | Centre Stage | 5.0 | 666 | 684 | 165 | 32 | 24 |
| 26 | Peel Off | 5.7 | 690 | 708 | 163 | 31 | 23 |
| 27 | Three Rights | 5.1 | 714 | 733 | 163 | 31 | 24 |
| 28 | Elbow Room | 5.9 | 738 | 756 | 160 | 29 | 23 |
| 29 | The Long Hall | 5.6 | 762 | 780 | 160 | 29 | 23 |
| 30 | Gridlock | 6.6 | 785 | 802 | 154 | 27 | 22 |
| 31 | Tight Squeeze | 5.8 | 809 | 826 | 152 | 28 | 23 |
| 32 | Two Lanes | 7.0 | 832 | 848 | 144 | 26 | 22 |
| 33 | Back of the Line | 5.7 | 856 | 872 | 143 | 28 | 23 |
| 34 | Full House | 6.2 | 880 | 895 | 138 | 28 | 22 |
| 35 | Roundabout | 7.0 | 903 | 916 | 132 | 26 | 22 |
| 36 | Colour Guard | 7.4 | 926 | 938 | 123 | 25 | 21 |
| 37 | Single File | 5.9 | 949 | 961 | 122 | 27 | 22 |
| 38 | Patience | 7.6 | 972 | 982 | 114 | 25 | 21 |
| 39 | Detour | 4.8 | 997 | 1007 | 119 | 29 | 23 |
| 40 | Grand Parade | 7.4 | 1019 | 1029 | 111 | 26 | 22 |

## Levels 1 tot 60

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 1451 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1501 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 1646 | 184 | 184 | 122 / 62 / 0 | 0.0 | nooit | 1511 | 0 / 0 / 0 |
| Gewone speler | 2.26 | 1355 | 1373 | 1286 | 567 / 460 / 260 | 3.4 | level 32 (14–56), 61% van de runs | 119 | 92 / 40 / 265 |
| Speler met moeite | 2.19 | 1311 | 2937 | 1333 | 966 / 319 / 48 | 84.0 | level 8 (3–13), 100% van de runs | 28 | 1737 / 1730 / 2065 |
| Jonge tikker | 2.19 | 1311 | 4440 | 1339 | 1261 / 72 / 7 | 244.3 | level 3 (1–6), 100% van de runs | 22 | 3292 / 3290 / 3640 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 | 24.1 | 0.0 | 0 |
| Puzzelaar | 27.8 | 2.4 | 0 | 27.1 | 3.7 | 0 | 27.3 | 3.2 | 0 |
| Gewone speler | 23.2 | 18.6 | 7 | 22.1 | 26.3 | 46 | 22.5 | 23.8 | 38 |
| Speler met moeite | 22.1 | 40.2 | 364 | 21.6 | 55.9 | 745 | 21.8 | 50.7 | 629 |
| Jonge tikker | 22.2 | 63.4 | 844 | 21.5 | 82.4 | 1292 | 21.8 | 76.2 | 1156 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 77 | 79 | 73 | 66 | 52 |
| 2 | Quarter Turn | 1.8 | 103 | 107 | 91 | 72 | 47 |
| 3 | Follow the Arrow | 3.1 | 128 | 134 | 101 | 67 | 38 |
| 4 | Everyone Steps | 2.1 | 154 | 162 | 118 | 72 | 37 |
| 5 | Lean on It | 2.7 | 179 | 189 | 131 | 71 | 34 |
| 6 | Two Minds | 3.1 | 205 | 216 | 142 | 69 | 31 |
| 7 | Side Door | 4.2 | 229 | 241 | 146 | 60 | 28 |
| 8 | Wait Your Turn | 3.8 | 254 | 267 | 153 | 55 | 27 |
| 9 | One Color Turns | 4.8 | 278 | 292 | 155 | 47 | 25 |
| 10 | Four Doors | 4.0 | 303 | 318 | 160 | 45 | 26 |
| 11 | Use the Wall | 4.8 | 327 | 343 | 162 | 41 | 25 |
| 12 | Three of a Kind | 4.3 | 352 | 368 | 167 | 40 | 25 |
| 13 | Close Quarters | 4.9 | 376 | 393 | 167 | 36 | 24 |
| 14 | Long Way Round | 5.5 | 400 | 417 | 165 | 33 | 23 |
| 15 | After You | 4.8 | 425 | 442 | 167 | 33 | 24 |
| 16 | Queue Up | 6.3 | 448 | 466 | 161 | 29 | 22 |
| 17 | The Corridor | 5.1 | 472 | 490 | 162 | 31 | 23 |
| 18 | Traffic Jam | 6.4 | 496 | 513 | 156 | 28 | 22 |
| 19 | Staircase | 3.6 | 521 | 539 | 165 | 34 | 26 |
| 20 | One Command, Many Consequences | 7.9 | 544 | 560 | 151 | 27 | 22 |
| 21 | Easy Does It | 4.4 | 568 | 585 | 156 | 31 | 24 |
| 22 | Parking Spot | 4.6 | 593 | 610 | 160 | 32 | 25 |
| 23 | All Together Now | 4.8 | 617 | 635 | 163 | 33 | 24 |
| 24 | Wide Open | 5.0 | 642 | 659 | 164 | 32 | 24 |
| 25 | Centre Stage | 5.0 | 666 | 684 | 165 | 32 | 24 |
| 26 | Peel Off | 5.7 | 690 | 708 | 163 | 31 | 23 |
| 27 | Three Rights | 5.1 | 714 | 733 | 163 | 31 | 24 |
| 28 | Elbow Room | 5.9 | 738 | 756 | 160 | 29 | 23 |
| 29 | The Long Hall | 5.6 | 762 | 780 | 160 | 29 | 23 |
| 30 | Gridlock | 6.6 | 785 | 802 | 154 | 27 | 22 |
| 31 | Tight Squeeze | 5.8 | 809 | 826 | 152 | 28 | 23 |
| 32 | Two Lanes | 7.0 | 832 | 848 | 144 | 26 | 22 |
| 33 | Back of the Line | 5.7 | 856 | 872 | 143 | 28 | 23 |
| 34 | Full House | 6.2 | 880 | 895 | 138 | 28 | 22 |
| 35 | Roundabout | 7.0 | 903 | 916 | 132 | 26 | 22 |
| 36 | Colour Guard | 7.4 | 926 | 938 | 123 | 25 | 21 |
| 37 | Single File | 5.9 | 949 | 961 | 122 | 27 | 22 |
| 38 | Patience | 7.6 | 972 | 982 | 114 | 25 | 21 |
| 39 | Detour | 4.8 | 997 | 1007 | 119 | 29 | 23 |
| 40 | Grand Parade | 7.4 | 1019 | 1029 | 111 | 26 | 22 |
| 41 | Turntable | 0.7 | 1046 | 1058 | 135 | 45 | 33 |
| 42 | Corner Piece | 2.3 | 1072 | 1085 | 150 | 51 | 33 |
| 43 | Two for One | 3.1 | 1097 | 1112 | 161 | 50 | 31 |
| 44 | Mind the Tile | 4.1 | 1122 | 1138 | 166 | 46 | 27 |
| 45 | Bank Shot | 3.7 | 1147 | 1164 | 174 | 45 | 27 |
| 46 | Merge Lane | 5.2 | 1171 | 1189 | 173 | 37 | 24 |
| 47 | Standoff | 5.2 | 1195 | 1213 | 172 | 34 | 24 |
| 48 | Switchback | 5.1 | 1220 | 1238 | 173 | 33 | 24 |
| 49 | Three Way | 6.0 | 1243 | 1261 | 169 | 30 | 22 |
| 50 | Open Floor | 6.8 | 1266 | 1283 | 161 | 27 | 22 |
| 51 | Carousel | 5.5 | 1290 | 1307 | 160 | 29 | 23 |
| 52 | Spiral In | 5.6 | 1314 | 1331 | 158 | 29 | 23 |
| 53 | Long Table | 7.0 | 1337 | 1353 | 149 | 27 | 22 |
| 54 | Pinball | 5.8 | 1361 | 1377 | 147 | 28 | 23 |
| 55 | Crowded Corner | 7.0 | 1385 | 1399 | 140 | 26 | 22 |
| 56 | Tricolour | 7.4 | 1408 | 1421 | 132 | 25 | 21 |
| 57 | Cliff Walk | 6.9 | 1431 | 1443 | 126 | 25 | 22 |
| 58 | Whirl | 8.5 | 1453 | 1463 | 114 | 23 | 21 |
| 59 | Conga Line | 3.6 | 1478 | 1489 | 125 | 32 | 25 |
| 60 | Grand Finale | 6.7 | 1501 | 1511 | 119 | 28 | 22 |
