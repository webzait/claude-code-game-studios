# Game Brief: FLEXFALL

## In your words

GAME DEVELOPMENT BRIEF — FLEXFALL

Jouw rol

Je bent mijn senior game designer, gameplay programmer, technical artist en mobile game product strategist.

We gaan samen een originele, internationaal schaalbare hybrid-casual mobiele game ontwikkelen met de werktitel FLEXFALL.

Mijn doel is een commercieel succesvolle mobiele game met eenvoudige bediening, uitdagende gameplay, sterke retentie en mogelijkheden voor advertenties en in-app aankopen.

Ik wil dat je de game daadwerkelijk programmeert en speelbaar maakt. Niet alleen plannen, concepten, pseudocode of visuele mock-ups produceren.

Werk stapsgewijs, toon werkende resultaten en geef aan wanneer belangrijke ontwerpbeslissingen nodig zijn.

1. Achterliggende filosofie

Bestudeer de succesfactoren van:

* Color Block Jam: ruimtelijke puzzels en strategische beslissingen.
* Pixel Flow: grote massa's die zichtbaar verdwijnen.
* Screwdom: tactiele interacties en oorzaak-gevolgketens.
* All in Hole: bevredigende beweging van veel objecten.
* Mob Control: massa, spectaculaire feedback en progressie.
* Pocket Champs: toegankelijke gameplay met langdurige metaprogressie.

Gebruik uitsluitend deze inzichten, niet hun concrete gameplayregels of visuele identiteit.

FLEXFALL moet herkenbaar zijn als hybrid-casual, maar zelfstandig functioneren als nieuw spel.

Geen gekleurde blokken naar uitgangen schuiven, geen schroeven verwijderen, geen transportbanden met sorteervakken en geen standaard Match-3.

2. Het spelconcept

Een compacte 3D-speelbak bevat een flexibele rubberachtige vloer, met daarop veel kleine fysieke objecten zoals knikkers.

De vloer wordt op verschillende plaatsen omhooggetrokken of omlaaggedrukt door mechanische ankerpunten.

De speler kan deze ankerpunten bedienen door erop te tikken.

Elke verandering vervormt de volledige vloer lokaal. Daardoor ontstaan nieuwe hellingen en dalen. Knikkers beginnen te rollen, botsen tegen elkaar en bewegen richting opvangpunten.

Het doel is een vooraf bepaalde hoeveelheid knikkers te verzamelen binnen een beperkt aantal handelingen.

De speler bestuurt dus nooit de knikkers direct. De speler manipuleert de vorm van de omgeving.

Kernmechaniek: één kleine terreinverandering kan een grote kettingreactie veroorzaken.

3. Bediening en gameplay

* Mobiele portretweergave.
* Volledig met één vinger te spelen.
* Tik op een ankerpunt om de ingestelde hoogte te veranderen.
* Toon vooraf een subtiele indicatie van het beïnvloede vloergebied.
* Animeer de vervorming soepel en fysiek geloofwaardig.
* Knikkers reageren op hellingen, zwaartekracht en botsingen.
* De speler wacht kort totdat de beweging tot rust komt.
* Daarna kan de volgende handeling plaatsvinden.
* Toon altijd duidelijk hoeveel knikkers zijn verzameld en hoeveel handelingen overblijven.

De eerste levels moeten binnen enkele seconden te begrijpen zijn.

Geen onnodige menu's, complexe tutorials of ingewikkelde besturing.

4. Belangrijke gameplayregels

Ontwerp een consistent systeem voor de hoogteveranderingen.

Denk aan een elastisch oppervlak waarop elk ankerpunt invloed uitoefent op een gebied eromheen.

De terreinvervorming moet reproduceerbaar zijn. Dezelfde uitgangssituatie en dezelfde handelingen moeten dezelfde gameplay-uitkomst opleveren.

Gebruik bij voorkeur een deterministische simulatie met vaste tijdstappen.

Definieer nauwkeurig:

* Hoe ankerpunten de hoogte van de vloer beïnvloeden.
* Hoe knikkers versnellen op hellingen.
* Hoe wrijving en botsingen werken.
* Wanneer een knikker is verzameld.
* Wanneer een level gewonnen of verloren is.
* Hoe een level correct wordt gereset.

Voorkom dat het spel alleen op geluk gebaseerd is.

5. Leveldesign

