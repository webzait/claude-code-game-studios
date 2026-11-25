# TURNFLOCK — de munteneconomie, eerste ronde (22 november 2026)

> **Historisch.** Dit is de onderbouwing van de eerste ronde. De bedragen die hier "aanbevolen" heten, zijn sinds
> bevinding B12 de afstelling "Roomy"; de huidige onderbouwing staat in `design/economy.md`. De verwijzingen naar
> `tools/economy/sets.json` en `production/qa/evidence/economy/` kloppen nog: die zijn als archief bewaard.

Stand: 2026-11-22. Dit document beantwoordt de vraag van de eigenaar over de muntbedragen, laat het
rekenmodel zien waarop de antwoorden steunen, en legt vast welke bedragen toen in het spel zaten.

> Er wordt nergens echt betaald. "Bijleggen" en "pakket" in dit document gaan over de testwinkel
> (`design/shop.md`), waar elke aankoop gespeeld is. De uitkomsten zijn scenario's op aannames, geen
> voorspellingen.

## 1. De antwoorden, kort

**Waarom 26 en geen 30?** De 26 was geen gekozen getal maar een optelsom: 10 voor de winst, plus 3 voor
elk van de 2 zetten die je overhield, plus 10 voor de kortste oplossing. Omdat het zettenbudget altijd
"kortste oplossing plus 2" is, kwamen er maar drie uitkomsten uit die formule: 26, 13 en 10. Niemand
heeft 26 bedacht; het rolde eruit.

**Krijg je meer als je efficiënt speelt?** Ja, meer. Dat was al zo (26 voor de kortste oplossing, 13
voor één zet meer, 10 voor twee zetten meer) en dat blijft zo. Wat niet klopte: de beloning liep niet
gelijk met de sterren die je zag. Twee sterren betaalde 13 of 10, en drie sterren met een hint
betaalde 10.

**Wat zit er nu in?** De beloning volgt de sterren, in ronde bedragen: **10 munten per ster**.

| | Was | Nu |
|---|--:|--:|
| 1 ster (gewonnen met +3 moves) | 10 | **10** |
| 2 sterren (één of twee zetten meer dan de kortste) | 13 of 10 | **20** |
| 3 sterren (de kortste oplossing) | 26 | **30** |
| Winst waarbij een hint is gekocht | altijd 10 | naar sterren |
| Startsaldo | 30 | **50** |
| Undo, per stap | 5 | **5** |
| Hint (de volgende zet) | 10 | **20** |
| +3 moves | 25 | **40** |
| Restart | gratis | gratis |

**Is het afgestemd op "uiteindelijk munten kopen" zonder te makkelijk te zijn?** In het model komt een
gewone speler met deze bedragen rond level 21 voor het eerst tekort (bij de meeste spelers ergens
tussen level 9 en 36) en zou hij daarna ongeveer **125 tot 145 munten per pagina van 20 levels** moeten
bijleggen om te blijven spelen zoals hij wil: ruim één "Handful" van 100 per pagina. Wie goed
speelt of zuinig is met hulp, komt nooit tekort. Wie veel hulp nodig heeft, komt al rond level 7
tekort. Dat laatste is de prijs van schaarste en staat in hoofdstuk 6 zonder omwegen.

De schaarste is ongeveer die van de oude bedragen (daar kwam de gewone speler rond level 16 tekort);
hij is dus niet strenger gemaakt, wel leesbaarder en anders verdeeld: je verdient meer met gewoon
spelen, en de bewuste hulp (hint, extra zetten) kost meer dan het terugnemen van een misstap.

## 2. Wat er nu in het spel zit

### De regel

- Elke winst betaalt naar zijn sterren: 10, 20 of 30. Wat de speler aan sterren ziet, is wat hij aan
  munten krijgt.
- Een level betaalt zijn beste beloning één keer. Wie een level later beter haalt, krijgt het verschil
  (van 2 naar 3 sterren: 10). Een level opnieuw winnen met hetzelfde of een slechter resultaat levert
  niets op. Dat is ongewijzigd.
- Een winst met een gekochte hint betaalt nu gewoon naar sterren. Een hint kost 20 en kan een winst
  hooguit één sterstap (10) optillen, dus een hint verdient zichzelf nooit terug en er valt niets mee
  te "boeren". Een unit-test bewaakt die verhouding.
- Een winst met +3 moves is één ster en betaalt 10. Je betaalt 40 en krijgt 10 terug: het is hulp om
  verder te komen, geen manier om te verdienen.

