# TURNFLOCK — bevindingen van de eigenaar

Losse bevindingen uit het spelen en bekijken, vastgelegd om later op te pakken. B1, B3 en B4 zijn
gebouwd (zie "Afgehandeld"); B2, B5 en B6 staan nog open. Nieuwe bevindingen komen onderaan; een punt verhuist naar "Afgehandeld" met de datum
en de commit zodra het in het spel zit.

## Open

### 2026-11-22

| Nr | Bevinding (woorden van de eigenaar) | Raakt | Vraag of aandachtspunt |
|---|---|---|---|
| B5 | "Level voltooid"-pop-up simpeler | Einde-ronde pop-up (nu: sterren, aantal zetten, uitsplitsing van de munten in drie regels, saldo, drie knoppen) | Wat mag weg: de uitsplitsing per regel, het saldo, de knop Replay? |
| B6 | Betere animatie van verdiende munten naar de pot | Einde-ronde pop-up en muntenteller | Geen vraag. Hangt samen met B5. |

### Opgepakt op 2026-11-22

De eigenaar vroeg de bevindingen op te lossen. Ze zijn verdeeld over drie sessies, elk op een eigen
branch vanaf de werkbranch. Waar een vraag openstond is een voorlopige keuze gemaakt; die staat
hier, is in de data instelbaar en kan door de eigenaar worden omgedraaid.

| Nr | Sessie / branch | Voorlopige keuze |
|---|---|---|
| B1, B3, B4 | Puzzelscherm — `claude/turnflock-puzzle-screen` | B1: de hint laat op het bord zien welke robots draaien en waar elke robot heen stapt, naast de ring om de knop; de tekstregel wordt korter. B4: Undo kost 5 munten per keer (`coins.undoCost`), Restart blijft gratis, geen gratis Undo's (`coins.freeUndosPerLevel` 0), de prijs staat op de knop, en bij te weinig munten blijft Restart als gratis uitweg. |
| B2 | Levelselectie — `claude/turnflock-level-path` | Alleen het huidige level en de volgende vijf zijn te zien (`levelsAhead`); gehaalde levels verdwijnen. Opnieuw spelen van een gehaald level kan alleen nog via "Replay" direct na de winst. |
| B5, B6 | Pop-up — `claude/turnflock-win-popup` | B5: sterren, één regel met het resultaat, één bedrag aan verdiende munten en één hoofdknop; de uitsplitsing en het saldo vervallen, Replay en Levels worden kleine knoppen. B6: de munten vliegen van de pop-up naar de teller, die meetelt. |

### 2026-11-22, gevonden bij het sluiten van de sessies

De sessie van het instellingenscherm had als laatste stap de keuzes van de eigenaar in het ontwerp
verwerkt (commit `16f584d` op `claude/turnflock-part-settings` in de oude repo). Dat ontwerp is
nieuwer dan wat in het spel zit.

| Nr | Bevinding | Raakt | Opgepakt |
|---|---|---|---|
| B7 | Trillen en "grotere tekst" zijn door de eigenaar geschrapt, maar Trillen zit nog in het spel | Instellingenscherm, `src/haptics.ts`, opslag | Sessie instellingen — `claude/turnflock-settings-choices` |
| B8 | "Colour shapes" (een vorm per kleur, als hulp bij kleurenblindheid) is door de eigenaar gekozen, maar zit nog niet in het spel | Instellingenscherm, robots, commandoknoppen | Sessie instellingen — `claude/turnflock-settings-choices` |

## Afgehandeld

### 2026-11-22 — puzzelscherm (branch `claude/turnflock-puzzle-screen`)

| Nr | Bevinding (woorden van de eigenaar) | Wat er nu in het spel zit | Commit |
|---|---|---|---|
| B3 | Level en moves moeten tijdens het spel bij elkaar getoond worden | De bovenbalk is één rij: terug, één plaatje met LEVEL en MOVES naast elkaar, de muntenteller. "Robots thuis" hangt als klein lipje onder dat plaatje. De naam van het level staat niet meer in beeld (wel voor schermlezers). De Hint-knop staat nu onderaan naast Undo, Restart en Replay (Replay alleen nog als pictogram). | `d0e0d59` |
| B4 | Undo kost munten. "Hier kunnen we geld verdienen." | Undo kost 5 munten per stap (`coins.undoCost`), geen gratis Undo's (`coins.freeUndosPerLevel` 0). De prijs staat op de Undo-knop en op de Undo in de "Out of moves"-pop-up (zelfde prijs). Te weinig munten: de knop blijft tikbaar, de tik wordt geweigerd met "Undo costs 5 coins. Restart is free." en Restart krijgt een ring. Restart blijft gratis. De testlab-schakelaar "Free help" maakt ook Undo gratis. Er is geen winkel, geen reclame en geen aankoop toegevoegd. | `f80f856` |
| B1 | Hinttekst aanpassen / visualiseren | Een onthulde hint is een tekening op het bord: een kwartboog om elke robot die draait, een pijl van elke robot naar het vakje waar hij heen stapt, en een stootmarkering waar een robot wordt tegengehouden. De ring om de opdrachtknop blijft. De tekst is een paar woorden geworden. Prijs en twee stappen (eerst gratis status, dan betaalde zet) zijn ongewijzigd. | `48c8d1a` |

Keuzes die de eigenaar kan omdraaien, en de muntenberekening voor Undo, staan in het verslag van de
sessie. Bewijs (voor en na, op 320, 390 en 430 px): `production/qa/evidence/findings-puzzle-screen/`.

**Kanttekening bij B4.** Een speler verdient op level 1 tot 20 tussen 10 en 26 munten per level
(alleen de basis, of perfect), plus 30 om te beginnen: 230 tot 550 munten in totaal, en elk level
betaalt zijn beste beloning maar één keer. Bij 5 munten per Undo is dat 2 tot 5 Undo's per level
als de speler nergens anders munten aan uitgeeft. Voor een zwakkere speler is dat krap. Zolang er
geen manier is om munten te kopen levert de prijs geen geld op; hij maakt alleen het saldo schaarser.

### 2026-11-22 — levelselectie (branch `claude/turnflock-level-path`)

| Nr | Datum | Commit | Wat er nu in het spel zit |
|---|---|---|---|
| B2 | 2026-11-22 | `9aa96d3` (branch `claude/turnflock-level-path`, nog niet samengevoegd) | Het levelscherm toont alleen het huidige level (groot) en de volgende vijf als vergrendelde stappen op een slingerend pad (`levelsAhead`, `levelPath.layout`); gehaalde levels zijn niet meer te zien. Voortgang: "Level 12 of 40" met balk en het sterrentotaal. Alles gehaald: een rustige eindtoestand zonder hoofdknop (`levelPath.playAgainWhenComplete` zet "Play again from level 1" aan). Het oude raster bestaat alleen nog als testweergave (testlab: "Level screen: Grid" of "Unlock all levels"). **Gevolg:** een gehaald level opnieuw spelen kan alleen nog via "Replay" direct na de winst. Open voor de eigenaar: wil je een kleine weg terug (bijvoorbeeld "Played levels" in de instellingen), en wil je "opnieuw vanaf level 1" na het laatste level? Bewijs: `production/qa/evidence/findings-level-path/`. |