Begin met vijf handmatig ontworpen, aantoonbaar oplosbare levels.

Level 1: één duidelijke klem, weinig knikkers, één opvangbak.

Level 2: twee klemmen, eenvoudige keuze.

Level 3: een obstakel waardoor de meest voor de hand liggende handeling niet optimaal is.

Level 4: meerdere kleine groepen knikkers die op verschillende plekken reageren.

Level 5: een grote, spectaculaire kettingreactie waarbij een slimme combinatie van twee handelingen een groot deel van het level oplost.

Later willen we uitbreiden naar tientallen en vervolgens honderden levels.

Ontwerp daarom vanaf het begin een data-driven levelsysteem met een eenvoudige leveleditor of JSON-configuratie.

Zorg voor controleerbare oplosbaarheid. Een level mag nooit onbedoeld onmogelijk zijn.

6. Visuele stijl

Stijl: premium, minimalistische 3D-diorama.

Ik wil een compacte speelgoedachtige wereld die aanvoelt als een fysiek object op een tafel.

Kenmerken:

* Zachte materialen met subtiele reflecties.
* Een mooi elastisch oppervlak met zichtbaar hoogteverschil.
* Glanzende, afgeronde knikkers.
* Een elegante, eenvoudige speelbak.
* Rustige achtergrond.
* Professionele belichting en zachte schaduwen.
* Zeer vloeiende animaties.
* Subtiele deformatie en veereffecten.
* Visuele voldoening wanneer grote groepen knikkers bewegen en worden verzameld.

Vermijd goedkope hypercasual stockgraphics, overdadige neonkleuren, drukke interfaces en kopieën van bestaande games.

Het speelveld moet groot en goed zichtbaar zijn op een smartphonescherm.

Focus volledig op de speelvloer, de ankerpunten en de bewegende knikkers.

7. Technologie

Begin met een speelbare HTML5-versie die op mijn Mac en iPhone via een browser werkt.

Voorkeursstack:

* TypeScript
* Vite
* Three.js voor de 3D-weergave
* Een eenvoudige, deterministische physicsimplementatie die specifiek voor dit spel is ontworpen

Gebruik niet automatisch een zware physics engine als een lichte eigen simulatie volstaat.

De architectuur moet later overdraagbaar zijn naar een mobiele productieversie, bijvoorbeeld met Capacitor.

Eisen:

* Touchbesturing.
* Goede ondersteuning voor verschillende schermformaten.
* Streef naar 60 FPS op gangbare smartphones.
* Efficiënt renderen van grote aantallen knikkers.
* Scheiding tussen gamelogica, physics, rendering en leveldata.
* Automatische tests voor de belangrijkste spelregels.
* Werkende restart, pauze en levelovergangen.

Gebruik in de prototypefase gegenereerde geometrie en eenvoudige eigen materialen. We hoeven nog geen volledige Blender-productiestraat te bouwen.

8. Hybrid-casual businessmodel

Houd in de architectuur rekening met:

* Optionele rewarded ads.
* Extra handelingen na verlies.
* Boosters.
* In-app aankopen.
* Cosmetische skins.
* Dagelijkse uitdagingen.
* Season Pass.
* Een lichte metagame met verzamelbare beloningen.

Implementeer nog geen echte advertenties, betalingen of SDK-integraties.

Zorg er wel voor dat we deze systemen later kunnen toevoegen zonder de gameplayarchitectuur te veranderen.

Maak gameplay niet kunstmatig moeilijk om aankopen af te dwingen.

9. Productontwikkeling in fasen

FASE A — Ontwerp en technische haalbaarheid

Maak een compact technisch ontwerp van de kernmechaniek, inclusief de natuurkunderegels en de vijf eerste levels.

Benoem maximaal drie belangrijke risico's en hoe je deze in de prototypefase gaat testen.

FASE B — Eerste speelbare game

Bouw een daadwerkelijke HTML5-versie waarin ik:

* De vloer kan zien.
* De klemmen kan bedienen.
* De vloer zichtbaar kan vervormen.
* Knikkers kan zien bewegen en botsen.
* Knikkers in een opvangbak kan verzamelen.
* Een level kan winnen of verliezen.
* Het volgende level kan spelen.
* Een level opnieuw kan proberen.

Het resultaat moet speelbaar zijn en lokaal kunnen draaien.

