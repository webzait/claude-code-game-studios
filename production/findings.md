# TURNFLOCK — bevindingen van de eigenaar

Losse bevindingen uit het spelen en bekijken, vastgelegd om later op te pakken. B1, B3 en B4 zijn
gebouwd (zie "Afgehandeld"); B2, B5 en B6 staan nog open. Nieuwe bevindingen komen onderaan; een punt verhuist naar "Afgehandeld" met de datum
en de commit zodra het in het spel zit.

## Open

### 2026-11-22

| Nr | Bevinding (woorden van de eigenaar) | Raakt | Vraag of aandachtspunt |
|---|---|---|---|

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

### 2026-11-22 — puzzelscherm (branch `claude/turnflock-puzzle-screen`)

| Nr | Bevinding (woorden van de eigenaar) | Wat er nu in het spel zit | Commit |
|---|---|---|---|
| B3 | Level en moves moeten tijdens het spel bij elkaar getoond worden | De bovenbalk is één rij: terug, één plaatje met LEVEL en MOVES naast elkaar, de muntenteller. "Robots thuis" hangt als klein lipje onder dat plaatje. De naam van het level staat niet meer in beeld (wel voor schermlezers). De Hint-knop staat nu onderaan naast Undo, Restart en Replay (Replay alleen nog als pictogram). | `d0e0d59` |
| B4 | Undo kost munten. "Hier kunnen we geld verdienen." | Undo kost 5 munten per stap (`coins.undoCost`), geen gratis Undo's (`coins.freeUndosPerLevel` 0). De prijs staat op de Undo-knop en op de Undo in de "Out of moves"-pop-up (zelfde prijs). Te weinig munten: de knop blijft tikbaar, de tik wordt geweigerd met "Undo costs 5 coins. Restart is free." en Restart krijgt een ring. Restart blijft gratis. De testlab-schakelaar "Free help" maakt ook Undo gratis. Er is geen winkel, geen reclame en geen aankoop toegevoegd. | `f80f856` |
| B1 | Hinttekst aanpassen / visualiseren | Een onthulde hint is een tekening op het bord: een kwartboog om elke robot die draait, een pijl van elke robot naar het vakje waar hij heen stapt, en een stootmarkering waar een robot wordt tegengehouden. De ring om de opdrachtknop blijft. De tekst is een paar woorden geworden. Prijs en twee stappen (eerst gratis status, dan betaalde zet) zijn ongewijzigd. | `48c8d1a` |

**B3, verfijnd op 2026-11-22 (`bac9422`, branch `claude/turnflock-top-bar`).** Level en moves zijn nu één voorwerp naar de compositie van `design/reference/b3-top-bar-reference.jpg`: een rond blauw medaillon met het level over het linkereind van een witte balk, en in die balk MOVES boven een verzonken vakje met het aantal. "Robots thuis" blijft het lipje onder de balk. Bewijs: `B3-unified-*.png`.

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

### 2026-11-22 — instellingen (branch `claude/turnflock-settings-choices`)

| Nr | Bevinding | Afgehandeld | Commit | Wat er nu is |
|---|---|---|---|---|
| B7 | Trillen en "grotere tekst" zijn door de eigenaar geschrapt, maar Trillen zat nog in het spel | 2026-11-22 | `c58ef5f` op `claude/turnflock-settings-choices` | De schakelaar Vibration, `src/haptics.ts`, de trilpatronen in de data en de tests zijn weg. Een oude save met een trilwaarde laadt gewoon; de waarde wordt genegeerd. "Larger text" zat niet in het spel. De mock-up op de onderdelenpagina volgt het ontwerp: geen Vibration, geen Larger text, geen labels "New idea". |
| B8 | "Colour shapes" (een vorm per kleur, als hulp bij kleurenblindheid) was gekozen maar zat nog niet in het spel | 2026-11-22 | `07f6a8f` op `claude/turnflock-settings-choices` | Spelersinstelling, standaard uit. Aan: het richtingsdriehoekje van elke robot ligt op een plaatje in de vorm van zijn kleur (rood cirkel, blauw vierkant, geel ruit) en de bijbehorende commandoknop draagt dezelfde vorm in de hoek. Werkt direct, ook in een level dat bezig is, en wordt bewaard (save-versie 5). Welke kleur welke vorm krijgt staat in `data/config.json` (`colourShapes`). Bewijs en simulaties van kleurenblindheid: `production/qa/evidence/findings-settings-choices/`. Niet getest op een echte telefoon of door iemand die kleurenblind is. |

Gezien bij B8, niet aangepast (valt buiten de bevinding): in de simulatie van rood-groen-kleurenblindheid krijgt de groene uitgang hetzelfde geel als een gele robot; het vinkje blijft wel zichtbaar. De hint op het bord (B1, andere sessie) moet bij "Colour shapes" aan ook de vorm tonen als ze robots per kleur aanwijst.

