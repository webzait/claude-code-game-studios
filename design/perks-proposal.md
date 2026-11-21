# Turnflock · voorstel voor perks

Status: **voorstel, niets hiervan zit in de game.** Mock-ups staan op de onderdelenpagina
(`npm run build:parts` → `dist-parts/parts.html`, kaart "Perks (voorstel)"); screenshots in
`production/qa/evidence/parts-perks/`.

## Kort

- Aanbevolen: drie perks die de kernregel **niet** raken — **Wegwijzer** (15 munten),
  **Zetten op maat** (10 / 18 / 25) en **Terugspoelen** (gratis) — plus één optionele
  regelbuiger, **Linksom** (30), die **een besluit van de eigenaar nodig heeft**.
- Op het puzzelscherm komt er in de aanbevolen opzet **geen enkele knop bij**: de bestaande
  Hint-knop wordt een Hulp-knop die een kleine lade opent.
- Belangrijkste vondst uit het doorrekenen: in Turnflock is bijna elke vastgelopen stand een
  tekort aan zetten. Regelbuigers die robots laten wachten (bevriezen, op de plaats draaien)
  redden daardoor bijna niets. Dat heeft het voorstel veranderd, zie "Kritische herlezing".

## Uitgangspunten uit de code

| Feit | Bron |
|---|---|
| Een zet = gekozen kleur draait 90° rechtsom, daarna probeert elke robot één stap vooruit; `forward` draait niets. | `step()` in `src/engine/engine.ts` |
| De toestand is alleen `robots` (positie, richting, `collected`) en `movesUsed`. Het bord verandert nooit. | `src/engine/types.ts` |
| Budget = par + 2 (`moveSlack`). Extra zetten zijn `Session.bonusMoves`. | `data/config.json`, `src/game/session.ts` |
| De solver zoekt breadth-first met dezelfde `step()` en meldt `capped` als de zoekgrens (1,5 miljoen standen) bereikt is; dan is er niets bewezen. | `src/solver/bfs.ts` |
| Hint, stap 1 is gratis: "nog oplosbaar, N zetten te gaan" of "doodlopend, N zetten terug". Stap 2 (de volgende zet) kost 10. | `routeScan()` in `src/game/assist.ts`, `src/main.ts` |
| +3 zetten (25) wordt alleen aangeboden als `checkRescue` bewijst dat de stand er dan mee te winnen is. | `checkRescue()` |
| Een winst met betaalde hulp levert alleen het basisbedrag op. Een level betaalt zijn beste beloning één keer. | `rewardFor()`, `payout()` in `src/game/coins.ts` |

### Munten: wat heeft een speler?

Beloning per level: 10 basis + 3 per ongebruikte zet + 10 bij par. Met budget par + 2 zijn
er precies drie uitkomsten: **26** (op par), **13** (één zet boven par), **10** (budget op,
of met betaalde hulp).

| Na level | Minimaal (steeds 10) | Gemengd (3× par, 4× één erboven, 3× budget op, gelijk verdeeld) | Maximaal (steeds 26) |
|---|---|---|---|
| start | 30 | 30 | 30 |
| 3 | 60 | ≈ 78 | 108 |
| 5 | 80 | ≈ 110 | 160 |
| 10 | 130 | 190 | 290 |

Gevolgen voor de prijzen:

- De voorraad is **eindig**: over alle tien levels bestaat er nooit meer dan 290 munten, en
  herhalen betaalt alleen de verbetering. Elke prijs is dus een keuze uit een vaste pot.
- Een perk kost twee keer: de prijs zelf, en de bonus die vervalt (tot 16 munten) omdat een
  geholpen winst alleen 10 oplevert. Wie elk level met een perk van 30 wil halen, staat na
  de eerste keer op 10 munten en moet twee levels zonder hulp winnen voor de volgende.
  Perks kunnen een speler dus niet door het spel dragen; dat is gewenst.

