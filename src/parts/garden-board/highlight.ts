import * as THREE from 'three';
import HL from '../../../data/themes/garden/highlight.json';
import TILE from '../../../data/themes/garden/tile.json';
import { CONFIG } from '../../config';
import { boardPixels, buildFloorTile, buildHighlightTile, buildTileGlow, hintGlowCells, type HintStep } from '../../render/parts/garden/board';
import { glowPulse } from '../../render/parts/garden/highlight';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, section, still, VIEWS } from './render';
import refSheetGlow from './ref-12-sheet-tile-highlight.webp';
import glowRimUrl from '../../../assets/turnflock/garden/board/highlight/glow-rim.png';

const W = HL.glow;
const PITCH = TILE.tile.size + GAP;

/** A chick stand-in for the hint picture (the chicks themselves are another session's): a yellow ball with a beak pointing along `dir` (0 north, 1 east, 2 south, 3 west). */
function standIn(dir: number): THREE.Group {
  const chick = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), new THREE.MeshStandardMaterial({ color: '#FFD23A', roughness: 0.7 }));
  body.position.y = 0.24;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), new THREE.MeshStandardMaterial({ color: '#FF8A1F', roughness: 0.6 }));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.3, -0.26);
  chick.add(body, beak);
  chick.rotation.y = -dir * (Math.PI / 2);
  chick.traverse((n) => { n.castShadow = true; });
  return chick;
}

/** Put `object` on cell (x, y) of a `cols` by `rows` board, on the tile top. */
function onCell(object: THREE.Object3D, x: number, y: number, cols: number, rows: number): THREE.Object3D {
  object.position.set((x - (cols - 1) / 2) * PITCH, TILE.tile.height, (y - (rows - 1) / 2) * PITCH);
  return object;
}

