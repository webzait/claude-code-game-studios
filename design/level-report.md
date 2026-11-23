# Levelrapport TURNFLOCK

> Gegenereerd door `npm run measure` uit `data/levels.json` en `design/levels-catalog.json`. Niet met de hand aanpassen:
> wijzig een level of de catalogus en draai het script opnieuw. Wat de kolommen betekenen staat onderaan;
> hoe de score is opgebouwd en geijkt staat in `design/level-structure.md`.

100 levels · zetbudget = kortste oplossing + 2 · alle getallen komen uit de solver-regels.

## Pagina 1 (level 1–20)

### Moeilijkheidscurve

```text
  1 ██··················  0.8  First Steps
  2 ████················  1.8  Quarter Turn
  3 ██████··············  3.1  Follow the Arrow
  4 ████················  2.1  Everyone Steps
  5 █████···············  2.7  Lean on It
  6 ██████··············  3.1  Two Minds
  7 ████████············  4.2  Side Door
  8 ████████············  3.8  Wait Your Turn
  9 ██████████··········  4.8  One Color Turns
 10 ████████············  4.0  Four Doors
 11 ██████████··········  4.8  Use the Wall
 12 █████████···········  4.3  Three of a Kind
 13 ██████████··········  4.9  Close Quarters
 14 ███████████·········  5.5  Long Way Round
 15 ██████████··········  4.8  After You
 16 █████████████·······  6.3  Queue Up
 17 ██████████··········  5.1  The Corridor
 18 █████████████·······  6.4  Traffic Jam
 19 ███████·············  3.6  Staircase
 20 ████████████████····  7.9  One Command, Many Consequences
```

### Getallen

| # | Level | Bord | Robots | Kleuren | Tegels | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |
|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|
| 1 | First Steps | 4×4 | 2 | 1 | 0 | 3 | 1 | 0 | 13 | 36 | 92% | 50% | 3/3 (3) | 0 | 0 | 100% | **0.8** |
| 2 | Quarter Turn | 4×4 | 1 | 1 | 0 | 6 | 1 | 1 | 32 | 37 | 84% | 42% | 6/6 (5) | 0 | 0 | 17% | **1.8** |
| 3 | Follow the Arrow | 5×4 | 3 | 1 | 0 | 7 | 1 | 1 | 112 | 208 | 97% | 43% | 7/7 (6) | 0 | 2 | 14% | **3.1** |
| 4 | Everyone Steps | 4×4 | 2 | 2 | 0 | 3 | 1 | 1 | 32 | 106 | 93% | 55% | 3/3 (2) | 0 | 0 | 33% | **2.1** |
| 5 | Lean on It | 5×5 | 2 | 1 | 0 | 6 | 1 | 1 | 62 | 123 | 95% | 50% | 6/6 (6) | 0 | 1 | 17% | **2.7** |
| 6 | Two Minds | 5×5 | 4 | 1 | 0 | 6 | 1 | 2 | 66 | 157 | 93% | 41% | 6/6 (4) | 1 | 0 | 7% | **3.1** |
| 7 | Side Door | 6×6 | 3 | 2 | 0 | 6 | 1 | 3 | 710 | 3377 | 100% | 60% | 6/6 (4) | 0 | 0 | 2% | **4.2** |
| 8 | Wait Your Turn | 5×4 | 4 | 2 | 0 | 5 | 1 | 1 | 210 | 839 | 99% | 57% | 5/5 (4) | 0 | 2 | 20% | **3.8** |
| 9 | One Color Turns | 5×5 | 4 | 2 | 0 | 7 | 1 | 3 | 1676 | 7479 | 100% | 58% | 7/7 (4) | 0 | 1 | 1% | **4.8** |
| 10 | Four Doors | 5×5 | 4 | 2 | 0 | 5 | 1 | 3 | 207 | 1042 | 98% | 50% | 5/5 (2) | 1 | 0 | 3% | **4.0** |
| 11 | Use the Wall | 6×5 | 4 | 2 | 0 | 8 | 2 | 3 | 2702 | 9221 | 100% | 52% | 7/8 (4) | 0 | 2 | 1% | **4.8** |
| 12 | Three of a Kind | 5×5 | 4 | 3 | 0 | 6 | 1 | 3 | 1585 | 9102 | 100% | 46% | 6/6 (2) | 0 | 0 | 1% | **4.3** |
| 13 | Close Quarters | 4×4 | 4 | 2 | 0 | 6 | 1 | 3 | 456 | 1432 | 98% | 46% | 6/6 (3) | 2 | 2 | 2% | **4.9** |
| 14 | Long Way Round | 6×5 | 4 | 2 | 0 | 10 | 4 | 4 | 14698 | 42600 | 100% | 55% | 8/10 (3) | 1 | 1 | 0% | **5.5** |
| 15 | After You | 5×5 | 4 | 2 | 0 | 7 | 2 | 4 | 741 | 2845 | 99% | 44% | 6/7 (2) | 0 | 3 | 1% | **4.8** |
| 16 | Queue Up | 6×6 | 5 | 3 | 0 | 8 | 1 | 3 | 38434 | 242055 | 100% | 64% | 8/8 (2) | 0 | 3 | 0% | **6.3** |
| 17 | The Corridor | 4×7 | 4 | 2 | 0 | 8 | 1 | 3 | 2191 | 7431 | 99% | 52% | 8/8 (3) | 2 | 1 | 1% | **5.1** |
| 18 | Traffic Jam | 6×6 | 6 | 3 | 0 | 8 | 1 | 3 | 36934 | 241623 | 100% | 68% | 8/8 (5) | 0 | 3 | 0% | **6.4** |
| 19 | Staircase | 6×5 | 4 | 1 | 0 | 8 | 1 | 1 | 267 | 542 | 99% | 44% | 8/8 (7) | 0 | 3 | 13% | **3.6** |
| 20 | One Command, Many Consequences | 6×6 | 12 | 3 | 0 | 10 | 1 | 5 | 282558 | 2360898 | 100% | 58% | 10/10 (6) | 2 | 3 | 0% | **7.9** |

### Idee per level

| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |
|--:|---|---|---|---|---|
| 1 | First Steps (`first-steps`) | VOORUIT zet iedereen één stap | Alleen VOORUIT: twee robots lopen van twee kanten de uitgang in. | met de hand gemaakt | zoekruimte 0.15 · robots 0.28 · onvergeeflijk 0.4 |
| 2 | Quarter Turn (`quarter-turn`) | Een kleur draait een kwartslag met de klok mee en stapt dan | Eén robot loopt tot de rand en heeft dan precies één keer ROOD nodig. | met de hand gemaakt | zoekruimte 0.44 · draaien 0.25 · smal 0.83 · onvergeeflijk 0.23 |
| 3 | Follow the Arrow (`follow-the-arrow`) | Wie tegen de rand loopt, wacht: achterblijvers halen in | Drie robots lopen omhoog en wachten bij de rand tot één keer ROOD ze samen naar de uitgang stuurt. | met de hand gemaakt (bestaand level) | zoekruimte 0.83 · draaien 0.25 · robots 0.44 · smal 0.86 · onvergeeflijk 0.26 · tegendraads 0.43 |
| 4 | Everyone Steps (`everyone-steps`) | Alleen de gekozen kleur draait, maar iedereen stapt | BLAUW draait alleen blauw, maar rood stapt in dezelfde zet mee. | met de hand gemaakt | zoekruimte 0.44 · draaien 0.25 · robots 0.28 · smal 0.67 · onvergeeflijk 0.49 |
| 5 | Lean on It (`lean-on-it`) | Een muur of rand zet een robot stil terwijl de rest doorloopt | Een muurtje houdt de voorste robot tegen tot de achterste op dezelfde rij staat. | met de hand gemaakt | zoekruimte 0.65 · draaien 0.25 · robots 0.28 · smal 0.83 · onvergeeflijk 0.4 · tegendraads 0.25 |
| 6 | Two Minds (`two-minds`) | Eén kleur, verschillende richtingen | Vier rode robots met twee richtingen: elke ROOD stuurt de ene groep goed en de andere eerst om. | gegenereerd, ongewijzigd gekozen | zoekruimte 0.67 · draaien 0.5 · robots 0.56 · smal 0.93 · onvergeeflijk 0.22 · tegendraads 0.25 |
| 7 | Side Door (`side-door`) | De uitgang in via verschillende kanten | De uitgang zit halverwege de rand; rood en blauw komen er van verschillende kanten in. | met de hand gemaakt (bestaand level) | zoekruimte 1.42 · draaien 0.75 · robots 0.44 · smal 0.98 · onvergeeflijk 0.61 |
| 8 | Wait Your Turn (`wait-your-turn`) | In de rij: wachten op de robot voor je | De blauwe robot kan pas weg als de rode voor hem is gedraaid en doorloopt. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.03 · draaien 0.25 · robots 0.56 · smal 0.8 · onvergeeflijk 0.54 · tegendraads 0.6 |
| 9 | One Color Turns (`one-color-turns`) | Alleen de gekozen kleur draait, maar iedereen stapt | Twee kleuren om beurten draaien terwijl de andere kleur gewoon doorloopt. | met de hand gemaakt (bestaand level) | zoekruimte 1.69 · draaien 0.75 · robots 0.56 · smal 0.99 · onvergeeflijk 0.55 · tegendraads 0.21 |
| 10 | Four Doors (`four-doors`) | De uitgang in via verschillende kanten | De uitgang ligt in het bord en wordt van alle vier de kanten binnengelopen. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.03 · draaien 0.75 · robots 0.56 · smal 0.97 · onvergeeflijk 0.4 · tegendraads 0.3 |
| 11 | Use the Wall (`use-the-wall`) | Een muur of rand zet een robot stil terwijl de rest doorloopt | Twee muren houden robots vast tot hun kleur aan de beurt is. | met de hand gemaakt (bestaand level) | zoekruimte 1.84 · draaien 0.75 · robots 0.56 · smal 0.86 · onvergeeflijk 0.45 · tegendraads 0.38 |
| 12 | Three of a Kind (`three-of-a-kind`) | Drie kleuren uit elkaar houden | Drie kleuren, elk één keer draaien, in de juiste volgorde. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.67 · draaien 0.75 · robots 0.56 · smal 0.99 · onvergeeflijk 0.32 |
| 13 | Close Quarters (`close-quarters`) | Klein bord: geen ruimte om om elkaar heen te lopen | Vier robots op 4×4: elke draai van de één duwt de ander een vakje op. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.28 · draaien 0.75 · robots 0.56 · smal 0.98 · onvergeeflijk 0.32 · tegendraads 1 |
| 14 | Long Way Round (`long-way-round`) | Alleen rechtsom: links is drie keer rechts, en je loopt terwijl je draait | Een robot moet eerst van de uitgang weg om rechtsom te kunnen aankomen. | met de hand gemaakt (bestaand level) | zoekruimte 2.37 · draaien 1 · robots 0.56 · smal 0.8 · onvergeeflijk 0.51 · tegendraads 0.3 |
| 15 | After You (`after-you`) | Twee robots die hetzelfde vakje willen, blijven allebei staan | Twee robots willen hetzelfde vakje en blijven staan; dat uitstel is precies wat nodig is. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.43 · draaien 1 · robots 0.56 · smal 0.85 · onvergeeflijk 0.28 · tegendraads 0.64 |
| 16 | Queue Up (`queue-up`) | In de rij: wachten op de robot voor je | Drie kleuren in een rij die elk op het juiste moment afslaan. | met de hand gemaakt (bestaand level) | zoekruimte 2.68 · draaien 0.75 · robots 0.65 · smal 1 · onvergeeflijk 0.67 · tegendraads 0.56 |
| 17 | The Corridor (`the-corridor`) | Andere bordvormen: lang, breed, smal | Een lang bord van 4×7: eerst samen lopen, dan kort na elkaar afslaan. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.77 · draaien 0.75 · robots 0.56 · smal 0.99 · onvergeeflijk 0.45 · tegendraads 0.56 |
| 18 | Traffic Jam (`traffic-jam`) | In de rij: wachten op de robot voor je | Zes robots in twee rijen die op elkaar wachten bij de muren. | met de hand gemaakt (bestaand level) | zoekruimte 2.66 · draaien 0.75 · robots 0.72 · smal 1 · onvergeeflijk 0.75 · tegendraads 0.56 |
| 19 | Staircase (`staircase`) | Wie tegen de rand loopt, wacht: achterblijvers halen in | Adempauze: vier robots op een diagonaal lopen omhoog, wachten bij de rand en gaan na één ROOD in een rij naar binnen. | met de hand gemaakt | zoekruimte 1.11 · draaien 0.25 · robots 0.56 · smal 0.88 · onvergeeflijk 0.28 · tegendraads 0.56 |
| 20 | One Command, Many Consequences (`one-command-many-consequences`) | Veel robots: één commando, veel gevolgen | Pronkstuk van pagina 1: twaalf robots in drie kleuren, één kortste oplossing. | met de hand gemaakt (bestaand level) | zoekruimte 3.3 · draaien 1.25 · robots 1 · smal 1 · onvergeeflijk 0.56 · tegendraads 0.75 |

## Pagina 2 (level 21–40)

### Moeilijkheidscurve

```text
 21 █████████···········  4.4  Easy Does It
 22 █████████···········  4.6  Parking Spot
 23 ██████████··········  4.8  All Together Now
 24 ██████████··········  5.0  Wide Open
 25 ██████████··········  5.0  Centre Stage
 26 ███████████·········  5.7  Peel Off
 27 ██████████··········  5.1  Three Rights
 28 ████████████········  5.9  Elbow Room
 29 ███████████·········  5.6  The Long Hall
 30 █████████████·······  6.6  Gridlock
 31 ████████████········  5.8  Tight Squeeze
 32 ██████████████······  7.0  Two Lanes
 33 ███████████·········  5.7  Back of the Line
 34 ████████████········  6.2  Full House
 35 ██████████████······  7.0  Roundabout
 36 ███████████████·····  7.4  Colour Guard
 37 ████████████········  5.9  Single File
 38 ███████████████·····  7.6  Patience
 39 ██████████··········  4.8  Detour
 40 ███████████████·····  7.4  Grand Parade
```

### Getallen

