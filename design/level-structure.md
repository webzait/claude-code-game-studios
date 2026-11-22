# Levelstructuur TURNFLOCK

Dit document legt vast hoe levels worden gemeten, geordend, gemaakt en bewezen, wat pagina 1 en 2 bevatten,
wat pagina 3 kan worden, en welk voorstel er ligt voor nieuwe levelelementen. De getallen per level staan in
`design/level-report.md` (gegenereerd, niet met de hand bijhouden). Stand: 22 november 2026: 60 levels in het
spel; pagina 3 (20 levels met de draaitegel) is getekend, geanimeerd, bewezen en in het lopende spel uitgespeeld.

De draaitegel is op 22 november 2026 met jouw akkoord aan de engine toegevoegd en daarna getekend en
geanimeerd (hoofdstuk 7); verder zijn de kernmechaniek, de schermen en het uiterlijk niet aangeraakt.
Er is geen verhaal, kaart of wereld; levels staan in gewone pagina's van 20.

## 1. De moeilijkheidsmaat

### Wat er per level wordt gemeten

Het gereedschap in `tools/level-design/` bouwt per level de volledige graaf van alle standen die binnen het
zetbudget (kortste oplossing + 2) bereikbaar zijn, met dezelfde `step`-functie als het spel. Daaruit komen:

| Getal | Betekenis |
|---|---|
| Kortste | Lengte van de kortste oplossing |
| Aantal kortste | Hoeveel verschillende commandoreeksen van die lengte winnen |
| Draaien | Kleurcommando's in de oplossing (de rest is VOORUIT) |
| Zoekruimte | Standen die een breedte-eerst-zoektocht bezoekt tot de eerste winst |
| Binnen budget | Alle standen die binnen het budget bereikbaar zijn |
| Dood | Aandeel van die standen waarvandaan winnen binnen het budget niet meer kan |
| Fatale zet | Aandeel van alle zetten vanuit een nog winbare stand dat het level onwinbaar maakt |
| Gedwongen | Commando's van de oplossing waarbij elk ander commando de kortste route verlaat (en tussen haakjes: het level verliest) |
| Weg van uitgang | Kleinste aantal zetten, over *alle* kortste oplossingen, waarin een robot van de uitgang wegloopt |
| Botsen | Kleinste aantal zetten, over alle kortste oplossingen, waarin een robot ergens tegenaan blijft staan terwijl de rest doorloopt |
| Volgorde vrij | Aandeel van de herschikkingen van de oplossing dat ook wint |
| Robots, kleuren, bord | Geteld |

"Weg van uitgang" en "Botsen" zijn samen het antwoord op de vraag of de oplossing een zet nodig heeft die
verkeerd lijkt. Ze worden over alle kortste oplossingen genomen en niet over één voorbeeld: is het getal
groter dan nul, dan bestaat er geen kortste oplossing zonder zo'n zet.

### Wat de meting opleverde dat niet was voorzien

1. **"Dood" onderscheidt levels niet.** Bij een budget van kortste + 2 is 84 tot 100 procent van alle
   bereikbare standen verloren, bij elk level, omdat de laatste lagen bijna helemaal uit verloren standen
   bestaan. Het getal staat in het rapport omdat erom gevraagd is, maar het telt niet mee in de score.
   Daarvoor in de plaats komt **"Fatale zet"**: van alle zetten die je vanuit een nog winbare stand kunt doen,
   welk deel maakt het level onwinbaar. Dat loopt van 41 tot 68 procent en onderscheidt wel.
2. **Draaien weegt zwaarder dan lopen.** Twee levels met dezelfde lengte voelen heel anders als het ene
   drie keer draait en het andere zeven keer. Het aantal kleurcommando's is daarom een eigen onderdeel van de score.
3. **De solver had een fout** die tijdens het meten boven water kwam (inmiddels gerepareerd). Zie hoofdstuk 5;
   het raakte de manier waarop levels worden bewezen.

### De score (0 tot 10)

Een optelsom van zes onderdelen. De gewichten staan in `data/config.json` onder `levelDesign.score` en zijn
beschreven in `data/config-notes.md`.

| Onderdeel | Gewicht | Waar het voor staat |
|---|--:|---|
| Zoekruimte | 3,5 | log₂ van het aantal standen tot de eerste winst: hoeveel er te overzien is. Vat lengte, kleuren en robots samen |
| Draaien | 2,0 | Aantal kleurcommando's in de oplossing (8 of meer telt vol) |
| Tegendraads | 1,5 | (weg van uitgang + botsen) gedeeld door de lengte |
| Robots | 1,0 | Aantal robots, logaritmisch (12 telt vol) |
| Smal | 1,0 | Aandeel gedwongen commando's × (1 − volgorde vrij) |
| Onvergeeflijk | 1,0 | Aandeel fatale zetten, tussen 30 en 80 procent |

Het rapport toont per level uit welke onderdelen de score bestaat. Dat is de korte verantwoording per level.

### Getoetst aan de bestaande 10

| Oude plek | Level | Score | Plek volgens de score |
|--:|---|--:|--:|
| 1 | Follow the Arrow | 3,1 | 1 |
| 2 | One Color Turns | 4,8 | 3 (gelijk met 4) |
| 3 | Side Door | 4,2 | 2 |
| 4 | Use the Wall | 4,8 | 3 (gelijk met 2) |
| 5 | Queue Up | 6,3 | 6 |
| 6 | Traffic Jam | 6,4 | 7 |
| 7 | Long Way Round | 5,5 | 5 |
| 8 | Two Lanes | 7,0 | 8 |
| 9 | Patience | 7,6 | 9 |
| 10 | One Command, Many Consequences | 7,9 | 10 |

De score volgt de oude volgorde op twee plekken na. *Side Door* komt vóór *One Color Turns*: het is korter en
heeft geen enkele tegendraadse zet. *Long Way Round* komt vóór *Queue Up* en *Traffic Jam*: het heeft twee
kleuren en vier kortste oplossingen, tegen drie kleuren en één oplossing, en zijn zoekruimte is ruim de helft
kleiner. Beide verschuivingen zijn te verdedigen, maar **dit is een toets tegen de volgorde van de maker, niet
tegen spelers**. Of een speler *Queue Up* echt lastiger vindt dan *Long Way Round* is niet gemeten. De
gewichten zijn een eerste ijking op tien levels; met speeldata (zetten boven de kortste oplossing, aantal
pogingen per level) kunnen ze worden bijgesteld zonder code te wijzigen.