### De schaal

Eén ster is 10 munten. De prijzen staan in dezelfde schaal:

| Hulp | Prijs | In sterren | Waarom zo |
|---|--:|---|---|
| Undo, één stap terug | 5 | een halve ster | De kleinste hulp: je neemt alleen iets terug. Een 3-sterrenwinst betaalt er zes. |
| Hint, de volgende zet | 20 | twee sterren | Geeft de juiste zet cadeau; kost wat een 2-sterrenwinst oplevert. |
| +3 moves | 40 | vier sterren | Redt een hele poging en is alleen te koop als de solver bewijst dat drie zetten genoeg zijn. |
| Startsaldo | 50 | vijf sterren | Genoeg om Undo en een hint één keer te proberen en nog iets over te houden. |

Alle bedragen staan in `data/config.json` onder `coins` en zijn beschreven in `data/config-notes.md`.

### Wie halverwege is

Een bestaande save houdt zijn munten. Er komt niets bij en er gaat niets af.

- Nieuwe levels betalen de nieuwe bedragen; een hint kost voortaan 20 en +3 moves 40.
- De 50 van het startsaldo geldt alleen voor een nieuwe speler (of na "Reset progress").
- Levels die al betaald waren onder de oude bedragen (26, 13 of 10) gelden als betaald voor het
  resultaat dat ze hebben. Zonder die regel zou een level dat 26 betaalde bij opnieuw winnen een
  restje van 4 uitkeren, en eentje van 13 een restje van 7: precies de willekeurige getallen waar de
  vraag over ging. Een beter resultaat betaalt het verschil in nieuwe bedragen (van 2 naar 3 sterren: 10).
- De regel wordt één keer toegepast bij het laden (`settlePaid` in `src/game/coins.ts`, met
  unit-tests en een browsertest). De save krijgt daarvoor een kenmerk `economy`; het save-formaat
  zelf verandert niet, zodat dit niet botst met de save-versie van de testwinkel.
- Het alternatief is het verschil alsnog uitkeren (een speler die 20 levels heeft gehaald zou dan in
  één keer tot ongeveer 200 munten bij krijgen). Dat is vriendelijker, maar vertekent de test van de
  economie. Het is een open besluit (hoofdstuk 10).

## 3. Het model

### Wat het is

`npm run economy` (code in `tools/economy/`, uitleg in `tools/economy/README.md`) speelt de
portemonnee van vijf soorten spelers over de echte levels, 2000 keer per speler met een vaste seed.
Het speelt geen borden: per level trekt het wat de speler *wil* (welk resultaat, hoeveel Undo's,
hints, wel of geen +3 moves) en rekent elke munt uit met de functies van het spel zelf
(`rewardFor`, `payout`, `undoQuote`, `hintPrice`, `extraMovesPrice`). Verandert de formule in het
spel, dan verandert het model mee. De moeilijkheid per level is de gemeten score uit
`design/level-report.md` (0 tot 10).

Elke speler wordt twee keer gespeeld met dezelfde wensen:

- **Legt nooit bij**: hulp die niet te betalen is, wordt geweigerd; de speler gaat gratis verder
  (Restart). Hieruit komt "eerste keer tekort".
- **Legt precies bij wat ontbreekt**: alles wat hij wil, wordt gekocht. Hieruit komt "moet bijleggen".

### De spelers (aannames)

Elk getal is een paar: de waarde op een level met score 0 en op een level met score 10, daartussen
een rechte lijn. De levels lopen van score 0,7 tot 8,5. De spelers staan in
`tools/economy/players.json` en zijn daar aan te passen.

| Speler | Kortste oplossing | Undo's per level | Hints per level | Kans op +3 moves |
|---|---|---|---|---|
| Zuinige speler: speelt gemiddeld, koopt nooit hulp | 70% → 15% | 0 | 0 | 0 |
| Puzzelaar: bijna altijd de kortste | 95% → 55% | 0 → 2 | 0 → 0,1 | 0 |
| Gewone speler | 70% → 15% | 0,5 → 5 | 0 → 0,8 | 0 → 25% |
| Speler met moeite | 50% → 5% | 1 → 8 | 0 → 2 | 0 → 50% |
| Jonge tikker: tikt Undo bij elke misstap, let niet op de prijs | 50% → 5% | 3 → 12 | 0,2 → 2,5 | 5% → 60% |