/** Give every glow in `object` the picture `map` in place of the painted glow. */
function withMap(object: THREE.Object3D, map: THREE.Texture): THREE.Object3D {
  object.traverse((n) => {
    if (n instanceof THREE.Mesh && n.name === 'tile-glow') {
      (n.material as THREE.MeshBasicMaterial).map = map;
      (n.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  });
  return object;
}

/** A glow on a plain tile at `opacity`, as the game pulses it. */
function pulsed(alt: boolean, opacity: number): THREE.Group {
  const tile = buildFloorTile(alt, false);
  const glow = buildTileGlow();
  (glow.material as THREE.MeshBasicMaterial).opacity = opacity;
  tile.add(glow);
  return tile;
}

/** The hint example: three chicks, one command. Two step forward, one walks into the rim. */
const HINT_CHICKS: { x: number; y: number; dir: number; step: HintStep }[] = [
  { x: 1, y: 3, dir: 1, step: { toX: 2, toY: 3, outcome: 'moved' } },
  { x: 3, y: 2, dir: 0, step: { toX: 3, toY: 1, outcome: 'moved' } },
  { x: 5, y: 4, dir: 1, step: { toX: 5, toY: 4, outcome: 'blocked-wall' } },
];

/** Parts sheet: the garden glowing tile next to 12-sheet-tile-highlight, the picture-or-code comparison, the pulse, and the hint in the garden. */
export function addHighlightCards(sheet: HTMLElement): void {
  const PX = 1000;
  const glowCost = cost(buildHighlightTile(false, false));
  section(sheet, 'garden-tile-highlight', 'Gloeiende tegel', `<div class="gb-row four">
      ${figure(img(refSheetGlow, 'Voorbeeld gloeiende tegel'), 'Voorbeeld 12-sheet-tile-highlight', 'ref small')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.top, PX, 0.66), 'Lichte tegel · bovenaanzicht')}
      ${figure(still(buildHighlightTile(true, true), VIEWS.close, PX, 0.66), 'Donkere tegel · schuin van boven')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.quarter, PX, 0.66), VIEWS.quarter.label)}
    </div>`,
  `De gewone grastegel (<code>buildFloorTile</code>, licht of donker) met de gloed erop (<code>buildHighlightTile</code>). De gloed volgt het profiel dat uit het voorbeeld is gemeten: een crèmewitte lijn precies op de tegelrand (0,04 cel breed), daarbuiten een gele halo tot ${W.reach} cel, daarbinnen geel dat in het gras overloopt. Gewoon gemengd, niet optellend, zodat hij ook op de lichte tegel leest. Kosten: ${fmt(glowCost.tris)} driehoeken (tegel + 2 voor de gloed), 1 extra tekenopdracht per gloed (eigen materiaal). Code: <code>src/render/parts/garden/highlight.ts</code>, maten en profiel: <code>data/themes/garden/highlight.json</code>.`);

  // Picture or code: the cut-out rim as a texture, against the painted glow, at game size.
  const lit = hintGlowCells(HINT_CHICKS.map((c) => c.step), 6);
  const phone = boardPixels(6, 6, GAP, 390 - 2 * CONFIG.camera.marginX);
  const compare = section(sheet, 'garden-glow-source', 'Beeld of code', `<div class="gb-row three">
      ${figure(img(glowRimUrl, 'Uitgesneden gloeirand'), `Uitgesneden gloeirand, ${HL.cutout.pixels} px (<code>glow-rim.png</code>)`, 'ref small')}
      ${figure(still(buildTileGlow(), VIEWS.top, 512, 0.6), 'Gloed in code, 512 px')}
      <figure class="cutout-slot"><figcaption>Uitgesneden gloed op de tegel (laden…)</figcaption></figure>
    </div><div class="gb-row two">
      <figure class="cutout-game game"><figcaption>Uitgesneden beeld als textuur · spelcamera, telefoon 390 px (laden…)</figcaption></figure>
      ${figure(phoneShot(gardenBoard(6, 6, lit)), `Gloed in code · spelcamera, telefoon 390 px (tegel ${phone.tile.toFixed(0)} px)`, 'game')}
    </div>`,
  `Het voorbeeld is 120×116 px zonder doorzichtigheid: de gloed staat op wit, en de lijn is even wit als de achtergrond. Uitsnijden kan dus alleen langs de tegelrand (<code>assets/turnflock/garden/board/highlight/cutout.py</code>), en dan blijven de vlekken van het gras in de binnengloed zitten, mist de halo links (die loopt van het beeld af) en is de lijn onderaan breder dan boven. Een tegel is in het voorbeeld ongeveer 98 px per cel; op een telefoon is een tegel ${phone.tile.toFixed(0)} px (37 tot 65 px), dus ${Math.round(phone.tile * 3)} beeldpunten bij 3× scherm: het beeld wordt tot 2× opgerekt. Onder de spelcamera (links) blijft het verrassend bruikbaar: de lijn is iets zachter en de halo links iets zwakker, verder is het verschil klein. Toch staat in het spel de gloed in code: hij past precies op de vorm van de grastegel (ook als die verandert), heeft geen vlekken of scheve lijn, kost geen bestand, en volgt het profiel (kleur en dekking tegen de afstand tot de rand) dat uit het beeld is gemeten, op 512 px. Het uitgesneden beeld blijft alleen hier ter vergelijking.`);
  new THREE.TextureLoader().load(glowRimUrl, (map) => {
    map.colorSpace = THREE.SRGBColorSpace;
    const tile = buildFloorTile(false, false);
    tile.add(buildTileGlow(map));
    compare.querySelector('.cutout-slot')?.prepend(still(tile, VIEWS.top, 512, 0.6));
    compare.querySelector('.cutout-slot figcaption')!.textContent = 'Uitgesneden gloed op de tegel';
    const game = phoneShot(withMap(gardenBoard(6, 6, lit), map));
    compare.querySelector('.cutout-game')?.prepend(game);
    compare.querySelector('.cutout-game figcaption')!.textContent = 'Uitgesneden beeld als textuur · spelcamera, telefoon 390 px';
  });

  // The pulse, in a few steps of one cycle.
  const steps = [0, 0.25, 0.5, 0.75].map((f) => f * W.pulse.seconds);
  section(sheet, 'garden-glow-pulse', 'Pulseren', `<div class="gb-row four">
      ${steps.map((t, i) => figure(still(pulsed(i % 2 === 1, glowPulse(t)), VIEWS.close, 500, 0.62), `t = ${t.toFixed(2)} s · dekking ${glowPulse(t).toFixed(2)} · ${i % 2 === 1 ? 'donkere' : 'lichte'} tegel`)).join('')}
    </div>`,
  `<code>buildTileGlow</code> heeft een eigen materiaal: het spel zet elke beeldschijf <code>glow.material.opacity = glowPulse(t)</code>, een zachte golf van ${W.pulse.high} naar ${W.pulse.low} en terug in ${W.pulse.seconds} s. Ook op het laagste punt blijft de lijn te zien.`);

  // The hint in the garden: lit cells instead of arrows.
  const hintBoard = (): THREE.Group => {
    const board = gardenBoard(6, 6, lit);
    for (const c of HINT_CHICKS) board.add(onCell(standIn(c.dir), c.x, c.y, 6, 6));
    return board;
  };
  section(sheet, 'garden-hint', 'Hint in de tuin (voorstel)', `<div class="gb-row two">
      ${figure(still(hintBoard(), VIEWS.top, 1200), 'Bovenaanzicht')}
      ${figure(phoneShot(hintBoard()), 'Spelcamera, telefoon 390 px, echte grootte', 'game')}
    </div>`,
  `Eén opdracht, drie kuikens (gele bollen: plaatsvervangers, de kuikens zijn van een andere sessie). Kuiken (1,3) kijkt naar rechts en loopt naar (2,3), een donkere tegel; kuiken (3,2) kijkt omhoog en loopt naar (3,1), een lichte tegel; kuiken (5,4) loopt tegen de rand en blijft staan. <code>hintGlowCells</code> geeft vakken ${lit.join(' en ')}: die gloeien, op de plek waar de kuikens heen gaan. Het kuiken dat botst krijgt geen gloed. In plaats van de pijlen van het robotthema; de regel van de hint (welke opdracht, wanneer) verandert niet.`);
}

/** The board under the game camera on a 390 px phone, at 3× pixels, shown at its real size. */
function phoneShot(board: THREE.Object3D): HTMLCanvasElement {
  const game = gameView(board, 6, 6, 390, Math.round(390 * 0.95 + 40), 3);
  game.style.width = '390px';
  game.className = 'gb-phone';
  return game;
}
