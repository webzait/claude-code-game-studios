# Economiemodel TURNFLOCK, bevinding B12: de afstellingen naast elkaar

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261123). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen zijn die van het spel (`data/config.json`: `coins`, `shop.packs`, `economy`). Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil. Euro's zijn voorbeeldprijzen van de testwinkel; er wordt nergens iets afgerekend.

## 1. De bedragen

|  | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| Startsaldo | 50 | 40 | 30 | 20 |
| 1 / 2 / 3 sterren | 10 / 20 / 30 | 10 / 20 / 30 | 10 / 20 / 30 | 10 / 20 / 30 |
| Undo, per stap | 5 | 5 | 10 | 25 |
| Hint | 20 | 40 | 75 | 250 |
| +3 moves | 40 | 80 | 150 | 750 |
| Restart | gratis | gratis | gratis | gratis |
| Pakketten (voorbeeldprijs) | 100 voor €0,99<br>250 voor €1,99<br>700 voor €4,99 | 100 voor €0,99<br>250 voor €1,99<br>700 voor €4,99 | 150 voor €0,99<br>400 voor €1,99<br>1100 voor €4,99 | 800 voor €1,99<br>2200 voor €4,99<br>5000 voor €9,99 |

## 2. De verhoudingen

Hoeveel hulp één winst van drie sterren betaalt, hoeveel hulp het startsaldo en het kleinste pakket kopen.

|  | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| Undo's per 3-sterrenwinst | 6.0 | 6.0 | 3.0 | 1.2 |
| 3-sterrenwinsten voor één hint | 0.7 | 1.3 | 2.5 | 8.3 |
| 3-sterrenwinsten voor één +3 moves | 1.3 | 2.7 | 5.0 | 25 |
| Startsaldo in Undo's | 10 | 8.0 | 3.0 | 0.8 |
| Startsaldo in hints | 2.5 | 1.0 | 0.4 | 0.1 |
| Kleinste pakket in hints | 5.0 | 2.5 | 2.0 | 3.2 |
| Kleinste pakket in +3 moves | 2.5 | 1.3 | 1.0 | 1.1 |
| Kleinste pakket in 3-sterrenwinsten | 3.3 | 3.3 | 5.0 | 27 |

## 3. Wat één keer hulp in euro kost

De prijs in munten maal de prijs per munt van een pakket: eerst uit het kleinste pakket, tussen haakjes uit het grootste.

|  | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| Eén Undo | €0,05 (€0,04) | €0,05 (€0,04) | €0,07 (€0,05) | €0,06 (€0,05) |
| Eén hint | €0,20 (€0,14) | €0,40 (€0,29) | €0,49 (€0,34) | €0,62 (€0,50) |
| Eén keer +3 moves | €0,40 (€0,29) | €0,79 (€0,57) | €0,99 (€0,68) | €1,87 (€1,50) |
| Wat een 3-sterrenwinst in euro "waard" is | €0,30 (€0,21) | €0,30 (€0,21) | €0,20 (€0,14) | €0,07 (€0,06) |

## 4. Hulp per tien levels uit verdiende munten

Wat een speler over 100 levels gemiddeld per tien levels verdient, en hoeveel Undo's, of hints, of keren +3 moves dat koopt als hij er niets anders mee doet.

| Speler | Verdient per 10 levels | Roomy: Undo / hint / +3 | Firmer: Undo / hint / +3 | Tight (in het spel): Undo / hint / +3 | Scarce: Undo / hint / +3 |
|---|--:|--:|--:|--:|--:|
| Puzzelaar | 274 | 55 / 14 / 6.9 | 55 / 6.9 / 3.4 | 27 / 3.7 / 1.8 | 11 / 1.1 / 0.4 |
| Gewone speler | 223 | 45 / 11 / 5.6 | 45 / 5.6 / 2.8 | 22 / 3.0 / 1.5 | 8.9 / 0.9 / 0.3 |
| Speler met moeite | 194 | 39 / 9.7 / 4.9 | 39 / 4.9 / 2.4 | 19 / 2.6 / 1.3 | 7.8 / 0.8 / 0.3 |

## 5. Eerste keer tekort

Over 100 levels. "Wil hetzelfde": de speler wil de hulp van `players.json`, wat die ook kost. "Prijsbewust": hij neemt minder van een hulp naarmate die duurder is dan onder Roomy (drie keer zo duur: een derde zo vaak).