Verdere aannames, allemaal aanvechtbaar:

1. Een speler wil dezelfde hulp, wat die ook kost. In het echt neemt iemand minder Undo's als ze
   duurder zijn, want Restart is gratis. Dit is de zwakste aanname; zie de gevoeligheid hieronder.
2. Wie niet de kortste oplossing vindt, wint even vaak met één als met twee zetten meer.
3. Een geweigerde +3 moves wordt een gratis nieuwe poging die op de laatste zet wint (2 sterren).
4. Hulp verandert het resultaat niet: een hint maakt de winst in het model niet korter.
5. Elk level wordt één keer gehaald, in volgorde. Niemand speelt een eerder level opnieuw.
6. Gratis Undo's (alleen in voorstel A en B+) tellen één keer per level, terwijl het spel ze na elke
   Restart opnieuw geeft. Dat is voorzichtig gerekend.

### Gecontroleerd

De uitkomsten zijn met de hand nagerekend voordat er iets op gebouwd is. Voorbeeld: de zuinige speler
vindt over 40 levels gemiddeld in 42% van de gevallen de kortste oplossing; 20 + 42% × 10 = 24,2 per
level, het model geeft 969 over 40 levels (24,2). De gewone speler wil gemiddeld 2,8 Undo's per level:
2,8 × 5 × 40 = 568, het model geeft 547 betaald plus de geweigerde. De unit-tests
(`tests/unit/economy.test.ts`) controleren de rekenregels: het saldo wordt nooit negatief, de boeken
sluiten per level, bijleggen is precies wat ontbreekt, en de set "aanbevolen" is gelijk aan wat het
spel gebruikt.

### Gevoeligheid

Het antwoord hangt sterk aan hoe vaak mensen echt Undo tikken. De gewone speler onder de bedragen die
nu in het spel zitten, over 60 levels:

| Undo's | Eerste keer tekort | Moet bijleggen |
|---|---|--:|
| de helft | level 33, in een derde van de runs | 34 |
| zoals aangenomen | level 24 | 295 |
| het dubbele | level 10 | 1114 |

Een factor twee in één aanname maakt het verschil tussen "koopt nooit" en "komt vanaf level 10
tekort". Daarom is dit een beginpunt voor de test en geen eindoordeel. Alle tabellen:
`production/qa/evidence/economy/model-sensitivity.md`.

## 4. Kritiek op de oude bedragen

De getallen in dit hoofdstuk komen uit `production/qa/evidence/economy/model-current.md`.

**Is 5 per Undo zinnig naast 10 tot 26 per level?** Als prijs wel: één Undo is een vijfde tot de helft
van wat een level opleverde. Als bron van uitgaven is het de olifant in de kamer. Bij de gewone speler
ging 485 van de 623 uitgegeven munten naar Undo, bij de speler met moeite 515 van de 563. Undo is de
enige hulp die je in een reflex tikt, meerdere keren per level, en het is dus de knop die het vaakst
geweigerd wordt. Een winst van 2 sterren (10 of 13) betaalde twee Undo's.

**Is een hint twee Undo's waard?** Nee, een hint is meer waard. Een Undo neemt iets terug; een hint
vertelt wat de goede zet is. Op papier kostte een hint 10, maar in werkelijkheid meer: wie een hint
kocht, kreeg voor de winst alleen nog 10 in plaats van 26. De hint kostte dus 10 plus tot 16 aan
gemiste beloning, zonder dat dat ergens stond. Een prijs die je niet ziet, is geen eerlijke prijs. Nu
staat de hele prijs op de knop (20) en raakt de hint de beloning niet meer.

**Domineert de perfecte bonus?** Ja. De laatste zet besparen was 13 munten waard (van 13 naar 26), de
zet daarvoor 3 (van 10 naar 13). Drie sterren betaalde twee keer zoveel als bijna-perfect. Voor een
gewone speler, die op zware levels zelden de kortste oplossing vindt, betaalde een level in de praktijk
10 tot 13. Nu is elke ster evenveel waard: 10.

**Zegt de start van 30 iets?** Weinig. Het was zes Undo's, of drie hints, of één keer +3 moves met 5
over. In het model was het bij de jonge tikker op level 2 op en bij de speler met moeite op level 5.
Het bedrag was niet aan een prijs gekoppeld. De 50 van nu is dat wel: een Undo, een hint en nog 25 over.

