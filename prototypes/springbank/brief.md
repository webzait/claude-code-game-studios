# Game Brief: SPRINGBANK

## In your words

SPRINGBANK — GAME PROTOTYPE

Je bent een senior mobile arcade game designer, physics programmer en technical artist.

Ontwikkel SPRINGBANK: een originele hybrid-casual physics arcade-puzzel waarin een speler vallende objecten opvangt, bewegingsenergie opslaat en vervolgens de volledige verzamelde massa in één beweging lanceert.

Doel: bouw een direct speelbaar HTML5-prototype met vijf levels.

Kernmechaniek

Een compacte verticale spelwereld bevat tientallen glanzende balletjes die vanuit de bovenkant vallen.

Onderaan staat één verplaatsbare opvangbak met een veermechanisme.

De speler positioneert de opvangbak horizontaal met één vinger. Door vast te houden vangt de speler de binnenkomende balletjes op.

De balletjes worden zichtbaar verzameld. Hun bewegingsenergie wordt opgeslagen in het veermechanisme.

Wanneer de speler loslaat, lanceert de veer de verzamelde balletjes omhoog in een compacte, krachtige groep.

Balletjes kunnen tegen obstakels botsen en in opvangdoelen bovenin terechtkomen.

Balletjes die geen doel bereiken, vallen weer terug en kunnen opnieuw worden opgevangen.

De speler heeft per level een beperkt aantal lanceringen en moet een bepaalde hoeveelheid balletjes in de doelen krijgen.

Onderscheidende spelregels

Het spel gebruikt geen onbeperkte voorraad projectielen.

De bestaande balletjes vormen steeds opnieuw de beschikbare massa.

De speler moet beslissen waar en wanneer hij de balletjes opvangt en hoe groot de verzamelde hoeveelheid wordt.

Snelheid en massa beïnvloeden de opgeslagen energie.

Maak de relatie tussen opvangen, energie en lanceren duidelijk zichtbaar en voorspelbaar. Laat de speler een subtiele indicatie van de verwachte lanceerrichting zien.

Begin met een vaste verticale lanceerrichting vanuit de huidige positie van de opvangbak. Voeg nog geen vrije schiethoek toe.

De besturing moet direct begrijpelijk zijn en goed functioneren op een smartphone.

Eerste vijf levels

Begin met weinig balletjes, één opvangdoel en één eenvoudige lancering.

Introduceer vervolgens verschillende posities van opvangdoelen, meer balletjes, hindernissen en een beperkte hoeveelheid lanceringen.

Het vijfde level moet een spectaculaire lancering mogelijk maken waarbij veel balletjes tegelijk bewegen.

Elk level moet aantoonbaar haalbaar zijn via een vooraf geteste combinatie van opvangpositie, timing en lancering.

Natuurkunde

Gebruik een vaste simulatietijdstap en voorspelbaar botsingsgedrag.

Kies een efficiënte 2D-physicsimplementatie met een 3D-visuele presentatie.

Definieer zwaartekracht, wrijving, botsingen, opslagcapaciteit, energieberekening, lanceersnelheid en doelen expliciet.

Optimaliseer voor minimaal 80 gelijktijdig bewegende balletjes in de eerste prototypeversie.

Overweeg een spatial grid voor collision detection en Three.js InstancedMesh voor rendering.

Maak een herhaalbare reset met dezelfde uitgangssituatie en dezelfde bewegingsuitkomsten bij dezelfde input.

Visuele kwaliteit

Gebruik een compacte, premium 2.5D-dioramastijl.

De baan moet vrijwel het volledige smartphonescherm benutten.

De opvangbak en veer zijn het belangrijkste visuele element.

Toon zichtbaar dat de veer wordt ingedrukt als de bak voller raakt.

Een lancering moet voelen als een krachtige fysieke ontlading: snelle beweging, subtiele schermtrilling, lichte impacteffecten en geluid dat past bij de kracht.

Beperk visuele drukte. Geen kleine onleesbare objecten of complexe HUD.

Techniek

Gebruik Vite, TypeScript en Three.js, met een eenvoudige afzonderlijke physicsengine.

Ondersteun iPhone Safari en desktops.

Lever een volledig werkende game met touchbesturing, levelreset, win/verlieslogica en vijf speelbare levels.

Schrijf tests voor behoud van het aantal balletjes, opvangcapaciteit, energieberekening, lanceringen en het correct afhandelen van verzamelde en terugvallende balletjes.

Werkwijze

Begin met de technische aanpak en realiseer daarna onmiddellijk het eerste speelbare prototype.

Gebruik eenvoudige, zelfgemaakte geometrie. We hebben nog geen Blender of externe 3D-assets nodig.

Implementeer geen advertenties, in-app aankopen of complexe upgrades.

Test de volledige gameplay en presenteer een werkende lokale versie.

Stop na het eerste prototype zodat we de spelervaring kunnen beoordelen voordat we investeren in verdere visuele ontwikkeling.

Belangrijkste vraag: is het opvangen en krachtig teruglanceren van dezelfde grote groep balletjes zo leuk dat spelers het steeds opnieuw willen doen?

