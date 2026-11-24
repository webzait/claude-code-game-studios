# Economiemodel: Tight (in het spel)

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261123). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen zijn die van het spel (`data/config.json`: `coins`, `shop.packs`, `economy`). Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil. Euro's zijn voorbeeldprijzen van de testwinkel; er wordt nergens iets afgerekend.

Thought-out help costs several levels of winnings; Undo stays small. The smallest pack is one +3 moves or two hints.

Start 30 · 1 ster 10 · 2 sterren 20 · 3 sterren 30 · Undo 10 · hint 75 · +3 moves 150 · pakketten 150 voor €0,99, 400 voor €1,99, 1100 voor €4,99

## Levels 1 tot 20

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.47 | 494 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 524 | 0 / 0 / 0 |
| Puzzelaar | 2.78 | 557 | 234 | 230 | 169 / 61 / 0 | 0.1 | level 2 (1–9), 5% van de runs | 357 | 1 / 0 / 0 |
| Gewone speler | 2.42 | 484 | 1303 | 478 | 428 / 50 / 0 | 13.3 | level 4 (2–9), 100% van de runs | 36 | 833 / 830 / 1230 |
| Speler met moeite | 2.25 | 450 | 2688 | 459 | 458 / 1 / 0 | 54.3 | level 2 (1–4), 100% van de runs | 21 | 2266 / 2245 / 2850 |
| Jonge tikker | 2.23 | 446 | 3944 | 456 | 456 / 0 / 0 | 118.9 | level 1 (1–2), 100% van de runs | 21 | 3539 / 3545 / 4165 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen |
|---|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 |
| Puzzelaar | 27.8 | 11.7 | 1 |
| Gewone speler | 24.2 | 65.2 | 833 |
| Speler met moeite | 22.5 | 134.4 | 2266 |
| Jonge tikker | 22.3 | 197.2 | 3539 |

## Levels 1 tot 40

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.42 | 970 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 1000 | 0 / 0 / 0 |
| Puzzelaar | 2.75 | 1099 | 561 | 556 | 405 / 151 / 0 | 0.1 | level 3 (1–9), 5% van de runs | 573 | 1 / 0 / 0 |
| Gewone speler | 2.37 | 949 | 3080 | 948 | 893 / 55 / 0 | 42.0 | level 4 (2–9), 100% van de runs | 31 | 2174 / 2160 / 2785 |
| Speler met moeite | 2.21 | 884 | 6360 | 892 | 891 / 1 / 0 | 142.7 | level 2 (1–4), 100% van de runs | 22 | 5564 / 5545 / 6425 |
| Jonge tikker | 2.19 | 877 | 9047 | 886 | 886 / 0 / 0 | 280.1 | level 1 (1–2), 100% van de runs | 21 | 8286 / 8265 / 9280 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen |
|---|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 |
| Puzzelaar | 27.8 | 11.7 | 1 | 27.1 | 16.3 | 0 |
| Gewone speler | 24.2 | 65.2 | 833 | 23.2 | 88.8 | 1342 |
| Speler met moeite | 22.5 | 134.4 | 2266 | 21.7 | 183.6 | 3298 |
| Jonge tikker | 22.3 | 197.2 | 3539 | 21.5 | 255.1 | 4747 |

## Levels 1 tot 100

| Speler | Sterren per level | Verdient | Wil uitgeven | Geeft uit | waarvan Undo / hint / +3 | Geweigerd (keer) | Eerste keer tekort | Saldo aan het eind | Moet bijleggen (gem. / mediaan / 90%) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 2.41 | 2414 | 0 | 0 | 0 / 0 / 0 | 0.0 | nooit | 2444 | 0 / 0 / 0 |
| Puzzelaar | 2.74 | 2740 | 1430 | 1426 | 1041 / 386 / 0 | 0.1 | level 3 (1–9), 5% van de runs | 1344 | 1 / 0 / 0 |
| Gewone speler | 2.36 | 2362 | 7933 | 2360 | 2261 / 99 / 0 | 111.9 | level 4 (2–9), 100% van de runs | 32 | 5693 / 5695 / 6645 |
| Speler met moeite | 2.20 | 2201 | 16377 | 2210 | 2208 / 1 / 0 | 374.2 | level 2 (1–4), 100% van de runs | 22 | 14423 / 14395 / 15780 |
| Jonge tikker | 2.18 | 2183 | 23171 | 2193 | 2193 / 0 / 0 | 722.0 | level 1 (1–2), 100% van de runs | 21 | 21308 / 21310 / 22865 |