**Maakt "één keer betalen" latere levels armer dan vroege?** Niet door die regel zelf: elk level betaalt
één keer, vroeg of laat. Wel door de moeilijkheid. Latere levels zijn zwaarder, dus minder vaak drie
sterren en meer hulp. Onder de oude bedragen verdiende de gewone speler op pagina 1 gemiddeld 15,8 per
level en wilde hij 18,0 uitgeven; op pagina 2 verdiende hij 14,9 en wilde hij 24,1 uitgeven. De kloof
groeit dus met de voortgang.

**Wat de regel wel doet: er is geen kraan voor wie vastzit.** Munten komen alleen uit nieuwe winsten.
Wie op een level vastzit en geen munten heeft, kan nergens munten verdienen, want gehaalde levels zijn
sinds bevinding B2 niet meer te openen (alleen "Replay" direct na een winst). Zolang er geen winkel is,
is dat alleen onhandig: Restart en de gratis eerste hintstap blijven. Met een winkel wordt kopen op dat
moment de enige uitweg naast doorzetten, en dat is precies de plek waar een spel als een val gaat
voelen. Zie hoofdstuk 6 en de open besluiten.

**Stonden beloning en sterren los van elkaar?** Ja. 2 sterren betaalde 13 of 10, en 3 sterren met een
hint betaalde 10. De speler zag drie sterren en +10.

## 5. Drie voorstellen

Alle drie gebruiken dezelfde beloning, 10 munten per ster, omdat dat het leesbare deel is. Ze
verschillen in prijzen, start en regels. Wisselen kan door de getallen van een set uit
`tools/economy/sets.json` over te nemen in `data/config.json` onder `coins`; de formule hoeft daarvoor
niet te veranderen. (Ook de oude bedragen zijn zo terug te zetten: `twoStars` 0, `perfect` 10,
`perSpareMove` 3, `hintedWinPays` "base".)

| | Oud | A. Ruim | **B. Aanbevolen (in het spel)** | C. Krap |
|---|--:|--:|--:|--:|
| Start | 30 | 100 | **50** | 30 |
| 1 / 2 / 3 sterren | 10 / 13 of 10 / 26 | 10 / 20 / 30 | **10 / 20 / 30** | 10 / 20 / 30 |
| Winst met hint | 10 | naar sterren | **naar sterren** | 10 |
| Undo | 5 | 5, eerste 2 per level gratis | **5** | 10 |
| Hint | 10 | 10 | **20** | 20 |
| +3 moves | 25 | 20 | **40** | 50 |

### Wat de spelers verdienen en uitgeven, levels 1 tot 40

"Tekort bij" is het level waarop voor het eerst een gewenste hulp niet te betalen is (mediaan; tussen
haakjes de spreiding van 10% tot 90% van de runs). "Bijleggen" is het gemiddelde over 40 levels.

| Speler | | Oud | A. Ruim | B. Aanbevolen | C. Krap |
|---|---|--:|--:|--:|--:|
| Zuinige speler | verdient | 706 | 969 | 969 | 969 |
| | tekort bij | nooit | nooit | nooit | nooit |
| Puzzelaar | verdient / geeft uit | 869 / 223 | 1099 / 46 | 1099 / 244 | 1064 / 446 |
| | tekort bij | nooit | nooit | nooit | nooit |
| | houdt over | 676 | 1153 | 905 | 648 |
| Gewone speler | verdient / wil uitgeven | 615 / 843 | 897 / 487 | 919 / 1080 | 896 / 1686 |
| | tekort bij | level 16 (7–30) | nooit | level 21 (9–36) | level 7 (2–14) |
| | bijleggen | 242 | 0 | 172 | 931 |
| Speler met moeite | verdient / wil uitgeven | 548 / 1563 | 828 / 1135 | 879 / 2119 | 868 / 3127 |
| | tekort bij | level 5 (2–8) | level 24 (16–34) | level 7 (3–11) | level 3 (1–5) |
| | bijleggen | 1073 | 273 | 1304 | 2553 |
| Jonge tikker | verdient / wil uitgeven | 547 / 2375 | 860 / 1913 | 876 / 3115 | 875 / 4751 |
| | tekort bij | level 2 (1–3) | level 9 (6–13) | level 3 (1–5) | level 1 (1–2) |
| | bijleggen | 1908 | 1083 | 2335 | 4229 |

### En over 60 levels, per pagina

Bijleggen per pagina van 20 levels (pagina 1 / 2 / 3) en in totaal.

