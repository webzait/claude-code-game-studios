# TURNFLOCK — de munteneconomie

Stand: 2026-11-23, bevinding B12. De eerste ronde (22 november) staat in `design/economy-round1.md`.

> Er wordt nergens echt betaald. "Pakket", "bijleggen" en elk bedrag in euro gaan over de testwinkel
> (`design/shop.md`), waar elke aankoop gespeeld is. De uitkomsten van het model zijn scenario's op
> aannames, geen voorspellingen.

## 1. De bevinding en het korte antwoord

**B12, in de woorden van de eigenaar:** "Puntentrekking voelt nog te makkelijk. Startmunten te hoog
en/of kosten te laag en/of winst te hoog. Lijkt niet in verhouding. Voorbeeld ter referentie. Niet
exact overnemen."

De referentie (twee schermafbeeldingen van een ander casual puzzelspel; de beelden staan bewust niet
in de repo) in cijfers: de speler heeft 20 munten, doorspelen na een verloren level kost 900, en het
kleinste pakket is 1.000 munten voor €1,99. Eén keer doorspelen kost daar dus bijna het hele kleinste
pakket (ongeveer €1,80) en het saldo is een fractie van die prijs.

**Wat er tot nu toe in zat**, nagerekend: start 50; een level betaalt 10, 20 of 30; Undo 5, hint 20,
+3 moves 40; het kleinste pakket is 100 munten voor €0,99. Eén perfect level betaalt zes keer Undo
of anderhalve hint. Het startsaldo dekt tien keer Undo. Een hint kost omgerekend €0,20 en een perfect
level "verdient" €0,30. Wie vier levels speelt, heeft het kleinste pakket bij elkaar. Er is dus geen
reden om ooit munten te kopen. De eigenaar heeft gelijk.

**Wat er nu in zit:** vier afstellingen die in het testlab te kiezen zijn (Settings → Test lab →
Coin shop → "Coin tuning"), met **Tight** als standaard:

- start 30; een level betaalt nog steeds 10, 20 of 30;
- Undo 10, hint 75, +3 moves 150; Restart blijft gratis;
- pakketten van 150, 400 en 1.100 munten voor de voorbeeldprijzen €0,99, €1,99 en €4,99.

Een hint kost nu wat tweeënhalf perfecte levels opleveren, +3 moves vijf. Het kleinste pakket is
precies één keer +3 moves of twee hints. Een hint kost omgerekend ongeveer €0,50, +3 moves €0,99.

## 2. De afstellingen naast elkaar

| | Roomy (was) | Firmer | **Tight (standaard)** | Scarce |
|---|--:|--:|--:|--:|
| Startsaldo | 50 | 40 | **30** | 20 |
| Beloning 1 / 2 / 3 sterren | 10 / 20 / 30 | 10 / 20 / 30 | **10 / 20 / 30** | 10 / 20 / 30 |
| Undo, per stap | 5 | 5 | **10** | 25 |
| Hint | 20 | 40 | **75** | 250 |
| +3 moves | 40 | 80 | **150** | 750 |
| Restart | gratis | gratis | **gratis** | gratis |
| Pakket 1 | 100 voor €0,99 | 100 voor €0,99 | **150 voor €0,99** | 800 voor €1,99 |
| Pakket 2 | 250 voor €1,99 | 250 voor €1,99 | **400 voor €1,99** | 2.200 voor €4,99 |
| Pakket 3 | 700 voor €4,99 | 700 voor €4,99 | **1.100 voor €4,99** | 5.000 voor €9,99 |

Het idee achter elk:

- **Roomy**: de bedragen tot B12. Staat erbij om mee te vergelijken.
- **Firmer** (gematigd strakker): alleen de hulp waar je over nadenkt wordt twee keer zo duur. Undo
  en de pakketten blijven zoals ze waren. De kleinste stap die je merkt.
- **Tight** (strak): bewuste hulp kost meerdere levels aan winst en het startsaldo koopt geen hint.
  Undo verdubbelt, maar blijft klein: een perfect level betaalt er drie. De pakketten zijn zo gekozen
  dat het kleinste precies de duurste hulp koopt.
- **Scarce** (heel strak, in de buurt van de referentie): +3 moves kost wat 25 perfecte levels
  opleveren en bijna het hele kleinste pakket. Verdiende munten kopen hier nog Undo's; hint en +3
  moves zijn in de praktijk alleen te koop. De getallen zijn eigen getallen, niet die van de referentie.