### Per pagina van 20 levels

| Speler | P1 verdient/level | P1 wil uitgeven/level | P1 bijleggen | P2 verdient/level | P2 wil uitgeven/level | P2 bijleggen | P3 verdient/level | P3 wil uitgeven/level | P3 bijleggen | P4 verdient/level | P4 wil uitgeven/level | P4 bijleggen | P5 verdient/level | P5 wil uitgeven/level | P5 bijleggen |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Zuinige speler | 24.7 | 0.0 | 0 | 23.8 | 0.0 | 0 | 24.1 | 0.0 | 0 | 24.0 | 0.0 | 0 | 24.1 | 0.0 | 0 |
| Puzzelaar | 27.8 | 11.7 | 1 | 27.1 | 16.3 | 0 | 27.3 | 14.4 | 0 | 27.3 | 14.6 | 0 | 27.4 | 14.4 | 0 |
| Gewone speler | 24.2 | 65.2 | 833 | 23.2 | 88.8 | 1342 | 23.6 | 81.2 | 1180 | 23.5 | 81.0 | 1176 | 23.6 | 80.4 | 1163 |
| Speler met moeite | 22.5 | 134.4 | 2266 | 21.7 | 183.6 | 3298 | 22.0 | 167.0 | 2954 | 21.9 | 169.2 | 2998 | 22.0 | 164.7 | 2907 |
| Jonge tikker | 22.3 | 197.2 | 3539 | 21.5 | 255.1 | 4747 | 21.8 | 236.2 | 4356 | 21.7 | 238.1 | 4397 | 21.8 | 231.9 | 4269 |

### Gemiddeld saldo na elk level (speler die nooit bijlegt)