### Wat de solver zegt over vastlopen (gemeten)

Met een losse kopie van de engine (niet in de repo) is per level doorgerekend:

**Hoe snel loop je vast?** Aantal standen na de eerste zet waarvandaan het level binnen het
budget nog te winnen is: level 1: 1 van 2 · levels 2–5: 2 van 3 of 2 van 4 · **level 6: 1
van 4** · levels 7–9: alle 3 · **level 10: 1 van 4**. Na drie zetten is in levels 1–6
tussen 85% en 94% van de bereikbare standen doodlopend, in levels 7–9 tussen 33% en 56%.
Informatie over "kan dit nog?" is dus het waardevolste wat de game kan geven, en dat geeft
de gratis eerste hintstap al.

**Wat redt een doodlopende stand?** Steekproef van 161 doodlopende standen na drie zetten
(levels 1–9, maximaal 24 per level), en hoeveel daarvan weer winbaar worden:

| Hulp | Gered | Aandeel |
|---|---|---|
| +3 zetten | 120 | 75% |
| één keer linksom draaien | 55 | 34% |
| +1 zet | 33 | 20% |
| één keer een kleur op de plaats laten draaien | 13 | 8% |
| één keer een kleur bevriezen | 9 | 6% |

Geen van deze zoektochten raakte de zoekgrens. Level 10 (12 robots) ontbreekt in deze
steekproef: die berekening was bij het afronden van dit document nog niet klaar. Een
variant waarin de speler één losse robot kiest, kwam op level 10 wel boven de 4 miljoen
standen uit en is daar dus niet te controleren.

**Maakt een regelbuiger puzzels korter dan par?** Bevriezen: in 1 van 10 levels (1 zet).
Op de plaats draaien: 1 van 10 (1 zet). Linksom: in levels 7, 8 en 9 (1, 3 en 3 zetten),
in de overige zeven niet.

## Hoe andere puzzelspellen het doen (alleen het patroon)

- **Informatie**: een hint die één zet toont; soms een gratis signaal dat je vastzit.
- **Terugnemen**: undo is in veel spellen betaald of beperkt. Hier is undo gratis en dat
  blijft zo; elke "terug"-perk moet daar dus bovenop iets bieden zonder undo te verkopen.
- **Budget**: extra zetten op het moment dat je faalt; vaak een vast pakket, ongeacht
  hoeveel je nodig had.
- **Regelbuigers**: één stuk weghalen, één keer een regel negeren. Sterk, maar ze maken de
  puzzel vaak triviaal en zijn daarom meestal schaars.
- **Vooraf gekochte hulp** vóór het level begint. Dit patroon nemen we niet over: je betaalt
  voordat iemand kan weten of je het nodig hebt.

Namen, iconen en vormgeving hieronder zijn eigen werk in de tonen van de eigenaar.

## De kandidaten

Bij elke kandidaat: **Engine** = welke toestand verandert. **Controle** = hoe de solver
vóór betaling bewijst dat het helpt. Voor alle betaalde perks geldt verder: bij `capped`
(niet te beoordelen) wordt niets aangeboden en niets afgeschreven, de winst telt als
"geholpen" (alleen basisbeloning), en de aankoop blijft bij de poging horen na Undo of
Restart, zoals een betaalde hint nu ook bekend blijft.

### 1. Wegwijzer — informatie · aanbevolen

- **Belofte**: "Zie waar de kudde over drie zetten moet staan; de zetten vind je zelf."
- **Wat het doet**: de solver zoekt een kortste oplossing vanaf de huidige stand; de game
  speelt daarvan de eerste drie zetten in het geheugen af en tekent de uitkomst als
  doorschijnende silhouetten op het bord. De silhouetten blijven staan tot de speler die
  stand bereikt of er meer dan drie zetten voor gebruikt heeft.
