import * as THREE from 'three';
import type { Color } from '../engine/types';
import * as pic from '../render/parts/garden/exitPictures';
import refGrey from './ref/garden/checkpoint-inactief.webp';
import refGreen from './ref/garden/checkpoint-actief.webp';
import refRays from './ref/garden/checkpoint-opgelicht.webp';
import refPortal from './ref/garden/checkpoint-portaal.webp';
import type { ExitLook } from '../render/parts/garden/exitMoments';
import garden from '../../data/themes/garden/exit.json';

/**
 * Parts sheet cards for the garden exit, gazebo and special tiles made from the owner's own
 * pictures (the standard version, src/render/parts/garden/exitPictures.ts): each cut-out WebP next
 * to the original, and the parts on the board at game size under the game camera.
 */

/** Drawing helpers shared with src/parts/garden-exit.ts. */
export interface Kit {
  large(object: THREE.Object3D, dir: THREE.Vector3, pad?: number, size?: number): HTMLCanvasElement;
  inGame(field: THREE.Object3D, cells: number, rows: number, cellPx: number, centre?: THREE.Vector3): HTMLCanvasElement;
  field(centre: THREE.Object3D | null, extras?: [number, number, THREE.Object3D][], size?: number): THREE.Group;
  bot(color: Color, heading?: number): THREE.Object3D;
  figure(canvas: HTMLCanvasElement | HTMLImageElement, caption: string, cls?: string): HTMLElement;
  img(src: string, alt: string): HTMLImageElement;
  section(id: string, title: string, intro: string): HTMLElement;
  row(el: HTMLElement, cls?: string): HTMLElement;
  note(el: HTMLElement, html: string): void;
  cost(o: THREE.Object3D): string;
  refPads: string;
  refGoal: string;
  refGazebo: string;
}

type SpriteName = string;
const LOOK_NAMES: Record<ExitLook, string> = { grey: 'Grijs', green: 'Groen', rays: 'Groen met stralen', portal: 'Portaal' };
const LOOKS: ExitLook[] = ['grey', 'green', 'rays', 'portal'];
/** The owner's corrected pictures (design/reference/turnflock/garden/exit-pads-v2/), shown here at 520 px. */
const REFS: Record<ExitLook, [string, string]> = {
  grey: [refGrey, 'checkpoint-inactief'],
  green: [refGreen, 'checkpoint-actief'],
  rays: [refRays, 'checkpoint-opgelicht'],
  portal: [refPortal, 'checkpoint-portaal'],
};

/** The cut-out shown enlarged `zoom` times on a checkerboard (so the transparent edge is visible), with its size. */
function cutout(k: Kit, name: SpriteName, caption: string, zoom = 1): HTMLElement {
  const i = k.img(pic.pictureUrl(name), caption);
  i.className = 'ge-cutout';
  i.decoding = 'sync';
  const f = k.figure(i, caption);
  i.addEventListener('load', () => {
    i.style.width = `${i.naturalWidth * zoom}px`;
    f.querySelector('figcaption')!.insertAdjacentText('beforeend', ` · ${i.naturalWidth}×${i.naturalHeight} px`);
  });
  return f;
}

/** Mark every part in `extras` as a whole cell (so the field leaves out the grass tile there). */
function cells(extras: [number, number, THREE.Object3D][]): [number, number, THREE.Object3D][] {
  for (const [, , o] of extras) o.userData.tile = true;
  return extras;
}