| Speler | Oud | A. Ruim | B. Aanbevolen | C. Krap |
|---|--:|--:|--:|--:|
| Gewone speler | 50 / 192 / 155 = 398 | 0 | 29 / 143 / 124 = 295 | 315 / 616 / 521 = 1453 |
| Speler met moeite | 402 / 672 / 584 = 1658 | 24 / 249 / 219 = 491 | 460 / 844 / 726 = 2030 | 1020 / 1533 / 1362 = 3915 |
| Jonge tikker | 797 / 1111 / 1013 = 2922 | 350 / 733 / 636 = 1719 | 943 / 1392 / 1256 = 3591 | 1814 / 2415 / 2223 = 6451 |

Pagina 3 is gemiddeld iets lichter dan pagina 2, omdat die pagina opnieuw makkelijk begint met het
nieuwe element (de draaitegel). De volledige tabellen, met het saldo na elk level, staan in
`production/qa/evidence/economy/model-*.md`.

### A. Ruim

- **Idee**: hulp hoort bij het spel; munten zijn een beloning, geen drempel. De eerste twee Undo's
  van elk level zijn gratis.
- **Wie komt tekort**: de gewone speler nooit. De speler met moeite rond level 24, daarna ongeveer 250
  per pagina. De jonge tikker rond level 9.
- **Comfortabel pakket**: voor de gewone speler geen. Voor de speler met moeite één pakket van 250 per
  pagina.
- **Risico's**: er is voor bijna niemand een reden om munten te kopen, wat tegen de wens van de
  eigenaar ingaat. De puzzelaar houdt na 40 levels ruim 1150 munten over waar hij niets mee kan. Twee
  gratis Undo's per level halen een deel van de puzzel weg: een fout kost niets meer.

### B. Aanbevolen (zit nu in het spel)

- **Idee**: gewoon spelen betaalt ruim, een misstap terugnemen is goedkoop, bewuste hulp is duur. De
  schaarste zit bij de hint en de extra zetten, waar de speler er even over nadenkt, en niet nog
  zwaarder bij de reflexknop.
- **Wie komt tekort**: de zuinige speler en de puzzelaar nooit. De gewone speler rond level 21, dus
  ongeveer aan het begin van pagina 2, en hij speelt pagina 1 vrijwel op eigen munten (29 tekort). De
  speler met moeite rond level 7. De jonge tikker rond level 3.
- **Comfortabel pakket**: voor de gewone speler 125 tot 145 munten per pagina vanaf pagina 2: ruim
  één Handful (100), of één Pouch (250) voor twee pagina's. Voor de speler met moeite 460 tot 840 per
  pagina: ongeveer een Chest (700) per pagina.
- **Risico's**:
  - De speler met moeite moet in dit voorstel meer bijleggen dan onder de oude bedragen (1304 tegen
    1073 over 40 levels), omdat hints en extra zetten duurder zijn en juist hij die het meest wil. Daar
    staat tegenover dat hij zonder bij te leggen méér hulp kan betalen dan vroeger: hij verdient 879 in
    plaats van 548, en koopt daarmee ongeveer 150 Undo's en 6 hints waar dat er eerst ongeveer 100 en 4
    waren. Hij krijgt dus meer voor niets, en er blijft meer onvervuld.
  - De puzzelaar houdt ongeveer 900 munten over. Er is niets om ze aan uit te geven.
  - Een winst met hint betaalt nu naar sterren. Wie hints koopt, haalt makkelijker drie sterren. De
    hintprijs van 20 houdt dat in toom, maar de sterren zeggen daardoor iets minder over eigen kunnen.
    Of een hint de sterren moet beperken is een spelregel en hier niet aangeraakt.

### B+. Aanbevolen met één gratis Undo per level (niet in het spel, wel doorgerekend)

Als B, met `freeUndosPerLevel` op 1: de eerste Undo van elk level is gratis. De gewone speler komt dan
pas rond level 29 tekort en in de helft van de runs helemaal niet (bijleggen 54 over 40 levels, 92 over
60). De speler met moeite legt 1109 bij in plaats van 1304. Dit staat niet in het spel omdat de
eigenaar bij bevinding B4 uitdrukkelijk koos voor "Undo kost munten" zonder gratis Undo's. Het is wel
mijn advies om het te overwegen, om één reden: de commandoknoppen reageren op de eerste aanraking, dus
een misgetikte zet kost nu 5 munten of een Restart. Zie de open besluiten.