FASE C — Gameplayverbetering

Na mijn feedback werken we aan:

* Bewegingsgedrag en balans.
* Visuele kwaliteit.
* Moeilijkheidsgraad.
* Bevredigende animaties.
* Nieuwe levelmechanieken.
* Een eenvoudige levelgenerator of editor.

FASE D — Commerciële uitbreiding

Pas nadat de kern aantoonbaar leuk is, bespreken en bouwen we monetisatie, progressie, LiveOps en mobiele distributie.

10. Werkwijze

Je bent verantwoordelijk voor het daadwerkelijk schrijven, draaien, testen en verbeteren van de code.

Werk zelfstandig aan de technische uitvoering, maar wijzig de fundamentele spelmechaniek niet zonder mijn goedkeuring.

Bouw eerst de eenvoudigste versie die het unieke spelgevoel overtuigend laat zien.

Zorg dat na elke fase een werkende versie beschikbaar is.

Laat me na FASE B eerst de gameplay beoordelen voordat je verdergaat met grote uitbreidingen.

Begin nu met FASE A en ga vervolgens direct door met het bouwen van FASE B.

Het belangrijkste beoordelingscriterium:

Voelt het fysiek vervormen van één speelvloer, waardoor tientallen knikkers tegelijk reageren, zo leuk en bevredigend dat iemand onmiddellijk nog een level wil spelen?

**Pitch:** Tik op een klem, de rubbervloer van een speelgoedbak veert in een nieuwe vorm en tientallen knikkers stromen in één kettingreactie naar de opvangbak.

**Genre:** physics-puzzle (hybrid-casual)

**Controls:** Eén vinger: tik op een klem om zijn hoogte te wisselen. Op desktop ook muisklik, of toetsen 1-9 voor een klem, R opnieuw, P pauze, M geluid uit.

**Question:** Voelt het fysiek vervormen van één speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?

**Hooks:** Je raakt de knikkers nooit aan: je vervormt het terrein, en één kleine verandering zet een grote kettingreactie in gang.

**Intent:** payoff builds *(you said: level 5 is de grote kettingreactie)*

## Look and references
- Look: premium, minimalistische 3D-diorama; een speelgoedbak als fysiek object op een tafel. Ronde, zachte vormen. Mat rubberen vloer met fijn raster dat het hoogteverschil leesbaar maakt; glanzende glazen knikkers als helderste element; warm lichte bak; rustige achtergrond. Palet met rollen: vloer diep blauwgroen (dalen donkerder, toppen lichter), knikkers warm koraal/amber/ivoor (de massa), klemmen messing met een gekleurde kop (omhoog = koraal, omlaag = blauwgroen), opvangbak donker met lichte rand, bak en tafel crème/zand. Schaduwen koeler, licht warmer. Zachte schaduwen, subtiele reflecties, geen neon. *(inferred (strong))*
- Signature: het raster op de vloer rekt zichtbaar mee en de vloer veert na bij elke tik. *(guessed)*
- References: geen spel als voorbeeld voor de look. De zes genoemde spellen leveren alleen inzichten: ruimtelijke keuzes, massa die zichtbaar verdwijnt, tactiele oorzaak-gevolg, veel objecten tegelijk in beweging, progressie.
- Every figure drawn, no emoji, no plain circles.
- View: 3D · Camera: vast, schuin van boven, portret; de hele bak past altijd in beeld.

## First minute
De bak staat er al, met een dozijn knikkers in een kuil en één klem die zacht pulseert; een ring op de vloer toont zijn invloedsgebied. Je tikt de klem aan: de vloer veert omhoog, de kuil wordt een heuvel en alle knikkers rollen tegelijk naar de opvangbak en tikken er één voor één in, terwijl de teller oploopt. Level gehaald binnen tien seconden, met hooguit één regel hint onder de bak. Level 2 laat je kiezen tussen twee klemmen: de verkeerde stuurt de knikkers een doodlopende hoek in en je probeert het meteen opnieuw.

## Challenge
De eerste echte moeite komt in level 3 (rond minuut 1-2): een wand maakt de voor de hand liggende tik de verkeerde, je moet eerst iets anders doen. Level 4 vraagt een volgorde over meerdere groepen, level 5 een combinatie van twee tikken voor de grote lawine. Verlies kost alleen een herstart van het level, direct. Later groeien levels in aantal klemmen, obstakels en krapte van het aantal handelingen. *(inferred (strong))*