De verhoudingen (uit `production/qa/evidence/economy-tighten/model-summary.md`):

| | Roomy | Firmer | Tight | Scarce |
|---|--:|--:|--:|--:|
| Undo's per 3-sterrenwinst | 6 | 6 | 3 | 1,2 |
| 3-sterrenwinsten voor één hint | 0,7 | 1,3 | 2,5 | 8,3 |
| 3-sterrenwinsten voor één +3 moves | 1,3 | 2,7 | 5 | 25 |
| Startsaldo in Undo's | 10 | 8 | 3 | 0,8 |
| Startsaldo in hints | 2,5 | 1 | 0,4 | 0,1 |
| Kleinste pakket in +3 moves | 2,5 | 1,3 | 1 | 1,1 |
| Kleinste pakket in 3-sterrenwinsten | 3,3 | 3,3 | 5 | 27 |

Wat één keer hulp in euro kost, gerekend uit het kleinste pakket (tussen haakjes uit het grootste):

| | Roomy | Firmer | Tight | Scarce |
|---|--:|--:|--:|--:|
| Eén Undo | €0,05 (€0,04) | €0,05 (€0,04) | €0,07 (€0,05) | €0,06 (€0,05) |
| Eén hint | €0,20 (€0,14) | €0,40 (€0,29) | €0,49 (€0,34) | €0,62 (€0,50) |
| Eén keer +3 moves | €0,40 (€0,29) | €0,79 (€0,57) | €0,99 (€0,68) | €1,87 (€1,50) |
| Wat een 3-sterrenwinst omgerekend "waard" is | €0,30 | €0,30 | €0,20 | €0,07 |

## 3. De drie knoppen: welke weegt het zwaarst?

De eigenaar noemt er drie: start te hoog, kosten te laag, winst te hoog.

**1. Kosten te laag: dit weegt het zwaarst.** De prijs van hulp bepaalt twee dingen tegelijk: hoeveel
levels je moet spelen voor één keer hulp, en wat hulp in euro kost. Bij 20 munten voor een hint doet
geen van de andere knoppen ertoe. Daarom zit bijna de hele aanscherping in de prijzen van hint en +3
moves (in Tight 3,75 keer zo hoog).

**2. Winst te hoog: waar, maar het is dezelfde knop van de andere kant.** Wat telt is de verhouding
tussen winst en prijs. De beloning halveren doet voor die verhouding hetzelfde als de prijzen
verdubbelen. Ik heb de prijzen verhoogd en de beloning op 10, 20 en 30 gelaten, om drie redenen:
"10 per ster" is in één blik te lezen en staat op elke winst-pop-up; bestaande saves kloppen zonder
omrekenen (wat al betaald is, blijft kloppen); en een beloning van 5 of 3 voelt als een fooi. Winst
weegt wel op één plek zwaarder dan de prijs: bij de goede speler. Die koopt geen hulp, dus voor hem
is de beloning de enige knop. Zie hoofdstuk 6: geen enkele afstelling maakt munten schaars voor
iemand die geen hulp nodig heeft.

**3. Start te hoog: het lichtst, maar het eerst zichtbaar.** Het startsaldo is eenmalig. Over 100
levels verdient een gewone speler ruim 2.200 munten; 50 daarvan is ruim 2 procent. Maar het bepaalt
de eerste tien minuten, en dat is wat een tester ziet. Met 50 munten en Undo op 5 begin je met tien
Undo's en tweeënhalve hint op zak, en level 1 tot 3 leggen daar 90 bovenop. In Tight koopt het
startsaldo drie Undo's en geen hint; de eerste hint is er na drie gewonnen levels.

Er is een vierde verhouding die de eigenaar niet noemt en die voor "reden om te kopen" beslist:
**pakket tegenover winst.** In Roomy is het kleinste pakket 3,3 perfecte levels: wie even doorspeelt,
heeft het zo bij elkaar, dus het pakket is niets waard. In Tight is het 5 levels, in Scarce 27.

## 4. De schaal van de getallen

De referentie werkt met honderden en duizenden. Levert dat TURNFLOCK iets op?