/** Add the picture cards. */
export function addPictureCards(sheet: HTMLElement, k: Kit): void {
  // ---- Exit pad ----
  {
    const el = k.section('garden-exit', 'Tuin · Uitgang: de gecorrigeerde beelden van de eigenaar', 'Standaard. De vier gecorrigeerde checkpoint-beelden van de eigenaar (exit-pads-v2, 1254×1254 op wit): uitgesneden van de witte achtergrond (stenen tegel dekkend, gloed, stralen en de lichtstraal half doorzichtig als licht; geen schaduw, net als de tegel die ze vervangen), dan alleen netjes verkleind: de steen is 320 px breed (twee keer de grootste weergave op een telefoon) en elke stand is op de hoogte van de groene tegel gebracht, zodat de tegel niet verspringt. Nieuw: het portaal, voorgesteld voor het moment dat een kuiken binnengaat. In het spel een plat vlak dat recht naar de spelcamera kijkt (30° gekanteld, perspectief), op een grastegel.');
    for (const look of LOOKS) {
      el.insertAdjacentHTML('beforeend', `<h3>${LOOK_NAMES[look]}</h3>`);
      const row = document.createElement('div');
      row.className = 'ge-look';
      const [src, name] = REFS[look];
      const ref = k.img(src, name);
      row.appendChild(k.figure(ref, `Origineel (${name}.png, verkleind)`));
      for (const [cls, label] of [['', 'uitgesneden, op ruitjes'], ['on-dark', 'op donker'], ['on-grass', 'op gras #8BCB4F']]) {
        const f = cutout(k, `exit-${look}` as SpriteName, `WebP ${label}`);
        const i = f.querySelector('img')!;
        if (cls) i.classList.add(cls);
        row.appendChild(f);
      }
      el.appendChild(row);
    }
    el.insertAdjacentHTML('beforeend', '<h3>Op spelgrootte, onder de spelcamera</h3>');
    for (const cellPx of [53, 42]) {
      const game = k.row(el, 'game');
      for (const look of LOOKS) {
        const f = k.field(null, cells([[0, 0, pic.buildExit(undefined, look)]]).concat([[-1, 0, k.bot('blue', 1)], [0, 1, k.bot('yellow', 0)], [0, -1, k.bot('red', 2)]]));
        game.appendChild(k.figure(k.inGame(f, 3, 3, cellPx), `${LOOK_NAMES[look]} · vak ${cellPx} px`));
      }
    }
    {
      el.insertAdjacentHTML('beforeend', `<h3>Een kuiken gaat de uitgang in (${garden.exit.flashSeconds} s)</h3>`);
      const frames = [0, 0.06, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
      const strip = k.row(el, 'game');
      for (const kk of frames) {
        const pad = pic.buildExit(undefined, 'green');
        pic.exitEntry(pad, kk);
        const f = k.field(null, cells([[0, 0, pad]]), 3);
        // Framed close round the pad and the column above it.
        strip.appendChild(k.figure(k.inGame(f, 1.5, 2.4, 60, new THREE.Vector3(0, 0.35, -0.4)), `${Math.round(kk * garden.exit.flashSeconds * 100) / 100} s`));
      }
      // The same, playing in a loop, larger: frames drawn once, then shown one after the other.
      const live = k.row(el, 'game');
      const shots: HTMLCanvasElement[] = [];
      const steps = 27;
      for (let i = 0; i <= steps; i++) {
        const pad = pic.buildExit(undefined, 'green');
        pic.exitEntry(pad, i / steps);
        shots.push(k.inGame(k.field(null, cells([[0, 0, pad]]), 3), 3, 3, 90));
      }
      const view = document.createElement('canvas');
      view.width = shots[0].width;
      view.height = shots[0].height;
      view.style.width = shots[0].style.width;
      view.style.height = shots[0].style.height;
      const ctx = view.getContext('2d')!;
      ctx.drawImage(shots[0], 0, 0);
      let frame = 0;
      const rest = 18;
      setInterval(() => {
        frame = (frame + 1) % (steps + 1 + rest);
        ctx.clearRect(0, 0, view.width, view.height);
        ctx.drawImage(shots[Math.min(frame, steps)], 0, 0);
      }, (garden.exit.flashSeconds * 1000) / steps);
      live.appendChild(k.figure(view, 'Afgespeeld in een lus (vak 90 px). Het portaal van de eigenaar verschijnt over de groene tegel, die even opveert; een zuil van het eigen licht van het portaal schiet uit de ring omhoog en dooft; dan weer groen. Geen rondje: de gloed op het gras volgt nu ook de vierkante tegel.'));
      const colour = k.row(el, 'game');
      for (const kk of [0, 0.15, 0.5, 1]) {
        const pad = pic.buildExit('blue', 'green');
        pic.exitEntry(pad, kk);
        colour.appendChild(k.figure(k.inGame(k.field(null, cells([[0, 0, pad]]), 3), 3, 3, 42), `Blauwe uitgang · ${Math.round(kk * garden.exit.flashSeconds * 100) / 100} s (geen portaal in eigen kleur: alleen opveren en oplichten)`));
      }
    }
    k.note(el, `Kosten per uitgang: ${k.cost(pic.buildExit(undefined, 'green'))} (grastegel, gloed en het beeld: één vlak van 2 driehoeken). Moment → stand (data/themes/garden/exit.json, <code>moments</code>): wachten = groen, kuiken net binnen = portaal (voorstel), alle kuikens binnen = stralen, uitgang klaar terwijl anderen nog buiten zijn = grijs. Een uitgang in een kuikenkleur heeft geen portaal of stralen in eigen kleur en houdt dan zijn kleur. De robots staan er als maatstaf; de kuikens zijn een andere sessie.`);
    sheet.appendChild(el);
  }

  // ---- Colour exits ----
  {
    const el = k.section('garden-exit-colours', 'Tuin · Uitgangen per kleur (levels 61 tot 80): uit het beeld', 'Er is geen beeld per kleur: de groene tegel van de eigenaar (gecorrigeerd beeld) is omgekleurd (alleen het verlichte vlak en de gloed in de voegen; steen en vinkje blijven). Geel krijgt het vinkje van de eigenaar in donker oker, zoals bij de robotuitgang. Voor "Kleurvormen" is het vinkje weggeschilderd en de vorm erin gezet.');
    const cuts = k.row(el, 'cutouts');
    for (const c of ['red', 'blue', 'yellow'] as Color[]) cuts.appendChild(cutout(k, `exit-${c}` as SpriteName, c === 'red' ? 'Rood' : c === 'blue' ? 'Blauw' : 'Geel', 0.5));
    for (const c of ['red', 'blue', 'yellow'] as Color[]) cuts.appendChild(cutout(k, `exit-shape-${c}` as SpriteName, 'met kleurvorm', 0.5));
    const game = k.row(el, 'game');
    for (const cellPx of [53, 42]) {
      const f = k.field(null, cells([[-1, 0, pic.buildExit('red')], [0, 0, pic.buildExit('blue')], [1, 0, pic.buildExit('yellow')]]).concat([[-1, 1, k.bot('red', 0)], [1, -1, k.bot('yellow', 2)]]));
      game.appendChild(k.figure(k.inGame(f, 3, 3, cellPx), `Rood, blauw, geel · vak ${cellPx} px`));
    }
    {
      const shaped = (c: Color): THREE.Group => {
        const p = pic.buildExit(c);
        (p.userData.shape as THREE.Object3D).visible = true;
        (p.userData.check as THREE.Object3D).visible = false;
        return p;
      };
      const f = k.field(null, cells([[-1, 0, shaped('red')], [0, 0, shaped('blue')], [1, 0, shaped('yellow')]]));
      game.appendChild(k.figure(k.inGame(f, 3, 3, 53), 'Met "Kleurvormen" aan · vak 53 px'));
    }
    {
      const f = k.field(null, cells([[-1, 0, pic.buildExit('red', 'grey')], [0, 0, pic.buildExit('blue', 'green')], [1, 0, pic.buildExit(undefined, 'portal')]]));
      game.appendChild(k.figure(k.inGame(f, 3, 3, 53), 'Rood klaar (grijs), blauw wacht, gewone uitgang: kuiken net binnen (portaal)'));
    }
    sheet.appendChild(el);
  }

  // ---- Special tiles ----
  {
    const el = k.section('garden-specials', 'Tuin · Draaitegel, drukplaat en poort: uit stukken van de beelden', 'De eigenaar heeft hier geen beelden van; ze zijn gemaakt uit stukken van de beelden van de eigenaar, zodat ze dezelfde geschilderde stijl hebben. Draaitegel: de groene checkpoint-tegel (gecorrigeerd beeld) met een crèmekleurig vlak en de draaipijl van de draaiknop (18-sheet-action-buttons), groen gekleurd. Drukplaat: dezelfde tegel in lavendel met een verhoogde knop in de stijl van de knoppen van de eigenaar. Poort: de balustrade uit 08-gazebo tussen twee stenen zuilen, in dezelfde lavendel. Tegels gemaakt op volle grootte en daarna verkleind tot een steen van 320 px.');
    const cuts = k.row(el, 'cutouts');
    cuts.appendChild(cutout(k, 'turn', 'Draaitegel'));
    cuts.appendChild(cutout(k, 'plate', 'Drukplaat'));
    cuts.appendChild(cutout(k, 'gate', 'Poort'));
    el.insertAdjacentHTML('beforeend', '<h3>Op spelgrootte</h3>');
    for (const cellPx of [53, 42]) {
      const game = k.row(el, 'game');
      const pressed = pic.buildPlate(false, false);
      (pressed.userData.button as THREE.Object3D).position.y -= 0.04;
      const open = pic.buildGate(false, false);
      (open.userData.door as THREE.Object3D).scale.y = pic.gateDoorScale(true);
      const tiles = cells([[-1, -1, pic.buildTurnTile(false, false)], [0, -1, pic.buildPlate(false, false)], [1, -1, pic.buildGate(false, false)], [-1, 0, pic.buildExit()], [0, 0, pressed], [1, 0, open]]);
      const f = k.field(null, [...tiles, [0, 0, k.bot('red', 0)], [1, 1, k.bot('blue', 2)], [-1, 1, k.bot('yellow', 1)]]);
      game.appendChild(k.figure(k.inGame(f, 3, 3, cellPx), `Vak ${cellPx} px · boven: draaitegel, drukplaat, poort dicht · midden: uitgang, plaat met robot, poort open`));
    }
    k.note(el, `Kosten: draaitegel ${k.cost(pic.buildTurnTile(false, false))}, drukplaat ${k.cost(pic.buildPlate(false, false))}, poort ${k.cost(pic.buildGate(false, false))}, elk inclusief de grastegel. Een geschilderd plaatje kan niet meedraaien met het kuiken: bij de draaitegel draait alleen de lichtring. De grastegel hier is een eenvoudige stand-in; de echte grastegel is van de bordsessie.`);
    sheet.appendChild(el);
  }

  // ---- Gazebo ----
  {
    const el = k.section('garden-gazebo', 'Tuin · Het prieel: het beeld van de eigenaar', 'Uitgesneden uit 08-gazebo (960 px breed, lucht door de bogen doorzichtig, echte schaduw) en 24-sheet-gazebo-goal (2,5× vergroot naar 775 px; het origineel is maar 318 px). Voorstel: het beeld bij "level gehaald" en het eindpunt van het levelpad, niet op een vak van het bord.');
    const ref = k.row(el, 'two');
    ref.appendChild(k.figure(k.img(k.refGazebo, 'Origineel 08-gazebo'), 'Origineel (08-gazebo)'));
    ref.appendChild(cutout(k, 'gazebo', 'WebP (getoond op 40 %)', 0.4));
    const ref2 = k.row(el, 'two');
    ref2.appendChild(k.figure(k.img(k.refGoal, 'Origineel 24-sheet-gazebo-goal'), 'Origineel (24-sheet-gazebo-goal)'));
    ref2.appendChild(cutout(k, 'gazebo-goal', 'WebP (getoond op 50 %)', 0.5));
    const sizes = k.row(el, 'game');
    for (const [name, px] of [['gazebo-goal', 160], ['gazebo', 120], ['gazebo', 64]] as [SpriteName, number][]) {
      const i = k.img(pic.pictureUrl(name), 'prieel');
      i.style.width = `${px}px`;
      sizes.appendChild(k.figure(i, `${px} px breed (pop-up / levelpad)`));
    }
    {
      const goal = pic.buildGazebo(true);
      goal.position.set(0, 0, -2.4);
      const f = k.field(null, [[0, 1, k.bot('yellow', 2)]]);
      f.add(goal);
      sizes.appendChild(k.figure(k.inGame(f, 4, 5, 42, new THREE.Vector3(0, 0.6, -0.8)), 'Achter het bord, op spelgrootte (vak 42 px)'));
    }
    sheet.appendChild(el);
  }
}
