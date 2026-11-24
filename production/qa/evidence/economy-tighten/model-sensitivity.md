# Economiemodel: gevoeligheid voor prijsbewust gedrag

> Gegenereerd door `npm run economy` (2000 runs per speler, vaste seed 20261123). Niet met de hand aanpassen.
> De spelers zijn aannames (`tools/economy/players.json`), de bedragen zijn die van het spel (`data/config.json`: `coins`, `shop.packs`, `economy`). Scenario's, geen voorspellingen.
> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.
> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil. Euro's zijn voorbeeldprijzen van de testwinkel; er wordt nergens iets afgerekend.

De gewone speler en de speler met moeite, levels 1 tot 100. Elasticiteit 0: wil dezelfde hulp, wat die ook kost. 1: wil evenveel munten uitgeven per soort hulp als onder Roomy, en krijgt dus minder hulp naarmate die duurder is. 0,5 zit ertussen.

## Roomy

| Speler | Elasticiteit | Wil Undo's / hints op een middelzwaar level | Verdient | Wil uitgeven | Eerste keer tekort | Moet bijleggen (gem., en uit het kleinste pakket) |
|---|--:|--:|--:|--:|--:|--:|
| Gewone speler | 0 | 3.0 / 0.4 | 2295 | 2779 | level 25 (10–50), 99% van de runs | 538 (€5,32) |
| Gewone speler | 0,5 | 3.0 / 0.4 | 2295 | 2779 | level 25 (10–50), 99% van de runs | 538 (€5,32) |
| Gewone speler | 1 | 3.0 / 0.4 | 2295 | 2779 | level 25 (10–50), 99% van de runs | 538 (€5,32) |
| Speler met moeite | 0 | 4.8 / 1.1 | 2195 | 5451 | level 7 (3–11), 100% van de runs | 3478 (€34,44) |
| Speler met moeite | 0,5 | 4.8 / 1.1 | 2195 | 5451 | level 7 (3–11), 100% van de runs | 3478 (€34,44) |
| Speler met moeite | 1 | 4.8 / 1.1 | 2195 | 5451 | level 7 (3–11), 100% van de runs | 3478 (€34,44) |

## Firmer

| Speler | Elasticiteit | Wil Undo's / hints op een middelzwaar level | Verdient | Wil uitgeven | Eerste keer tekort | Moet bijleggen (gem., en uit het kleinste pakket) |
|---|--:|--:|--:|--:|--:|--:|
| Gewone speler | 0 | 3.0 / 0.4 | 2345 | 4136 | level 10 (2–20), 100% van de runs | 1893 (€18,75) |
| Gewone speler | 0,5 | 3.0 / 0.3 | 2352 | 3326 | level 15 (3–34), 100% van de runs | 1042 (€10,32) |
| Gewone speler | 1 | 3.0 / 0.2 | 2356 | 2763 | level 23 (3–57), 97% van de runs | 472 (€4,68) |
| Speler met moeite | 0 | 4.8 / 1.1 | 2201 | 8579 | level 3 (1–7), 100% van de runs | 6616 (€65,50) |
| Speler met moeite | 0,5 | 4.8 / 0.8 | 2220 | 6745 | level 4 (2–9), 100% van de runs | 4687 (€46,41) |
| Speler met moeite | 1 | 4.8 / 0.6 | 2233 | 5436 | level 6 (2–12), 100% van de runs | 3312 (€32,79) |

## Tight (in het spel)

| Speler | Elasticiteit | Wil Undo's / hints op een middelzwaar level | Verdient | Wil uitgeven | Eerste keer tekort | Moet bijleggen (gem., en uit het kleinste pakket) |
|---|--:|--:|--:|--:|--:|--:|
| Gewone speler | 0 | 3.0 / 0.4 | 2362 | 7933 | level 4 (2–9), 100% van de runs | 5693 (€37,58) |
| Gewone speler | 0,5 | 2.1 / 0.2 | 2386 | 4625 | level 8 (2–19), 100% van de runs | 2306 (€15,22) |
| Gewone speler | 1 | 1.5 / 0.1 | 2387 | 2774 | level 17 (3–57), 94% van de runs | 504 (€3,32) |
| Speler met moeite | 0 | 4.8 / 1.1 | 2201 | 16377 | level 2 (1–4), 100% van de runs | 14423 (€95,20) |
| Speler met moeite | 0,5 | 3.4 / 0.6 | 2232 | 9353 | level 3 (1–7), 100% van de runs | 7247 (€47,83) |
| Speler met moeite | 1 | 2.4 / 0.3 | 2249 | 5422 | level 6 (2–14), 100% van de runs | 3236 (€21,36) |

## Scarce

| Speler | Elasticiteit | Wil Undo's / hints op een middelzwaar level | Verdient | Wil uitgeven | Eerste keer tekort | Moet bijleggen (gem., en uit het kleinste pakket) |
|---|--:|--:|--:|--:|--:|--:|
| Gewone speler | 0 | 3.0 / 0.4 | 2362 | 27340 | level 1 (1–4), 100% van de runs | 25110 (€62,46) |
| Gewone speler | 0,5 | 1.3 / 0.1 | 2402 | 8369 | level 3 (1–13), 100% van de runs | 6010 (€14,95) |
| Gewone speler | 1 | 0.6 / 0.0 | 2410 | 2771 | level 14 (1–58), 85% van de runs | 673 (€1,67) |
| Speler met moeite | 0 | 4.8 / 1.1 | 2201 | 57232 | level 1 (1–2), 100% van de runs | 55289 (€137,53) |
| Speler met moeite | 0,5 | 2.2 / 0.3 | 2250 | 17057 | level 1 (1–5), 100% van de runs | 14869 (€36,99) |
| Speler met moeite | 1 | 1.0 / 0.1 | 2263 | 5431 | level 6 (1–20), 100% van de runs | 3211 (€7,99) |
