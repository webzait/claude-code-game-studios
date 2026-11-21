<!-- PROTOTYPE - NOT FOR PRODUCTION -->
# Game Brief: BUMPBURST

## In your words

BUMPBURST — One color. One burst. Big chain reactions.

Status: eerste game voor Claude-prototype. Genre: hybrid-casual physics puzzle. Kern: alle vaste ronde bumpers van een gekozen kleur zetten tegelijk kort uit, duwen kleine witte knikkers en creëren een gezamenlijke kettingreactie richting opvangbak.

Definitieve kernmechaniek: In een compacte vierkante bak liggen witte knikkers en enkele grote ronde rubberen bumpers in rood, blauw en geel. Bumpers zijn vast gepositioneerd. De speler tikt een kleurknop: ALLE bumpers van die kleur zetten synchroon tijdelijk uit, verplaatsen nabijgelegen knikkers via botsingen/impulsen en krimpen weer naar hun oorspronkelijke straal. Niet-verzamelde knikkers blijven op hun nieuwe plek. Het doel is een minimumaantal knikkers binnen een maximaal aantal kleurpulsen naar de opvangopening te brengen. Geen directe knikkerbesturing en geen verplaatsbare bumpers.

Visuele ontwerpstandaard: Gebruik primaire/secondaire kleuren helder en functioneel: rood #F04446, blauw #2675E8, geel #FFD12F, groen #2FC56C, oranje #FF9736, paars #9856E8. Begin met drie kleuren. Witte parelmoerknikkers, zachte schaduwen, afgeronde rubberen bumpers, rustige lichtgrijze of gebroken witte achtergrond, premium diorama-uitstraling. Grote speelbak centraal; geen drukke HUD of generieke stockgraphics. Voeg symbolen toe ter ondersteuning van kleurherkenning; een puls geeft subtiel veer-, licht- en geluidseffect.

Prioriteit: gameplayhelderheid, tactiele voldoening, sterke visuele feedback, goede prestaties en eenvoudige bediening met één vinger.

(The full request, with the physics, level, UI, technique and test requirements, is the first message of the session that built this prototype.)

**Pitch:** Tap one color and every bumper of that color bursts at once, shoving white marbles into a chain reaction toward the catcher.

**Genre:** hybrid-casual physics puzzle

**Controls:** one finger: tap a color button. Desktop: click, or keys 1-3; R resets.

**Question:** do players want to play five levels of "pick the color, watch the burst" of their own accord?

**Hooks:** one tap moves every bumper of a color together; marbles stay where they stop, so the order of colors is the puzzle.

**Intent:**

## Look and references
- Look: premium minimalist diorama. A light grey rounded tray on an off-white background, pale floor, glossy rubber bumper domes in red, blue and yellow on white rims, white pearl marbles, soft shadows, and a green catch bin that sticks out of the near wall and fills with the caught marbles (from your playfield sketch). Color carries the rule; each color also has a shape (red triangle, blue square, yellow star) on bumper and button. Every figure drawn in code, no emoji, no stock graphics, no neon.
- References: your concept sketch of the playfield (grey frame, white-rimmed bumpers, green bin outside the bottom wall, R/B/Y buttons). Avoid visual copies of existing games.
- View: 2.5D/3D · Camera: fixed, angled top-down (about 63 degrees), portrait, tray fills the width.

## First minute
Level 1 shows one red bumper with five marbles resting on it and one bobbing red button. The player taps it: the bumper swells, the marbles shoot out, three drop into the catcher with a rising chime, "Level clear". Level 2 offers red and blue with a single pulse: one sends the marbles home, the other into the wall. By level 3 the greedy first tap loses and the player learns that order matters.

## Challenge
Level 1 cannot be lost by choice; level 2 can (wrong color). Level 3 is the first real trouble: the tempting blue pulse catches two marbles and loses. A loss costs only a retry of the level. Level 5 has three colors, 15 marbles and 4 pulses, and 9 of the 81 full-length orders win.

## Core loop
- Read the board: which bumpers will move which marbles where.
- Tap one color; all its bumpers burst; watch the chain settle.
- Marbles in the catcher count; the rest stay where they stopped.
- Reach the target within the pulse budget, or retry with another order.

## Goal & fail state
- Win: at least `target` marbles in the catcher within `pulses` pulses, decided only after a pulse has fully settled.
- Fail: pulses spent and target not reached. Retry is instant.

## Features
- [x] Global burst per color on a deterministic fixed-step simulation
- [x] Five levels, each with a solution verified in the real simulation
- [x] Catcher, goal counter, pulse budget, win and loss, reset, next level
- [x] Diorama look with symbols backing every color
- [x] Burst feedback: spring, light, shock ring, sound; chime per caught marble
- [x] Touch and desktop controls with input locked while a pulse resolves

## Out of scope
- Ads, in-app purchases and any SDK: only extension points for now (extra pulses, hints from stored solutions, skins through the theme, progress storage)
- Green, orange and purple bumpers: colors and symbols are defined, no level uses them yet
- Level editor, daily challenges, meta progression, accounts

## Build order
1. The slice: physics and rules, five levels proven solvable, playable in portrait with win and loss.
2. Feel pass on a real phone: burst strength, friction, sound.
3. More levels and new elements (moving parts, more colors) once five levels hold attention.

---
**Kill condition:** if testers do not finish the five levels unprompted, or cannot predict what a burst will do after level 3.

**Who it's for / what they feel:** casual mobile players; a satisfying, tactile "one tap, big result".

**Games you love / don't:** not given.