| Speler | Gedrag | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|--:|
| Zuinige speler | wil hetzelfde | nooit | nooit | nooit | nooit |
| Puzzelaar | wil hetzelfde | nooit | level 1 (1–1), 0% | level 3 (1–9), 5% | level 13 (1–36), 99% |
|  | prijsbewust | nooit | nooit | level 2 (1–3), 1% | level 1 (1–9), 6% |
| Gewone speler | wil hetzelfde | level 25 (10–50), 99% | level 10 (2–20) | level 4 (2–9) | level 1 (1–4) |
|  | prijsbewust | level 25 (10–50), 99% | level 23 (3–57), 97% | level 17 (3–57), 94% | level 14 (1–58), 85% |
| Speler met moeite | wil hetzelfde | level 7 (3–11) | level 3 (1–7) | level 2 (1–4) | level 1 (1–2) |
|  | prijsbewust | level 7 (3–11) | level 6 (2–12) | level 6 (2–14) | level 6 (1–20) |
| Jonge tikker | wil hetzelfde | level 3 (1–5) | level 2 (1–3) | level 1 (1–2) | level 1 (1–1) |
|  | prijsbewust | level 3 (1–5) | level 3 (1–6) | level 3 (1–6) | level 1 (1–7) |

## 6. Het saldo over de levels

Gemiddeld saldo van een speler die nooit bijlegt (hulp die hij niet kan betalen, krijgt hij niet), onder "wil hetzelfde".

**Puzzelaar**

| Na level | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| start | 50 | 40 | 30 | 20 |
| 5 | 181 | 168 | 147 | 115 |
| 10 | 296 | 279 | 231 | 157 |
| 20 | 505 | 478 | 357 | 157 |
| 40 | 905 | 853 | 573 | 123 |
| 60 | 1325 | 1253 | 830 | 137 |
| 100 | 2166 | 2052 | 1344 | 150 |

**Gewone speler**

| Na level | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| start | 50 | 40 | 30 | 20 |
| 5 | 113 | 97 | 79 | 49 |
| 10 | 123 | 91 | 65 | 38 |
| 20 | 87 | 59 | 36 | 33 |
| 40 | 49 | 48 | 31 | 33 |
| 60 | 50 | 51 | 33 | 34 |
| 100 | 51 | 50 | 32 | 33 |

**Speler met moeite**

| Na level | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| start | 50 | 40 | 30 | 20 |
| 5 | 57 | 55 | 39 | 36 |
| 10 | 35 | 40 | 27 | 34 |
| 20 | 24 | 28 | 21 | 31 |
| 40 | 24 | 26 | 22 | 31 |
| 60 | 25 | 28 | 22 | 32 |
| 100 | 24 | 27 | 22 | 31 |

## 7. Hoeveel van de gewenste hulp een speler krijgt zonder bij te leggen

Over 100 levels, onder "wil hetzelfde": het deel van de catalogusprijs van alles wat hij wilde dat hij uit eigen munten kon betalen.

| Speler | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|
| Puzzelaar | 100% | 100% | 100% | 67% |
| Gewone speler | 83% | 56% | 30% | 9% |
| Speler met moeite | 41% | 26% | 13% | 4% |
| Jonge tikker | 28% | 18% | 9% | 3% |

## 8. Bijleggen om alles te kopen wat de speler wil

Over 100 levels: munten (gemiddeld) en wat dat kost uit het kleinste pakket. Eerst "wil hetzelfde", daaronder "prijsbewust".

| Speler | Gedrag | Roomy | Firmer | Tight (in het spel) | Scarce |
|---|--:|--:|--:|--:|--:|
| Puzzelaar | wil hetzelfde | 0 (€0,00) | 0 (€0,00) | 1 (€0,01) | 1228 (€3,05) |
|  | prijsbewust | 0 (€0,00) | 0 (€0,00) | 0 (€0,00) | 3 (€0,01) |
| Gewone speler | wil hetzelfde | 538 (€5,32) | 1893 (€18,75) | 5693 (€37,58) | 25110 (€62,46) |
|  | prijsbewust | 538 (€5,32) | 472 (€4,68) | 504 (€3,32) | 673 (€1,67) |
| Speler met moeite | wil hetzelfde | 3478 (€34,44) | 6616 (€65,50) | 14423 (€95,20) | 55289 (€137,53) |
|  | prijsbewust | 3478 (€34,44) | 3312 (€32,79) | 3236 (€21,36) | 3211 (€7,99) |
| Jonge tikker | wil hetzelfde | 6089 (€60,28) | 10229 (€101,27) | 21308 (€140,63) | 77349 (€192,41) |
|  | prijsbewust | 6089 (€60,28) | 5895 (€58,36) | 5839 (€38,54) | 5705 (€14,19) |