- **Alles met tien vermenigvuldigen is ruis.** 300 per level en 750 voor een hint is dezelfde economie
  als 30 en 75. Het levert alleen grotere getallen op het kleine prijskaartje, en het maakt de
  eurowaarde lastiger te overzien. Dat laatste is voor een spel dat eerlijk wil zijn een nadeel:
  grote getallen verbergen wat iets kost.
- **Wat de referentie echt doet, is geen schaal maar een verhouding**: de beloningen zijn daar ook
  klein (tientallen) en alleen de prijzen en pakketten zijn groot. Dat is wat hier nu gebeurt: de
  beloning blijft 10 tot 30 en de prijzen lopen op naar 75 en 150 (in Scarce 250 en 750). De grotere
  schaal komt dus vanzelf mee met de aanscherping, zonder dat er iets is opgeblazen.
- **Fijnere prijsstappen**: die zijn er nu. Tussen 75 en 150 zit ruimte om een hint op 60 of 90 te
  zetten zonder dat het rijtje onleesbaar wordt. Bij prijzen van 5 en 20 was elke stap meteen 25%.
- **Gevoel van waarde**: een pakket van 1.100 munten klinkt als meer dan een van 700, terwijl het
  minder hulp koopt (7 keer +3 moves tegenover 17). Dat is precies het effect waar ik voorzichtig mee
  wil zijn; daarom staat in de tabellen overal ook wat een pakket aan hulp koopt.
- De prijskaartjes en de teller kunnen vier cijfers aan (getest op de onderdelenpagina met "1 250").

Mijn advies: de schaal laten waar hij nu is uitgekomen. Niet verder vermenigvuldigen.

## 5. Doorgerekend

`npm run economy` speelt de portemonnee van vijf soorten spelers over alle 100 levels, 2.000 keer per
speler, met de muntfuncties en de afstellingen van het spel zelf. Alle tabellen staan in
`production/qa/evidence/economy-tighten/` (`model-summary.md`, een bestand per afstelling met het
saldo na elk level, en `model-sensitivity.md`). Hier de hoofdzaken voor drie spelers: de **puzzelaar**
(lost bijna alles perfect op), de **gewone speler** en de **speler met moeite** (loopt vaak vast).

### Hulp per tien levels uit verdiende munten

Hoeveel Undo's, of hints, of keren +3 moves een speler per tien levels kan betalen uit wat hij
verdient, als hij er niets anders mee doet (Undo / hint / +3 moves):

| Speler | Verdient per 10 levels | Roomy | Firmer | Tight | Scarce |
|---|--:|--:|--:|--:|--:|
| Puzzelaar | 274 | 55 / 14 / 6,9 | 55 / 6,9 / 3,4 | 27 / 3,7 / 1,8 | 11 / 1,1 / 0,4 |
| Gewone speler | 223 | 45 / 11 / 5,6 | 45 / 5,6 / 2,8 | 22 / 3,0 / 1,5 | 8,9 / 0,9 / 0,3 |
| Speler met moeite | 194 | 39 / 9,7 / 4,9 | 39 / 4,9 / 2,4 | 19 / 2,6 / 1,3 | 7,8 / 0,8 / 0,3 |

In Tight kan een gewone speler per tien levels drie hints betalen, of anderhalve keer +3 moves, of 22
Undo's. Niet alle drie. Dat is de afweging waar de bevinding om vraagt.

### Eerste keer tekort

Het level waarop een speler voor het eerst een hulp wil die hij niet kan betalen (mediaan; tussen
haakjes waar het bij 10% en 90% van de runs gebeurt). Het model kent twee soorten gedrag:

- **Wil hetzelfde**: de speler wil evenveel hulp als in de aannames, wat die ook kost.
- **Prijsbewust**: hij neemt minder van een hulp naarmate die duurder is (drie keer zo duur: een
  derde zo vaak) en tikt vaker Restart, dat gratis is.

| Speler | Gedrag | Roomy | Firmer | Tight | Scarce |
|---|---|--:|--:|--:|--:|
| Puzzelaar | wil hetzelfde | nooit | nooit | bijna nooit (5% van de runs) | level 13 (1–36) |
| | prijsbewust | nooit | nooit | bijna nooit | bijna nooit (6%) |
| Gewone speler | wil hetzelfde | level 25 (10–50) | level 10 (2–20) | level 4 (2–9) | level 1 (1–4) |
| | prijsbewust | level 25 (10–50) | level 23 (3–57) | level 17 (3–57) | level 14 (1–58) |
| Speler met moeite | wil hetzelfde | level 7 (3–11) | level 3 (1–7) | level 2 (1–4) | level 1 (1–2) |
| | prijsbewust | level 7 (3–11) | level 6 (2–12) | level 6 (2–14) | level 6 (1–20) |