**Pitch:** Vang de regen van balletjes in een geveerde bak, spaar hun energie op en schiet dezelfde massa in één klap omhoog de doelen in.

**Genre:** hybrid-casual physics arcade-puzzel

**Controls:** Eén vinger of muis: vasthouden vangt, slepen verplaatst de bak, loslaten lanceert. Desktop ook: pijltjes links/rechts, spatie vasthouden en loslaten *(guessed)*.

**Question:** Is het opvangen en krachtig teruglanceren van dezelfde grote groep balletjes zo leuk dat spelers het steeds opnieuw willen doen?

**Hooks:** Geen voorraad projectielen: dezelfde balletjes zijn steeds opnieuw de massa. Snelheid en massa bij het vangen bepalen hoe hard de veer terugslaat.

**Intent:**

## Look and references
- Look: compacte, premium 2.5D-diorama in een staande kast; glanzende balletjes; de opvangbak met zichtbare veer is het grootste en warmste object; diep nachtblauw bord, koper en goud voor bak en veer, ivoorwitte balletjes, turquoise doelen *(guessed: het palet)*; signatuur: de veer die zichtbaar inzakt als de bak voller raakt en bij loslaten terugslaat; every figure drawn, no emoji, no plain circles.
- References: geen genoemd.
- View: 2.5D · Camera: vaste camera recht voor de baan met lichte kanteling, de baan vult vrijwel het hele smartphonescherm.

## First minute
Acht balletjes vallen in een stroom links van boven. De speler houdt de vinger op het scherm: de bak schuift eronder en vangt ze, de veer zakt zichtbaar in en een stippellijn boven de bak groeit tot de hoogte die de lancering gaat halen. De speler sleept de bak onder het ene doel en laat los: de veer slaat terug, het scherm trilt kort en de groep schiet het doel in. Level gehaald.

## Challenge
Vanaf level 3 blokkeren hindernissen de rechte lijn naar een doel en is het aantal lanceringen krap. Een hoog doel vraagt een grote, snelle vangst; een te kleine groep haalt de hoogte niet. Zijn de lanceringen op zonder het doelaantal, dan is het level verloren en begint het opnieuw vanuit dezelfde uitgangssituatie. Level 5 vraagt één grote lancering met tientallen balletjes tegelijk.

## Core loop
- Vasthouden en positioneren: de bak vangt vallende balletjes, elke vangst telt ½·m·v² op in de veer.
- Loslaten: de veer lanceert de hele verzamelde massa recht omhoog; meer en snellere balletjes komen hoger.
- Balletjes in een doel tellen; de rest valt terug, komt bovenaan weer in de stroom en kan opnieuw gevangen worden.
- Doelaantal gehaald binnen de lanceringen: volgend level. Lanceringen op: level opnieuw.

## Goal & fail state
- Per level een doelaantal balletjes in de doelen krijgen binnen een beperkt aantal lanceringen. Vijf levels; na het vijfde een eindscherm.
- Verlies: de lanceringen zijn op, alle gelanceerde balletjes zijn tot rust (in een doel of teruggevallen) en het doelaantal is niet gehaald. Het level herstart.

## Features
- [x] Opvangbak die met één vinger horizontaal schuift en bij vasthouden balletjes vangt
- [x] Energieopslag: snelheid en massa van elke vangst vullen de veer, zichtbaar in de veer en in een lijn die de verwachte hoogte toont
- [x] Lancering van de hele verzamelde massa recht omhoog bij loslaten
- [x] Kringloop: dezelfde balletjes vallen terug en komen opnieuw bovenaan, geen nieuwe voorraad
- [x] Opvangdoelen met een capaciteit, en hindernissen waar balletjes tegen botsen
- [x] Beperkt aantal lanceringen per level, win- en verliesscherm, levelreset
- [x] Vijf levels, elk met een opgenomen en geteste oplossing
- [ ] Ontlading: schermtrilling, impacteffecten en geluid dat meeschaalt met de kracht
- [x] Vaste tijdstap en dezelfde uitkomst bij dezelfde input, met minstens 80 balletjes tegelijk

## Keep
-

## Avoid
- geen vrije schiethoek
- geen advertenties, in-app aankopen of complexe upgrades
- geen Blender of externe 3D-assets
- geen kleine onleesbare objecten of complexe HUD
- geen onbeperkte voorraad projectielen

## Out of scope
- werelden met meer handgemaakte levels: grow it
- schoten met speciale krachten: change it after play
- wind en vrij bewegende doelen: change it after play
- phone: het draait in de telefoonbrowser; touch is gebouwd uit je woorden, de vaste check speelt met toetsen

## Build order
1. De slice: vangen, energie opslaan en lanceren met doelen, lanceringslimiet, winst en verlies, in vijf levels.

---
**Kill condition:** als vangen en lanceren na twee tuningrondes nog niet uitnodigt tot "nog een keer".

**Who it's for / what they feel:** mobiele spelers die in korte sessies een voorspelbare, krachtige ontlading willen voelen.

**Games you love / don't:**