### 2026-11-22 — winst-pop-up (branch `claude/turnflock-win-popup`)

| Nr | Bevinding (woorden van de eigenaar) | Afgehandeld | Commit | Wat er nu in het spel zit |
|---|---|---|---|---|
| B5 | "Level voltooid"-pop-up simpeler | 2026-11-22 | `1a3aa21` (branch `claude/turnflock-win-popup`) | Winst: sterren, één regel (aantal zetten tegenover de kortste oplossing), één bedrag (wat echt is uitbetaald) en drie symboolknoppen (zie B7). Vervallen: de uitsplitsing in drie regels, de saldoregel, de levelnaam en de kop "All home". Levert een herhaald level niets op, dan staat er geen muntenplaatje maar de regel "Best reward already paid". Geen zetten meer: één titel, één zin, het aanbod als dat bewezen helpt, en de gratis opties. Bewijs: `production/qa/evidence/findings-win-popup/compare-*.png`. |
| B6 | Betere animatie van verdiende munten naar de pot | 2026-11-22 | `7aa3a83` (branch `claude/turnflock-win-popup`) | Zes munten vliegen in een boog van het bedrag op de pop-up naar de muntenteller, die per landing optelt en een tikje geeft; de teller staat boven de verduistering. Blokkeert nooit: elke knop werkt meteen en beëindigt de vlucht direct op het echte saldo. Bij verminderde beweging vliegt er niets. Instelbaar in `data/parts.json` onder `coins.fly`. Bewijs: `production/qa/evidence/findings-win-popup/coin-flight-strip-*.png`. |
| B7 | Je moet ook direct vanuit de pop-up opnieuw kunnen beginnen om je score te verbeteren | 2026-11-22 | zie de commit "Retry on the win pop-up" (branch `claude/turnflock-win-popup`) | De kleine knop onder "Next" heet nu "Retry" en begint hetzelfde level direct opnieuw (was "Replay": je eigen oplossing terugkijken, dat staat niet meer op de pop-up). Een betere uitslag betaalt alleen het verschil uit. Bewijs: `production/qa/evidence/findings-win-popup/after-win-retry-*.png`. |

### 2026-11-22 — testwinkel (branch `claude/turnflock-test-shop`)

| Nr | Bevinding (woorden van de eigenaar) | Afgehandeld | Commit | Wat er nu in het spel zit |
|---|---|---|---|---|
| — | "Zorg dat er eerst een testwinkel is om mee te testen" | 2026-11-22 | `77ac142`, `f67f009` (branch `claude/turnflock-test-shop`) | De plusknop opent een testwinkel met drie muntpakketten (100, 250 en 700 munten; voorbeeldprijzen €0,99, €1,99 en €4,99 uit `shop.packs`). Een aankoop is gespeeld: bevestigingsstap, korte verwerking, munten erbij met de bestaande telleranimatie, en een bonregel. Overal staat "Test shop" en dat er niets wordt afgerekend; er is geen betaalprovider en er verlaat niets het toestel. Bij te weinig munten voor Hint, Undo of "+3 moves" staat een stille link "Get coins" naast de gratis uitweg. Testlab: winkel aan/uit (standaard aan, omdat deze build voor het testen is), uitkomst van de aankoop (slaagt, geannuleerd, mislukt) en een kasboek met totalen (gekocht en verdiend apart), saldo instellen en wissen. Het kopen zit achter `PurchaseProvider`; wat een echte winkel nodig heeft en de economienotitie staan in `design/shop.md`. Screenshots: `production/qa/evidence/test-shop/`. |

### 2026-11-22 — knoppen onderin (branch `claude/turnflock-bottom-buttons`)

| B9 | Knoppen onderin allemaal in dezelfde stijl, zodat ze bij elkaar horen. Eenduidige manier van prijs aangeven als dat van toepassing is. Voorbeeld: `design/reference/turnflock/source/buttons-price-reference.jpg` | 2026-11-22 | `d710e3b` (branch `claude/turnflock-bottom-buttons`) | Undo, Restart en Hint zijn drie gelijke, compacte knoppen (zelfde maat, diepte, hoek, pictogramdikte) die elk op zichzelf staan, zonder gezamenlijke bak, in het midden boven de opdrachtknoppen en daar duidelijk los van. Ze hebben één eigen kleur, violet, duidelijk anders dan het rood, blauw, geel en donker van de opdrachtknoppen; alleen het witte symbool verschilt per knop. Ronder dan de opdrachtknoppen (verfijnd op verzoek van de eigenaar, zelfde dag). Replay staat op verzoek van de eigenaar niet meer op het puzzelscherm (hij zit in de pop-up na een gehaald level). Alleen een pictogram; de naam is er voor schermlezers. Restart heeft een eigen pictogram (terug naar het begin), zodat hij niet meer op een draaiknop lijkt. Een prijs staat overal op hetzelfde kaartje: de munt over het linkereind van een crème plaatje met het bedrag, midden over de onderrand van de knop. Vier vaste toestanden: betaalbaar, te weinig munten (rood, knop dof maar tikbaar), gratis (groen woord), al gebruikt (grijs met vinkje; de Hint-lamp brandt zolang de hint op het bord staat). Hetzelfde kaartje staat op "+3 moves" en op Undo in de pop-up "Out of moves". Het aanbod "+3 moves" heeft een eigen kleur (groen), los van de violette hulpknoppen en de blauwe Retry. De hulpknoppen in de pop-up (Undo) hebben dezelfde stijl als tijdens het spel, en Retry heeft hetzelfde pictogram als Restart. Het bord verliest geen hoogte. Maat, hoek en tussenruimte staan in `data/parts.json` → `buttons.tools`. Prijzen, aanbiedingen en regels zijn niet veranderd. Bewijs: `production/qa/evidence/findings-bottom-buttons/`. |

