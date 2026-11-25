# TURNFLOCK — de testwinkel voor munten

Stand: 2026-11-23 (pakketten en hoofdstuk 5 en 6 bijgewerkt voor bevinding B12). Dit document beschrijft de **testwinkel** die in het spel zit, de laag
waarachter het kopen is weggezet, wat een **echte** winkel nog nodig zou hebben (niet gebouwd) en een
eerste rekensom over de munteneconomie.

> **Er wordt nergens echt betaald.** Elke aankoop in deze build is gespeeld: er is geen
> betaalprovider, geen app-winkel, geen betaallink, geen advertentie-SDK en geen enkele aanvraag die
> het toestel verlaat. De prijzen in euro's zijn voorbeelden.

## 1. Wat er nu in het spel zit

### De winkel

- De **plusknop** naast de muntenteller (levelselectie en puzzelscherm) opent de winkel als een vel
  onderaan het scherm, bovenop wat er al stond. Sluiten (knop "Close", tik naast het vel of Escape)
  brengt de speler precies terug waar die was: een level dat bezig is blijft onaangeroerd, ook een
  "Out of moves"-pop-up blijft staan en rekent daarna opnieuw uit wat betaalbaar is.
- Het vel toont: de titel "Coin shop" met het label **Test shop**, het saldo, de zin "This is a
  test shop. Nothing is charged; the prices are examples.", en drie pakketten uit
  `data/config.json` → `shop.packs`:

  | Pakket | Munten | Voorbeeldprijs | Per 100 munten |
  |---|---|---|---|
  | Handful of coins | 150 | €0,99 | €0,66 |
  | Pouch of coins | 400 | €1,99 | €0,50 |
  | Chest of coins | 1.100 | €4,99 | €0,45 |

  Dit zijn de pakketten van de afstelling "Tight", de standaard sinds bevinding B12. De pakketten
  horen bij de afstelling van de munteneconomie en wisselen mee met de keuze "Coin tuning" in het
  testlab; alle vier de afstellingen staan in `design/economy.md`, hoofdstuk 2. In elke afstelling
  koopt het kleinste pakket minstens één keer de duurste hulp (+3 moves); een unit-test bewaakt dat.

- **De gespeelde aankoop**: tik op een pakket → bevestigingsstap met pakket, munten, voorbeeldprijs,
  het label "Test shop" en de zin "This is a test. Nothing is charged." → "Confirm test purchase" →
  een kort "Processing the test purchase…" (`shop.processingMs`, 0,9 s) → de munten komen erbij, de
  teller telt op met de bestaande muntanimatie (gouden rand, "+150") en een bonregel bevestigt het:
  "Test purchase TEST-0001: +150 coins. You now have 180. Nothing was charged."
- **De ongelukkige paden** (schakelaar in het testlab): *geannuleerd* en *mislukt*. In beide verandert
  het saldo niet en de regel zegt dat ook, met het saldo erbij. "Cancel" in de bevestigingsstap doet
  hetzelfde als annuleren: er gebeurt niets.

### Waar de winkel wordt aangeboden

- Altijd via de plusknop.
- Op de momenten dat de speler tekortkomt, als **stille tekstlink "Get coins"** naast de gratis
  uitweg, nooit in plaats daarvan en nooit als pop-up die het spel onderbreekt:
  - Undo te duur: de regel "Undo costs 10 coins. Restart is free." met Restart omringd, en daarachter
    de link.
  - Hint te duur: "Not enough coins for the next move." met de link erachter.
  - "+3 moves" te duur (of de Undo op die pop-up): de link staat klein onder Undo en de gratis
    hoofdknop Retry.
- Na een geslaagde aankoop verdwijnen de waarschuwing en de link vanzelf.

### Schakelaars in het testlab (Settings → Test lab → "Coin shop")