- **Engine**: niets. Alleen lezen: `solve()` en drie keer `step()` op een kopie.
- **Wanneer aangeboden**: tijdens het spelen, in de Hulp-lade.
- **Controle**: `solve(stand, zetten over)` vindt een oplossing van **minstens 5 zetten**.
  Korter dan 5: "nu niet nodig" (het doel zou bijna de uitgang zijn; de gewone hint is dan
  goedkoper). Doodlopend: geen aanbod, wel de gratis melding met Terugspoelen (perk 4).
- **Prijs: 15.** Een hint (10) geeft één zet met zekerheid; drie hints kosten 30.
  Wegwijzer geeft een doel voor drie zetten voor de helft, omdat de speler het werk zelf
  doet. Betaalbaar vanaf de start (30) en na elk gewonnen level opnieuw binnen twee levels.
- **Risico's**: triviaal? Nee: 64 mogelijke reeksen van drie zetten, en de speler moet nog
  steeds begrijpen waarom. Verwarrend? Mogelijk: bij meerdere kortste oplossingen toont het
  er één; wie een andere goede route loopt, ziet silhouetten die niet kloppen. De tekst moet
  "één mogelijke route" zeggen. Aha-moment: blijft grotendeels, dit is de reden om hem boven
  de hint te verkiezen.
- **Kernmechaniek**: niet geraakt.

### 2. Veilige zetten — informatie · afgeraden

