# Economiemodel: Huidig (tot 22 november 2026)

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261122). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen staan in `tools/economy/sets.json`. Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.

10 per winst, 3 per zet over, 10 voor de kortste oplossing; een winst met hint of extra zetten betaalt alleen de 10.

Start 30 · 1 ster 10 · 2 sterren 10 (+3 per zet over) · 3 sterren 26 · winst met hint betaalt alleen 10 · Undo 5 · hint 10 · +3 moves 25

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 706 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 736 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 869 | 223 | 223 | 202 / 21 / 0 | 0.0 | nooit | 676 | 0 / 0 / 0 |
| Gewone speler | 2.33 | 615 | 843 | 623 | 485 / 92 / 46 | 23.9 | level 16 (7–30), 99% van de runs | 22 | 242 / 243 / 380 |
| Speler met moeite | 2.20 | 548 | 1563 | 563 | 515 / 43 / 6 | 124.4 | level 5 (2–8), 100% van de runs | 15 | 1073 / 1072 / 1234 |
| Jonge tikker | 2.19 | 547 | 2375 | 562 | 551 / 11 / 1 | 257.4 | level 2 (1–3), 100% van de runs | 14 | 1908 / 1903 / 2102 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 18.3 | 0.0 | 0 | 17.0 | 0.0 | 0 |
| Puzzelaar | 22.3 | 4.7 | 0 | 21.1 | 6.5 | 0 |
| Gewone speler | 15.8 | 18.0 | 50 | 14.9 | 24.1 | 192 |
| Speler met moeite | 14.1 | 33.4 | 402 | 13.3 | 44.7 | 672 |
| Jonge tikker | 14.2 | 52.5 | 797 | 13.1 | 66.2 | 1111 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 51 | 54 | 45 | 37 | 25 |
| 2 | Quarter Turn | 1.8 | 71 | 76 | 54 | 37 | 21 |
| 3 | Follow the Arrow | 3.1 | 91 | 96 | 57 | 30 | 18 |
| 4 | Everyone Steps | 2.1 | 111 | 117 | 66 | 31 | 20 |
| 5 | Lean on It | 2.7 | 130 | 137 | 71 | 29 | 19 |
| 6 | Two Minds | 3.1 | 149 | 157 | 74 | 26 | 18 |
| 7 | Side Door | 4.2 | 167 | 174 | 72 | 22 | 17 |
| 8 | Wait Your Turn | 3.8 | 186 | 192 | 72 | 21 | 17 |
| 9 | One Color Turns | 4.8 | 203 | 209 | 68 | 18 | 16 |
| 10 | Four Doors | 4.0 | 222 | 227 | 68 | 19 | 17 |
| 11 | Use the Wall | 4.8 | 240 | 244 | 64 | 18 | 16 |
| 12 | Three of a Kind | 4.3 | 258 | 261 | 63 | 18 | 16 |
| 13 | Close Quarters | 4.9 | 276 | 277 | 60 | 17 | 16 |
| 14 | Long Way Round | 5.5 | 293 | 293 | 55 | 17 | 15 |
| 15 | After You | 4.8 | 311 | 310 | 53 | 17 | 16 |
| 16 | Queue Up | 6.3 | 327 | 324 | 47 | 16 | 15 |
| 17 | The Corridor | 5.1 | 345 | 340 | 45 | 17 | 16 |
| 18 | Traffic Jam | 6.4 | 361 | 354 | 40 | 15 | 15 |
| 19 | Staircase | 3.6 | 380 | 373 | 44 | 19 | 17 |
| 20 | One Command, Many Consequences | 7.9 | 396 | 383 | 35 | 15 | 14 |
| 21 | Easy Does It | 4.4 | 414 | 401 | 37 | 17 | 16 |
| 22 | Parking Spot | 4.6 | 432 | 417 | 38 | 18 | 16 |
| 23 | All Together Now | 4.8 | 450 | 434 | 38 | 18 | 16 |
| 24 | Wide Open | 5.0 | 468 | 450 | 37 | 17 | 16 |
| 25 | Centre Stage | 5.0 | 485 | 467 | 37 | 17 | 16 |
| 26 | Peel Off | 5.7 | 502 | 482 | 34 | 16 | 15 |
| 27 | Three Rights | 5.1 | 520 | 498 | 34 | 17 | 16 |
| 28 | Elbow Room | 5.9 | 537 | 512 | 31 | 16 | 15 |
| 29 | The Long Hall | 5.6 | 554 | 528 | 31 | 16 | 15 |
| 30 | Gridlock | 6.6 | 571 | 541 | 28 | 15 | 15 |
| 31 | Tight Squeeze | 5.8 | 588 | 556 | 28 | 16 | 15 |
| 32 | Two Lanes | 7.0 | 604 | 568 | 25 | 15 | 14 |
| 33 | Back of the Line | 5.7 | 621 | 583 | 26 | 16 | 15 |
| 34 | Full House | 6.2 | 638 | 597 | 25 | 16 | 15 |
| 35 | Roundabout | 7.0 | 654 | 610 | 23 | 15 | 15 |
| 36 | Colour Guard | 7.4 | 670 | 622 | 21 | 15 | 14 |
| 37 | Single File | 5.9 | 686 | 636 | 23 | 16 | 15 |
| 38 | Patience | 7.6 | 702 | 648 | 21 | 15 | 14 |
| 39 | Detour | 4.8 | 720 | 664 | 25 | 17 | 16 |
| 40 | Grand Parade | 7.4 | 736 | 676 | 22 | 15 | 14 |