### C. Krap

- **Idee**: alle hulp kost het dubbele en een winst met hint betaalt alleen de 10.
- **Wie komt tekort**: de gewone speler rond level 7, de speler met moeite rond level 3, de jonge
  tikker op level 1.
- **Comfortabel pakket**: voor de gewone speler 300 tot 600 per pagina (een Chest per pagina); voor
  de speler met moeite 1000 tot 1500 per pagina (twee Chests).
- **Risico's**: dit hongert gewone spelers uit. Het tekort begint in de levels waarin de regels nog
  worden uitgelegd, en een gewone speler kan over 40 levels maar de helft betalen van wat hij wil. Dit
  is de instelling die als val voelt: je merkt al op de eerste pagina dat het spel is afgesteld op je
  portemonnee. **Ik raad dit af**, ook als de wens is dat er gekocht wordt. Het staat hier om te laten
  zien waar de grens ligt.

## 6. De spanning, zonder omwegen

"Schaars genoeg om te kopen" en "eerlijk" trekken tegen elkaar in. Dit is waar de grens volgens het
model ligt.

1. **Wie tekortkomt, is in elk voorstel dezelfde: de speler die de meeste hulp nodig heeft.** De
   puzzelaar en de zuinige speler kopen nooit, onder geen enkele instelling. Schaarste raakt dus niet
   "de speler", maar de zwakste speler en de speler die het minst op prijzen let. Elke stap krapper
   haalt het meeste bij hen: van B naar C gaat de gewone speler van 172 naar 931 bijleggen, de speler
   met moeite van 1304 naar 2553.
2. **Omgerekend met de voorbeeldprijzen van de testwinkel** (ongeveer 1 euro per 100 munten) is B over
   60 levels ongeveer 3 euro voor de gewone speler, 15 tot 20 euro voor de speler met moeite en 25 tot
   35 euro voor de jonge tikker. Onder C is dat ongeveer 10 tot 15, 30 tot 40 en 45 tot 65 euro. De
   eerste is een redelijke prijs voor een spel. De laatste bedragen zijn dat niet, en ze komen van de
   spelers die het minst overzien wat ze uitgeven.
3. **Kinderen.** De "jonge tikker" is een kind dat Undo tikt zoals het in elk ander spel gratis kan. In
   elk voorstel staat die speler binnen een paar levels droog, en de meeste van zijn uitgaven zijn
   Undo. Zodra er echt betaald kan worden, is "een kind tikt, de teller loopt, een link 'Get coins'
   verschijnt" de situatie waar toezichthouders en ouders op letten. Voor kinderen ongeschikt zijn in
   elk geval: een prijs op Undo zonder gratis Undo's in combinatie met een echte winkel zonder
   oudercontrole; "Get coins" tonen op het moment van verlies; en elke prijs die oploopt binnen een
   level. Het eerste is de huidige instelling plus een toekomstige echte winkel; het tweede doet de
   testwinkel als rustige link (zie `design/shop.md`); het derde zit nergens in.
4. **Wat het spel eerlijk houdt, en dus niet mag verdwijnen**: Restart is gratis; de eerste hintstap
   ("kan ik nog winnen?") is gratis; +3 moves verschijnt alleen als het bewezen helpt; elke prijs staat
   op de knop; elk level is zonder munten uit te spelen. Dat laatste is waar voor iedereen die de
   puzzel kan oplossen. Voor wie een level echt niet ziet, is de enige hulp een betaalde hint. Zo'n
   speler heeft in theorie toegang en zit in de praktijk vast.
5. **Mijn grens**: de gewone speler mag pas tekortkomen nadat hij de regels kent (na pagina 1), en wat
   hij dan per pagina tekortkomt, moet met het kleinste pakket te dekken zijn. B zit daar net binnen.
   Alles wat krapper is, verschuift de eerste weigering naar de leerlevels.

## 7. Overwogen en niet gedaan

- **Beloning per zet over (de oude formule) houden, met ronde getallen.** Bijvoorbeeld 10 + 5 per zet
  over + 10: dat geeft 30, 15 en 10. Rond, maar dan betaalt 2 sterren nog steeds twee verschillende
  bedragen. De sterren zijn wat de speler ziet; de beloning hoort die te volgen.