De waarheid ligt ergens tussen de twee regels, en waar precies weet het model niet. Zie hoofdstuk 8.

### Het saldo over de levels

Gemiddeld saldo van een speler die nooit bijlegt, onder "wil hetzelfde":

| Speler | Na level | Roomy | Firmer | Tight | Scarce |
|---|--:|--:|--:|--:|--:|
| Puzzelaar | 10 | 296 | 279 | 231 | 157 |
| | 20 | 505 | 478 | 357 | 157 |
| | 40 | 905 | 853 | 573 | 123 |
| | 100 | 2.166 | 2.052 | 1.344 | 150 |
| Gewone speler | 5 | 113 | 97 | 79 | 49 |
| | 10 | 123 | 91 | 65 | 38 |
| | 20 | 87 | 59 | 36 | 33 |
| | 40 en verder | rond 50 | rond 50 | rond 32 | rond 33 |
| Speler met moeite | 5 | 57 | 55 | 39 | 36 |
| | 10 | 35 | 40 | 27 | 34 |
| | 20 en verder | rond 24 | rond 27 | rond 22 | rond 31 |

Een saldo dat blijft hangen rond 30 betekent: alles wat binnenkomt gaat meteen weer uit, en het
bedrag dat overblijft is te klein voor de volgende hulp. Zo ziet schaarste er in het model uit.

### Hoeveel van de gewenste hulp je krijgt zonder te kopen, en wat alles kopen kost

Over 100 levels, onder "wil hetzelfde":

| Speler | | Roomy | Firmer | Tight | Scarce |
|---|---|--:|--:|--:|--:|
| Puzzelaar | krijgt uit eigen munten | 100% | 100% | 100% | 67% |
| Gewone speler | krijgt uit eigen munten | 83% | 56% | 30% | 9% |
| | alles kopen kost | €5 | €19 | €38 | €62 |
| | idem, prijsbewust | €5 | €5 | €3 | €2 |
| Speler met moeite | krijgt uit eigen munten | 41% | 26% | 13% | 4% |
| | alles kopen kost | €34 | €66 | €95 | €138 |
| | idem, prijsbewust | €34 | €33 | €21 | €8 |

De spreiding tussen de twee soorten gedrag is enorm: voor de gewone speler in Tight tussen €3 en €38
over het hele spel. Dat is geen zwakte van de tabel maar de eerlijke uitkomst: **wat een speler
uitgeeft hangt bijna helemaal af van hoe hij reageert op de prijs, en dat kan alleen een test met
echte mensen laten zien.** De "prijsbewuste" bedragen dalen bij strakkere afstellingen omdat die
speler evenveel munten blijft uitgeven en een pakket daar meer munten per euro geeft; hij krijgt er
wel veel minder hulp voor.

## 6. De aanbeveling: Tight, en waarom

**Tight staat als standaard in het spel.** De redenen:

1. **Het doet wat de bevinding vraagt.** Een hint of +3 moves is geen reflex meer maar een keuze: het
   kost meerdere levels aan winst en het startsaldo dekt het niet.
2. **Verdiende munten blijven iets waard.** Wie goed speelt, verdient per tien levels drie hints.
   Spelen loont dus nog. In Scarce is dat minder dan één hint per tien levels en één +3 moves per
   dertig: daar zijn munten in de praktijk alleen nog te koop. De referentie kan dat doen omdat zulke
   spellen munten ook uitdelen via dagelijkse beloningen en evenementen. TURNFLOCK heeft die bronnen
   niet (en ze horen niet bij deze opdracht), dus dezelfde verhouding is hier harder dan daar.
3. **Undo blijft klein.** Undo is de enige hulp die je in een reflex tikt, en de opdrachtknoppen
   reageren op de eerste aanraking, dus een misgetikte zet komt voor. De schaarste hoort bij de hulp
   waar je over nadenkt. In Tight kost een Undo een derde van een perfect level; in Scarce bijna een
   heel level.