## Levels 1 tot 60

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 1054 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1084 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 1300 | 339 | 339 | 308 / 31 / 0 | 0.0 | nooit | 991 | 0 / 0 / 0 |
| Gewone speler | 2.33 | 921 | 1285 | 927 | 730 / 135 / 63 | 39.3 | level 16 (7–30), 100% van de runs | 23 | 398 / 398 / 566 |
| Speler met moeite | 2.20 | 820 | 2382 | 835 | 767 / 60 / 8 | 193.2 | level 5 (2–8), 100% van de runs | 16 | 1658 / 1654 / 1857 |
| Jonge tikker | 2.19 | 817 | 3612 | 833 | 818 / 14 / 1 | 395.1 | level 2 (1–3), 100% van de runs | 15 | 2922 / 2922 / 3148 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 18.3 | 0.0 | 0 | 17.0 | 0.0 | 0 | 17.4 | 0.0 | 0 |
| Puzzelaar | 22.3 | 4.7 | 0 | 21.1 | 6.5 | 0 | 21.5 | 5.8 | 0 |
| Gewone speler | 15.8 | 18.0 | 50 | 14.9 | 24.1 | 192 | 15.3 | 22.1 | 155 |
| Speler met moeite | 14.1 | 33.4 | 402 | 13.3 | 44.7 | 672 | 13.6 | 40.9 | 584 |
| Jonge tikker | 14.2 | 52.5 | 797 | 13.1 | 66.2 | 1111 | 13.5 | 61.8 | 1013 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 51 | 54 | 45 | 37 | 25 |
| 2 | Quarter Turn | 1.8 | 71 | 76 | 54 | 37 | 21 |
| 3 | Follow the Arrow | 3.1 | 91 | 96 | 57 | 30 | 18 |
| 4 | Everyone Steps | 2.1 | 111 | 117 | 66 | 31 | 20 |
| 5 | Lean on It | 2.7 | 130 | 137 | 71 | 29 | 19 |
| 6 | Two Minds | 3.1 | 149 | 157 | 74 | 26 | 18 |
| 7 | Side Door | 4.2 | 167 | 174 | 72 | 22 | 17 |
| 8 | Wait Your Turn | 3.8 | 186 | 192 | 72 | 21 | 17 |
| 9 | One Color Turns | 4.8 | 203 | 209 | 68 | 18 | 16 |
| 10 | Four Doors | 4.0 | 222 | 227 | 68 | 19 | 17 |
| 11 | Use the Wall | 4.8 | 240 | 244 | 64 | 18 | 16 |
| 12 | Three of a Kind | 4.3 | 258 | 261 | 63 | 18 | 16 |
| 13 | Close Quarters | 4.9 | 276 | 277 | 60 | 17 | 16 |
| 14 | Long Way Round | 5.5 | 293 | 293 | 55 | 17 | 15 |
| 15 | After You | 4.8 | 311 | 310 | 53 | 17 | 16 |
| 16 | Queue Up | 6.3 | 327 | 324 | 47 | 16 | 15 |
| 17 | The Corridor | 5.1 | 345 | 340 | 45 | 17 | 16 |
| 18 | Traffic Jam | 6.4 | 361 | 354 | 40 | 15 | 15 |
| 19 | Staircase | 3.6 | 380 | 373 | 44 | 19 | 17 |
| 20 | One Command, Many Consequences | 7.9 | 396 | 383 | 35 | 15 | 14 |
| 21 | Easy Does It | 4.4 | 414 | 401 | 37 | 17 | 16 |
| 22 | Parking Spot | 4.6 | 432 | 417 | 38 | 18 | 16 |
| 23 | All Together Now | 4.8 | 450 | 434 | 38 | 18 | 16 |
| 24 | Wide Open | 5.0 | 468 | 450 | 37 | 17 | 16 |
| 25 | Centre Stage | 5.0 | 485 | 467 | 37 | 17 | 16 |
| 26 | Peel Off | 5.7 | 502 | 482 | 34 | 16 | 15 |
| 27 | Three Rights | 5.1 | 520 | 498 | 34 | 17 | 16 |
| 28 | Elbow Room | 5.9 | 537 | 512 | 31 | 16 | 15 |
| 29 | The Long Hall | 5.6 | 554 | 528 | 31 | 16 | 15 |
| 30 | Gridlock | 6.6 | 571 | 541 | 28 | 15 | 15 |
| 31 | Tight Squeeze | 5.8 | 588 | 556 | 28 | 16 | 15 |
| 32 | Two Lanes | 7.0 | 604 | 568 | 25 | 15 | 14 |
| 33 | Back of the Line | 5.7 | 621 | 583 | 26 | 16 | 15 |
| 34 | Full House | 6.2 | 638 | 597 | 25 | 16 | 15 |
| 35 | Roundabout | 7.0 | 654 | 610 | 23 | 15 | 15 |
| 36 | Colour Guard | 7.4 | 670 | 622 | 21 | 15 | 14 |
| 37 | Single File | 5.9 | 686 | 636 | 23 | 16 | 15 |
| 38 | Patience | 7.6 | 702 | 648 | 21 | 15 | 14 |
| 39 | Detour | 4.8 | 720 | 664 | 25 | 17 | 16 |
| 40 | Grand Parade | 7.4 | 736 | 676 | 22 | 15 | 14 |
| 41 | Turntable | 0.7 | 757 | 700 | 38 | 26 | 21 |
| 42 | Corner Piece | 2.3 | 777 | 721 | 46 | 26 | 19 |
| 43 | Two for One | 3.1 | 796 | 741 | 50 | 24 | 18 |
| 44 | Mind the Tile | 4.1 | 814 | 759 | 49 | 21 | 17 |
| 45 | Bank Shot | 3.7 | 833 | 777 | 51 | 20 | 17 |
| 46 | Merge Lane | 5.2 | 851 | 794 | 46 | 18 | 16 |
| 47 | Standoff | 5.2 | 868 | 810 | 42 | 17 | 15 |
| 48 | Switchback | 5.1 | 886 | 826 | 41 | 17 | 16 |
| 49 | Three Way | 6.0 | 903 | 840 | 36 | 16 | 15 |
| 50 | Open Floor | 6.8 | 919 | 853 | 31 | 15 | 14 |
| 51 | Carousel | 5.5 | 936 | 868 | 31 | 16 | 16 |
| 52 | Spiral In | 5.6 | 953 | 884 | 30 | 16 | 15 |
| 53 | Long Table | 7.0 | 969 | 897 | 26 | 15 | 14 |
| 54 | Pinball | 5.8 | 987 | 912 | 26 | 16 | 15 |
| 55 | Crowded Corner | 7.0 | 1003 | 924 | 24 | 15 | 14 |
| 56 | Tricolour | 7.4 | 1018 | 936 | 22 | 15 | 14 |
| 57 | Cliff Walk | 6.9 | 1035 | 949 | 22 | 15 | 14 |
| 58 | Whirl | 8.5 | 1049 | 959 | 19 | 14 | 14 |
| 59 | Conga Line | 3.6 | 1068 | 978 | 26 | 18 | 17 |
| 60 | Grand Finale | 6.7 | 1084 | 991 | 23 | 16 | 15 |