Wat de score niet ziet: hoe leesbaar een bord is, en of een oplossing een herkenbaar patroon heeft ("elke
kleur één keer") dat een mens sneller vindt dan de zoekruimte doet vermoeden.

## 2. De ideeën die de huidige regels al bieden

Elk level draagt één idee dat een speler in één zin kan zeggen. Dit zijn de zestien ideeën van de huidige
regels, met waar ze worden geleerd (L) en waar ze terugkomen. Elk idee is ook een recept voor de generator
(`tools/level-design/ideas.json`).

| Idee | In één zin | Geleerd | Komt terug |
|---|---|:-:|---|
| `forward` | VOORUIT zet iedereen één stap | L1 | overal |
| `turn` | Een kleur draait een kwartslag met de klok mee en stapt dan | L2 | overal |
| `wait-at-wall` | Wie tegen de rand loopt, wacht; achterblijvers halen in | L3 | 19 |
| `two-colours` | Alleen de gekozen kleur draait, maar iedereen stapt | L4 | 9 |
| `wall-stopper` | Een muur zet een robot stil terwijl de rest doorloopt (parkeren, uit de pas raken) | L5 | 11, 22, 38 |
| `same-colour` | Eén kleur, verschillende richtingen: één druk stuurt ze verschillend | 6 | 33 |
| `exit-sides` | De uitgang in via verschillende kanten; uitgang aan de rand of midden in het bord | 7 | 10, 25, 35 |
| `queue` | In de rij: wachten op de robot voor je | 8 | 16, 18, 32, 37 |
| `three-colours` | Drie kleuren uit elkaar houden | 12 | 21, 26, 36 |
| `tight` | Klein bord: geen ruimte om om elkaar heen te lopen | 13 | 28, 31 |
| `three-rights` | Alleen rechtsom: links is drie keer rechts, en je loopt terwijl je draait | 14 | 27, 39 |
| `conflict` | Twee robots die hetzelfde vakje willen, blijven allebei staan | 15 | 30 |
| `board-shape` | Andere bordvormen: lang (4×7), breed (7×5), laag (8×4) | 17 | 24, 29 |
| `together` | Meerdere robots tegelijk de uitgang in | 23 | 35, 40 |
| `crowd` | Veel robots: één commando, veel gevolgen | 20 | 34 |
| `big` | Het grootste bord (8×8) | 40 | pagina 3 |

Nog niet als eigen level gebruikt, wel mogelijk met de huidige regels: een gesloten kring van robots die
niet beweegt (de engine blokkeert kringen en ruilen), en de enkele-uitgang-regel uit het testlab.

## 3. De boog van een pagina

Elke pagina van 20 is een kleine boog. Moeilijkheid stijgt in een zaagtand: na een lastig level komt een
makkelijker level met een nieuwe draai.

| Plek | Rol | Richtscore |
|---|---|---|
| 1–5 | Eén idee per level introduceren of opnieuw introduceren | pagina 1: 1–3 · pagina 2: 4,5–5 |
| 6–14 | Ideeën combineren, zaagtand | 4–6,5 |
| 15–18 | Piek, met één lichter level ertussen | tot 6,5 (pagina 1) · tot 7,5 (pagina 2) |
| 19 | Adempauze | 3,5–5 |
| 20 | Pronkstuk: groot om te zien, niet per se het moeilijkste | 7,5–8 |

Vuistregels die bij het ordenen zijn gebruikt:
- Nooit meer dan twee levels achter elkaar stijgen in het middendeel.
- Een nieuw idee komt eerst in een level met een score onder het voorgaande.
- Twee levels met hetzelfde idee staan niet naast elkaar.
- Bordgrootte wisselt: geen drie keer dezelfde afmeting achter elkaar als het te vermijden is.

Pagina 2 begint lager dan pagina 1 eindigt (4,4 na 7,9): een nieuwe pagina is een nieuw begin.

## 4. Pagina 1, 2 en 3

### Pagina 1 (level 1–20): de regels en de eerste combinaties

| # | Level | Idee | Bord | Score | Herkomst |
|--:|---|---|:-:|--:|---|
| 1 | First Steps | `forward` | 4×4 | 0,8 | hand, nieuw |
| 2 | Quarter Turn | `turn` | 4×4 | 1,8 | hand, nieuw |
| 3 | Follow the Arrow | `wait-at-wall` | 5×4 | 3,1 | bestaand |
| 4 | Everyone Steps | `two-colours` | 4×4 | 2,1 | hand, nieuw |
| 5 | Lean on It | `wall-stopper` | 5×5 | 2,7 | hand, nieuw |
| 6 | Two Minds | `same-colour` | 5×5 | 3,1 | gegenereerd |
| 7 | Side Door | `exit-sides` | 6×6 | 4,2 | bestaand |
| 8 | Wait Your Turn | `queue` | 5×4 | 3,8 | gegenereerd |
| 9 | One Color Turns | `two-colours` | 5×5 | 4,8 | bestaand |
| 10 | Four Doors | `exit-sides` | 5×5 | 4,0 | gegenereerd |
| 11 | Use the Wall | `wall-stopper` | 6×5 | 4,8 | bestaand |
| 12 | Three of a Kind | `three-colours` | 5×5 | 4,3 | gegenereerd |
| 13 | Close Quarters | `tight` | 4×4 | 4,9 | gegenereerd |
| 14 | Long Way Round | `three-rights` | 6×5 | 5,5 | bestaand |
| 15 | After You | `conflict` | 5×5 | 4,8 | gegenereerd |
| 16 | Queue Up | `queue` | 6×6 | 6,3 | bestaand |
| 17 | The Corridor | `board-shape` | 4×7 | 5,1 | gegenereerd |
| 18 | Traffic Jam | `queue` | 6×6 | 6,4 | bestaand |
| 19 | Staircase | `wait-at-wall` | 6×5 | 3,6 | hand, nieuw |
| 20 | One Command, Many Consequences | `crowd` | 6×6 | 7,9 | bestaand |

**Level 1 tot 5 leren de regels zonder tekst**, één ding per level:
1. *First Steps*: alleen VOORUIT wint (drie zetten). De knop pulseert zoals nu al op level 1.
2. *Quarter Turn*: één robot, één keer ROOD, op het moment dat hij tegen de rand staat.
3. *Follow the Arrow*: drie robots; wie eerder bij de rand is, wacht daar.
4. *Everyone Steps*: BLAUW draait alleen blauw, maar rood stapt in dezelfde zet mee (drie zetten).
5. *Lean on It*: de eerste muur; hij houdt de voorste robot tegen tot de achterste naast hem staat.

*Follow the Arrow* was level 1 en is nu level 3. Het vraagt VOORUIT, ROOD én wachten bij de rand in één
level; dat zijn drie dingen. Level 1 en 2 nemen de eerste twee apart.

Een kanttekening bij level 5: mijn eerste ontwerp had twee muren. Het opschoongereedschap liet zien dat de
linker niets deed (de achterste robot komt vanzelf op tijd), dus die is weggelaten.

### Pagina 2 (level 21–40): dezelfde ideeën op andere borden, drie kleuren als gewoonte

| # | Level | Idee | Bord | Score | Herkomst |
|--:|---|---|:-:|--:|---|
| 21 | Easy Does It | `three-colours` | 6×5 | 4,4 | gegenereerd |
| 22 | Parking Spot | `wall-stopper` | 5×5 | 4,6 | gegenereerd |
| 23 | All Together Now | `together` | 6×5 | 4,8 | gegenereerd |
| 24 | Wide Open | `board-shape` | 7×5 | 5,0 | gegenereerd |
| 25 | Centre Stage | `exit-sides` | 5×5 | 5,0 | gegenereerd |
| 26 | Peel Off | `three-colours` | 5×5 | 5,7 | gegenereerd |
| 27 | Three Rights | `three-rights` | 6×5 | 5,1 | gegenereerd |
| 28 | Elbow Room | `tight` | 4×4 | 5,9 | gegenereerd |
| 29 | The Long Hall | `board-shape` | 8×4 | 5,6 | gegenereerd |
| 30 | Gridlock | `conflict` | 6×5 | 6,6 | gegenereerd |
| 31 | Tight Squeeze | `tight` | 5×4 | 5,8 | gegenereerd |
| 32 | Two Lanes | `queue` | 6×5 | 7,0 | bestaand |
| 33 | Back of the Line | `same-colour` | 6×5 | 5,7 | gegenereerd |
| 34 | Full House | `crowd` | 6×6 | 6,2 | gegenereerd |
| 35 | Roundabout | `exit-sides` | 7×7 | 7,0 | gegenereerd, opgeschoond |
| 36 | Colour Guard | `three-colours` | 6×6 | 7,4 | gegenereerd |
| 37 | Single File | `queue` | 6×6 | 5,9 | gegenereerd |
| 38 | Patience | `wall-stopper` | 6×6 | 7,6 | bestaand |
| 39 | Detour | `three-rights` | 5×5 | 4,8 | gegenereerd |
| 40 | Grand Parade | `big` | 8×8 | 7,4 | gegenereerd, opgeschoond |

Waar pagina 2 afwijkt van de ideale boog: level 21 tot 26 stijgen bijna in een rechte lijn (4,4 tot 5,7) in
plaats van in een zaagtand. Het zijn de herintroducties en de verschillen zijn klein; ik heb ze zo gelaten
in plaats van een level te kiezen dat zijn idee minder zuiver toont.

Tien bordmaten in 40 levels: 4×4, 5×4, 5×5, 6×5, 6×6, 4×7, 7×5, 8×4, 7×7 en 8×8.

**De bestaande 10** zijn alle tien behouden, met hun `id`, bord, `par` en getuige-oplossing ongewijzigd. Acht
staan op pagina 1, *Two Lanes* en *Patience* op pagina 2 (hun scores van 7,0 en 7,6 horen bij een piek van
pagina 2, niet bij pagina 1). Er is geen level uit de reeks gehaald. Voortgang staat per `id` opgeslagen,
dus een bestaande save houdt zijn sterren; wel kan een speler nu "gaten" zien: een opgelost level 9 naast een
nog gesloten level 8. De ontgrendelregel (het vorige level opgelost) is niet aangepast. Zie beslissing 5.

### Pagina 3 (level 41–60): de draaitegel — in het spel

De 20 levels staan sinds 22 november 2026 in `data/levels.json`, met dezelfde id's en in dezelfde volgorde als
ze in `data/levels-upcoming.json` stonden (dat bestand is weg). Ze zijn op precies dezelfde manier bewezen als
de 40 andere (`tests/unit/levels.test.ts`: de opgeslagen oplossing wint, `par` is de echte kortste oplossing,
en een tweede, onafhankelijke zoektocht komt op dezelfde lengte). Geen level is gewijzigd, vervangen of
geschrapt bij het in het spel brengen.

| # | Level | Idee | Bord | Tegels | Score | Herkomst |
|--:|---|---|:-:|--:|--:|---|
| 41 | Turntable | `turn-tile` | 4×4 | 1 | 0,7 | hand |
| 42 | Corner Piece | `turn-tile` | 5×4 | 1 | 2,3 | gegenereerd |
| 43 | Two for One | `turn-tile` | 5×5 | 1 | 3,1 | gegenereerd |
| 44 | Mind the Tile | `tile-to-avoid` | 5×5 | 1 | 4,1 | gegenereerd |
| 45 | Bank Shot | `turn-tile` + muur | 5×5 | 1 | 3,7 | gegenereerd |
| 46 | Merge Lane | `queue` | 6×5 | 1 | 5,2 | gegenereerd |
| 47 | Standoff | `conflict` | 5×5 | 1 | 5,2 | gegenereerd |
| 48 | Switchback | `board-shape` | 4×7 | 2 | 5,1 | gegenereerd |
| 49 | Three Way | `three-colours` | 6×5 | 1 | 6,0 | gegenereerd |
| 50 | Open Floor | `crowd` | 7×7 | 0 | 6,8 | gegenereerd, opgeschoond |
| 51 | Carousel | `same-colour` | 6×5 | 2 | 5,5 | gegenereerd |
| 52 | Spiral In | `exit-sides` | 6×6 | 1 | 5,6 | gegenereerd |
| 53 | Long Table | `board-shape` | 8×6 | 0 | 7,0 | gegenereerd, opgeschoond |
| 54 | Pinball | `tight` | 4×4 | 1 | 5,8 | gegenereerd |
| 55 | Crowded Corner | `crowd` | 6×6 | 2 | 7,0 | gegenereerd, opgeschoond |
| 56 | Tricolour | `three-colours` | 6×6 | 2 | 7,4 | gegenereerd |
| 57 | Cliff Walk | `big` | 8×8 | 1 | 6,9 | gegenereerd, opgeschoond |
| 58 | Whirl | `turn-tile` | 7×7 | 2 | 8,5 | gegenereerd, opgeschoond |
| 59 | Conga Line | `wait-at-wall` | 6×5 | 1 | 3,6 | gegenereerd |
| 60 | Grand Finale | `big` | 8×8 | 1 | 6,7 | gegenereerd, opgeschoond |

Level 41 tot 45 leren de tegel, één ding per level: het bord draait voor je (alleen VOORUIT); één kleurdruk
plus de tegel; twee robots over dezelfde tegel; een tegel die je moet mijden; tegel en muur samen. Level 50 en
53 hebben geen tegel en laten de grote borden zien. De piek is level 58 (8,5, het hoogste van alle 60).

Eerlijk hierover:
- Eén level met de hand (41), zes door het gereedschap opgeschoond (overbodige muren en tegels weg), dertien
  ongewijzigd gekozen.
- De volledige meting is afgekapt bij 3 miljoen standen voor *Grand Finale*; lengte en oplossing zijn bewezen.
- Het pronkstuk (6,7) is niet het moeilijkste level van de pagina, en lager dan de richtscore van 8.
  De zoektocht naar een zwaarder 8×8-bord met tien of meer robots liep steeds tegen de zoeklimiet aan; een
  level dat de tests niet in een paar seconden kunnen bewijzen wilde ik niet opnemen.
- **Gezien en gespeeld, maar alleen door de maker.** Alle 20 zijn met hun opgeslagen oplossing in het lopende
  spel gewonnen (de browsertest "every level can be played to a win in order" en een aparte doorloop met
  schermafbeeldingen in `production/qa/evidence/turn-tile/`), en acht zijn daarnaast met eigen, afwijkende
  commando's gespeeld (42, 43, 44, 45, 47, 48, 54, 58). Wat dat opleverde:
  - Het zetbudget is net als op pagina 1 en 2 de kortste oplossing plus 2. Eén verkeerde zet is daardoor
    meestal fataal, vaak al de eerste (level 41: ROOD als eerste zet; level 42: VOORUIT als eerste zet). Dat is
    dezelfde strengheid als op de eerste twee pagina's, geen nieuwe; herstellen gaat met Undo of de gratis
    Restart, en de hint zegt hoeveel zetten terug. Een speler ziet een verloren stand niet aan het bord.
  - *Mind the Tile* (44): de tegel ligt niet op de route van de oplossing, maar is wel een echte val: wie
    BLAUW één zet te vroeg indrukt, stuurt een blauwe robot over rij 2 de tegel op en raakt hem kwijt.
  - *Conga Line* (59) is met 3,6 bewust een adempauze voor het slotlevel, geen vergissing in de volgorde.
  - Geen van de 20 bleek op het scherm saai, verwarrend of oneerlijk genoeg om te vervangen. Dat is het oordeel
    van één maker die de oplossingen kende; een echte speler heeft ze niet gezien.

## 5. Hoe een level wordt gemaakt en bewezen

### Maken: de machine stelt voor, een mens kiest

1. **Recept.** Elk idee heeft een recept in `tools/level-design/ideas.json`: bordmaat, robots per kleur,
   aantal muren, plek van de uitgang, gewenste lengte, en het kenmerk dat het idee bewijst (bijvoorbeeld
   "minstens twee keer wacht een robot achter een andere" voor `queue`).
2. **Genereren.** `npm run generate -- <idee>` maakt honderden tot duizenden borden. Twee manieren:
   - *willekeurig plaatsen* en dan oplossen;
   - *achteruit werken*: eerst een bedoelde oplossing trekken (lopen, een paar draaien, lopen), dan robots
     zoeken die daar elk mee thuiskomen en het samen ook nog doen. Dit heb ik toegevoegd nadat de eerste
     ronde willekeurige borden weliswaar geldig was, maar bijna elke zet een draai vroeg ("BBRRBRBR"), heel
     anders dan de handgemaakte levels. Achteruit werken geeft borden die lopen in plaats van tollen, en is
     het idee van het al bestaande `compose.ts`, nu geautomatiseerd.
3. **Zeven en meten.** Een kandidaat valt af als hij onoplosbaar is, te lang of te kort, triviaal (één
   herhaald commando, of winbaar in bijna elke volgorde: de helft van de herschikkingen of meer), te los
   (meer kortste oplossingen dan het recept toestaat, standaard vier, in de recepten twee), buiten het
   zoekbudget, zonder het kenmerk van zijn idee, of **niet bevestigd door de solver van het spel**. Muren die
   niets veranderen worden automatisch weggehaald.
4. **Kiezen.** Per plek in de boog heb ik acht tot tien kandidaten gelezen en er één gekozen: de kandidaat
   waarvan de oplossing het idee het zuiverst laat zien, met zo min mogelijk bijzaken, en met een score die
   op die plek past. Daarna naam, plek en één zin.

### Eerlijk over de herkomst van de 30 nieuwe levels

| Herkomst | Aantal | Welke |
|---|--:|---|
| Met de hand gemaakt | 5 | First Steps, Quarter Turn, Everyone Steps, Lean on It, Staircase |
| Gegenereerd en opgeschoond | 2 | Roundabout (twee overbodige muren weg), Grand Parade (alle negen muren bleken overbodig en zijn weg) |
| Gegenereerd, ongewijzigd gekozen | 23 | de overige |

Het opschonen is door het gereedschap gedaan, niet met de hand. Met de hand bijwerken heb ik bij de
gegenereerde levels **niet** gedaan: elke verplaatste robot is een ander raadsel dat opnieuw bewezen moet
worden, en waar een bord niet schoon was, lag er een andere kandidaat die het wel was. Spiegelen kan ook
niet zomaar, omdat draaien alleen met de klok mee gaat: een gespiegeld bord is een ander level. Het
handwerk zat dus in het kiezen, het ordenen, de namen en de vijf leerlevels. Als je meer handwerk per
level wilt, is dat een bewuste vervolgstap; zie "Niet gecontroleerd".

De recepten en startgetallen van de generatorrondes staan niet per level vastgelegd. Dezelfde opdracht met
hetzelfde startgetal geeft dezelfde kandidaten, maar de generator is tijdens het werk nog aangescherpt
(strengere afwijzing), dus de precieze lijsten van toen zijn niet gegarandeerd terug te halen. De levels
zelf staan vast in `data/levels.json` en hangen daar niet van af.

### Bewijzen

`npm run test:unit` bewijst voor elk van de 40 levels:
- de opgeslagen getuige-oplossing wint, gespeeld door de echte spelsessie;
- `par` is de kortste oplossing volgens de solver van het spel, zonder zoeklimiet;
- **een tweede, onafhankelijke zoektocht komt op dezelfde lengte uit** (nieuw, zie hieronder);
- alleen level 1 is met enkel VOORUIT te winnen;
- de `id`'s en namen zijn uniek, de tien oude `id`'s bestaan nog op hun oude bord, en elk level heeft een
  idee, een herkomst en een zin in de catalogus.

Geen enkel level heeft een hint, extra zetten of betaalde hulp nodig: het budget is overal kortste + 2 en
de getuige gebruikt precies de kortste lengte.

**Tijd.** De hele unit-suite duurt nu ongeveer 26 seconden (was 13 met 10 levels). Het zwaarst zijn één
bestaande test die alle levels onder de enkele-uitgang-regel doorrekent (ongeveer 25 seconden wandklok,
parallel aan de rest; die test heeft al een limiet van 400.000 standen per level) en de certificering van
*Grand Parade* (3 seconden) en *One Command, Many Consequences* (2 seconden). Begrensd is het zo: bij het
kiezen van grote levels is de zoekruimte tot de eerste winst onder ongeveer 550.000 standen gehouden. De
volledige meting van een level (alle standen binnen het budget) zit niet in de tests maar in
`npm run measure`, dat anderhalve minuut duurt en zijn uitkomsten bewaart.

De Playwright-tests tegen het gebouwde spel zijn ook bijgewerkt en groen (10 van 10). Eén daarvan speelt alle
40 levels op volgorde uit met hun getuige-oplossing; die duurt nu bijna 10 minuten in een browser zonder
grafische kaart (was ruim 2 minuten met 10 levels). De andere negen samen 3 minuten. Die tests noemen levels
nu bij `id` in plaats van bij plek, zodat een andere volgorde ze niet meer breekt.

*Grand Parade* is het enige level waarvan de volledige meting is afgekapt (bij 3 miljoen standen; het
rapport zet er ⚠ bij). Zijn lengte en oplossing zijn wél volledig bewezen; alleen de aandelen "dood" en
"fatale zet" zijn daar ondergrenzen.

### Gevonden en gerepareerde fout in de engine: twee standen met dezelfde sleutel

Tijdens het meten bleek dat `stateKey` in `src/engine/engine.ts` een opgenomen robot schrijft als het teken
`~` (code 126). Een robot op vakje 19 die naar beneden kijkt, krijgt ook code 126 (48 + 19 × 4 + 2). De
solver houdt twee verschillende standen dan voor dezelfde en kan de route naar de winst weggooien.

Gevolgen, alle drie waargenomen:
- een bord met een oplossing in 9 zetten meldt de solver als onoplosbaar binnen 10;
- bij vier kandidaten die ik voor pagina 1 en 2 had gekozen of als vervanger probeerde, gaf de solver een
  te lange kortste oplossing (16 in plaats van 7, 12 in plaats van 7, en twee keer 8 in plaats van 7).
  Die borden zijn niet opgenomen;
- de hint en de redding in het spel gebruiken dezelfde solver en kunnen dus in zeldzame standen ten onrechte
  "doodlopend" melden.

Vakje 19 is op een bord van 5 breed (4,3), op 6 breed (1,3), op 4 breed (3,4), op 7 breed (5,2) en op 8
breed (3,2). De tien bestaande levels zijn nagerekend met de onafhankelijke zoektocht: hun `par` klopt.

**Gerepareerd op 22 november 2026, na jouw akkoord.** Een opgenomen robot krijgt nu een teken dat geen
vakje kan zijn; er is geen spelregel veranderd. De twee tests die de fout vastlegden zijn vóór de reparatie
rood gezien en zijn nu gewone regressietests in `tests/unit/level-tools.test.ts`. De `par` van alle 40
levels is na de reparatie opnieuw bevestigd. De tweede zoektocht in de certificering en de controle in de
generator blijven staan als vangnet.

## 6. Het gereedschap

| Opdracht | Doet |
|---|---|
| `npm run measure` | Meet alle levels en schrijft `design/level-report.md` |
| `npm run generate -- <idee> [sleutel=waarde …]` | Stelt kandidaten voor; zonder argumenten de lijst van ideeën |
| `npm run solve` | Kortste oplossing van elk level of van borden in een bestand (bestond al) |

Uitleg en werkwijze: `tools/level-design/README.md`. De metingen zelf zijn getest op kleine borden waarvan
de getallen met de hand zijn na te tellen (`tests/unit/level-tools.test.ts`), en de snelle kopie van de
regels die de generator als zeef gebruikt, wordt daar zet voor zet met de echte engine vergeleken.

## 7. Nieuwe levelelementen

**Stand 22 november 2026.** Van de zeven kandidaten hieronder is er één gebouwd: **A, de draaitegel**, in de
engine, de levelparser, de zeef, de generator en de meting, en sinds dezelfde dag ook getekend en geanimeerd.
Wat er precies in zit:

- Celcode `@@` in een level. Een robot kan er niet op beginnen.
- De regel, als zevende stap van `step`: een robot die deze zet op de tegel *aankomt*, draait daar een
  kwartslag met de klok mee, welke kleur hij ook heeft. Wie op de tegel staat en geblokkeerd blijft, draait
  niet opnieuw. Wie geblokkeerd wordt vóór hij de tegel bereikt, draait niet.
- De draai van de tegel komt bovenop een kleurdraai in dezelfde zet (ROOD en dan de tegel is een halve slag).
- De toestand is niet groter geworden; de solver is niet gewijzigd.
- Elk stapverslag heeft een veld `tileTurned`, zodat het tekenwerk de extra draai kan laten zien.
- Een bord zonder tegels gedraagt zich exact als voorheen: de 40 bestaande levels en al hun tests zijn
  onveranderd groen.

**Hoe de tegel eruitziet en beweegt** (`buildTurnTile` in `src/render/parts/board.ts`, maten in
`data/parts.json` onder `turnTile`, kleuren `colors.kit.turn*` en tijden `anim.tile*` in `data/config.json`):

- Een gewone vloertegel met een ingelaten ronde draaischijf: witte schijf, twee donkere pijlen die elkaar met
  de klok mee achtervolgen, en een periwinkle kraag (de kleur van de bordrand) tot bijna aan de tegelrand.
  Geen rood, blauw, geel of groen: de tegel hoort bij het bord, niet bij een robotkleur. Rond in plaats van
  vierkant, twee pijlen in plaats van één haak, donker op wit in plaats van wit op kleur: zo lijkt hij niet op
  een commandoknop, niet op de richtingsdriehoek van een robot en niet op het vinkje van de uitgang.
- Een robot die erop staat bedekt de pijlen; de kraag blijft eromheen zichtbaar, en zodra de robot wegstapt
  zijn de pijlen terug.
- De animatie: de robot maakt eerst zijn stap af, staat een ogenblik stil (`tileTurnPause`, 0,07 s) en wordt
  dan samen met de schijf een kwartslag met de klok mee gedraaid (`tileTurnTime`, 0,22 s) terwijl een lichtring
  rond de schijf opflitst. De robot hupt daarbij niet, anders dan bij een kleurdraai: het bord doet het. Undo
  speelt hetzelfde achteruit (eerst terugdraaien op de tegel, dan terugglijden). Met "minder beweging" draait
  de robot zonder doorschieten.
- De aanwijzing: bij het openen van een level maakt elke draaischijf één keer een kwartslag met een lichtflits,
  nog voor de speler iets heeft aangeraakt. Meer uitleg is er niet; er staat nergens tekst.
- De hint tekent de volgende zet met de eigen stap van de engine en laat nu ook de extra draai zien: een tweede
  kwartboog rond het vakje van de tegel.
- De twee getekende ontwerpen (A: twee pijlen op wit, gebouwd; B: één lange pijl op een paarse schijf) staan
  naast elkaar op de onderdelenpagina (`npm run build:parts`, kaart "Draaitegel") op 53 en 42 px. B is
  afgevallen omdat hij op die grootte als een ronde knop leest en zijn paars bij rood-groen-kleurenblindheid
  naar het blauw van de blauwe robot trekt.

De koppeling tussen engine en beeld is een klein stuk zuivere code (`src/render/stepPlan.ts`): elk
`tileTurned`-verslag geeft precies één draai-tel op het vakje waar de robot aankwam. De unittest
`tests/unit/turn-tile.test.ts` speelt daarmee de oplossing van elk tegel-level na en controleert dat de getoonde
richting van elke robot na elke zet gelijk is aan die van de engine.

De rest van dit hoofdstuk is het oorspronkelijke voorstel, ongewijzigd, als verantwoording van de keuze.
B tot en met G zijn niet gebouwd.

### Waar elk element aan moet voldoen

1. **Het versterkt "één commando, veel gevolgen".** De speler krijgt geen vijfde knop en geen robot die
   hij apart bestuurt. Het element verandert alleen wat één stap van de hele groep doet.
2. **Het blijft deterministisch.** Dezelfde stand en hetzelfde commando geven altijd hetzelfde resultaat.
3. **De toestand blijft klein en eindig**, zodat de breedte-eerst-solver elk level blijft bewijzen. Nu is
   een toestand: per robot een vakje, een richting en "binnen of niet". Een element mag daar een paar bits
   aan toevoegen, geen open einde.
4. **Het is zonder tekst te lezen.** Eén blik op het bord moet zeggen wat het vakje doet.

Notatie in de voorbeelden: de bestaande celcodes, plus een nieuwe code per element. De voorbeeldborden
zijn met de hand doorgerekend, niet door de solver (die kent het element nog niet).

### A. Draaitegel

- **Wat het is:** een vloertegel met een gebogen pijl. Een robot die een stap *eindigt* op de tegel, draait
  daar een kwartslag met de klok mee, welke kleur hij ook heeft.
- **Toestand erbij:** geen. De tegel is deel van het vaste bord, net als een muur.
- **Eén stap:** na stap 6 van de engine (vastleggen) draait elke robot die zojuist op een draaitegel is
  aangekomen één kwartslag. Een robot die er al stond en geblokkeerd bleef, draait niet opnieuw.
- **Waarom oplosbaar:** de regel hangt alleen af van de stand na de stap; de toestandsruimte wordt niet
  groter. De solver verandert niet, alleen `step`.
- **Voorbeeld** (`@>` = draaitegel):

  ```text
  r> .. @> ..
  .. .. .. ..
  .. .. EX ..
  ```

  VOORUIT, VOORUIT (de robot komt op de tegel en kijkt nu naar beneden), VOORUIT, VOORUIT: binnen in
  vier zetten zonder één keer ROOD. Met ROOD erbij loopt hij juist verkeerd.
- **Wat het leert:** het bord kan voor je draaien. Twee robots van dezelfde kleur raken uit de pas zonder
  dat je iets extra's indrukt, en een draai "gratis" laten gebeuren wordt een planmiddel.
- **Risico voor de kern:** laag. Het is dezelfde handeling als de kleurknop (een kwartslag met de klok
  mee), alleen door het bord gegeven. Te veel draaitegels maken een bord onleesbaar: maximaal twee of drie.
- **Kosten:** engine klein (een extra regel na het vastleggen, een bordveld), solver niets, tekenwerk één
  tegel met pijl en een korte draai-animatie, uitleg één leerlevel. **Klein.**

### B. Eenrichtingstegel

- **Wat het is:** een tegel met een pijl. Een robot mag er alleen *op* stappen in de richting van de pijl;
  van de andere kanten werkt de tegel als muur. Eraf stappen mag in elke richting.
- **Toestand erbij:** geen (vast bord).
- **Eén stap:** in stap 2 (voornemens) telt het doelvakje als muur wanneer de richting van de robot niet
  die van de tegel is.
- **Waarom oplosbaar:** alleen de vaste "volgende cel"-tabel verandert.
- **Voorbeeld** (`=>` = alleen naar rechts te betreden):

  ```text
  r> => .. EX
  .. .. .. ..
  b^ .. .. ..
  ```

  Rood loopt gewoon door de tegel. Blauw kan niet via de bovenste rij "achterom" de tegel op en moet
  onderlangs.
- **Wat het leert:** routes hebben een richting; een muur die voor de ene robot dicht is, is voor de
  andere open. Geeft de ontwerper een stopper die maar van één kant werkt.
- **Risico voor de kern:** laag tot middel. Het voegt geen handeling toe, maar wel iets om te lezen per
  tegel (de pijl lijkt op de pijl op een robot; de vormgeving moet dat uit elkaar houden).
- **Kosten:** engine klein, solver niets, tekenwerk één tegel in vier richtingen, uitleg één leerlevel.
  **Klein.**

### C. Uitgang per kleur, of een tweede uitgang

- **Wat het is:** (C1) de uitgang heeft een kleur en neemt alleen robots van die kleur op; voor andere
  kleuren is hij een gewone vloertegel. (C2) twee uitgangen; een robot mag in elk van beide.
- **Toestand erbij:** geen. Wel verandert de betekenis van "binnen": bij C1 kan een robot óp de uitgang
  staan zonder opgenomen te worden.
- **Eén stap:** in stap 6 wordt een robot alleen opgenomen als de uitgang zijn kleur accepteert. De
  uitzondering "meerdere robots tegelijk de uitgang in" (stap 3) geldt dan alleen voor robots die echt
  opgenomen worden; twee robots van een verkeerde kleur die hetzelfde uitgangsvakje willen, blokkeren
  elkaar zoals op elke tegel.
- **Waarom oplosbaar:** toestand en vertakking blijven gelijk; alleen het winstcriterium en de botsregel
  op één of twee vakjes veranderen.
- **Voorbeeld** (`ER` = uitgang voor rood, `EB` = uitgang voor blauw):

  ```text
  ER .. .. EB
  .. .. .. ..
  b^ .. .. r^
  ```

  Beide robots staan onder de verkeerde deur. Ze moeten elkaar kruisen, en elke draai van de één is een
  stap van de ander.
- **Wat het leert:** kleuren hebben een bestemming. Dit is het enige element dat de vraag "wie moet
  waarheen" verandert in plaats van "hoe kom ik er".
- **Risico voor de kern:** laag voor C1 (het maakt kleur belangrijker, en kleur *is* de kern). C2 zonder
  kleur maakt levels vooral makkelijker en voegt weinig toe; die raad ik niet apart aan.
- **Kosten:** engine klein tot middel (bord krijgt een lijst uitgangen; de botsregel op de uitgang moet
  zorgvuldig), `parseLevel` staat nu één uitgang toe, de HUD telt al "binnen", tekenwerk een gekleurde
  uitgang, uitleg één leerlevel. Let op: de bestaande sleutelbotsing in `stateKey` (hoofdstuk 5) moet
  eerst gerepareerd zijn. **Middel.**

### D. Schakelaar en poort

- **Wat het is:** een drukplaat en een poort. Zolang er een robot op de plaat staat, is de poort open
  (vloer); anders is hij dicht (muur).
- **Toestand erbij:** geen, mits de poort *alleen* afhangt van wie er nu op de plaat staat. (Een schakelaar
  die blijft omgeklapt staan, voegt één bit per schakelaar toe: ook eindig, maar dan verdubbelt de
  toestandsruimte per schakelaar.)
- **Eén stap:** vóór stap 2 wordt bepaald welke poorten open zijn uit de stand van *vóór* de stap; een
  robot die deze beurt van de plaat af stapt, laat de poort na de stap dichtvallen. Er is één randgeval dat
  een regel nodig heeft: een robot die in de poort staat als die dichtgaat. Voorstel: de poort gaat niet
  dicht zolang er een robot in staat.
- **Waarom oplosbaar:** de poortstand volgt uit de robotposities, dus de toestand blijft dezelfde.
- **Voorbeeld** (`()` = plaat, `||` = poort):

  ```text
  r> .. || EX
  .. .. .. ..
  b^ .. () ..
  ```

  Blauw moet op de plaat blijven staan terwijl rood door de poort loopt, maar elke VOORUIT laat blauw ook
  lopen. Blauw moet dus eerst tegen een rand worden gezet waar hij op de plaat blijft botsen.
- **Wat het leert:** parkeren krijgt een doel. "Een robot expres laten botsen" is nu al het diepste idee
  van het spel; de plaat maakt er een opdracht van.
- **Risico voor de kern:** middel. Het is het rijkste element, maar ook het eerste met werking op afstand:
  de speler moet twee plekken op het bord tegelijk in de gaten houden. Per level hooguit één paar.
- **Kosten:** engine middel (poorten in de "is dit een muur"-vraag, het randgeval), solver niets,
  tekenwerk plaat, poort en een open/dicht-animatie, geluid, uitleg twee leerlevels. **Middel tot groot.**

### E. IJs

- **Wat het is:** een gladde tegel. Een robot die erop stapt, glijdt in dezelfde richting door tot hij op
  gewone vloer komt of ergens tegenaan stopt.
- **Toestand erbij:** geen.
- **Eén stap:** hier wringt het. Nu verplaatst elke robot precies één vakje per stap en worden alle
  botsingen in één ronde opgelost. Met glijden moet een stap in deelstappen worden opgelost (iedereen één
  vakje, dan de glijders nog een, enzovoort), en de regels voor "wie wijkt voor wie" moeten per deelstap
  gelden.
- **Waarom oplosbaar:** nog steeds deterministisch en eindig, dus de solver kan het. Maar de engine-regel
  wordt een lus in plaats van zes vaste stappen.
- **Voorbeeld** (`~~` = ijs):

  ```text
  r> ~~ ~~ ## EX
  .. .. .. .. ..
  ```

  Eén VOORUIT brengt rood drie vakjes verder, tot tegen de muur.
- **Wat het leert:** afstand is niet meer gelijk aan aantal zetten.
- **Risico voor de kern:** hoog. Het hele spel leest nu als "iedereen één stap". IJs breekt dat ritme, en
  het tellen ("over drie zetten staat hij daar") is juist wat de speler leert.
- **Kosten:** engine groot (deelstappen, nieuwe botsregels, alle bestaande engine-tests herzien),
  animatie groot (ongelijke staplengtes in één beurt), uitleg twee leerlevels. **Groot.**

### F. Kuil en brokkeltegel

- **Wat het is:** (F1) een kuil: een robot die erin stapt is weg en het level is verloren. (F2) een
  brokkeltegel: draagt één keer; nadat een robot eraf is gestapt, is het een kuil (of een muur).
- **Toestand erbij:** F1 geen. F2 één bit per brokkeltegel.
- **Eén stap:** F1: na het vastleggen is de stand verloren zodra een robot op een kuil staat. F2: de
  tegels die deze beurt verlaten zijn, vallen weg.
- **Waarom oplosbaar:** F1 knipt alleen takken weg. F2 vergroot de toestand met het aantal brokkeltegels
  in bits; bij vier tegels is dat zestien keer zoveel, nog te doen.
- **Voorbeeld** (`OO` = kuil):

  ```text
  r> .. OO EX
  .. .. .. ..
  b> .. .. ..
  ```

  Rood moet om de kuil heen; elke VOORUIT te veel is meteen fataal.
- **Wat het leert:** niet elke fout is te herstellen.
- **Risico voor de kern:** middel tot hoog. Het spel is nu vergevingsgezind op het bord zelf (alleen het
  zetbudget straft). De meting laat zien dat al 43 tot 68 procent van de zetten vanuit een winbare stand
  het level binnen het budget onwinbaar maakt; een kuil maakt dat zichtbaar én harder. Brokkeltegels
  passen beter (ze straffen niet, ze beperken), maar vragen meer uitleg.
- **Kosten:** F1 engine klein, nieuwe verliesstatus in sessie en schermen, val-animatie. F2 engine middel,
  toestandssleutel uitbreiden. **Klein (F1) tot middel (F2).**

### G. Duwblok

- **Wat het is:** een blok dat een robot één vakje voor zich uit duwt als het vakje erachter vrij is.
- **Toestand erbij:** de positie van elk blok. Dat is de grootste uitbreiding van alle kandidaten: de
  toestandsruimte vermenigvuldigt met het aantal plekken waar blokken kunnen staan.
- **Eén stap:** blokken doen mee in de botsingsoplossing als "robots zonder eigen wil". Er zijn nieuwe
  regels nodig: twee robots die hetzelfde blok duwen, een blok dat tegen een rij robots wordt geduwd, een
  blok dat de uitgang in wordt geduwd.
- **Waarom oplosbaar:** eindig en deterministisch, dus in principe wel; in de praktijk raakt de
  zoektocht eerder aan zijn grens, vooral op 7×7 en 8×8.
- **Voorbeeld** (`[]` = blok):

  ```text
  r> [] .. ## EX
  .. .. .. .. ..
  ```

  Rood duwt het blok tegen de muur en zit dan zelf vast: het blok moet eerst de andere kant op.
- **Wat het leert:** het bord verandert door wat je doet.
- **Risico voor de kern:** hoog. Dit is een ander, bekend puzzelgenre. De aandacht gaat van "wat doet de
  hele groep" naar "waar moet dat blok heen".
- **Kosten:** engine groot, solver groter zoekwerk, tekenwerk en animatie middel, uitleg twee à drie
  leerlevels. **Groot.**

### Overzicht

| Element | Extra toestand | Engine | Risico voor de kern | Kosten | Oordeel |
|---|---|---|---|---|---|
| A. Draaitegel | geen | één regel na de stap | laag | klein | **aanbevolen** |
| B. Eenrichtingstegel | geen | bordtabel | laag–middel | klein | goede reserve |
| C1. Uitgang per kleur | geen | winst- en botsregel op de uitgang | laag | middel | **aanbevolen** |
| C2. Tweede uitgang (kleurloos) | geen | idem | laag, maar voegt weinig toe | middel | niet apart |
| D. Schakelaar en poort | geen (drukplaat) | poorten als muur, één randgeval | middel | middel–groot | **aanbevolen, als laatste** |
| E. IJs | geen | stap wordt een lus | hoog | groot | afgeraden |
| F1. Kuil | geen | nieuwe verliesstatus | middel–hoog | klein | afgeraden voor nu |
| F2. Brokkeltegel | 1 bit per tegel | toestand uitbreiden | middel | middel | later bekijken |
| G. Duwblok | positie per blok | groot | hoog | groot | afgeraden |

### Aanbeveling: drie elementen, één per pagina

1. **Draaitegel, vanaf pagina 3** (level 41–60). Kleinste stap, sluit aan op wat de speler al kan, en
   maakt pagina 3 meteen anders dan pagina 1 en 2.
2. **Uitgang per kleur, vanaf pagina 4** (level 61–80). Verandert de vraag van het level en maakt kleur
   belangrijker.
3. **Schakelaar en poort (drukplaat), vanaf pagina 5** (level 81–100). Het rijkste element, en het duurst;
   pas bouwen als de eerste twee bevallen.

De eenrichtingstegel is de reserve als één van de drie afvalt. IJs, kuil en duwblok raad ik af: ze kosten
het meest en trekken de aandacht weg van de groepsbeweging.

Elk nieuw element krijgt de eerste vijf levels van zijn pagina als leerlevels (één idee per level, zoals
level 1–5 nu), en de generator krijgt er een recept bij; de meting en de certificering werken ongewijzigd,
omdat ze op `step` leunen.

## 8. Besluiten (eigenaar, 22 november 2026: "akkoord op alles")

| # | Vraag | Besluit | Stand |
|--:|---|---|---|
| 1 | De sleutelfout in de engine repareren | Ja | Gedaan, zie hoofdstuk 5 |
| 2 | Nieuwe elementen | Draaitegel (pagina 3), uitgang per kleur (pagina 4), drukplaat met poort (pagina 5); eenrichtingstegel als reserve | Draaitegel gebouwd, getekend en geanimeerd. De andere twee niet begonnen |
| 3 | Pagina 3 | Variant A, met de draaitegel | Gedaan: 20 levels in `data/levels.json`, het spel heeft er 60 |
| 4 | Volgorde van pagina 1 en 2 | Akkoord: *Follow the Arrow* op plek 3, *Two Lanes* en *Patience* op pagina 2 | Gedaan |
| 5 | Oude saves met een opgelost level achter een gesloten level | Zo laten | Geen wijziging |
| 6 | De 23 ongewijzigd gekozen levels | Zo laten | Geen wijziging |
| 7 | Gewichten van de score | Laten tot er speeldata is | Geen wijziging |

Bij 5 en 6 lagen er twee mogelijkheden zonder aanbeveling. "Akkoord op alles" is daar gelezen als de eerste
en kleinste: niets veranderen. Wil je de andere (ontgrendelregel aanpassen, of een handmatige ronde over de
levels), dan is dat één woord.

Op 22 november 2026 volgde een tweede akkoord: de draaitegel bouwen in engine, solver en generator en de
levels van pagina 3 maken, en het tekenwerk laten liggen tot de andere sessie in `src/render/` klaar is.
Zie hoofdstuk 4 en 7.

Op 22 november 2026 volgde het derde akkoord: de tegel tekenen en animeren en pagina 3 in het spel brengen.
Dat is gedaan; zie hoofdstuk 4 en 7 en de schermafbeeldingen in `production/qa/evidence/turn-tile/`.

## 9. Niet gecontroleerd

- **Of echte spelers de volgorde goed vinden.** De score is geijkt op tien levels en op de volgorde van de
  maker. Er heeft niemand gespeeld.
- **Of level 1 tot 5 een nieuwkomer echt zonder tekst de regels leren.** Het ontwerp volgt "één ding per
  level", maar dat is niet met een beginner getest.
- **Of de namen bevallen** en of er een naam botst met een bestaand merk; ik heb alleen een voor de hand
  liggende naam van een bekend puzzelspel vermeden.
- **Leesbaarheid op een echt toestel.** De schermafbeeldingen zijn gemaakt in een browser zonder grafische
  kaart op 390×844; 7×7 en 8×8 zijn daar leesbaar, maar niet op een telefoon in de hand beoordeeld.
- **De volledige meting van Grand Parade** (afgekapt bij 3 miljoen standen).
- **De voorbeeldborden van de nieuwe elementen** B tot en met G zijn met de hand doorgerekend, niet door een solver.
- **Of echte spelers de draaitegel begrijpen.** Level 41 leert hem zonder tekst (de schijf draait bij het
  openen één keer voor, en de tegel draait de robot als hij erop stapt), maar dat is alleen door de maker
  beoordeeld. Niemand anders heeft pagina 3 gezien of gespeeld.
- **De tegel op een echt toestel.** Beoordeeld op schermafbeeldingen van 390×844 uit een browser zonder
  grafische kaart, in gewone kleuren, met "Colour shapes" aan en in een nagebootste rood-groen-kleurenblindheid;
  niet op een telefoon in de hand en niet door iemand die kleurenblind is.
- **De browsertests na het samenvoegen met `main`** (22 november 2026): 20 van de 21 slaagden in één volledige
  run, waaronder "the win coins: Next on the first frame…", die vóór het samenvoegen faalde en door het werk
  in `main` is hersteld. De test die alle 60 levels na elkaar uitspeelt haperde in die run bij level 56 terwijl
  er een tweede browser naast draaide, en slaagde daarna alleen (20,3 minuten). Hij wacht 30 seconden op het
  winstscherm en is dus gevoelig voor een belaste machine.
- **Het tempo van de draai** (0,07 s stilstaan, 0,22 s draaien) is op beeldreeksen beoordeeld, niet op gevoel
  bij het spelen op een toestel.
- **De herhaalbaarheid van de generatorrondes** met de huidige code is niet opnieuw gedraaid.