| # | Level | Bord | Robots | Kleuren | Tegels | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |
|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|
| 21 | Easy Does It | 6×5 | 3 | 3 | 0 | 6 | 1 | 2 | 2965 | 18263 | 100% | 60% | 6/6 (4) | 0 | 0 | 3% | **4.4** |
| 22 | Parking Spot | 5×5 | 4 | 2 | 0 | 7 | 1 | 2 | 1105 | 5037 | 100% | 52% | 7/7 (3) | 1 | 2 | 5% | **4.6** |
| 23 | All Together Now | 6×5 | 6 | 2 | 0 | 7 | 1 | 3 | 915 | 5310 | 100% | 41% | 7/7 (4) | 1 | 2 | 3% | **4.8** |
| 24 | Wide Open | 7×5 | 4 | 2 | 0 | 7 | 1 | 3 | 2204 | 12073 | 100% | 52% | 7/7 (4) | 1 | 1 | 1% | **5.0** |
| 25 | Centre Stage | 5×5 | 5 | 2 | 0 | 7 | 1 | 3 | 1509 | 7648 | 100% | 56% | 7/7 (5) | 1 | 1 | 1% | **5.0** |
| 26 | Peel Off | 5×5 | 5 | 3 | 0 | 7 | 1 | 3 | 6560 | 43804 | 100% | 56% | 7/7 (3) | 0 | 3 | 1% | **5.7** |
| 27 | Three Rights | 6×5 | 3 | 2 | 0 | 10 | 1 | 3 | 5044 | 15569 | 100% | 53% | 10/10 (6) | 3 | 0 | 1% | **5.1** |
| 28 | Elbow Room | 4×4 | 5 | 3 | 0 | 8 | 1 | 3 | 11530 | 53129 | 100% | 53% | 8/8 (6) | 1 | 3 | 1% | **5.9** |
| 29 | The Long Hall | 8×4 | 6 | 2 | 0 | 8 | 1 | 3 | 5141 | 29056 | 100% | 56% | 8/8 (5) | 2 | 1 | 1% | **5.6** |
| 30 | Gridlock | 6×5 | 6 | 2 | 0 | 9 | 2 | 4 | 13916 | 68959 | 100% | 56% | 8/9 (5) | 2 | 5 | 0% | **6.6** |
| 31 | Tight Squeeze | 5×4 | 5 | 2 | 0 | 10 | 1 | 4 | 6555 | 17393 | 100% | 52% | 10/10 (5) | 3 | 1 | 0% | **5.8** |
| 32 | Two Lanes | 6×5 | 6 | 2 | 0 | 11 | 4 | 6 | 56289 | 236405 | 100% | 56% | 9/11 (2) | 1 | 4 | 0% | **7.0** |
| 33 | Back of the Line | 6×5 | 6 | 2 | 0 | 9 | 1 | 3 | 14214 | 73444 | 100% | 49% | 9/9 (5) | 1 | 2 | 1% | **5.7** |
| 34 | Full House | 6×6 | 8 | 2 | 0 | 8 | 1 | 3 | 4123 | 22551 | 100% | 56% | 8/8 (4) | 2 | 4 | 1% | **6.2** |
| 35 | Roundabout | 7×7 | 7 | 3 | 0 | 9 | 1 | 4 | 46445 | 401260 | 100% | 55% | 9/9 (5) | 3 | 3 | 1% | **7.0** |
| 36 | Colour Guard | 6×6 | 6 | 3 | 0 | 9 | 1 | 4 | 106149 | 763048 | 100% | 63% | 9/9 (5) | 3 | 3 | 0% | **7.4** |
| 37 | Single File | 6×6 | 6 | 3 | 0 | 8 | 1 | 2 | 27296 | 228418 | 100% | 61% | 8/8 (2) | 0 | 3 | 2% | **5.9** |
| 38 | Patience | 6×6 | 5 | 2 | 0 | 12 | 1 | 6 | 96437 | 346159 | 100% | 55% | 12/12 (5) | 3 | 5 | 0% | **7.6** |
| 39 | Detour | 5×5 | 4 | 2 | 0 | 8 | 1 | 2 | 3715 | 16398 | 100% | 51% | 8/8 (4) | 2 | 0 | 4% | **4.8** |
| 40 | Grand Parade | 8×8 | 10 | 3 | 0 | 10 | 1 | 3 | 533142 ⚠ | 3000003 | 100% | 62% | 10/10 (6) | 1 | 3 | 0% | **7.4** |

### Idee per level

| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |
|--:|---|---|---|---|---|
| 21 | Easy Does It (`easy-does-it`) | Drie kleuren uit elkaar houden | Drie kleuren op een ruim bord, met maar twee draaien: geel hoeft alleen te lopen. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.87 · draaien 0.5 · robots 0.44 · smal 0.97 · onvergeeflijk 0.6 |
| 22 | Parking Spot (`parking-spot`) | Een muur of rand zet een robot stil terwijl de rest doorloopt | Een muur houdt één rode robot een zet tegen, zodat de twee rode later netjes achter elkaar de bovenste rij op komen. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.56 · draaien 0.5 · robots 0.56 · smal 0.95 · onvergeeflijk 0.43 · tegendraads 0.64 |
| 23 | All Together Now (`all-together-now`) | Meerdere robots tegelijk de uitgang in | De eerste zet brengt drie blauwe robots tegelijk de uitgang in, van drie kanten; de drie rode moeten daarna nog de lange weg. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.5 · draaien 0.75 · robots 0.72 · smal 0.97 · onvergeeflijk 0.21 · tegendraads 0.64 |
| 24 | Wide Open (`wide-open`) | Andere bordvormen: lang, breed, smal | Een breed bord van 7×5: lange looplijnen en drie draaien op het goede moment. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.77 · draaien 0.75 · robots 0.56 · smal 0.99 · onvergeeflijk 0.45 · tegendraads 0.43 |
| 25 | Centre Stage (`centre-stage`) | De uitgang in via verschillende kanten | Uitgang midden in het bord; vijf robots komen van drie kanten. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.65 · draaien 0.75 · robots 0.65 · smal 0.99 · onvergeeflijk 0.51 · tegendraads 0.43 |
| 26 | Peel Off (`peel-off`) | Drie kleuren uit elkaar houden | Iedereen loopt samen omhoog, daarna slaat elke kleur om de beurt af. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.12 · draaien 0.75 · robots 0.65 · smal 0.99 · onvergeeflijk 0.53 · tegendraads 0.64 |
| 27 | Three Rights (`three-rights`) | Alleen rechtsom: links is drie keer rechts, en je loopt terwijl je draait | Twee keer ROOD kort na elkaar en later nog een keer: rood loopt een lus om goed aan te komen. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.03 · draaien 0.75 · robots 0.44 · smal 0.99 · onvergeeflijk 0.46 · tegendraads 0.45 |
| 28 | Elbow Room (`elbow-room`) | Klein bord: geen ruimte om om elkaar heen te lopen | Vijf robots in drie kleuren op 4×4, met één muur naast de uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.3 · draaien 0.75 · robots 0.65 · smal 0.99 · onvergeeflijk 0.45 · tegendraads 0.75 |
| 29 | The Long Hall (`the-long-hall`) | Andere bordvormen: lang, breed, smal | Een lage gang van 8×4: twee blauwe robots wachten boven tegen de rand tot hun kleur aan de beurt is. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.04 · draaien 0.75 · robots 0.72 · smal 0.99 · onvergeeflijk 0.53 · tegendraads 0.56 |
| 30 | Gridlock (`gridlock`) | Twee robots die hetzelfde vakje willen, blijven allebei staan | Rijen én botsingen: robots houden elkaar tegen, en twee die hetzelfde vakje willen wachten allebei. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.35 · draaien 1 · robots 0.72 · smal 0.89 · onvergeeflijk 0.51 · tegendraads 1.17 |
| 31 | Tight Squeeze (`tight-squeeze`) | Klein bord: geen ruimte om om elkaar heen te lopen | Vijf robots op 5×4 langs de linkerrand; blauw draait drie keer, steeds op een ander moment. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.12 · draaien 1 · robots 0.65 · smal 1 · onvergeeflijk 0.44 · tegendraads 0.6 |
| 32 | Two Lanes (`two-lanes`) | In de rij: wachten op de robot voor je | Twee rijen naast elkaar; rood draait een heel rondje om uit de pas te raken. | met de hand gemaakt (bestaand level) | zoekruimte 2.8 · draaien 1.5 · robots 0.72 · smal 0.82 · onvergeeflijk 0.53 · tegendraads 0.68 |
| 33 | Back of the Line (`back-of-the-line`) | Eén kleur, verschillende richtingen | Vier rode robots lopen als één rij; de twee blauwe moeten er op het juiste moment tussen. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.36 · draaien 0.75 · robots 0.72 · smal 0.99 · onvergeeflijk 0.39 · tegendraads 0.5 |
| 34 | Full House (`full-house`) | Veel robots: één commando, veel gevolgen | Acht robots dicht bij de uitgang: wie eerst gaat, bepaalt of de rest erlangs kan. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.97 · draaien 0.75 · robots 0.84 · smal 0.99 · onvergeeflijk 0.52 · tegendraads 1.13 |
| 35 | Roundabout (`roundabout`) | De uitgang in via verschillende kanten | Het 7×7-bord met de uitgang binnenin: zeven robots komen van alle vier de kanten. | gegenereerd en opgeschoond | zoekruimte 2.74 · draaien 1 · robots 0.78 · smal 0.99 · onvergeeflijk 0.5 · tegendraads 1 |
| 36 | Colour Guard (`colour-guard`) | Drie kleuren uit elkaar houden | Zes robots in drie kleuren, vier draaien achter elkaar in vaste volgorde. | gegenereerd, ongewijzigd gekozen | zoekruimte 3 · draaien 1 · robots 0.72 · smal 1 · onvergeeflijk 0.67 · tegendraads 1 |
| 37 | Single File (`single-file`) | In de rij: wachten op de robot voor je | Vijf zetten samen lopen en wachten in de rij, dan pas twee draaien. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.57 · draaien 0.5 · robots 0.72 · smal 0.98 · onvergeeflijk 0.61 · tegendraads 0.56 |
| 38 | Patience (`patience`) | Een muur of rand zet een robot stil terwijl de rest doorloopt | Piek van pagina 2: twaalf zetten, één kortste oplossing, veel bewust botsen en weglopen. | met de hand gemaakt (bestaand level) | zoekruimte 2.97 · draaien 1.5 · robots 0.65 · smal 1 · onvergeeflijk 0.49 · tegendraads 1 |
| 39 | Detour (`detour`) | Alleen rechtsom: links is drie keer rechts, en je loopt terwijl je draait | Adempauze: vier robots, twee keer ROOD, en blauw hoeft alleen te lopen. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.94 · draaien 0.5 · robots 0.56 · smal 0.96 · onvergeeflijk 0.42 · tegendraads 0.38 |
| 40 | Grand Parade (`grand-parade`) | Het grootste bord (8×8) | Pronkstuk van pagina 2: tien robots op een leeg 8×8-bord lopen in optocht naar de hoek. | gegenereerd en opgeschoond | zoekruimte 3.5 · draaien 0.75 · robots 0.93 · smal 1 · onvergeeflijk 0.63 · tegendraads 0.6 |

