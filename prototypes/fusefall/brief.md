# Game Brief: FUSEFALL

## In your words

FUSEFALL — GAME PROTOTYPE

Je bent een ervaren hybrid-casual game designer, TypeScript-gameprogrammeur en technical artist.

We ontwikkelen FUSEFALL: een originele mobiele puzzelgame waarin de speler warmtepulsen door een veranderende miniatuurmachine stuurt.

Doel: bouw een werkend HTML5-prototype met vijf zorgvuldig ontworpen, oplosbare levels.

Kernmechaniek

De spelwereld bevat metalen platforms, warmtegeleidende verbindingen, thermische sluitingen en reservoirs met kleine bolletjes.

De speler activeert één van de beschikbare warmtebronnen door erop te tikken.

Een warmtepuls verspreidt zich via de verbonden geleiders. Thermische sluitingen openen wanneer hun energiedrempel wordt bereikt.

Wanneer een sluiting opent, kan een platform kantelen. Hierdoor vallen bolletjes naar beneden en kan de structuur van het netwerk veranderen.

Sommige acties openen nieuwe verbindingen. Andere acties onderbreken verbindingen.

De speler moet de juiste activeringsvolgorde vinden om zoveel mogelijk bolletjes in de opvangbak te krijgen binnen een beperkt aantal pulsen.

Gameplayregels

Maak een deterministisch grafmodel met energieoverdracht, drempels en veranderbare verbindingen.

Houd de regels aanvankelijk eenvoudig en volledig voorspelbaar. Beschrijf exact hoe energie wordt doorgegeven, welke sluitingen reageren en in welke volgorde gebeurtenissen worden afgehandeld.

De visuele animaties mogen natuurkundig ogen, maar de uitkomst van een puzzel mag niet afhangen van willekeurige fysieke botsingen.

Maak een scheiding tussen logische gebeurtenissen en visuele effecten.

Levelontwikkeling

Ontwerp vijf levels met toenemende strategische diepgang.

Het eerste level demonstreert één warmtepuls. Het tweede introduceert een keuze tussen warmtebronnen. Het derde toont een mechanische kettingreactie. Het vierde vereist twee samenwerkende pulsen. Het vijfde vereist een doordachte volgorde om een groot reservoir vrij te maken.

Leg voor elk level een bedoelde oplossing vast en maak een automatische test die de oplosbaarheid controleert.

Visuele richting

Maak een premium, minimalistische 3D-diorama met een transparante behuizing, koperen geleiders, lichtgevende warmtepunten en kleine glanzende bolletjes.

Het mag aanvoelen als een bijzonder, zorgvuldig ontworpen mechanisch speelgoedobject.

De warmte moet zichtbaar door de constructie reizen. Wanneer een sluiting opent, moet de speler de oorzaak onmiddellijk begrijpen.

Geen drukke interfaces, geen sorteerpuzzels en geen overdadige decoraties.

Techniek

Gebruik Vite, TypeScript en Three.js. Maak de logische puzzelengine onafhankelijk van de 3D-rendering.

Ondersteun touchscreen en mobiele portretweergave.

Lever een werkende game met reset, levelovergangen, voortgangsteller en een beperkte hoeveelheid handelingen.

Schrijf automatische tests voor energieoverdracht, veranderingen in verbindingen, correcte volgorde van gebeurtenissen en win/verliescondities.

Werkwijze

Maak eerst een beknopt technisch ontwerp. Bouw daarna direct een speelbare versie.

Verifieer dat de game daadwerkelijk start en alle vijf levels speelbaar zijn.

Voeg voorlopig geen advertenties, betalingen, 3D-modellen van externe diensten of complexe metagame toe.

Stop na het eerste speelbare prototype zodat we de gameplay en strategische diepgang kunnen beoordelen.

Belangrijkste vraag: geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?

**Pitch:** Tik één warmtebron aan en kijk hoe een koperen miniatuurmachine zichzelf ombouwt: sluitingen springen open, platforms kantelen en bolletjes rollen naar de opvangbak.

**Genre:** deterministische kettingreactie-puzzel (hybrid-casual, mobiel portret)

**Controls:** tik op een warmtebron om een puls te geven; knoppen voor reset en volgend level. Muis werkt ook; toetsen 1-3 kiezen een bron, R reset, Enter gaat verder. *(toetsen: guessed)*

**Question:** geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?

**Hooks:** het netwerk verandert door je eigen puls: een kantelend platform sluit of verbreekt geleiders, dus de volgorde is de puzzel.

**Intent:**

