# Bewijs: munteneconomie (design/economy.md)

Stand: 2026-11-22, branch `claude/turnflock-economy`.

## Modeluitvoer

Gemaakt met `npm run economy` (2000 runs per speler, vaste seed). Scenario's op aannames, geen voorspellingen.

- `model-summary.md`: alle sets naast elkaar, levels 1–40 en 1–60.
- `model-current.md`, `model-generous.md`, `model-recommended.md`, `model-recommended-free-undo.md`, `model-scarce.md`: per set, met het gemiddelde saldo na elk level.
- `model-sensitivity.md`: de helft en het dubbele aantal Undo's.

## Schermafbeeldingen

Gemaakt met `npm run build:single && node tools/economy/screenshots.mjs` uit de gebouwde game (390×844, Chromium met software-3D). Het script vergelijkt elk bedrag op het scherm met `data/config.json` en stopt met een fout als er één afwijkt; alle 18 controles waren goed.

| Bestand | Wat erop staat |
|---|---|
| `01-level-start-50-coins.png` | Level 1, nieuw startsaldo 50, prijs 5 op Undo en 20 op Hint |
| `02-win-3-stars.png` | Drie sterren, +30 |
| `03-price-tags-undo-hint.png` | Prijslabels Undo 5 en Hint 20 tijdens het spelen |
| `04-win-2-stars.png` | Twee sterren, +20 |
| `05-out-of-moves-offer.png` | "+3 moves" voor 40, Undo voor 5, Retry gratis |
| `06-win-1-star.png` | Eén ster (met extra zetten), +10 |
| `07-coin-explainer.png` | De uitleg achter de plusknop met alle bedragen |

## Tests

- `npm run test:unit`: 415 van 415 geslaagd (12 bestanden), waaronder de nieuwe tests voor de formule, de regel voor oude saves en het model.
- `npm run test:e2e`: 18 tests. Eerste volledige run: 17 geslaagd, 1 mislukt. De mislukte ("the win coins: … a replayed level shows no made-up reward") faalde niet op een bedrag: hij wachtte op `#node-1`, de stap van level 1 op het pad, die sinds bevinding B2 verdwijnt zodra het level gehaald is. De test is aangepast om het level via de testweergave (raster) opnieuw te openen en slaagt daarna los gedraaid. De volledige reeks is na die aanpassing niet nog een keer in zijn geheel gedraaid (duurt hier ongeveer 20 minuten).
- Nieuw: de browsertest "a save from the first economy keeps its coins" (geslaagd).

## Niet gecontroleerd

- Echte spelers: alle spelersgedrag in het model is aangenomen.
- Een echte telefoon; alleen Chromium op 390×844.
- Samenvoegen met de branches van de testwinkel, de knoppenrij en de draaitegel. Bekende raakpunten: `data/config.json` (blok `coins`), `src/game/save.ts` (nieuw veld `economy`), `src/ui/coins.ts` (regels van de muntenuitleg) en `tools/economy/shop-sim.mjs` van de winkelbranch, dat de oude formule narekent.
- De onderdelenpagina (`npm run build:parts`) is alleen op typefouten gecontroleerd, niet bekeken.