- **Beloningen en prijzen laten meegroeien per pagina.** Als beide evenveel groeien, verandert er
  niets behalve dat de getallen groter en minder leesbaar worden. Alleen de beloning laten groeien is
  wel een echte knop: de gewone speler wil op pagina 2 ongeveer 31 per level uitgeven tegen 23 op
  pagina 1, terwijl hij per level iets minder verdient (22,6 tegen 23,4). Een toeslag van 5 munten per
  winst op pagina 2 en 3 zou dat gat voor ruim de helft dichten. Niet gedaan omdat het de regel "10
  per ster" breekt en omdat het de schaarste wegneemt waar de eigenaar om vraagt. Het is de eerste
  knop om aan te draaien als de test laat zien dat pagina 2 als een muur voelt.
- **Een bonus voor de eerste keer.** Die is er al: een level betaalt één keer. Een aparte bonus bovenop
  de 10 zou alleen de basis verhogen.
- **Opnieuw spelen laten betalen.** Elke herhaling betalen maakt level 1 tot een geldmachine (drie
  tikken, 30 munten). Het verschil betalen bij een beter resultaat blijft; dat is de juiste beloning
  voor terugkomen. Het werkt nu alleen bijna nooit, omdat gehaalde levels niet meer te openen zijn
  (bevinding B2).
- **2 sterren op 15 zetten (10 / 15 / 30).** Dat maakt de gewone speler armer (ongeveer 4 per level) en
  beloont de kortste oplossing dubbel. Het is de zuinigere variant van "per ster", maar het is geen
  rijtje dat je in één blik leest, en de dominantie van de perfecte winst was juist een kritiekpunt.

## 8. Naast de economienotitie van de testwinkel

`design/shop.md` (branch `claude/turnflock-test-shop`) heeft een eerste rekensom met drie spelers en
vaste gemiddelden per moeilijkheidsklasse, onder de oude bedragen. Waar de twee verschillen:

| | `design/shop.md` | Dit model, oude bedragen |
|---|---|---|
| Gemiddelde speler: tekort bij | level 27 | level 16 (7–30) |
| Gemiddelde speler: bijleggen over 40 levels | ongeveer 260 | 242 |
| Zwakke speler: tekort bij | level 9 | level 5 (2–8) |
| Zwakke speler: bijleggen over 40 levels | ongeveer 860 | 1073 |

- De totalen liggen dicht bij elkaar. Het moment van de eerste weigering ligt hier vroeger, omdat dit
  model per run rekent: een speler heeft soms een zwaar level met veel Undo's vroeg in het spel, en
  een gemiddelde verbergt dat.
- **Voor de bedragen moet dit document gelden**: het model gebruikt de echte muntfuncties, de gemeten
  moeilijkheid en de nieuwe regels. De getallen in hoofdstuk 5 van `design/shop.md` gaan over de oude
  bedragen en kloppen na samenvoegen niet meer.
- **De pakketten van de testwinkel (100, 250 en 700) kunnen blijven staan.** Onder de nieuwe bedragen
  past een Handful bij wat de gewone speler per pagina tekortkomt, een Pouch bij twee pagina's en een
  Chest bij een pagina van de speler met moeite.
- `tools/economy/shop-sim.mjs` van die branch leest `coins.perSpareMove` en `coins.perfect` en rekent
  daarmee de oude formule na. Na samenvoegen geeft het nog wel getallen (30 voor de kortste oplossing),
  maar "één zet meer" komt er als 10 uit in plaats van 20. `npm run economy` vervangt het.
- De regel in de winkel dat tekortkomen een woordregel en een link geeft en nooit een pop-up, is een
  voorwaarde waaronder B eerlijk blijft.

### Naast andere bekende puzzelspellen

Kort nagezocht op 22 november 2026; alleen het cijfer van Royal Match per level komt uit een analyse, de
rest uit spelersreviews en verkoperssites, niet van de makers. Royal Match betaalt 10, 20 of 30 munten
per level naar moeilijkheid en vraagt 900 munten voor vijf extra zetten. Magic Sort vraagt volgens
reviews ook 900 om door te spelen of een fles toe te voegen en verkoopt 1000 munten voor ongeveer 2
dollar. Van Color Block Jam zijn geen bedragen gepubliceerd. Het patroon: kleine ronde beloningen, bijna
niets extra voor efficiënt spelen, en één dure knop die levels nooit terugverdienen; de munten daarvoor
komen uit events, dagelijkse beloningen en de winkel. TURNFLOCK heeft die tweede bronnen bewust niet,
dus een verhouding als 900 tegen 30 zou hier betekenen dat hulp alleen nog te koop is. De tegenhanger
van die knop is bij ons "+3 moves" (40).

