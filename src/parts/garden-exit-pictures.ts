import * as THREE from 'three';
import type { Color } from '../engine/types';
import * as pic from '../render/parts/garden/exitPictures';
import type { ExitLook } from '../render/parts/garden/exitMoments';

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
const LOOK_NAMES: Record<ExitLook, string> = { grey: 'Grijs', green: 'Groen', rays: 'Groen met stralen' };

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
    const el = k.section('garden-exit', 'Tuin · Uitgang: het beeld van de eigenaar', 'Standaard. Uitgesneden uit 22-sheet-exit-pad-states en 3× vergroot (ca. 300 px breed): omtrek, vinkje en stralen scherp nagetrokken van het beeld, de vlakken zijn het geschilderde beeld zelf. In het spel een plat vlak dat recht naar de spelcamera kijkt (30° gekanteld, perspectief), op een grastegel.');
    const ref = k.row(el, 'ref');
    ref.appendChild(k.figure(k.img(k.refPads, 'Origineel'), 'Origineel van de eigenaar (22-sheet-exit-pad-states)'));
    const cuts = k.row(el, 'cutouts');
    for (const look of ['grey', 'green', 'rays'] as ExitLook[]) cuts.appendChild(cutout(k, `exit-${look}` as SpriteName, `${LOOK_NAMES[look]} · WebP`));
    el.insertAdjacentHTML('beforeend', '<h3>Op spelgrootte, onder de spelcamera</h3>');
    for (const cellPx of [53, 42]) {
      const game = k.row(el, 'game');
      for (const look of ['grey', 'green', 'rays'] as ExitLook[]) {
        const f = k.field(null, cells([[0, 0, pic.buildExit(undefined, look)]]).concat([[-1, 0, k.bot('blue', 1)], [0, 1, k.bot('yellow', 0)], [0, -1, k.bot('red', 2)]]));
        game.appendChild(k.figure(k.inGame(f, 3, 3, cellPx), `${LOOK_NAMES[look]} · vak ${cellPx} px`));
      }
    }
    k.note(el, `Kosten per uitgang: ${k.cost(pic.buildExit(undefined, 'green'))} (grastegel, gloed en het beeld: één vlak van 2 driehoeken). De robots staan er als maatstaf; de kuikens zijn een andere sessie.`);
    sheet.appendChild(el);
  }

  // ---- Colour exits ----
  {
    const el = k.section('garden-exit-colours', 'Tuin · Uitgangen per kleur (levels 61 tot 80): uit het beeld', 'Er is geen beeld per kleur: het groene plateau van de eigenaar is omgekleurd (alleen het verlichte vlak en de gloed in de voegen; steen en vinkje blijven). Geel krijgt het vinkje van de eigenaar in donker oker, zoals bij de robotuitgang. Voor "Kleurvormen" is het vinkje weggeschilderd en de vorm erin gezet.');
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
      const f = k.field(null, cells([[-1, 0, pic.buildExit('red', 'grey')], [0, 0, pic.buildExit('blue', 'green')], [1, 0, pic.buildExit(undefined, 'rays')]]));
      game.appendChild(k.figure(k.inGame(f, 3, 3, 53), 'Rood klaar (grijs), blauw wacht, gewone uitgang net binnen (stralen)'));
    }
    sheet.appendChild(el);
  }

  // ---- Special tiles ----
  {
    const el = k.section('garden-specials', 'Tuin · Draaitegel, drukplaat en poort: uit stukken van de beelden', 'De eigenaar heeft hier geen beelden van; ze zijn gemaakt uit stukken van zijn beelden, zodat ze dezelfde geschilderde stijl hebben. Draaitegel: het plateau met een crèmekleurig vlak en de draaipijl van de draaiknop (18-sheet-action-buttons), groen gekleurd. Drukplaat: het plateau in lavendel met een verhoogde knop in de stijl van de knoppen van de eigenaar. Poort: de balustrade uit 08-gazebo tussen twee stenen zuilen, in dezelfde lavendel. Alles op 3× (ca. 300 px breed).');
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