| Schakelaar | Waarden | Standaard |
|---|---|---|
| Coin tuning | Roomy / Firmer / Tight / Scarce: de afstelling van de munteneconomie (start, beloning, prijzen en pakketten samen). Geldt meteen; het saldo blijft staan. Zie `design/economy.md` | **Tight** |
| Test shop | aan / uit. Uit: de plusknop opent weer de uitleg "there is nothing to buy" en er is nergens een "Get coins"-link | **aan** |
| Purchase outcome | Succeeds / Cancelled / Fails | Succeeds |
| Free help (bestond al, onder "Shortcuts") | Hints, extra zetten en Undo kosten niets | uit |

**Waarom de winkel standaard aan staat:** deze build bestaat om de winkel te testen, de winkel kan
niets afrekenen en hij is overal als test gelabeld. Stond hij standaard uit, dan zou elke tester hem
eerst moeten zoeken. **Vóór een publieke release moet dit om**: de winkel uit, of vervangen door een
echte die door de punten van hoofdstuk 4 heen is.

### Het kasboek (Settings → Test lab → "Coin ledger")

Elke gespeelde aankoop, elke beloning en elke uitgave wordt in de save bijgeschreven: tijd, pakket of
onderdeel, munten, saldo erna. Het testlab toont:

- **totalen**, gekocht en verdiend apart: munten gekocht (met het aantal testaankopen), munten verdiend
  met spelen, uitgegeven aan hints, aan Undo en aan extra zetten, totaal uitgegeven, saldo nu;
- de laatste regels (nieuwste boven; `shop.ledgerShown`, 40);
- **Set balance**: het saldo op een gekozen getal zetten (komt als eigen regel in de lijst, telt in
  geen enkel totaal mee);
- **Clear ledger**: lijst en totalen leeg; het saldo blijft.

De lijst bewaart de laatste 200 regels (`shop.ledgerMax`); de totalen tellen door tot ze gewist
worden. "Reset progress" zet het saldo terug op de startwaarde en laat het kasboek staan (er komt een
regel "Balance set" bij).

### Zo test je het, stap voor stap

1. Open het spel, ga naar Settings → Test lab → Coin ledger, vul bij het saldo `10` in en tik
   "Set balance".
2. Ga terug en open een level. Doe een zet, tik Undo (5 munten), doe een zet, tik Undo: het saldo is 0.
3. Doe nog een zet en tik Undo: geweigerd, "Restart is free." en de link **Get coins**.
4. Tik Get coins → de winkel. Kies een pakket → lees de bevestiging → "Confirm test purchase" →
   de munten tellen op en de bonregel verschijnt.
5. Close → je staat in hetzelfde level op dezelfde zet. Tik Undo: nu betaald met de gekochte munten.
6. Test lab → Purchase outcome → Cancelled, en daarna Fails: herhaal een aankoop en zie dat het saldo
   gelijk blijft en de melding dat zegt.
7. Test lab → Coin ledger: bekijk wat er gekocht, verdiend en uitgegeven is.
8. Test lab → Test shop uit: de plusknop toont weer de oude uitleg.

## 2. Ontwerpregels (gelden ook voor een latere echte winkel)

- De prijs staat **op het pakket vóór de tik**, en nog een keer in de bevestigingsstap.
- Alle pakketten zien er hetzelfde uit, goedkoopste bovenaan. Geen voorgeselecteerd of uitgelicht
  pakket, geen "best value", geen "popular".
- Geen afteltimers, geen "last chance", geen doorgestreepte prijzen of nepkortingen, geen
  drukwoorden. De unit-test "carries no pressure wording" bewaakt de teksten van de winkel.
- De winkel verschijnt nooit uit zichzelf. Tekortkomen levert een woordregel en een link op, geen
  pop-up; de gratis uitweg (Restart, Retry) staat er altijd bij en blijft de hoofdknop.
- Een aankoop vraagt altijd een aparte bevestigingsstap. De focus staat daar op de kop, niet op de
  koopknop, zodat een toets die nog ingedrukt is niets koopt.