## 9. Wat alleen echt spelen kan uitwijzen

Het model weet niet hoe mensen spelen. Deze metingen uit het kasboek van de testwinkel (Settings →
Test lab → "Coin ledger") en uit de gebeurtenissen in `src/game/metrics.ts` beslissen het:

| Vraag | Meting | Wat het verandert |
|---|---|---|
| Hoe vaak tikt iemand Undo nu het 5 kost, en hoe vaak Restart? | `undo` (met `refused`) en het aantal Restarts per level | De hele uitkomst: zie de gevoeligheid in hoofdstuk 3 |
| Bij welk level is een echte tester voor het eerst droog, en door welke knop? | Kasboek: eerste regel met een weigering; "Spent on Undo / hints / +3 moves" | Of level 21 klopt, en of de start van 50 goed zit |
| Hoe vaak drie sterren, per level? | `level_win` met `stars` | De inkomsten; nu aangenomen 70% → 15% |
| Wordt een hint van 20 nog gekocht? | `hint` en `coins_spent` op `hint` | Of 20 te duur is; onder de oude prijs van 10 was er de verborgen strafkorting |
| Wordt +3 moves van 40 ooit gekocht? | `extra_moves` tegenover `level_fail` met `rescuable: 'yes'` | Als het bijna nooit gekocht wordt, is 40 te duur of het aanbod niet aantrekkelijk |
| Koopt iemand überhaupt, en hoe snel is een pakket op? | `purchase`; het saldo in de levels erna | Of de pakketten passen |
| Hoeveel houdt een goede speler over? | Saldo na level 20 en 40 | Of er iets moet komen om munten aan uit te geven |
| Voelt "tekort" als pech of als een val? | Niet te meten: vragen aan de tester, en kijken of hij na een weigering stopt | Het belangrijkste, en het model zegt er niets over |

Wat het model ook niet weet: of mensen hun gedrag aanpassen als ze droog staan (waarschijnlijk wel:
meer Restart), of een kind de prijs op de knop leest, en of iemand die tekortkomt koopt of stopt met
spelen.

## 10. Open besluiten voor de eigenaar

1. **Blijft B staan, of wil je ruimer of krapper?** Wisselen is getallen overnemen uit
   `tools/economy/sets.json`. Mijn advies: B, en pas bijstellen na de eerste echte speelsessies.
2. **Eén gratis Undo per level (B+)?** Dat draait een deel van je keuze bij B4 terug. Het kost in het
   model het grootste deel van wat de gewone speler zou bijleggen (van 172 naar 54 over 40 levels), en
   het voorkomt dat een misgetikte zet geld kost. Mijn advies: doen zodra er een echte winkel komt, en
   in elk geval als kinderen de doelgroep zijn.
3. **Hint 20: akkoord?** De hint is verdubbeld, maar kost de beloning niet meer. Voor wie vastzit is
   het de enige uitweg; 15 is het alternatief als 20 in de test te zwaar blijkt.
4. **Een kraan voor wie vastzit zonder munten.** Nu is er geen manier om munten te verdienen buiten
   nieuwe winsten. Mogelijkheden: gehaalde levels weer bereikbaar maken, zodat betere resultaten hun
   verschil kunnen uitbetalen (hangt aan de open vraag bij B2), of een gratis hint na een aantal
   mislukte pogingen op hetzelfde level. Geen van beide is gebouwd.
5. **Spelers die halverwege zijn**: niets erbij (zoals nu), of het verschil met de nieuwe bedragen
   alsnog uitkeren?
6. **Iets om munten aan uit te geven voor goede spelers.** De puzzelaar houdt rond de 900 munten over
   na 40 levels. Zolang munten alleen hulp kopen, hebben de beste spelers er niets aan.
7. **Kinderen**: is dit spel voor hen bedoeld? Zo ja, dan horen B+ en een oudercontrole bij elke
   echte winkel, en is C uitgesloten.

## 11. Niet gecontroleerd

Zie het bewijs en de testuitslagen in `production/qa/evidence/economy/README.md`. Niet gecontroleerd is
in elk geval: of echte spelers zich gedragen zoals de vijf aangenomen spelers; het gedrag op een echte
telefoon; en het samengaan met de branches van de testwinkel, de knoppenrij en de draaitegel, die
tegelijk worden gebouwd en hier niet zijn samengevoegd.