4. **Het kleinste pakket koopt precies iets.** 150 munten is één keer +3 moves of twee hints. Geen
   restje dat tot een tweede aankoop dwingt, en geen pakket dat de duurste hulp net niet haalt (een
   unit-test bewaakt dat in elke afstelling).
5. **Er is ruimte naar beide kanten.** Voelt Tight nog te ruim, dan is Scarce één tik verder; voelt
   het te zuinig, dan is Firmer één tik terug.

**Wat ik afraad als standaard: Scarce.** Het staat erin om te voelen, en het komt het dichtst bij de
referentie. Maar een gewone speler krijgt daar in het model 9% van de hulp die hij wil, en +3 moves
kost €1,87. Zonder andere muntbronnen is dat een winkel met een puzzel eromheen.

**Wat geen enkele afstelling oplost: de goede speler.** De puzzelaar heeft in Tight na 100 levels
ruim 1.300 munten over en komt nooit tekort. Wie geen hulp nodig heeft, heeft geen munten nodig, hoe
de bedragen ook staan. Als de eigenaar vooral zelf merkt dat munten zich opstapelen, dan ligt dat
hieraan en niet aan de prijzen. De oplossing daarvoor is iets om munten aan uit te geven dat ook een
goede speler wil (de uitgestelde perks, of iets cosmetisch), en dat valt buiten deze opdracht.

## 7. Wat er in het spel zit

- **De keuze**: Settings → Test lab → Coin shop → "Coin tuning": Roomy, Firmer, Tight, Scarce. Onder
  de keuze staan de bedragen van de gekozen afstelling. De keuze geldt meteen, ook in een level dat
  bezig is: prijskaartjes, beloning, uitleg en de pakketten van de winkel wisselen mee.
- **Het saldo bij wisselen**: blijft staan. Eén uitzondering: wie nog geen level heeft gewonnen en
  precies het startsaldo heeft, krijgt het startsaldo van de nieuwe afstelling, zodat een verse
  tester elke afstelling ziet zoals een nieuwe speler. "Reset progress" begint opnieuw met het
  startsaldo van de gekozen afstelling.
- **Alle bedragen staan in `data/config.json`**: `coins` en `shop.packs` zijn de afstelling van het
  spel (Tight), `economy.tuning` geeft die een naam, `economy.alternatives` bevat de andere drie en
  `economy.order` de volgorde in het testlab. In de code staat geen bedrag. Een andere standaard
  kiezen: de bedragen van die afstelling naar `coins` en `shop.packs` zetten (en de oude naar
  `alternatives`). Beschreven in `data/config-notes.md`.

### Bestaande spelers

- **Het saldo blijft wat het was.** Er gaat niets af en er komt niets bij.
- **Wat al betaald is, blijft betaald.** Een level dat zijn beloning heeft uitgekeerd, keert die niet
  nog eens uit; een beter resultaat betaalt het verschil (van 2 naar 3 sterren: 10). Omdat de
  beloningen 10, 20 en 30 zijn gebleven, verandert hier in de praktijk niets.
- **De prijzen gelden meteen.** Een opgespaard saldo koopt dus minder hulp dan gisteren: 400 munten
  was twintig hints en is er nu vijf. Dat is de bedoeling van de aanscherping, maar het is wel een
  achteruitgang voor wie al speelde. Zolang alleen testers spelen is dat geen punt; bij een publiek
  spel zou ik het saldo eenmalig meeschalen. Zie de open besluiten.
- **Techniek**: de save draagt een economieversie (`economy` in `src/game/save.ts`, nu 3). Een save
  met een ouder nummer wordt één keer bij het laden bijgewerkt (`settlePaid` in `src/game/coins.ts`)
  en krijgt de afstelling van het spel. Het save-formaat zelf is niet veranderd. Bewaakt door
  unit-tests (`tests/unit/meta.test.ts`, "the tunings of finding B12") en een browsertest.

## 8. Wat het model wel en niet kan zeggen

Het model telt munten. Het speelt geen borden en het weet niet hoe mensen zich gedragen.

**Aannames over spelers** (`tools/economy/players.json`, ongewijzigd sinds de eerste ronde):

| Speler | Kortste oplossing (makkelijk → zwaar level) | Undo's per level | Hints per level | Kans op +3 moves |
|---|---|---|---|---|
| Puzzelaar | 95% → 55% | 0 → 2 | 0 → 0,1 | 0 |
| Gewone speler | 70% → 15% | 0,5 → 5 | 0 → 0,8 | 0 → 25% |
| Speler met moeite | 50% → 5% | 1 → 8 | 0 → 2 | 0 → 50% |

