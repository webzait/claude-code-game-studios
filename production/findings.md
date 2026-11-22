# TURNFLOCK — bevindingen van de eigenaar

Losse bevindingen uit het spelen en bekijken, vastgelegd om later op te pakken. Niets hiervan is
al gebouwd. Nieuwe bevindingen komen onderaan; een punt verhuist naar "Afgehandeld" met de datum
en de commit zodra het in het spel zit.

## Open

### 2026-11-22

| Nr | Bevinding (woorden van de eigenaar) | Raakt | Vraag of aandachtspunt |
|---|---|---|---|
| B1 | Hinttekst aanpassen / visualiseren | Puzzelscherm: hintregel, Hint-knop, de "volgende zet"-ring | Wat moet zichtbaar worden: de aanbevolen knop, de robots die gaan bewegen, of het pad op het bord? |
| B2 | Levelselectie: alleen het huidige level plus een aantal toekomstige tonen. "Zijn niet meer te zien." | Levelscherm (nu: raster van 20 per pagina, alle levels zichtbaar) | Lezing: gehaalde levels verdwijnen uit beeld. Te bevestigen: kun je een gehaald level nog opnieuw spelen (voor meer sterren), en zo ja waar? Hoeveel toekomstige levels zijn zichtbaar? |
| B3 | Level en moves moeten tijdens het spel bij elkaar getoond worden | Bovenbalk van het puzzelscherm (nu twee rijen: level en munten boven; robots, zetten en Hint eronder) | Geen vraag. |
| B4 | Undo kost munten. "Hier kunnen we geld verdienen." | Spelregels rond hulp, munteneconomie, Undo-knop | **Wijzigt een vastgelegde afspraak**: tot nu toe zijn Undo en Retry altijd gratis (zie `design/game-brief.md`). Te beslissen: prijs per Undo, blijft Restart gratis, is de eerste Undo per level gratis, en wat gebeurt er bij te weinig munten. Verdienen kan pas als munten te koop zijn of via advertenties komen; een winkel bestaat nog niet. |

### Opgepakt op 2026-11-22

De eigenaar vroeg de bevindingen op te lossen. Ze zijn verdeeld over drie sessies, elk op een eigen
branch vanaf de werkbranch. Waar een vraag openstond is een voorlopige keuze gemaakt; die staat
hier, is in de data instelbaar en kan door de eigenaar worden omgedraaid.

| Nr | Sessie / branch | Voorlopige keuze |
|---|---|---|
| B1, B3, B4 | Puzzelscherm — `claude/turnflock-puzzle-screen` | B1: de hint laat op het bord zien welke robots draaien en waar elke robot heen stapt, naast de ring om de knop; de tekstregel wordt korter. B4: Undo kost 5 munten per keer (`coins.undoCost`), Restart blijft gratis, geen gratis Undo's (`coins.freeUndosPerLevel` 0), de prijs staat op de knop, en bij te weinig munten blijft Restart als gratis uitweg. |
| B2 | Levelselectie — `claude/turnflock-level-path` | Alleen het huidige level en de volgende vijf zijn te zien (`levelsAhead`); gehaalde levels verdwijnen. Opnieuw spelen van een gehaald level kan alleen nog via "Replay" direct na de winst. |
| B5, B6 | Pop-up — `claude/turnflock-win-popup` | B5: sterren, één regel met het resultaat, één bedrag aan verdiende munten en één hoofdknop; de uitsplitsing en het saldo vervallen, Replay en Levels worden kleine knoppen. B6: de munten vliegen van de pop-up naar de teller, die meetelt. |

## Afgehandeld

| Nr | Bevinding (woorden van de eigenaar) | Afgehandeld | Commit | Wat er nu in het spel zit |
|---|---|---|---|---|
| B5 | "Level voltooid"-pop-up simpeler | 2026-11-22 | `1a3aa21` (branch `claude/turnflock-win-popup`) | Winst: sterren, één regel (aantal zetten tegenover de kortste oplossing), één bedrag (wat echt is uitbetaald) en één hoofdknop "Next"; Replay en Levels zijn kleine tekstknoppen. Vervallen: de uitsplitsing in drie regels, de saldoregel, de levelnaam en de kop "All home". Levert een herhaald level niets op, dan staat er geen muntenplaatje maar de regel "Best reward already paid". Geen zetten meer: één titel, één zin, het aanbod als dat bewezen helpt, en de gratis opties. Bewijs: `production/qa/evidence/findings-win-popup/compare-*.png`. |
| B6 | Betere animatie van verdiende munten naar de pot | 2026-11-22 | `7aa3a83` (branch `claude/turnflock-win-popup`) | Zes munten vliegen in een boog van het bedrag op de pop-up naar de muntenteller, die per landing optelt en een tikje geeft; de teller staat boven de verduistering. Blokkeert nooit: elke knop werkt meteen en beëindigt de vlucht direct op het echte saldo. Bij verminderde beweging vliegt er niets. Instelbaar in `data/parts.json` onder `coins.fly`. Bewijs: `production/qa/evidence/findings-win-popup/coin-flight-strip-*.png`. |