## Look and references
- Look: premium minimalistisch 3D-diorama; transparante behuizing, koperen geleiders, lichtgevende warmtepunten, kleine glanzende bolletjes, geborsteld metalen platforms op een donkere sokkel. Signatuurdetail: de gloed reist zichtbaar door het koper en de sluiting gloeit op vlak voor ze loslaat *(inferred (strong))*. Alles in code getekend: geen emoji, geen kale cirkels, geen externe modellen.
- References: geen genoemd.
- View: 3D · Camera: vast, licht schuin van voren, de hele kast passend in portret *(guessed)*

## First minute
Level 1 toont één gloeiende bron. Je tikt, de gloed loopt door het koper, de sluiting laat los, het platform kantelt en de bolletjes rollen in de bak. Level 2 geeft twee bronnen: de dichtstbijzijnde laat de bolletjes stranden op een platform dat nog op slot zit. In level 3 zet één tik een ketting in gang van drie kantelende platforms: daar betaalt de hook uit.

## Challenge
De eerste echte denkstap komt in level 2, binnen een minuut: één puls, twee bronnen, één goede. Level 4 vraagt twee pulsen die samen één sluiting opwarmen, in één volgorde. Level 5 heeft een groot reservoir waarbij de voor de hand liggende volgorde de eigen geleider doorsnijdt: 3 van de 27 volgordes winnen. Een verlies kost alleen een reset van het level.

## Core loop
- Lees de machine: welke bron bereikt welke sluiting, en met hoeveel warmte.
- Tik een bron: de puls verspreidt zich, sluitingen openen, platforms kantelen, bolletjes verplaatsen, geleiders sluiten of breken.
- De machine is nu een andere: kies de volgende bron, tot de bak vol genoeg is of de pulsen op zijn.
- Mislukt: reset en probeer een andere volgorde. Gelukt: volgend level.

## Goal & fail state
- Winst: het doelaantal bolletjes ligt in de opvangbak. Verlies: de pulsen zijn op, of het doel is met de resterende pulsen niet meer haalbaar. Na level 5 volgt het eindscherm.

## Rules
- Graaf: knopen zijn bronnen, knooppunten en sluitingen; randen zijn geleiders die open of gesloten zijn.
- Puls: een bron heeft sterkte S. Warmte verspreidt zich hop voor hop over gesloten geleiders; een knoop op afstand d ontvangt S − d, en bij 0 stopt het.
- Sluitingen absorberen warmte, geven niets door en bewaren hun lading tussen pulsen.
- Vaste volgorde per puls: (1) warmte verspreidt zich volledig; (2) alle sluitingen met lading ≥ drempel openen, op aankomsttijd en daarna op id; (3) de mechanische wachtrij loopt leeg: platform kantelt → zijn geleiders breken of sluiten → zijn bolletjes gaan naar het vaste doel; (4) winst of verlies.
- Een weegplatform kantelt vanzelf bij ≥ N bolletjes. Een gekanteld platform is een goot.
- Geen nieuwe warmte binnen een puls: gewijzigde geleiders gelden vanaf de volgende puls.

## Features
- [x] Deterministische engine: energieoverdracht, drempels, veranderbare verbindingen, geordende gebeurtenissenlijst
- [x] Vijf levels: één puls · bronkeuze · kettingreactie · twee samenwerkende pulsen · volgorde rond een groot reservoir
- [x] 3D-diorama met zichtbaar reizende warmte en een duidelijke oorzaak bij elke sluiting
- [x] Reset, levelovergangen, voortgangsteller (bolletjes / doel) en een pulsenlimiet
- [x] Touchscreen en mobiele portretweergave
- [x] Automatische tests: energieoverdracht, verbindingswijzigingen, gebeurtenisvolgorde, win/verlies, oplosbaarheid per level

## Keep
-

## Avoid
- Geen drukke interfaces
- Geen sorteerpuzzels
- Geen overdadige decoraties
- Geen advertenties, betalingen, 3D-modellen van externe diensten of complexe metagame
- De uitkomst hangt nooit af van willekeurige fysieke botsingen

## Out of scope
- Geluid
- Opslaan van voortgang
- Leveleditor
- Meer dan vijf levels

## Build order
1. Engine en tests; vijf levels met oplosbaarheidstest; diorama en animatie; HUD en overgangen: één korte sessie van titel tot eindscherm, met winst en verlies per level.

---
**Kill condition:** als testers na level 3 de kettingreactie niet kunnen navertellen, of level 5 alleen door gokken oplossen. *(guessed)*

**Who it's for / what they feel:** mobiele puzzelaars die een kort, tastbaar "aha" willen: één tik, en de machine doet de rest. *(guessed)*

**Games you love / don't:**