| Level | Naam | Score | Zuinige speler | Puzzelaar | Gewone speler | Speler met moeite | Jonge tikker |
|---|--:|--:|--:|--:|--:|--:|--:|
| 1 | First Steps | 0.8 | 57 | 58 | 48 | 40 | 28 |
| 2 | Quarter Turn | 1.8 | 83 | 83 | 61 | 43 | 26 |
| 3 | Follow the Arrow | 3.1 | 108 | 104 | 66 | 38 | 24 |
| 4 | Everyone Steps | 2.1 | 134 | 127 | 75 | 41 | 25 |
| 5 | Lean on It | 2.7 | 159 | 147 | 79 | 39 | 24 |
| 6 | Two Minds | 3.1 | 185 | 166 | 79 | 38 | 23 |
| 7 | Side Door | 4.2 | 209 | 183 | 74 | 32 | 23 |
| 8 | Wait Your Turn | 3.8 | 234 | 200 | 72 | 30 | 23 |
| 9 | One Color Turns | 4.8 | 258 | 215 | 66 | 27 | 22 |
| 10 | Four Doors | 4.0 | 283 | 231 | 65 | 27 | 23 |
| 11 | Use the Wall | 4.8 | 307 | 246 | 60 | 25 | 22 |
| 12 | Three of a Kind | 4.3 | 332 | 262 | 59 | 25 | 22 |
| 13 | Close Quarters | 4.9 | 356 | 276 | 56 | 24 | 22 |
| 14 | Long Way Round | 5.5 | 380 | 288 | 52 | 23 | 22 |
| 15 | After You | 4.8 | 405 | 303 | 50 | 24 | 22 |
| 16 | Queue Up | 6.3 | 428 | 314 | 44 | 22 | 21 |
| 17 | The Corridor | 5.1 | 453 | 327 | 44 | 23 | 22 |
| 18 | Traffic Jam | 6.4 | 476 | 335 | 40 | 22 | 21 |
| 19 | Staircase | 3.6 | 501 | 353 | 45 | 25 | 23 |
| 20 | One Command, Many Consequences | 7.9 | 524 | 357 | 36 | 21 | 21 |
| 21 | Easy Does It | 4.4 | 548 | 372 | 40 | 24 | 22 |
| 22 | Parking Spot | 4.6 | 573 | 386 | 42 | 24 | 22 |
| 23 | All Together Now | 4.8 | 597 | 400 | 43 | 24 | 22 |
| 24 | Wide Open | 5.0 | 622 | 414 | 43 | 24 | 22 |
| 25 | Centre Stage | 5.0 | 646 | 428 | 43 | 24 | 22 |
| 26 | Peel Off | 5.7 | 670 | 440 | 41 | 23 | 22 |
| 27 | Three Rights | 5.1 | 694 | 454 | 41 | 23 | 22 |
| 28 | Elbow Room | 5.9 | 718 | 464 | 39 | 22 | 22 |
| 29 | The Long Hall | 5.6 | 742 | 476 | 39 | 23 | 22 |
| 30 | Gridlock | 6.6 | 765 | 484 | 36 | 22 | 21 |
| 31 | Tight Squeeze | 5.8 | 789 | 495 | 36 | 23 | 22 |
| 32 | Two Lanes | 7.0 | 812 | 503 | 33 | 21 | 21 |
| 33 | Back of the Line | 5.7 | 836 | 514 | 34 | 22 | 22 |
| 34 | Full House | 6.2 | 860 | 524 | 33 | 22 | 21 |
| 35 | Roundabout | 7.0 | 883 | 531 | 32 | 22 | 21 |
| 36 | Colour Guard | 7.4 | 906 | 537 | 30 | 21 | 21 |
| 37 | Single File | 5.9 | 929 | 547 | 32 | 22 | 22 |
| 38 | Patience | 7.6 | 952 | 553 | 29 | 21 | 21 |
| 39 | Detour | 4.8 | 977 | 567 | 33 | 23 | 22 |
| 40 | Grand Parade | 7.4 | 1000 | 573 | 31 | 22 | 21 |
| 41 | Turntable | 0.7 | 1026 | 600 | 49 | 34 | 26 |
| 42 | Corner Piece | 2.3 | 1052 | 622 | 59 | 35 | 25 |
| 43 | Two for One | 3.1 | 1077 | 642 | 64 | 34 | 23 |
| 44 | Mind the Tile | 4.1 | 1102 | 659 | 63 | 30 | 22 |
| 45 | Bank Shot | 3.7 | 1127 | 677 | 64 | 29 | 23 |
| 46 | Merge Lane | 5.2 | 1151 | 690 | 57 | 25 | 22 |
| 47 | Standoff | 5.2 | 1175 | 704 | 52 | 24 | 22 |
| 48 | Switchback | 5.1 | 1200 | 718 | 50 | 24 | 22 |
| 49 | Three Way | 6.0 | 1223 | 728 | 45 | 22 | 21 |
| 50 | Open Floor | 6.8 | 1246 | 737 | 39 | 22 | 21 |
| 51 | Carousel | 5.5 | 1270 | 748 | 39 | 23 | 22 |
| 52 | Spiral In | 5.6 | 1294 | 760 | 39 | 23 | 22 |
| 53 | Long Table | 7.0 | 1317 | 768 | 35 | 22 | 21 |
| 54 | Pinball | 5.8 | 1341 | 779 | 35 | 22 | 22 |
| 55 | Crowded Corner | 7.0 | 1365 | 786 | 33 | 22 | 21 |
| 56 | Tricolour | 7.4 | 1388 | 793 | 30 | 21 | 21 |
| 57 | Cliff Walk | 6.9 | 1411 | 801 | 30 | 21 | 21 |
| 58 | Whirl | 8.5 | 1433 | 804 | 27 | 21 | 21 |
| 59 | Conga Line | 3.6 | 1458 | 822 | 36 | 25 | 23 |
| 60 | Grand Finale | 6.7 | 1481 | 830 | 33 | 22 | 21 |
| 61 | Own Door | 1.5 | 1507 | 855 | 47 | 31 | 25 |
| 62 | Just Passing | 3.2 | 1532 | 874 | 53 | 30 | 23 |
| 63 | Swap Sides | 4.5 | 1557 | 890 | 53 | 27 | 22 |
| 64 | Doorstop | 4.6 | 1581 | 904 | 52 | 25 | 22 |
| 65 | Three Doors | 4.8 | 1606 | 918 | 51 | 24 | 22 |
| 66 | Ricochet | 4.9 | 1630 | 933 | 50 | 24 | 22 |
| 67 | Side by Side | 4.9 | 1654 | 948 | 48 | 24 | 22 |
| 68 | Top and Bottom | 5.7 | 1678 | 960 | 45 | 23 | 21 |
| 69 | After the Red | 4.9 | 1702 | 973 | 44 | 23 | 22 |
| 70 | Stacked Doors | 5.4 | 1726 | 986 | 42 | 23 | 22 |
| 71 | Twin Gates | 6.3 | 1750 | 996 | 39 | 22 | 21 |
| 72 | Four Corners | 5.4 | 1774 | 1009 | 39 | 23 | 22 |
| 73 | Colour Sort | 6.6 | 1798 | 1017 | 36 | 22 | 21 |
| 74 | Half and Half | 4.9 | 1822 | 1032 | 38 | 23 | 22 |
| 75 | Three Lanes | 7.0 | 1845 | 1039 | 34 | 22 | 21 |
| 76 | Wide Sort | 6.8 | 1868 | 1048 | 33 | 22 | 21 |
| 77 | Sorting Office | 7.0 | 1892 | 1054 | 32 | 22 | 21 |
| 78 | Long Sort | 7.1 | 1915 | 1062 | 30 | 22 | 21 |
| 79 | Home Stretch | 4.6 | 1939 | 1078 | 34 | 23 | 22 |
| 80 | Grand Sort | 7.4 | 1962 | 1084 | 31 | 22 | 21 |
| 81 | Hold the Door | 2.2 | 1988 | 1107 | 43 | 28 | 24 |
| 82 | Doorman | 3.5 | 2013 | 1125 | 48 | 28 | 23 |
| 83 | Stand Here | 4.0 | 2037 | 1142 | 51 | 27 | 23 |
| 84 | Knock First | 4.3 | 2062 | 1158 | 52 | 26 | 22 |
| 85 | Through the Wall | 4.8 | 2086 | 1172 | 51 | 25 | 22 |
| 86 | Back Door | 5.0 | 2111 | 1186 | 49 | 24 | 22 |
| 87 | Side Gate | 5.5 | 2134 | 1198 | 46 | 23 | 22 |
| 88 | Waiting Room | 4.8 | 2159 | 1213 | 45 | 24 | 22 |
| 89 | Long Wait | 5.4 | 2183 | 1225 | 44 | 23 | 22 |
| 90 | Pinch | 5.7 | 2207 | 1236 | 41 | 23 | 22 |
| 91 | Three at the Gate | 5.6 | 2231 | 1248 | 40 | 23 | 22 |
| 92 | Colour Gate | 5.6 | 2255 | 1260 | 39 | 23 | 22 |
| 93 | Turnstile | 5.8 | 2278 | 1271 | 38 | 23 | 22 |
| 94 | Double Gate | 6.0 | 2302 | 1281 | 37 | 22 | 22 |
| 95 | Sorted Gate | 5.7 | 2326 | 1292 | 37 | 23 | 22 |
| 96 | Wide Gate | 6.4 | 2349 | 1302 | 34 | 22 | 21 |
| 97 | Long Gate | 6.2 | 2373 | 1313 | 34 | 22 | 21 |
| 98 | Great Wall | 6.4 | 2396 | 1323 | 33 | 22 | 21 |
| 99 | Open Sesame | 4.7 | 2421 | 1338 | 36 | 24 | 22 |
| 100 | Grand Gate | 7.3 | 2444 | 1344 | 32 | 22 | 21 |