## Core loop
- Lees de vloer: waar liggen de knikkers, waar is de bak, wat doet elke klem (ring = invloed).
- Tik één klem: de vloer vervormt, knikkers rollen, botsen en vallen in de bak; je wacht tot alles stilligt.
- Herhaal tot het doel is gehaald (winst, sterren voor minder tikken) of de handelingen op zijn (opnieuw, meteen).
- Volgend level met één nieuw idee.

## Goal & fail state
- Winst: het vereiste aantal knikkers ligt in de opvangbak zodra de beweging tot rust is. Verlies: handelingen op, alles stil, doel niet gehaald. Herstart zet het level exact terug.

## Features
- [x] Elastische vloer: elke klem vervormt een gebied eromheen, met vering, deterministisch op een vaste tijdstap
- [x] Tientallen knikkers die rollen op hellingen, botsen op elkaar, wanden en pinnen, en tot rust komen
- [x] Opvangbak met teller: verzameld / doel, en resterende handelingen altijd in beeld
- [x] Tik op een klem met vooraf zichtbare invloedsring; invoer wacht tot de beweging stilligt
- [x] Vijf handgemaakte levels uit JSON, elk met een opgenomen oplossing die een test naspeelt
- [x] Winst met sterren voor minder tikken, verlies, opnieuw, volgend level, pauze
- [ ] Geluid: knikkertikken, de vloer, het vallen in de bak; uit te zetten

## Your systems
- elastische vloer met klemmen · in the slice
- knikkerphysics (hellingen, wrijving, botsingen) · in the slice
- opvangbak en spelregels (doel, handelingen, winst/verlies, reset) · in the slice
- data-driven levels (JSON) met controleerbare oplosbaarheid · in the slice
- voortgang (hoogste level, sterren, lokaal bewaard) · thin stand-in *(guessed)*
- commerciële diensten (rewarded ads, extra handelingen, boosters, IAP, skins) · thin stand-in *(guessed)*
- leveleditor of -generator · later
- dagelijkse uitdagingen, Season Pass, metagame met verzamelbeloningen · later

## Keep
-

## Avoid
- Geen gekleurde blokken naar uitgangen schuiven, geen schroeven verwijderen, geen transportbanden met sorteervakken, geen standaard Match-3
- De regels of visuele identiteit van de zes genoemde spellen
- De knikkers direct besturen
- Uitkomsten die van geluk afhangen
- Goedkope hypercasual stockgraphics, overdadige neonkleuren, drukke interfaces
- Onnodige menu's, complexe tutorials, ingewikkelde besturing
- Echte advertenties, betalingen of SDK's; gameplay die kunstmatig moeilijk is om aankopen af te dwingen
- Automatisch een zware physics engine

## Out of scope
- Leveleditor of -generator: Fase C, na je feedback
- Tientallen tot honderden levels: grow it
- Monetisatie, LiveOps, Season Pass, dagelijkse uitdagingen, metagame: Fase D; nu alleen de aansluitpunten
- Capacitor / app-store-build: Fase D
- Platform: phone: het draait in de browser van een telefoon; de tikbediening is gebouwd, maar geen automatische check speelt met aanraking

## Build order
1. De slice: vloer + klemmen + knikkers + opvangbak + regels, vijf levels van eerste tik tot de grote kettingreactie, met winst, verlies en herstart.
2. Na je oordeel (Fase C): gevoel en balans, visuele kwaliteit, nieuwe mechanieken, editor.
3. Pas als de kern leuk is (Fase D): monetisatie, progressie, LiveOps, distributie.

---
**Kill condition:** als na twee afstelrondes het tikken op een klem nog steeds niet voelt als "ik deed dat" en de uitkomst als toeval leest.

**Who it's for / what they feel:** casual mobiele spelers; het tactiele plezier van één tik die een massa in beweging zet, en het slimme gevoel dat het precies zo liep als bedoeld.

**Games you love / don't:** Color Block Jam (ruimtelijke keuzes), Pixel Flow (massa die verdwijnt), Screwdom (tactiel, oorzaak-gevolg), All in Hole (veel objecten in beweging), Mob Control (massa en feedback), Pocket Champs (metaprogressie): alleen de inzichten, niet de regels of de look.