Verder: een hulp die niet te betalen is, wordt overgeslagen en het level wordt toch gehaald; hulp
verandert de uitslag niet; elk level wordt één keer gespeeld, in volgorde; "prijsbewust" is één
vaste formule en geen gemeten gedrag.

**Deze aannames zijn waarschijnlijk te zwaar.** Het model zegt dat een gewone speler onder Roomy rond
level 25 tekortkomt en over het hele spel €5 zou moeten bijleggen. De eigenaar speelt Roomy en
ervaart het tegenovergestelde: munten zijn nooit schaars. Dat is de enige echte waarneming die er is,
en ze wijst erop dat echte spelers minder hulp nemen dan aangenomen (of dat de eigenaar dichter bij
de puzzelaar zit dan bij de gewone speler). Lees de regels "wil hetzelfde" daarom als bovengrens.

**Wat alleen echt spelen kan uitwijzen:**

- Hoe schaars Tight *voelt*. Het model geeft een saldo, geen gevoel.
- Of spelers bij een hint van 75 gaan sparen, vaker Restart tikken, kopen, of stoppen.
- Of een Undo van 10 nog als reflex wordt getikt.
- Of iemand die tekortkomt dat als pech ervaart of als een val.
- Het kasboek in het testlab (Settings → Test lab → "Coin ledger") laat per sessie zien waar de
  munten heen gingen en wanneer er voor het eerst iets geweigerd werd. Dat is de meting die het model
  kan vervangen.

## 9. Wat vaststaat en niet is aangeraakt

- **Elk level is zonder munten op te lossen** (de oplosser bewijst het per level) en **Restart is
  gratis**. Geen enkele afstelling zet een level op slot; schaarste maakt alleen hulp duur.
- De eerste hintstap ("kan ik nog winnen?") blijft gratis; alleen de zet zelf kost munten.
- **+3 moves verschijnt alleen als de oplosser bewijst dat het helpt.**
- Elke prijs staat op de knop vóór de tik. Geen prijs loopt op binnen een level.
- Geen echte betalingen, geen advertenties, geen diensten van buitenaf. De winkel is een testwinkel.
- Geen druktactieken: geen kortingsstickers, geen timers, geen aanbod dat het spel onderbreekt. Een
  voorstel voor een eerlijk aanbod op het verliesmoment staat in `design/shop.md` (hoofdstuk 6); het
  is beschreven en **niet gebouwd**.
- De kernmechaniek en de perks zijn niet aangeraakt.

Eén punt dat bij strakkere bedragen zwaarder gaat wegen: wie een level echt niet ziet, heeft als
enige hulp de betaalde hint. Zo'n speler kan het level in theorie zonder munten halen en zit in de
praktijk vast. Bij een hint van 20 was dat een klein punt; bij 75 of 250 niet meer. Een kraan voor
wie vastzit (bijvoorbeeld een gratis hint na een aantal mislukte pogingen op hetzelfde level) is de
eerlijkste tegenhanger van schaarste. Niet gebouwd; zie de open besluiten.

## 10. Open besluiten voor de eigenaar

1. **Welke afstelling?** Speel ze in het testlab: begin met Tight, probeer daarna Scarce en Firmer.
   Mijn advies is Tight. Wil je een tussenvorm (bijvoorbeeld Tight met Undo op 5, of een hint van
   60), dan is dat één getal in `data/config.json`.
2. **Bestaande saldo's**: laten staan (zoals nu), of eenmalig meeschalen met de prijzen?
3. **Een kraan voor wie vastzit zonder munten** (gratis hint na een aantal mislukte pogingen)? Hoe
   strakker de afstelling, hoe harder dit nodig is om eerlijk te blijven.
4. **Iets om munten aan uit te geven voor goede spelers.** Zonder dat stapelen munten zich bij hen
   op, wat de prijzen ook zijn.
5. **Het aanbod op het verliesmoment** (`design/shop.md`, hoofdstuk 6): bouwen of niet?
6. **Kinderen.** Is het spel ook voor hen? Dan horen een gratis Undo per level en een oudercontrole
   bij elke echte winkel, en is Scarce uitgesloten. Dit punt staat nog open uit de eerste ronde.