- Annuleren kost niets en is even groot als bevestigen.
- Het spel blijft zonder kopen uit te spelen: Restart is gratis, de eerste hintstap ("kan ik nog
  winnen?") is gratis, en "+3 moves" wordt alleen aangeboden als de oplosser bewezen heeft dat het
  genoeg is.

## 3. De aankooplaag

Het kopen zit achter één kleine interface in `src/game/shop.ts`:

```ts
interface PurchaseProvider {
  readonly simulated: boolean;                    // true: er kan geen geld bewegen
  listPacks(): Promise<readonly CoinPack[]>;      // de pakketten
  buy(packId: string): Promise<PurchaseResult>;   // success | cancelled | failed
}
```

Er is één implementatie, `SimulatedProvider`. De spelcode (`src/main.ts`) praat alleen met de
interface: `buyPack` vraagt de laag om een uitkomst, telt alleen bij `success` de munten bij
(`walletAfter`), schrijft het kasboek en geeft de bonregel terug aan het scherm
(`src/ui/shopView.ts`), dat zelf nooit aan het saldo komt. Een echte winkel wordt een tweede
implementatie van dezelfde interface; scherm, kasboek en links blijven zoals ze zijn.

## 4. Wat een echte winkel nodig heeft — NIET GEBOUWD

> **Niets van dit hoofdstuk bestaat in het spel.** Het is een lijst van wat er komt kijken, in
> algemene termen en naar beste weten op 2026-11-22. Het is **geen juridisch of fiscaal advies**.
> Laat dit vóór livegang nakijken door een jurist (consumentenrecht, privacy) en een
> belastingadviseur; regels en winkelvoorwaarden veranderen geregeld.

### 4.1 De betaalroute

TURNFLOCK is nu een webspel in één HTML-bestand. De route hangt af van waar het verschijnt:

- **Als app in de App Store of Google Play** (het webspel verpakt in een app): digitale goederen
  zoals munten moeten daar in de regel via de betaalsystemen van Apple en Google zelf lopen. De
  winkel houdt een commissie in (grofweg 15–30%) en regelt btw en prijzen per land. Uitzonderingen
  voor externe betaallinks bestaan en verschuiven; nakijken op het moment zelf.
- **Als webspel**: een betaaldienst (in Nederland met iDEAL) of een *merchant of record* die als
  verkoper optreedt en de btw afdraagt. Dan is de uitgever zelf de verkoper met alle plichten
  daarvan, of besteedt hij dat uit.
- In beide gevallen is een **server** nodig. Nu staat het saldo in `localStorage` op het toestel;
  iedereen kan het daar aanpassen, en het is weg als de browsergegevens gewist worden. Zodra munten
  geld kosten moet het saldo, of in elk geval elke aankoop, op een server staan die de betaling
  controleert.

### 4.2 Bonnen en aankopen herstellen

- Elke aankoop wordt op de server gecontroleerd tegen de bon van de winkel of de betaaldienst, en
  precies één keer geleverd (ook als de app middenin sluit of de melding twee keer binnenkomt).
- Betalingen die pas later slagen of mislukken (iDEAL, bankoverschrijving, "pending" bij Google)
  moeten netjes afgehandeld worden: niet leveren voor het geld er is, wel leveren als de speler de
  app al dicht had.
- Munten zijn verbruiksgoederen; winkels herstellen die niet vanzelf op een nieuw toestel. Wie wil dat
  gekochte munten een nieuwe telefoon overleven, heeft een account of een andere koppeling met een
  serversaldo nodig. Het kasboek van nu (gekocht en verdiend apart) is daar het begin van.
- De speler krijgt een echte bon (e-mail of in de winkel) en kan zijn aankopen terugzien.

### 4.3 Terugbetalingen

- Winkels en betaaldiensten kunnen een aankoop terugdraaien en melden dat aan de server. Er moet een
  regel zijn voor wat er dan met de munten gebeurt (terugnemen; wat als ze al op zijn).
- In de EU heeft een consument bij een aankoop op afstand in beginsel 14 dagen bedenktijd. Bij
  digitale inhoud die direct geleverd wordt vervalt die alleen als de koper daar vooraf uitdrukkelijk
  mee instemt en erkent dat het recht vervalt, en dat bevestigd krijgt. Hoe dat bij munten precies
  moet, hoort bij de juridische controle.
- Een bereikbaar aanspreekpunt en een duidelijke terugbetaalregeling in gewone taal.

### 4.4 Belasting en prijzen per land

- Btw is verschuldigd in het land van de koper; binnen de EU via de éénloketregeling, tenzij de
  app-winkel of een merchant of record als verkoper optreedt.
- Prijzen worden getoond in de valuta van de koper en inclusief btw; de totale prijs moet duidelijk
  zijn vóór de koop. Winkels werken met prijsniveaus per land.
- Inkomsten uit het spel zijn omzet van een onderneming: administratie, facturen, eventueel KvK en
  btw-nummer.

### 4.5 De oudercontrole (beschreven, niet gebouwd)

Kinderen kunnen dit spel spelen. Vóór echte betalingen komt er een drempel die een volwassene moet
nemen. Het ontwerp laat daar ruimte voor:

- **Plaats**: tussen de tik op een pakket en de bevestigingsstap (in `ShopView.confirm`, zie de
  opmerking in de code), en opnieuw bij het openen van een eventuele aankoopgeschiedenis of
  instelling die bestedingen raakt.
- **Vorm**: een opgave die een jong kind niet oplost maar een volwassene wel (bijvoorbeeld een som
  in woorden of een geboortejaar invullen), elke keer opnieuw, zonder "onthoud dit". Dit is een
  drempel en geen leeftijdscontrole; de echte beveiliging zijn de betaalwachtwoorden en
  gezinsinstellingen van het toestel en de winkel, en daar verwijst het spel naar.
- **Daarnaast**: een instelbare bestedingslimiet per dag of maand, een instelling "aankopen uit" die
  achter dezelfde drempel zit, en geen winkel-links op het puzzelscherm voor wie die instelling
  gebruikt. Winkels stellen voor apps in een kindercategorie zelf eisen aan zo'n drempel.

### 4.6 Privacy en toestemming

- Nu verlaat niets het toestel: geen account, geen meting, geen advertenties. Een echte winkel
  verandert dat (betaalgegevens bij de betaaldienst, aankoopgegevens op de server), en dan gelden de
  AVG en de regels voor cookies en vergelijkbare opslag.
- Nodig: een privacyverklaring in gewone taal, alleen de gegevens die nodig zijn, bewaartermijnen,
  verwerkersovereenkomsten met de betaaldienst en de host, en een manier om gegevens in te zien en te
  laten wissen.
- Voor toestemming als grondslag geldt in Nederland de leeftijd van 16 jaar; daaronder is toestemming
  van een ouder nodig. Geen profilering van kinderen en geen meet- of advertentiesoftware zonder
  geldige toestemming.

### 4.7 Wat de wet vraagt bij spellen die kinderen spelen (EU en Nederland, in algemene termen)

- **Oneerlijke handelspraktijken**: kinderen in reclame rechtstreeks aansporen om te kopen, of om hun
  ouders over te halen, staat op de Europese zwarte lijst. Ook misleiding over prijs en druk
  (valse schaarste, valse timers) is verboden. De ontwerpregels van hoofdstuk 2 zijn daarop gebouwd.
- **Speelgeld**: de Europese consumententoezichthouders hebben in 2025 uitgangspunten voor virtuele
  munten in spellen gepubliceerd. De kern: de prijs van wat je in het spel koopt moet ook in echt geld
  duidelijk zijn, kosten mogen niet verstopt worden achter tussenmunten of gedwongen bundels, en
  kwetsbare spelers, kinderen in het bijzonder, verdienen extra bescherming. Voor TURNFLOCK betekent
  dat onder meer: bij de prijs van een hint of Undo moet te zien zijn wat dat in euro's is.
- **Nederland**: de ACM houdt toezicht en heeft een leidraad over online beïnvloeding (misleidende
  ontwerpen). Een minderjarige kan zonder toestemming van een ouder in beginsel geen bindende koop
  sluiten, behalve wat voor de leeftijd gebruikelijk is; zulke aankopen kunnen worden teruggedraaid.
- **Informatieplichten bij verkoop op afstand**: wie de verkoper is, de totale prijs, de
  bedenktijdregeling, en een bestelknop waaruit duidelijk blijkt dat er betaald moet worden.
- **Winkelregels en keurmerken**: Apple en Google hebben eigen regels voor apps voor kinderen
  (oudercontrole, beperkingen op advertenties en meetsoftware). De leeftijdsaanduiding moet
  aankopen in het spel vermelden (bij PEGI de aanduiding "in-game purchases").
- **Geen loot boxes of kansspelelementen**: die zitten er niet in en horen er niet in te komen; een
  pakket is altijd een vast aantal munten voor een vaste prijs.

### 4.8 Verder nog

- Een tweede implementatie van `PurchaseProvider`, met de label- en teksten "Test shop" eruit en de
  wettelijke teksten erin; de winkel moet duidelijk tonen of hij gespeeld is (`simulated`).
- Fraude en misbruik: aankopen namaken, terugboekingen, een saldo dat op het toestel wordt aangepast.
- Testen in de zandbakomgevingen van de winkel of betaaldienst, en op echte toestellen.
- Bereikbaarheid: klantenservice, algemene voorwaarden, contactgegevens van de uitgever.

## 5. Economienotitie: verdienen, uitgeven en wat de pakketten waard zijn

> **Verouderd sinds 2026-11-23.** De rest van dit hoofdstuk rekent met de allereerste bedragen (start
> 30, hint 10, pakketten van 100, 250 en 700) en is bewaard als verslag van hoe de pakketten toen zijn
> gekozen. De huidige bedragen, de vier afstellingen en hun doorrekening staan in `design/economy.md`.
> Wat nu geldt voor de pakketten, kort:
>
> | Afstelling | Pakketten (voorbeeldprijs) | Kleinste pakket koopt | Eén hint / één +3 moves in euro |
> |---|---|---|---|
> | Roomy | 100 / 250 / 700 voor €0,99 / €1,99 / €4,99 | 5 hints of 2,5 keer +3 moves | €0,20 / €0,40 |
> | Firmer | 100 / 250 / 700 voor €0,99 / €1,99 / €4,99 | 2,5 hints of 1,25 keer +3 moves | €0,40 / €0,79 |
> | **Tight (standaard)** | 150 / 400 / 1.100 voor €0,99 / €1,99 / €4,99 | 2 hints of 1 keer +3 moves | €0,49 / €0,99 |
> | Scarce | 800 / 2.200 / 5.000 voor €1,99 / €4,99 / €9,99 | 3,2 hints of 1 keer +3 moves | €0,62 / €1,87 |
>
> De regels voor pakketten zijn niet veranderd: drie pakketten, het grotere is per munt nooit duurder,
> de hoeveelheidskorting wordt niet aangeprezen, en geen pakket is voorgeselecteerd of uitgelicht.

**Dit is een beginpunt voor de test, geen voorspelling.** De spelersprofielen hieronder zijn
aannames; alleen het kasboek van echte speelsessies kan ze bevestigen of weerleggen. De rekensom is
opnieuw te draaien met `node tools/economy/shop-sim.mjs`, waar de profielen ook aan te passen zijn.

### Wat vaststaat (uit `data/config.json` en `data/levels.json`)

- Start: 30 munten. Winst: 10, plus 3 per ongebruikte zet, plus 10 voor de kortste oplossing. Het
  zettenbudget is de kortste oplossing plus 2, dus een level betaalt **26** (kortste oplossing),
  **13** (één zet meer) of **10** (twee zetten meer). Wie een betaalde hint of extra zetten
  gebruikte krijgt alleen de 10. Elk level betaalt zijn beste beloning één keer.
- Prijzen: hint 10, Undo 5 per stap, "+3 moves" 25. Restart is gratis.
- Levels 1 tot 40: 11 makkelijke (kortste oplossing tot 6 zetten), 18 middelzware (7 of 8) en 11
  zware (9 tot 12). De middelzware beginnen bij level 3, de zware bij level 14.
- Het maximum over 40 levels is 30 + 40 × 26 = **1070** munten; het minimum 30 + 40 × 10 = **430**.

### Aannames per speler

| | Sterke speler | Gemiddelde speler | Zwakke speler |
|---|---|---|---|
| Verdient per level | altijd 26 | makkelijk: gemiddeld 16; middel: 13; zwaar: 11 | altijd 10 |
| Makkelijk level | geen hulp | 1 Undo (5) | 2 Undo's (10) |
| Middelzwaar level | geen hulp | 3 Undo's en om het level een hint (20) | 4 Undo's en 1 hint (30) |
| Zwaar level | geen hulp | 4 Undo's, 1 hint, een op de vier keer "+3 moves" (36) | 5 Undo's, 2 hints, om het level "+3 moves" (58) |

### Uitkomst over levels 1 tot 40

| | Verdient | Wil uitgeven | Loopt droog bij | Komt in totaal tekort |
|---|---|---|---|---|
| Sterke speler | 1040 | 0 | nooit (eindigt op 1070) | 0 |
| Gemiddelde speler | 535 | 814 | level 27 | ongeveer 260 |
| Zwakke speler | 400 | 1283 | level 9 | ongeveer 860 |

Verloop van de zwakke speler: na 10 levels 20 tekort, na 20 levels 235, na 30 levels 470, na 40
levels 863. De gemiddelde speler heeft na 10 levels nog 107 munten, na 20 nog 38, en komt pas in het
laatste kwart tekort (61 na 30 levels, 260 na 40).

### Wat dat zegt

- De sterke speler heeft de winkel nooit nodig en houdt ruim duizend munten over waar hij niets mee
  kan. Dat is geen probleem voor de winkel, wel een open vraag voor het spel (wat doet hij ermee?).
- De gemiddelde speler redt het tot ver in de tweede helft op eigen munten. Zijn tekort over het
  hele spel (ongeveer 260) is **één Pouch van 250**: rond €2 voor veertig levels.
- De zwakke speler staat al rond level 9 droog en heeft over het hele spel ongeveer 860 munten
  extra nodig: **een Chest van 700 plus een Handful, ongeveer €6**, of ruim drie Pouches. Op een zwaar
  level wil hij ongeveer 58 munten uitgeven terwijl het level er 10 oplevert; een Handful van 100 is
  dan twee zware levels hulp.
- Het knelpunt is **Undo**. In deze aannames gaat bij beide spelers meer dan de helft van de uitgaven
  naar Undo (5 per stap, meerdere per level). Dat is de knop die het vaakst geweigerd zal worden, en
  dus de plek waar "Get coins" het vaakst verschijnt. Als dat in de test als zeuren voelt, is
  `coins.freeUndosPerLevel` (nu 0) de eerste knop om aan te draaien, niet de pakketprijs.

### Wat de voorbeeldpakketten moeten kosten en bevatten om te kloppen

- **Handful, 100 munten, €0,99**: de kleinste zinnige eenheid. 100 munten is 10 hints, 20 Undo's of 4
  keer "+3 moves". Omgerekend kost een hint dan €0,10, een Undo €0,05 en "+3 moves" €0,25. Kleiner dan
  100 heeft geen zin: de laagste prijs die winkels gangbaar toestaan ligt rond dit bedrag, en 50
  munten is op een zwaar level in één poging op.
- **Pouch, 250 munten, €1,99**: afgestemd op het hele tekort van de gemiddelde speler.
- **Chest, 700 munten, €4,99**: afgestemd op het grootste deel van het tekort van de zwakke speler.
- De grotere pakketten zijn per munt iets goedkoper (€0,99, €0,80 en €0,71 per 100). Dat is een
  gewone hoeveelheidskorting; ze wordt niet als "bonus" of "korting" aangeprezen, en een unit-test
  bewaakt dat een groter pakket per munt nooit duurder is dan een kleiner.
- Een vierde, groter pakket is nu niet te verantwoorden: zelfs de zwakke speler heeft over alle 40
  levels minder dan 900 munten extra nodig. Pas als er meer levels of meer te besteden komt.

### Waar de test op moet letten

1. Bij welk level staat een echte tester voor het eerst droog, en door welke knop (kasboek: Spent on
   Undo, hints, +3 moves)?
2. Hoeveel "koopt" hij dan, en is dat na twee of drie levels alweer op?
3. Voelt de link "Get coins" als hulp of als zeuren? En wordt Restart nog gebruikt?
4. Houdt een goede speler te veel munten over?
5. Kloppen de aannames hierboven? Pas ze aan in `tools/economy/shop-sim.mjs` en draai opnieuw.

## 6. Een aanbod op het verliesmoment: voorstel, NIET GEBOUWD

De referentie bij bevinding B12 toont onder het verliesscherm een bundel (munten plus hulpmiddelen)
met een sticker "30% korting". Dat is hier niet overgenomen en hoort er ook niet in: de korting is
een anker dat alleen op het moment van frustratie verschijnt, de bundel mengt dingen zodat de prijs
niet te vergelijken is, en het aanbod staat op de plek waar de gratis uitweg hoort te staan.

Er bestaat wel een vorm die binnen de vaste grenzen past. Wat er nu al is: bij te weinig munten voor
"+3 moves" staat onder de gratis Retry een stille tekstlink "Get coins", die de gewone winkel opent.
Het voorstel maakt van die link één rustige regel met een knop:

- **Wanneer**: alleen op de pop-up "Out of moves", alleen als de oplosser heeft bewezen dat +3 moves
  deze stand oplost (de bestaande regel voor het aanbod), en alleen als de speler er te weinig munten
  voor heeft. In elk ander geval verschijnt er niets.
- **Wat er staat**: de feiten, zonder aansporing. "You have 40 coins. +3 moves costs 150." en daaronder
  het kleinste gewone pakket dat het tekort dekt, met zijn gewone naam, inhoud en prijs: "Handful of
  coins: 150 coins, €0.99".
- **Wat er niet staat**: geen korting, geen sticker, geen doorgestreepte prijs, geen "alleen nu", geen
  timer, geen bundel met extra's, geen animatie die de aandacht trekt, geen ander pakket dan wat ook
  in de winkel ligt en voor dezelfde prijs.
- **Volgorde en gewicht**: Retry blijft de hoofdknop en staat erboven. Het aanbod is kleiner en
  rustiger dan Retry en heeft geen eigen kleur.
- **De tik** opent de bestaande bevestigingsstap van de winkel (pakket, munten, prijs, "Confirm").
  Er wordt dus nooit met één tik gekocht. Na de aankoop staat de speler terug op dezelfde pop-up, met
  +3 moves nu betaalbaar; hij koopt die zelf, of kiest toch Retry.
- **Hoe vaak**: één keer per verloren poging, nooit als pop-up over het spel, en niet opnieuw na
  "Cancel".
- **Met een echte winkel**: de oudercontrole van hoofdstuk 4.5 komt vóór de bevestigingsstap, ook hier.

Waarom dit eerlijk te verdedigen is: het aanbod verschijnt alleen als het bewezen helpt, het zegt
precies wat de speler tekortkomt en wat het kost, en het is hetzelfde pakket voor dezelfde prijs als
op elk ander moment. Wat het niet wegneemt: het is en blijft een aanbod op een moment van
teleurstelling. Als kinderen de doelgroep zijn, zou ik het weglaten en de stille link houden.