## Pagina 3 (level 41–60)

### Moeilijkheidscurve

```text
 41 █···················  0.7  Turntable
 42 █████···············  2.3  Corner Piece
 43 ██████··············  3.1  Two for One
 44 ████████············  4.1  Mind the Tile
 45 ███████·············  3.7  Bank Shot
 46 ██████████··········  5.2  Merge Lane
 47 ██████████··········  5.2  Standoff
 48 ██████████··········  5.1  Switchback
 49 ████████████········  6.0  Three Way
 50 ██████████████······  6.8  Open Floor
 51 ███████████·········  5.5  Carousel
 52 ███████████·········  5.6  Spiral In
 53 ██████████████······  7.0  Long Table
 54 ████████████········  5.8  Pinball
 55 ██████████████······  7.0  Crowded Corner
 56 ███████████████·····  7.4  Tricolour
 57 ██████████████······  6.9  Cliff Walk
 58 █████████████████···  8.5  Whirl
 59 ███████·············  3.6  Conga Line
 60 █████████████·······  6.7  Grand Finale
```

### Getallen

| # | Level | Bord | Robots | Kleuren | Tegels | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |
|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|
| 41 | Turntable | 4×4 | 1 | 1 | 1 | 5 | 1 | 0 | 23 | 28 | 82% | 50% | 5/5 (5) | 0 | 0 | 100% | **0.7** |
| 42 | Corner Piece | 5×4 | 2 | 1 | 1 | 5 | 1 | 1 | 51 | 124 | 96% | 50% | 5/5 (5) | 0 | 0 | 20% | **2.3** |
| 43 | Two for One | 5×5 | 3 | 2 | 1 | 5 | 1 | 1 | 224 | 1055 | 100% | 57% | 5/5 (4) | 0 | 0 | 20% | **3.1** |
| 44 | Mind the Tile | 5×5 | 3 | 2 | 1 | 6 | 1 | 2 | 531 | 2375 | 99% | 49% | 6/6 (2) | 0 | 2 | 3% | **4.1** |
| 45 | Bank Shot | 5×5 | 3 | 2 | 1 | 6 | 1 | 1 | 355 | 1734 | 99% | 55% | 6/6 (5) | 1 | 1 | 17% | **3.7** |
| 46 | Merge Lane | 6×5 | 5 | 2 | 1 | 7 | 1 | 2 | 1071 | 5977 | 100% | 52% | 7/7 (4) | 2 | 3 | 2% | **5.2** |
| 47 | Standoff | 5×5 | 3 | 2 | 1 | 8 | 1 | 4 | 1725 | 5492 | 100% | 47% | 8/8 (5) | 2 | 2 | 1% | **5.2** |
| 48 | Switchback | 4×7 | 4 | 2 | 2 | 8 | 1 | 2 | 3535 | 17545 | 100% | 50% | 8/8 (4) | 3 | 1 | 4% | **5.1** |
| 49 | Three Way | 6×5 | 5 | 3 | 1 | 7 | 1 | 3 | 7323 | 45728 | 100% | 62% | 7/7 (4) | 1 | 3 | 1% | **6.0** |
| 50 | Open Floor | 7×7 | 7 | 2 | 0 | 10 | 1 | 3 | 42188 | 259953 | 100% | 58% | 10/10 (5) | 3 | 4 | 0% | **6.8** |
| 51 | Carousel | 6×5 | 5 | 2 | 2 | 9 | 1 | 2 | 9558 | 47216 | 100% | 55% | 9/9 (6) | 3 | 1 | 3% | **5.5** |
| 52 | Spiral In | 6×6 | 5 | 2 | 1 | 8 | 1 | 2 | 4919 | 25856 | 100% | 56% | 8/8 (4) | 2 | 3 | 4% | **5.6** |
| 53 | Long Table | 8×6 | 7 | 3 | 0 | 9 | 1 | 4 | 153262 | 1588467 | 100% | 63% | 9/9 (3) | 0 | 3 | 0% | **7.0** |
| 54 | Pinball | 4×4 | 4 | 2 | 1 | 8 | 1 | 4 | 2475 | 8094 | 99% | 55% | 8/8 (4) | 2 | 3 | 0% | **5.8** |
| 55 | Crowded Corner | 6×6 | 8 | 2 | 2 | 10 | 1 | 4 | 42166 | 301661 | 100% | 58% | 10/10 (6) | 4 | 2 | 0% | **7.0** |
| 56 | Tricolour | 6×6 | 6 | 3 | 2 | 9 | 1 | 5 | 64197 | 398982 | 100% | 59% | 9/9 (4) | 2 | 4 | 0% | **7.4** |
| 57 | Cliff Walk | 8×8 | 7 | 3 | 1 | 10 | 1 | 3 | 308432 | 2886525 | 100% | 60% | 10/10 (8) | 2 | 1 | 0% | **6.9** |
| 58 | Whirl | 7×7 | 8 | 3 | 2 | 9 | 1 | 6 | 197608 | 2136483 | 100% | 64% | 9/9 (3) | 3 | 5 | 0% | **8.5** |
| 59 | Conga Line | 6×5 | 6 | 1 | 1 | 7 | 1 | 1 | 187 | 588 | 99% | 50% | 7/7 (7) | 1 | 1 | 14% | **3.6** |
| 60 | Grand Finale | 8×8 | 10 | 3 | 1 | 9 | 1 | 3 | 236345 ⚠ | 3000002 | 100% | 62% | 9/9 (6) | 1 | 0 | 0% | **6.7** |

### Idee per level

| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |
|--:|---|---|---|---|---|
| 41 | Turntable (`turntable`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Alleen VOORUIT: de tegel draait de robot naar de uitgang, zonder kleurknop. | met de hand gemaakt | zoekruimte 0.33 · onvergeeflijk 0.4 |
| 42 | Corner Piece (`corner-piece`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Eén keer ROOD stuurt beide robots omlaag; de tegel in de onderste rij draait er één naar de uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 0.58 · draaien 0.25 · robots 0.28 · smal 0.8 · onvergeeflijk 0.4 |
| 43 | Two for One (`two-for-one`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Twee rode robots lopen na elkaar over dezelfde tegel en worden allebei gedraaid; blauw heeft zijn eigen knop nodig. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.05 · draaien 0.25 · robots 0.44 · smal 0.8 · onvergeeflijk 0.54 |
| 44 | Mind the Tile (`mind-the-tile`) | Een draaitegel in de weg: wie erop stapt, loopt verkeerd | De tegel ligt vlak bij de uitgang, maar de oplossing raakt hem niet aan. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.32 · draaien 0.5 · robots 0.44 · smal 0.97 · onvergeeflijk 0.38 · tegendraads 0.5 |
| 45 | Bank Shot (`bank-shot`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Tegel en muur samen: twee robots worden door de tegel gedraaid, en een muur houdt er één even tegen. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.2 · draaien 0.25 · robots 0.44 · smal 0.83 · onvergeeflijk 0.51 · tegendraads 0.5 |
| 46 | Merge Lane (`merge-lane`) | In de rij: wachten op de robot voor je | Vijf robots in de rij bij de uitgang; één wordt onderweg door de tegel gedraaid. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.55 · draaien 0.5 · robots 0.65 · smal 0.98 · onvergeeflijk 0.44 · tegendraads 1.07 |
| 47 | Standoff (`standoff`) | Twee robots die hetzelfde vakje willen, blijven allebei staan | Twee blauwe robots willen hetzelfde vakje en wachten; de tegel aan de linkerrand brengt er één terug in de goede richting. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.7 · draaien 1 · robots 0.44 · smal 0.99 · onvergeeflijk 0.33 · tegendraads 0.75 |
| 48 | Switchback (`switchback`) | Andere bordvormen: lang, breed, smal | Het lange 4×7-bord met twee tegels: blauw wordt twee keer door het bord gedraaid. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.92 · draaien 0.5 · robots 0.56 · smal 0.96 · onvergeeflijk 0.4 · tegendraads 0.75 |
| 49 | Three Way (`three-way`) | Drie kleuren uit elkaar houden | Samen omhoog lopen, dan elke kleur één keer; één robot neemt de tegel. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.15 · draaien 0.75 · robots 0.65 · smal 0.99 · onvergeeflijk 0.64 · tegendraads 0.86 |
| 50 | Open Floor (`open-floor`) | Veel robots: één commando, veel gevolgen | Zonder tegel: zeven robots op een leeg 7×7-bord, met twee robots die tegenover elkaar staan en niet kunnen ruilen. | gegenereerd en opgeschoond | zoekruimte 2.7 · draaien 0.75 · robots 0.78 · smal 1 · onvergeeflijk 0.55 · tegendraads 1.05 |
| 51 | Carousel (`carousel`) | Eén kleur, verschillende richtingen | Vier rode robots en twee tegels onder elkaar: het bord draait zes keer, de speler maar twee keer. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.24 · draaien 0.5 · robots 0.65 · smal 0.97 · onvergeeflijk 0.51 · tegendraads 0.67 |
| 52 | Spiral In (`spiral-in`) | De uitgang in via verschillende kanten | Uitgang in het bord, van vier kanten binnen; de tegel stuurt twee robots de hoek om. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.03 · draaien 0.5 · robots 0.65 · smal 0.96 · onvergeeflijk 0.53 · tegendraads 0.94 |
| 53 | Long Table (`long-table`) | Andere bordvormen: lang, breed, smal | Zonder tegel: het brede 8×6-bord met zeven robots in drie kleuren; vier draaien vroeg, daarna lopen. | gegenereerd en opgeschoond | zoekruimte 3.11 · draaien 1 · robots 0.78 · smal 1 · onvergeeflijk 0.66 · tegendraads 0.5 |
| 54 | Pinball (`pinball`) | Klein bord: geen ruimte om om elkaar heen te lopen | Vier robots en één tegel op 4×4; blauw draait drie keer. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.81 · draaien 1 · robots 0.56 · smal 1 · onvergeeflijk 0.51 · tegendraads 0.94 |
| 55 | Crowded Corner (`crowded-corner`) | Veel robots: één commando, veel gevolgen | Acht robots in de hoek bij de uitgang en twee tegels die samen vier keer een robot draaien. | gegenereerd en opgeschoond | zoekruimte 2.7 · draaien 1 · robots 0.84 · smal 1 · onvergeeflijk 0.55 · tegendraads 0.9 |
| 56 | Tricolour (`tricolour`) | Drie kleuren uit elkaar houden | Zes robots in drie kleuren en twee tegels; geel draait vier keer. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.84 · draaien 1.25 · robots 0.72 · smal 1 · onvergeeflijk 0.57 · tegendraads 1 |
| 57 | Cliff Walk (`cliff-walk`) | Het grootste bord (8×8) | Het 8×8-bord: zeven robots langs de rechterrand, en één tegel naast de uitgang. | gegenereerd en opgeschoond | zoekruimte 3.33 · draaien 0.75 · robots 0.78 · smal 1 · onvergeeflijk 0.6 · tegendraads 0.45 |
| 58 | Whirl (`whirl`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Piek van pagina 3: acht robots op 7×7, twee tegels en zes draaien. | gegenereerd en opgeschoond | zoekruimte 3.19 · draaien 1.5 · robots 0.84 · smal 1 · onvergeeflijk 0.69 · tegendraads 1.33 |
| 59 | Conga Line (`conga-line`) | Wie tegen de rand loopt, wacht: achterblijvers halen in | Adempauze: zes rode robots, één keer ROOD, en de tegel in de hoek draait er drie naar de uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 0.99 · draaien 0.25 · robots 0.72 · smal 0.86 · onvergeeflijk 0.4 · tegendraads 0.43 |
| 60 | Grand Finale (`grand-finale`) | Het grootste bord (8×8) | Pronkstuk van pagina 3: tien robots in drie kleuren op een leeg 8×8-bord; de ene tegel in de onderste rij draait er vier. | gegenereerd en opgeschoond | zoekruimte 3.25 · draaien 0.75 · robots 0.93 · smal 1 · onvergeeflijk 0.63 · tegendraads 0.17 |

## Pagina 4 (level 61–80)

### Moeilijkheidscurve

```text
 61 ███·················  1.5  Own Door
 62 ██████··············  3.2  Just Passing
 63 █████████···········  4.5  Swap Sides
 64 █████████···········  4.6  Doorstop
 65 ██████████··········  4.8  Three Doors
 66 ██████████··········  4.9  Ricochet
 67 ██████████··········  4.9  Side by Side
 68 ███████████·········  5.7  Top and Bottom
 69 ██████████··········  4.9  After the Red
 70 ███████████·········  5.4  Stacked Doors
 71 █████████████·······  6.3  Twin Gates
 72 ███████████·········  5.4  Four Corners
 73 █████████████·······  6.6  Colour Sort
 74 ██████████··········  4.9  Half and Half
 75 ██████████████······  7.0  Three Lanes
 76 ██████████████······  6.8  Wide Sort
 77 ██████████████······  7.0  Sorting Office
 78 ██████████████······  7.1  Long Sort
 79 █████████···········  4.6  Home Stretch
 80 ███████████████·····  7.4  Grand Sort
```

### Getallen

| # | Level | Bord | Robots | Kleuren | Tegels | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |
|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|
| 61 | Own Door | 4×4 | 2 | 2 | 0 | 3 | 1 | 0 | 36 | 119 | 98% | 67% | 3/3 (3) | 0 | 0 | 100% | **1.5** |
| 62 | Just Passing | 5×4 | 3 | 2 | 0 | 5 | 1 | 2 | 186 | 714 | 99% | 48% | 5/5 (3) | 0 | 0 | 10% | **3.2** |
| 63 | Swap Sides | 4×3 | 2 | 2 | 0 | 7 | 2 | 5 | 285 | 412 | 86% | 48% | 6/7 (2) | 0 | 3 | 2% | **4.5** |
| 64 | Doorstop | 5×5 | 4 | 2 | 0 | 7 | 1 | 2 | 1260 | 5574 | 100% | 58% | 7/7 (3) | 0 | 2 | 5% | **4.6** |
| 65 | Three Doors | 5×5 | 3 | 3 | 0 | 6 | 1 | 3 | 2585 | 15844 | 100% | 57% | 6/6 (3) | 0 | 1 | 1% | **4.8** |
| 66 | Ricochet | 5×5 | 4 | 2 | 1 | 7 | 1 | 2 | 1098 | 5361 | 100% | 53% | 7/7 (5) | 1 | 3 | 5% | **4.9** |
| 67 | Side by Side | 6×5 | 4 | 2 | 0 | 8 | 1 | 1 | 4013 | 15169 | 99% | 56% | 8/8 (3) | 0 | 4 | 13% | **4.9** |
| 68 | Top and Bottom | 4×7 | 4 | 2 | 0 | 8 | 1 | 3 | 3454 | 16273 | 100% | 56% | 8/8 (4) | 2 | 3 | 2% | **5.7** |
| 69 | After the Red | 6×5 | 5 | 2 | 0 | 8 | 1 | 2 | 2519 | 11816 | 100% | 51% | 8/8 (3) | 0 | 3 | 4% | **4.9** |
| 70 | Stacked Doors | 6×6 | 4 | 2 | 0 | 7 | 1 | 4 | 1803 | 9251 | 100% | 44% | 7/7 (2) | 0 | 4 | 1% | **5.4** |
| 71 | Twin Gates | 6×6 | 5 | 2 | 0 | 9 | 1 | 4 | 11090 | 51378 | 100% | 56% | 9/9 (4) | 1 | 4 | 0% | **6.3** |
| 72 | Four Corners | 4×4 | 4 | 2 | 0 | 7 | 1 | 4 | 787 | 2729 | 98% | 47% | 7/7 (3) | 1 | 4 | 1% | **5.4** |
| 73 | Colour Sort | 6×5 | 6 | 3 | 0 | 8 | 1 | 4 | 52778 | 480150 | 100% | 58% | 8/8 (5) | 0 | 3 | 0% | **6.6** |
| 74 | Half and Half | 6×5 | 6 | 2 | 0 | 6 | 1 | 2 | 862 | 4923 | 100% | 54% | 6/6 (4) | 0 | 3 | 3% | **4.9** |
| 75 | Three Lanes | 6×6 | 6 | 3 | 0 | 9 | 2 | 4 | 120077 | 1035763 | 100% | 63% | 8/9 (3) | 0 | 4 | 0% | **7.0** |
| 76 | Wide Sort | 7×7 | 8 | 3 | 0 | 9 | 2 | 3 | 160222 | 1617539 | 100% | 56% | 8/9 (3) | 2 | 2 | 1% | **6.8** |
| 77 | Sorting Office | 6×5 | 5 | 3 | 0 | 8 | 1 | 4 | 17646 | 98156 | 100% | 58% | 8/8 (1) | 1 | 6 | 0% | **7.0** |
| 78 | Long Sort | 8×6 | 8 | 3 | 0 | 9 | 1 | 4 | 113638 | 1175890 | 100% | 58% | 9/9 (6) | 2 | 2 | 1% | **7.1** |
| 79 | Home Stretch | 6×5 | 6 | 2 | 0 | 7 | 1 | 1 | 2159 | 12549 | 100% | 56% | 7/7 (6) | 0 | 2 | 14% | **4.6** |
| 80 | Grand Sort | 8×8 | 10 | 3 | 0 | 9 | 1 | 3 | 263456 ⚠ | 3000003 | 100% | 58% | 9/9 (4) | 4 | 1 | 0% | **7.4** |

### Idee per level

| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |
|--:|---|---|---|---|---|
| 61 | Own Door (`own-door`) | Elke kleur heeft een eigen uitgang | Alleen VOORUIT: rood en blauw lopen elk naar hun eigen uitgang. | met de hand gemaakt | zoekruimte 0.47 · robots 0.28 · onvergeeflijk 0.73 |
| 62 | Just Passing (`just-passing`) | Een uitgang van een andere kleur is gewone vloer: je loopt eroverheen of staat er in de weg | Een robot stapt op de uitgang van de andere kleur en wordt niet opgenomen: voor hem is het gewone vloer. | gegenereerd, ongewijzigd gekozen | zoekruimte 0.99 · draaien 0.5 · robots 0.44 · smal 0.9 · onvergeeflijk 0.36 |
| 63 | Swap Sides (`swap-sides`) | Elke kleur heeft een eigen uitgang | Elke robot staat onder de verkeerde uitgang; ze moeten kruisen, en elke draai van de één is een stap van de ander. | met de hand gemaakt | zoekruimte 1.13 · draaien 1.25 · robots 0.28 · smal 0.84 · onvergeeflijk 0.36 · tegendraads 0.64 |
| 64 | Doorstop (`doorstop`) | Een uitgang van een andere kleur is gewone vloer: je loopt eroverheen of staat er in de weg | Een robot staat even op andermans uitgang, en wie achter hem staat moet wachten. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.6 · draaien 0.5 · robots 0.56 · smal 0.95 · onvergeeflijk 0.57 · tegendraads 0.43 |
| 65 | Three Doors (`three-doors`) | Drie kleuren uit elkaar houden | Drie kleuren, drie uitgangen in drie hoeken; elke kleur draait één keer. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.82 · draaien 0.75 · robots 0.44 · smal 0.99 · onvergeeflijk 0.53 · tegendraads 0.25 |
| 66 | Ricochet (`ricochet`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Uitgangen per kleur met een draaitegel erbij: het bord draait een blauwe robot richting zijn uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.55 · draaien 0.5 · robots 0.56 · smal 0.95 · onvergeeflijk 0.47 · tegendraads 0.86 |
| 67 | Side by Side (`side-by-side`) | Elke kleur heeft een eigen uitgang | Twee uitgangen in de bovenrand: iedereen loopt omhoog en alleen blauw hoeft één keer te draaien. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.96 · draaien 0.25 · robots 0.56 · smal 0.88 · onvergeeflijk 0.52 · tegendraads 0.75 |
| 68 | Top and Bottom (`top-and-bottom`) | Andere bordvormen: lang, breed, smal | Het lange 4×7-bord met de rode uitgang boven en de blauwe onder. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.91 · draaien 0.75 · robots 0.56 · smal 0.98 · onvergeeflijk 0.51 · tegendraads 0.94 |
| 69 | After the Red (`after-the-red`) | In de rij: wachten op de robot voor je | Twee blauwe robots staan in de rij achter een rode, vlak voor hun eigen uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.82 · draaien 0.5 · robots 0.65 · smal 0.96 · onvergeeflijk 0.42 · tegendraads 0.56 |
| 70 | Stacked Doors (`stacked-doors`) | De uitgang in via verschillende kanten | Twee uitgangen boven elkaar, binnen in het bord; de robots komen er van drie kanten in. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.71 · draaien 1 · robots 0.56 · smal 0.99 · onvergeeflijk 0.28 · tegendraads 0.86 |
| 71 | Twin Gates (`twin-gates`) | Een uitgang van een andere kleur is gewone vloer: je loopt eroverheen of staat er in de weg | Twee uitgangen naast elkaar midden op het bord; twee keer loopt een robot over de verkeerde. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.28 · draaien 1 · robots 0.65 · smal 1 · onvergeeflijk 0.51 · tegendraads 0.83 |
| 72 | Four Corners (`four-corners`) | Klein bord: geen ruimte om om elkaar heen te lopen | Vier robots op 4×4 met de uitgangen in twee hoeken; vier draaien. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.45 · draaien 1 · robots 0.56 · smal 0.99 · onvergeeflijk 0.34 · tegendraads 1.07 |
| 73 | Colour Sort (`colour-sort`) | Drie kleuren uit elkaar houden | Zes robots in drie kleuren, elk naar een eigen hoek. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.78 · draaien 1 · robots 0.72 · smal 1 · onvergeeflijk 0.56 · tegendraads 0.56 |
| 74 | Half and Half (`half-and-half`) | Elke kleur heeft een eigen uitgang | Drie blauwe naar rechtsboven, drie rode naar linksonder, met maar twee draaien. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.48 · draaien 0.5 · robots 0.72 · smal 0.97 · onvergeeflijk 0.48 · tegendraads 0.75 |
| 75 | Three Lanes (`three-lanes`) | Drie kleuren uit elkaar houden | Zes robots in drie kleuren en drie uitgangen; blauw draait twee keer, rood twee keer achter elkaar. | gegenereerd en opgeschoond | zoekruimte 3.03 · draaien 1 · robots 0.72 · smal 0.89 · onvergeeflijk 0.67 · tegendraads 0.67 |
| 76 | Wide Sort (`wide-sort`) | Andere bordvormen: lang, breed, smal | Het 7×7-bord met acht robots en drie uitgangen in drie hoeken. | gegenereerd en opgeschoond | zoekruimte 3.13 · draaien 0.75 · robots 0.84 · smal 0.88 · onvergeeflijk 0.51 · tegendraads 0.67 |
| 77 | Sorting Office (`sorting-office`) | Twee robots die hetzelfde vakje willen, blijven allebei staan | Vijf robots en drie uitgangen; robots die hetzelfde vakje willen, wachten op elkaar. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.43 · draaien 1 · robots 0.65 · smal 1 · onvergeeflijk 0.56 · tegendraads 1.31 |
| 78 | Long Sort (`long-sort`) | Andere bordvormen: lang, breed, smal | Piek van pagina 4: het brede 8×6-bord, acht robots, drie keer ROOD achter elkaar. | gegenereerd en opgeschoond | zoekruimte 3.02 · draaien 1 · robots 0.84 · smal 0.99 · onvergeeflijk 0.56 · tegendraads 0.67 |
| 79 | Home Stretch (`home-stretch`) | Elke kleur heeft een eigen uitgang | Adempauze: zes robots, twee uitgangen, één keer ROOD. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.77 · draaien 0.25 · robots 0.72 · smal 0.86 · onvergeeflijk 0.53 · tegendraads 0.43 |
| 80 | Grand Sort (`grand-sort`) | Het grootste bord (8×8) | Pronkstuk van pagina 4: tien robots in drie kleuren op een leeg 8×8-bord, elk naar zijn eigen hoek. | gegenereerd, ongewijzigd gekozen | zoekruimte 3.28 · draaien 0.75 · robots 0.93 · smal 1 · onvergeeflijk 0.57 · tegendraads 0.83 |

## Pagina 5 (level 81–100)

### Moeilijkheidscurve

```text
 81 ████················  2.2  Hold the Door
 82 ███████·············  3.5  Doorman
 83 ████████············  4.0  Stand Here
 84 █████████···········  4.3  Knock First
 85 ██████████··········  4.8  Through the Wall
 86 ██████████··········  5.0  Back Door
 87 ███████████·········  5.5  Side Gate
 88 ██████████··········  4.8  Waiting Room
 89 ███████████·········  5.4  Long Wait
 90 ███████████·········  5.7  Pinch
 91 ███████████·········  5.6  Three at the Gate
 92 ███████████·········  5.6  Colour Gate
 93 ████████████········  5.8  Turnstile
 94 ████████████········  6.0  Double Gate
 95 ███████████·········  5.7  Sorted Gate
 96 █████████████·······  6.4  Wide Gate
 97 ████████████········  6.2  Long Gate
 98 █████████████·······  6.4  Great Wall
 99 █████████···········  4.7  Open Sesame
100 ███████████████·····  7.3  Grand Gate
```

### Getallen

| # | Level | Bord | Robots | Kleuren | Tegels | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |
|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|
| 81 | Hold the Door | 4×3 | 2 | 2 | 0 | 4 | 1 | 0 | 35 | 75 | 95% | 64% | 4/4 (4) | 0 | 2 | 100% | **2.2** |
| 82 | Doorman | 5×4 | 2 | 2 | 0 | 5 | 1 | 1 | 119 | 221 | 98% | 64% | 5/5 (5) | 0 | 2 | 20% | **3.5** |
| 83 | Stand Here | 5×5 | 3 | 2 | 0 | 6 | 1 | 1 | 238 | 564 | 96% | 49% | 6/6 (1) | 0 | 4 | 17% | **4.0** |
| 84 | Knock First | 5×5 | 4 | 2 | 0 | 6 | 1 | 2 | 350 | 1140 | 98% | 49% | 6/6 (3) | 1 | 2 | 7% | **4.3** |
| 85 | Through the Wall | 5×5 | 4 | 2 | 0 | 6 | 1 | 2 | 295 | 817 | 98% | 52% | 6/6 (2) | 1 | 4 | 7% | **4.8** |
| 86 | Back Door | 6×5 | 4 | 2 | 0 | 8 | 1 | 2 | 1636 | 4671 | 100% | 47% | 8/8 (5) | 0 | 5 | 4% | **5.0** |
| 87 | Side Gate | 6×5 | 4 | 2 | 0 | 9 | 1 | 3 | 2020 | 5684 | 100% | 55% | 9/9 (5) | 3 | 3 | 1% | **5.5** |
| 88 | Waiting Room | 6×5 | 6 | 2 | 0 | 8 | 1 | 2 | 1159 | 3790 | 100% | 47% | 8/8 (6) | 0 | 4 | 4% | **4.8** |
| 89 | Long Wait | 4×7 | 4 | 2 | 0 | 8 | 1 | 2 | 1921 | 5077 | 100% | 57% | 8/8 (7) | 2 | 4 | 4% | **5.4** |
| 90 | Pinch | 4×4 | 4 | 2 | 0 | 8 | 1 | 4 | 636 | 1175 | 98% | 51% | 8/8 (4) | 3 | 4 | 0% | **5.7** |
| 91 | Three at the Gate | 6×5 | 4 | 3 | 0 | 7 | 1 | 4 | 5170 | 24531 | 100% | 58% | 7/7 (5) | 0 | 2 | 1% | **5.6** |
| 92 | Colour Gate | 6×6 | 4 | 2 | 0 | 9 | 1 | 2 | 2884 | 7741 | 100% | 54% | 9/9 (4) | 0 | 7 | 1% | **5.6** |
| 93 | Turnstile | 6×5 | 4 | 2 | 1 | 9 | 1 | 3 | 2419 | 6403 | 100% | 58% | 9/9 (6) | 3 | 4 | 0% | **5.8** |
| 94 | Double Gate | 6×6 | 6 | 2 | 0 | 10 | 1 | 2 | 11136 | 38134 | 100% | 62% | 10/10 (9) | 0 | 6 | 2% | **6.0** |
| 95 | Sorted Gate | 6×6 | 6 | 3 | 0 | 8 | 1 | 4 | 8014 | 38469 | 100% | 53% | 8/8 (4) | 1 | 1 | 0% | **5.7** |
| 96 | Wide Gate | 7×5 | 5 | 3 | 0 | 8 | 1 | 3 | 5996 | 22824 | 100% | 63% | 8/8 (3) | 1 | 6 | 1% | **6.4** |
| 97 | Long Gate | 8×6 | 6 | 2 | 0 | 9 | 1 | 3 | 5087 | 18218 | 100% | 49% | 9/9 (4) | 3 | 5 | 0% | **6.2** |
| 98 | Great Wall | 7×7 | 6 | 3 | 0 | 11 | 1 | 3 | 23165 | 55840 | 100% | 61% | 11/11 (5) | 1 | 5 | 1% | **6.4** |
| 99 | Open Sesame | 6×5 | 5 | 2 | 0 | 8 | 1 | 1 | 2922 | 11597 | 100% | 47% | 8/8 (6) | 0 | 4 | 13% | **4.7** |
| 100 | Grand Gate | 8×8 | 6 | 2 | 0 | 11 | 1 | 4 | 96685 | 468750 | 100% | 58% | 11/11 (4) | 4 | 4 | 0% | **7.3** |

### Idee per level

| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |
|--:|---|---|---|---|---|
| 81 | Hold the Door (`hold-the-door`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Alleen VOORUIT: blauw loopt over de plaat, en precies dan kan rood door de poort. | met de hand gemaakt | zoekruimte 0.47 · robots 0.28 · onvergeeflijk 0.67 · tegendraads 0.75 |
| 82 | Doorman (`doorman`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Rood loopt naar de plaat bij de uitgang; blauw moet eerst draaien om op tijd bij de poort te zijn. | gegenereerd, ongewijzigd gekozen | zoekruimte 0.85 · draaien 0.25 · robots 0.28 · smal 0.8 · onvergeeflijk 0.69 · tegendraads 0.6 |
| 83 | Stand Here (`stand-here`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Een rode robot blijft tegen de rand op de plaat staan terwijl de andere rode door de poort komt. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.07 · draaien 0.25 · robots 0.44 · smal 0.83 · onvergeeflijk 0.38 · tegendraads 1 |
| 84 | Knock First (`knock-first`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Blauw botst eerst tegen de dichte poort en komt erdoor zodra rood op de plaat staat. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.19 · draaien 0.5 · robots 0.56 · smal 0.93 · onvergeeflijk 0.38 · tegendraads 0.75 |
| 85 | Through the Wall (`through-the-wall`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Vier robots om één poort: wie op de plaat staat, laat de robot onder de muur door. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.14 · draaien 0.5 · robots 0.56 · smal 0.93 · onvergeeflijk 0.44 · tegendraads 1.25 |
| 86 | Back Door (`back-door`) | Een muur of rand zet een robot stil terwijl de rest doorloopt | De poort zit in de hoek van een lange muur; twee blauwe robots lopen over de plaat en rood glipt erdoor. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.68 · draaien 0.5 · robots 0.56 · smal 0.96 · onvergeeflijk 0.33 · tegendraads 0.94 |
| 87 | Side Gate (`side-gate`) | Alleen rechtsom: links is drie keer rechts, en je loopt terwijl je draait | Blauw staat links van de muur en moet door de poort onderaan, terwijl rood drie keer draait. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.75 · draaien 0.75 · robots 0.56 · smal 0.99 · onvergeeflijk 0.5 · tegendraads 1 |
| 88 | Waiting Room (`waiting-room`) | In de rij: wachten op de robot voor je | Zes robots; drie gaan achter elkaar door de poort naast de uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.57 · draaien 0.5 · robots 0.72 · smal 0.96 · onvergeeflijk 0.34 · tegendraads 0.75 |
| 89 | Long Wait (`long-wait`) | Andere bordvormen: lang, breed, smal | Het lange 4×7-bord met de muur dwars erdoor; rood wacht onder de poort. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.73 · draaien 0.5 · robots 0.56 · smal 0.96 · onvergeeflijk 0.53 · tegendraads 1.13 |
| 90 | Pinch (`pinch`) | Klein bord: geen ruimte om om elkaar heen te lopen | 4×4 met een muur in het midden: blauw botst vier keer tegen de poort voor hij open is. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.38 · draaien 1 · robots 0.56 · smal 1 · onvergeeflijk 0.42 · tegendraads 1.31 |
| 91 | Three at the Gate (`three-at-the-gate`) | Drie kleuren uit elkaar houden | Drie kleuren en één poort; rood en geel draaien elk twee keer. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.04 · draaien 1 · robots 0.56 · smal 0.99 · onvergeeflijk 0.55 · tegendraads 0.43 |
| 92 | Colour Gate (`colour-gate`) | Elke kleur heeft een eigen uitgang | Poort en uitgang per kleur samen: de blauwe uitgang ligt achter de muur. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.86 · draaien 0.5 · robots 0.56 · smal 0.99 · onvergeeflijk 0.48 · tegendraads 1.17 |
| 93 | Turnstile (`turnstile`) | Een draaitegel draait wie erop stapt: het bord doet het draaien | Plaat, poort en draaitegel naast elkaar; de tegel draait drie robots. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.8 · draaien 0.75 · robots 0.56 · smal 1 · onvergeeflijk 0.55 · tegendraads 1.17 |
| 94 | Double Gate (`double-gate`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Twee poorten in één muur en één plaat: acht keer botst er een robot tegen een dichte poort. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.28 · draaien 0.5 · robots 0.72 · smal 0.98 · onvergeeflijk 0.64 · tegendraads 0.9 |
| 95 | Sorted Gate (`sorted-gate`) | Drie kleuren uit elkaar houden | Drie kleuren, drie uitgangen en een poort in de hoek; geel draait drie keer achter elkaar. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.18 · draaien 1 · robots 0.72 · smal 1 · onvergeeflijk 0.46 · tegendraads 0.38 |
| 96 | Wide Gate (`wide-gate`) | Andere bordvormen: lang, breed, smal | Het brede 7×5-bord: blauw blijft vijf zetten op de plaat staan en drie robots gaan door de poort naast de uitgang. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.09 · draaien 0.75 · robots 0.65 · smal 0.99 · onvergeeflijk 0.66 · tegendraads 1.31 |
| 97 | Long Gate (`long-gate`) | Andere bordvormen: lang, breed, smal | Het 8×6-bord met de muur dwars erdoor en één rode robot aan de verkeerde kant. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.04 · draaien 0.75 · robots 0.72 · smal 1 · onvergeeflijk 0.39 · tegendraads 1.33 |
| 98 | Great Wall (`great-wall`) | In de rij: wachten op de robot voor je | Piek van pagina 5: het 7×7-bord, elf zetten, vijf robots in de rij onder de muur en één die erdoor moet. | gegenereerd, ongewijzigd gekozen | zoekruimte 2.52 · draaien 0.75 · robots 0.72 · smal 0.99 · onvergeeflijk 0.61 · tegendraads 0.82 |
| 99 | Open Sesame (`open-sesame`) | Een poort is alleen open zolang er een robot op een drukplaat staat | Adempauze: zes zetten samen lopen, dan één keer BLAUW. | gegenereerd, ongewijzigd gekozen | zoekruimte 1.86 · draaien 0.25 · robots 0.65 · smal 0.88 · onvergeeflijk 0.34 · tegendraads 0.75 |
| 100 | Grand Gate (`grand-gate`) | Het grootste bord (8×8) | Pronkstuk van pagina 5: het 8×8-bord met een muur, een poort en een opening; elf zetten. | gegenereerd en opgeschoond | zoekruimte 2.97 · draaien 1 · robots 0.72 · smal 1 · onvergeeflijk 0.55 · tegendraads 1.09 |

## Wat de kolommen betekenen

- **Tegels**: draaitegels op het bord.
- **Kortste**: lengte van de kortste oplossing (`par`). **Aantal kortste**: hoeveel verschillende commandoreeksen van die lengte winnen.
- **Draaien**: kleurcommando's in de oplossing; de rest is VOORUIT.
- **Zoekruimte**: posities die een breedte-eerst-zoektocht bezoekt tot de eerste winst. **Binnen budget**: alle posities die binnen het zetbudget bereikbaar zijn.
- **Dood**: aandeel van die posities waarvandaan winnen binnen het budget niet meer kan. Bij een krap budget is dit bijna altijd dicht bij 100% (de laatste lagen zijn vrijwel allemaal verloren); het getal onderscheidt levels dus nauwelijks.
- **Fatale zet**: aandeel van alle zetten vanuit een nog winbare positie dat het level onwinbaar maakt. Dit onderscheidt wel.
- **Gedwongen**: commando's van de oplossing waarbij elk ander commando de kortste route verlaat; tussen haakjes het aantal waarbij elk ander commando het level verliest.
- **Weg van uitgang** / **Botsen**: het kleinste aantal zetten, over alle kortste oplossingen, waarin een robot van de uitgang wegloopt, respectievelijk ergens tegenaan blijft staan terwijl de rest doorloopt. Groter dan 0 betekent: de oplossing vraagt een zet die verkeerd lijkt.
- **Volgorde vrij**: aandeel van de herschikkingen van de oplossing dat ook wint (100% = elke volgorde werkt).
- **Score**: 0–10, som van de onderdelen in de laatste kolom van de tweede tabel. ⚠ achter een getal: de zoektocht is afgekapt, het getal is een ondergrens.