- **Belofte**: "Zie welke van de vier knoppen het level winbaar houden."
- **Wat het doet**: voor elk van de vier commando's `solve(step(stand, commando), zetten
  over − 1)`; knoppen die doodlopen krijgen een kruis.
- **Engine**: niets. **Controle**: alleen aanbieden als minstens één en niet alle vier
  commando's veilig zijn.
- **Prijs**: zou tussen 5 en 10 liggen.
- **Waarom niet**: in levels 6 en 10 is vanaf de eerste zet precies één commando veilig;
  dan is dit de hint onder een andere naam, voor minder geld. Het zet bovendien tekens op de
  vier grote actieknoppen, de rustigste plek van het scherm, en kost vier zoektochten.
- **Kernmechaniek**: niet geraakt.

### 3. Vooruitblik — informatie · afgeraden als betaalde perk

- **Belofte**: "Zie wat een commando doet voordat je het kiest."
- **Wat het doet**: `step()` op een kopie, uitkomst als silhouet. **Engine**: niets.
- **Waarom niet**: precies hetzelfde als drukken en Undo, en Undo is gratis. Hiervoor
  munten vragen is undo verkopen via een omweg. Het ondermijnt ook wat het spel wil laten
  voelen ("één tik, en de kudde deed wat ik had bedacht"). Hooguit ooit een gratis
  toegankelijkheidsinstelling; geen perk.
- **Kernmechaniek**: niet geraakt.

### 4. Terugspoelen — terugnemen · aanbevolen, gratis

- **Belofte**: "Eén tik terug naar de laatste stand waar het nog kon."
- **Wat het doet**: als de gratis hintstap "doodlopend, N zetten terug" meldt, verschijnt
  in die melding een knop die `Session.undo()` N keer uitvoert.
- **Engine**: niets; het zijn gewone undo's. `routeScan()` levert N al.
- **Wanneer aangeboden**: alleen bij de uitkomst `dead-end`. Bij `on-route` of
  `not-assessed` bestaat de knop niet.
- **Controle**: `routeScan` heeft de doelstand als winbaar bewezen; anders geen knop.
- **Prijs: gratis.** Undo en Restart zijn gratis en N keer Undo tikken kan nu al. Hier
  munten voor vragen zou die afspraak breken. Telt niet als "geholpen".
- **Risico's**: het maakt de eerste hintstap aantrekkelijker om na elke zet te tikken; dat
  kan nu ook al. Het neemt een stukje zelf terugzoeken weg, maar niet de oplossing.
- **Kernmechaniek**: niet geraakt.

### 5. Zetten op maat — budget · aanbevolen (vervangt "+3 zetten")

- **Belofte**: "Precies de zetten die je tekortkomt, en je betaalt alleen daarvoor."
- **Wat het doet**: bij "geen zetten meer" zoekt de solver één keer met drie extra zetten.
  De lengte van de kortste oplossing is het kleinste aantal dat volstaat (1, 2 of 3); dat
  aantal wordt aangeboden via `Session.grantBonus(k)`.
- **Engine**: niets; alleen `bonusMoves`, zoals nu.
- **Wanneer aangeboden**: alleen op de kaart "geen zetten meer", naast gratis opnieuw
  proberen, dat de eerste keuze blijft.
- **Controle**: dezelfde `checkRescue` als nu. `hopeless` of `not-assessed`: geen aanbod,
  met dezelfde uitleg als nu.
- **Prijs: 10 / 18 / 25** voor +1 / +2 / +3. +3 blijft wat het nu kost; wie één zet
  tekortkomt betaalt geen 25 meer voor twee zetten die hij niet nodig heeft. +1 kost
  evenveel als een hint, en dat klopt: "nog één zet" verklapt ongeveer evenveel.
- **Risico's**: het aanbod "+1" zegt dat de oplossing één zet ver is; dat is een stevige
  aanwijzing, maar de speler heeft ervoor betaald. De game haalt per redding minder munten
  op dan nu. Uit de steekproef: +1 redt ongeveer een vijfde van de doodlopende standen, +3
  driekwart; het goedkope aanbod komt dus niet vaak voor.
- **Kernmechaniek**: niet geraakt. **Wel een besluit van de eigenaar**, om twee redenen die
  los staan van de kernregel: het verandert een bestaand onderdeel, en het vraagt nieuwe
  bedragen in `data/config.json` → `coins` (nu niet aangeraakt).

### 6. Ruime start — budget · afgeraden

- **Belofte**: "Begin dit level met twee zetten extra."
- **Wat het doet**: `bonusMoves = 2` vóór de eerste zet.
- **Waarom niet**: de solver kan niet bewijzen dat het helpt, want elk level is vanaf de
  start al winbaar. Betalen vóór de noodzaak is precies wat de eerlijkheidsregel verbiedt,
  en een keuzescherm vóór het level is een stap richting winkel.
- **Kernmechaniek**: niet geraakt.

### 7. Linksom — regelbuiger · optioneel · BESLUIT VAN DE EIGENAAR NODIG

- **Belofte**: "Eén keer per poging draait een kleur linksom in plaats van rechtsom."
- **Wat het doet**: de speler kiest Linksom (de pijlen op de drie kleurknoppen keren om),
  daarna een kleur. Die kleur draait 90° **linksom**, daarna stapt iedereen zoals altijd.
  Het kost één zet zoals elke zet. Afschrijven gebeurt bij die zet, niet bij het kiezen.
  Na Undo van die zet mag de speler hem opnieuw plaatsen zonder opnieuw te betalen.
- **Engine**: `step()` krijgt een optionele draairichting; in stap 1 wordt `(dir + 1) % 4`
  dan `(dir + 3) % 4`. Stappen 2–6 blijven gelijk. De sessie onthoudt dat de perk gebruikt
  is en bij welke zet.
- **Wat dit precies verandert aan de kernmechaniek**: de regel "draaien gaat altijd
  rechtsom" geldt voor één zet per poging niet. Dat is een van de twee haken uit de game
  brief ("turns are clockwise only"). Alle andere regels (iedereen stapt, botsen,
  rijen, uitgang) blijven onaangeroerd.
- **Wanneer aangeboden**: alleen als de stand doodlopend is en Linksom hem redt.
- **Controle**: (1) `solve(stand, zetten over)` vindt niets en is niet afgekapt; (2) een
  zoektocht over (stand, "Linksom al gebruikt?") met per stand de vier gewone zetten plus,
  zolang ongebruikt, drie linksom-zetten vindt wel een oplossing. Alleen dan is de knop
  actief. Winbaar zonder: "nu niet nodig". Niet te redden of afgekapt: uit, geen prijs.
  De zoekruimte is ruwweg twee keer die van de gewone solver.
- **Prijs: 30.** Duurder dan +3 zetten (25) omdat de speler er midden in de poging mee
  verder kan in plaats van pas bij falen. Een startende speler kan het precies één keer;
  over tien levels hoogstens vier à vijf keer als er niets anders gekocht wordt
  (elke keer kost 30 en dat level levert dan 10 op).
- **Risico's**: triviaal? In de steekproef redt het 34% van de doodlopende standen en het
  maakt levels 8 en 9 drie zetten korter dan par; de speler moet de plek zelf vinden, maar
  het is sterk. Verwarrend? Ja, dit is het grootste risico: het leert spelers dat linksom
  bestaat, terwijl het hele spel draait om het ontbreken daarvan. Aha-moment: de puzzel
  "hoe kom ik er met alleen rechtsom" wordt voor één zet uitgezet.
- **Mijn advies**: de game werkt zonder. Als de eigenaar één regelbuiger wil, is dit de
  enige die volgens de metingen genoeg doet om er munten voor te vragen.

### 8. Bevries — regelbuiger · afgeraden · zou ook een besluit van de eigenaar vragen

- **Belofte**: "Eén kleur staat één zet stil."
- **Wat het doet**: robots van de gekozen kleur draaien en stappen één zet niet; ze gelden
  als blijvers, anderen botsen ertegen (`blocked-robot`).
- **Engine**: `step()` krijgt een bevroren kleur; die robots krijgen vooraf een nieuwe
  uitkomst en doen niet mee in stap 1 en 2. **Verandert** de regel "elke robot stapt".
- **Waarom niet**: gemeten redt het 6% van de doodlopende standen en verkort het één level
  met één zet. Vastlopen is in dit spel een tekort aan zetten, en bevriezen houdt robots
  juist tegen. Met de eerlijkheidsregel zou de knop bijna altijd "nu niet nodig" tonen: een
  perk die er wel staat maar zelden iets kan.

**Ook doorgerekend en afgevallen.** *Op de plaats draaien* (een kleur draait, niemand
stapt): redt 8%, zelfde bezwaar. *Eén robot wacht* of *één robot stapt alleen*: breekt de
andere haak van het spel ("je beweegt nooit één robot"), vraagt aantikken van het bord als
nieuwe bediening, en is op level 10 niet door de solver te controleren (meer dan 4 miljoen
standen), dus daar zou het volgens de eerlijkheidsregel nooit aangeboden mogen worden.

## Aanbevolen set

| Perk | Soort | Prijs | Waar | Raakt kernmechaniek |
|---|---|---|---|---|
| Wegwijzer | informatie | 15 | Hulp-lade | nee |
| Terugspoelen | terugnemen | gratis | in de hintmelding bij "doodlopend" | nee |
| Zetten op maat | budget | 10 / 18 / 25 | kaart "geen zetten meer" | nee (wel bestaand onderdeel en muntbedragen) |
| Linksom (optioneel) | regelbuiger | 30 | Hulp-lade | **ja, besluit nodig** |

De bestaande Hint (10) blijft. Elk level blijft zonder perk oplosbaar: geen perk verandert
levels, par of budget, en de certificering van levels gebruikt geen perks.

### Plaats op het scherm

Twee opties, beide als telefoonstrook van 390 px gemockt:

- **Optie A, hulprij**: drie compacte knoppen (Hint, Wegwijzer, Linksom) met prijs tussen
  bord en knoppen; het muntensaldo in de bovenbalk. Alles in één blik, maar het bord levert
  ongeveer 56 px in en er staat meestal minstens één uitgeschakelde knop.
- **Optie B, Hulp-knop met lade (aanbevolen)**: de Hint-knop in de bovenbalk wordt Hulp.
  Dicht is het scherm gelijk aan vandaag. Open toont de lade per perk naam, belofte, prijs
  en saldo, en in woorden waarom iets nu niet kan. Kost één tik extra voor een hint.

Terugspoelen en Zetten op maat hebben in beide opties geen eigen knop.

### Iconen en knoppen

- Icoon: een gegoten tegel in de familietint (hoofd-, donkere en lichte toon van de
  eigenaar) met wit teken, getekend op een raster van 24. Wegwijzer: gestippeld
  robot-silhouet (cyaan). Linksom: de draaipijl van de actieknoppen, gespiegeld (paars).
  Zetten op maat: plus (groen). Terugspoelen: dubbele pijl terug (cyaan). Munt: goud.
- Knop: de bestaande `tf-btn` met een eigen laag `tf-perk-btn` (wand in de familietint) en
  een prijsplaatje op de hoek. Toestanden: **beschikbaar**; **te weinig munten** (knop
  blijft, prijsplaatje wordt rood, tik toont het saldo en schrijft niets af); **nu niet
  nodig** (uit, plaatje zonder prijs); **gebruikt** (uit, vinkje); voor Linksom ook
  **gekozen**.
- Bekende zwakte: de cyaan iconen hebben op het bordblauw minder contrast dan op wit; de
  donkere rand en het witte teken houden ze leesbaar, maar op 24 px is het krap.

## Testplan (lijst, geen code)

**Wegwijzer** (`tests/unit/assist.test.ts`)
- geeft bij een winbare stand met een kortste oplossing van 5 of meer de stand na precies drie zetten van die oplossing
- die stand is zelf winbaar in (zetten over − 3)
- "niet nodig" bij een kortste oplossing van 4 of minder
- "doodlopend" met het juiste aantal zetten terug als de stand niet winbaar is
- "niet beoordeeld" als de zoekgrens bereikt is, en dan geen afschrijving
- verandert de sessie niet (zelfde `state`, `commands`, `movesLeft` vóór en na)
- zelfde invoer geeft twee keer dezelfde uitkomst

**Terugspoelen** (`tests/unit/session.test.ts`, `assist.test.ts`)
- na terugspoelen is de stand gelijk aan de stand N zetten eerder en klopt de commandolijst
- de bereikte stand is winbaar binnen de resterende zetten
- niet beschikbaar bij `on-route` en bij `not-assessed`
- gekochte extra zetten en de markering "hint gebruikt" blijven staan
- kost geen munten en zet "geholpen" niet aan

**Zetten op maat** (`assist.test.ts`, `meta.test.ts`)
- geeft 1, 2 of 3 terug op drie vaste borden die precies zoveel tekortkomen
- geeft nooit meer dan nodig: met (k − 1) extra zetten is dezelfde stand niet winbaar
- "hopeloos" als drie niet genoeg is; "niet beoordeeld" bij de zoekgrens; in beide gevallen geen aanbod
- prijs volgt k uit de configuratie; te weinig munten schrijft niets af en geeft geen zetten
- na aankoop is `movesLeft` precies k en is de stand winbaar
- winst na aankoop levert alleen de basisbeloning; Restart wist de extra zetten

**Linksom** (alleen als de eigenaar ja zegt; `engine.test.ts`, `assist.test.ts`, `levels.test.ts`)
- engine: de gekozen kleur draait 90° linksom, andere kleuren draaien niet, iedereen stapt
- engine: linksom gevolgd door dezelfde kleur rechtsom geeft de oude richting
- engine: muren, botsingen, rijen, wissels en de uitgang werken bij een linksom-zet als bij een gewone
- engine: zonder de optie is `step()` bit voor bit gelijk aan nu (alle bestaande tests blijven groen)
- engine: `forward` met de optie doet hetzelfde als `forward` zonder
- solver: een oplossing bevat hoogstens één linksom-zet, en opnieuw afspelen ervan wint
- solver: de sleutel van een stand onderscheidt "gebruikt" van "ongebruikt"
- solver: vindt op een vast bord dat alleen met linksom te redden is de redding; meldt "niet te redden" waar het echt niet kan
- aanbod: uit bij een winbare stand ("niet nodig"), uit bij afgekapt zoeken, aan bij doodlopend en te redden
- sessie: Undo van de linksom-zet maakt hem weer plaatsbaar zonder tweede afschrijving; een tweede linksom-zet in dezelfde poging wordt geweigerd
- levels: elk level blijft gecertificeerd met de gewone solver, zonder perks

**Voor alle perks**
- elk level in `data/levels.json` is zonder perk winbaar binnen budget (bestaat al; blijft de poortwachter)
- geen perk is aan te schaffen op een testbord of als het level al gewonnen of verloren is

## Kritische herlezing

Na de eerste versie heb ik het voorstel tegen de metingen en de regels van de eigenaar
gelegd. Wat daardoor veranderd is:

1. **Bevries is geschrapt uit de aanbevolen set.** De eerste versie beval het aan omdat het
   het best bij het thema past. De steekproef liet zien dat het 6% van de doodlopende
   standen redt. Als er een regelbuiger komt, is het Linksom; en het eerlijke advies is dat
   het spel er geen nodig heeft.
2. **Terugspoelen is gratis geworden.** Als betaalde perk verkocht het iets wat met de
   gratis Undo al kan.
3. **Linksom wordt alleen in een doodlopende stand aangeboden**, niet om een winbare stand
   korter te maken. Anders kan de game niet zeggen dat het "echt helpt", en zou het in
   levels 8 en 9 de par-puzzel overslaan.
4. **Wegwijzer kreeg een ondergrens** (oplossing van minstens 5 zetten); daaronder is hij
   een dure hint.
5. **Optie B is de aanbeveling geworden** omdat perks die alleen mogen verschijnen als ze
   helpen het grootste deel van de tijd uit staan; een vaste rij grijze knoppen maakt het
   scherm onrustig zonder iets te bieden.

Wat ik niet heb kunnen vaststellen:

- De steekproef bekijkt standen na drie zetten, niet de standen waarin echte spelers
  vastlopen; dat kan alleen een speltest laten zien.
- Level 10 ontbreekt in de reddingstabel (berekening niet af). Voor Linksom is dus niet
  aangetoond dat de controle daar binnen de zoekgrens blijft; lukt dat niet, dan wordt
  Linksom daar nooit aangeboden.
- De prijzen zijn beredeneerd tegen tien levels en 290 munten in totaal. Met meer levels
  verschuift dat.
- De mock-ups tonen plaats en toestanden; de silhouetten van Wegwijzer op het echte bord
  en de omgekeerde pijlen bij Linksom zijn niet getekend.

## Beslissingen voor de eigenaar

1. **Linksom**: mag de regel "altijd rechtsom" voor één zet per poging wijken? (Advies: niet
   nodig; zo ja, dan deze en geen andere regelbuiger.)
2. **Zetten op maat**: mag "+3 zetten voor 25" vervangen worden door +1 / +2 / +3 voor
   10 / 18 / 25? Dit vraagt nieuwe bedragen in `data/config.json`.
3. **Plaats**: optie A (hulprij) of optie B (Hulp-knop met lade)?
4. **Blijft de eerste hintstap gratis?** Het voorstel gaat ervan uit van wel; Terugspoelen
   hangt eraan.
5. **Prijzen** van Wegwijzer (15) en Linksom (30).
6. **Namen op de knoppen**: de game is nu Engelstalig (Waypoint, Left turn, Rewind,
   +1 move); de Nederlandse namen hierboven zijn werknamen.