### 2026-11-23 — plaats van de pop-up (branch `claude/turnflock-popup-position`)

| Nr | Bevinding (woorden van de eigenaar) | Afgehandeld | Commit | Wat er nu in het spel zit |
|---|---|---|---|---|
| B10 | Pop-up einde level moet hoger en niet over de actieknoppen vallen. Spelers drukken te snel door zonder te kunnen zien wat er staat. | 2026-11-23 | `1102c16` (branch `claude/turnflock-popup-position`, nog niet samengevoegd) | De pop-up rust nu boven de hulpknoppen (Undo, Restart, Hint) in plaats van onderaan het scherm, in elke vorm: gewonnen, laatste level gewonnen, zetten op met en zonder aanbod, de testlab-kaart en de rustige versie. De plek wordt gemeten vanaf de hulpknoppen zelf, dus als die verschuiven (B11) schuift de pop-up mee. Geen knop van de pop-up ligt nog op de plek van een actieknop of hulpknop; een tik op die plekken doet niets zolang de pop-up er staat. Daarnaast reageren de knoppen van de pop-up de eerste 0,35 seconde na het verschijnen niet, omdat een tik tijdens de viering de pop-up meteen tevoorschijn haalt. Instelbaar in `data/config.json` onder `endCard` (`gapAboveControls`, `minTop`, `armSeconds`). Inhoud, uiterlijk, beloningen en prijzen zijn niet veranderd. Gemeten op 320×568, 360×640, 390×844 en 430×932: `production/qa/evidence/popup-position/measurements.md`, met een schermafbeelding per maat en vorm in dezelfde map. Bewaakt door `tests/integration/popup-position.spec.ts`. |

Kanttekening bij B10: de pop-up ligt nu over het onderste deel van het bord. Op een hoog scherm (390×844 en groter) blijft de bovenste helft van het bord met de viering vrij; op het kleinste scherm (320×568) bedekt de pop-up het grootste deel van het bord, omdat er tussen de bovenbalk en de hulpknoppen niet meer ruimte is. De viering begint wel vóór de pop-up verschijnt (`celebration.cardDelay`).
### 2026-11-23 — hulpknoppen hoger (branch `claude/turnflock-tools-position`)

| Nr | Bevinding (woorden van de eigenaar) | Afgehandeld | Commit | Wat er nu in het spel zit |
|---|---|---|---|---|
| B11 | "Undo retry hint knoppen moeten iets hoger geplaatst worden om per ongeluk drukken te voorkomen." | 2026-11-23 | `1eb164f` (branch `claude/turnflock-tools-position`) | Undo, Restart en Hint staan 11 px hoger (14,5 px op schermen tot 620 px hoog). De lege strook tussen de onderrand van de prijskaartjes en de bovenrand van de actieknoppen is nu op elk scherm 24 px (was 13 px, en 9,5 px op het kleinste scherm); van de onderrand van de knop zelf tot de actieknoppen is het 32 px (30 px op het kleinste scherm; was 21 en 15,5). 24 px is de afstand die WCAG 2.5.8 voor aanraakdoelen noemt en ruim boven de 8 px van de platformrichtlijnen. De ruimte komt uit de speelzone boven de knoppen (11 tot 14,5 px lager, 2 tot 4%); het bord zelf is op alle gemeten schermen even groot gebleven, ook het grootste bord (8×8), omdat de breedte daar de maat bepaalt. Stijl, grootte, volgorde, prijskaartjes en prijzen zijn niet veranderd. De maat staat op één plek: `data/parts.json` → `buttons.tools.clearance` (CSS-variabele `--tools-clear`). Een browsertest bewaakt de afstand op 320×568, 360×640, 390×844 en 430×932. Bewijs (voor en na, level 1 en level 40): `production/qa/evidence/tools-position/`. Niet getest op een echte telefoon met echte duimen. |
