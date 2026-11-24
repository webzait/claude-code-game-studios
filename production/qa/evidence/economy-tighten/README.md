# Bewijs: munteneconomie strakker (bevinding B12)

Onderbouwing: `design/economy.md`. Winkel en het voorstel voor een aanbod op het verliesmoment: `design/shop.md`.

## Rekenmodel

Gegenereerd door `npm run economy` (2.000 runs per speler, vaste seed, alle 100 levels). Niet met de hand aanpassen.

| Bestand | Wat erin staat |
|---|---|
| `model-summary.md` | De vier afstellingen naast elkaar: bedragen, verhoudingen, wat hulp in euro kost, hulp per tien levels, eerste keer tekort, saldo over de levels, bijleggen |
| `model-roomy.md`, `model-firmer.md`, `model-tight.md`, `model-scarce.md` | Per afstelling: levels 1–20, 1–40 en 1–100, per pagina, en het saldo na elk level |
| `model-sensitivity.md` | Hoe sterk de uitkomst leunt op de aanname over prijsbewust gedrag |

De spelers zijn aannames (`tools/economy/players.json`). De uitkomsten zijn scenario's, geen voorspellingen.

## Schermafbeeldingen

Gemaakt door `node tools/economy/screenshots.mjs` uit de gebouwde game (`npm run build:single`), 390×844. Het script
controleert dat elk bedrag op het scherm het bedrag uit `data/config.json` is en stopt met een fout als dat niet zo is.

Per afstelling (`roomy`, `firmer`, `tight`, `scarce`):

| Bestand | Wat erop staat |
|---|---|
| `<afstelling>-01-top-bar-and-price-tags.png` | Level 2 na één zet: het saldo in de bovenbalk en de prijskaartjes op Undo en Hint |
| `<afstelling>-02-win-popup.png` | Level 1 gewonnen met drie sterren: de beloning en het nieuwe saldo |
| `<afstelling>-03-out-of-moves-offer.png` | Zetten op, +3 moves helpt bewezen: het aanbod met zijn prijs, Undo en de gratis Retry |
| `<afstelling>-04-shop.png` | De testwinkel met de pakketten van deze afstelling |

En `lab-coin-tuning.png`: de keuze "Coin tuning" in het testlab, met Tight als standaard.

## Tests

- `npm run test:unit`: de regels van de afstellingen, de overgang van een bestaande save en het model
  (`tests/unit/meta.test.ts` "the tunings of finding B12", `tests/unit/economy.test.ts`, `tests/unit/shop.test.ts`).
- Browsertests die munten en de winkel raken: `tests/integration/boot.spec.ts`, `shop.spec.ts`, `popup-position.spec.ts`.

## Niet gecontroleerd

- Hoe schaars het voelt voor echte spelers. Dat kan geen model en geen schermafbeelding laten zien.
- Een echte telefoon: alles is in een browser op telefoonformaat bekeken.
