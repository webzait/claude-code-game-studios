import * as THREE from 'three';
import HL from '../../../data/themes/garden/highlight.json';
import TILE from '../../../data/themes/garden/tile.json';
import { CONFIG } from '../../config';
import { boardPixels, buildFloorTile, buildHighlightTile, buildTileGlow, hintGlowCells, type HintStep } from '../../render/parts/garden/board';
import { glowPictureReady, glowPictureSource, glowPulse, glowTexture } from '../../render/parts/garden/highlight';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, section, still, VIEWS } from './render';
import refSheetGlow from './ref-12-sheet-tile-highlight.webp';

const W = HL.glow;
const PITCH = TILE.tile.size + GAP;

/** A chick stand-in for the hint picture (the chicks are another session's): a yellow ball with a beak along `dir` (0 north, 1 east, 2 south, 3 west). */
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

/** Give every glow in `object` the painted look (the 'painted' style), for the comparison. */
function painted(object: THREE.Object3D): THREE.Object3D {
  object.traverse((n) => {
    if (n instanceof THREE.Mesh && n.name === 'tile-glow') {
      (n.material as THREE.MeshBasicMaterial).map = glowTexture();
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

/** The board under the game camera on a 390 px phone, at 3× pixels, shown at its real size. */
function phoneShot(board: THREE.Object3D, cols: number, rows: number): HTMLCanvasElement {
  const game = gameView(board, cols, rows, 390, Math.round(390 * (rows / cols) * 0.95 + 40), 3);
  game.style.width = '390px';
  game.className = 'gb-phone';
  return game;
}

/** The hint example: three chicks, one command. Two step forward, one walks into the rim. */
const HINT_CHICKS: { x: number; y: number; dir: number; step: HintStep }[] = [
  { x: 1, y: 3, dir: 1, step: { toX: 2, toY: 3, outcome: 'moved' } },
  { x: 3, y: 2, dir: 0, step: { toX: 3, toY: 1, outcome: 'moved' } },
  { x: 5, y: 4, dir: 1, step: { toX: 5, toY: 4, outcome: 'blocked-wall' } },
];

/** A section now, filled once the glow picture has loaded (the stills need it). */
function later(sheet: HTMLElement, id: string, title: string, fill: () => { body: string; note: string }): void {
  const el = section(sheet, id, title, '<p class="note">Laden…</p>', '');
  void glowPictureReady.then(() => {
    const { body, note } = fill();
    el.innerHTML = `<h2>${title}</h2>${body}<p class="note">${note}</p>`;
  });
}

/** Parts sheet: the garden glowing tile next to 12-sheet-tile-highlight, at game size on three boards, picture against code, the pulse, and the hint in the garden. */
export function addHighlightCards(sheet: HTMLElement): void {
  const PX = 1000;
  const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1).replace('.', ',')} kB`;

  later(sheet, 'garden-tile-highlight', 'Gloeiende tegel', () => {
    const glowCost = cost(buildHighlightTile(false, false));
    return {
      body: `<div class="gb-row four">
        ${figure(img(refSheetGlow, 'Voorbeeld gloeiende tegel'), 'Voorbeeld 12-sheet-tile-highlight (120×116 px, vergroot)', 'ref small')}
        ${figure(img(glowPictureSource, 'Uitgesneden gloeirand'), `Uitgesneden gloeirand, WebP ${HL.cutout.pixels} px, doorzichtig`, 'ref small')}
        ${figure(still(buildHighlightTile(false, true), VIEWS.top, PX, 0.66), 'Lichte tegel · bovenaanzicht')}
        ${figure(still(buildHighlightTile(true, true), VIEWS.close, PX, 0.66), 'Donkere tegel · schuin van boven')}
      </div>`,
      note: `De gewone grastegel (<code>buildFloorTile</code>, licht of donker) met de gloeirand uit het beeld van de eigenaar erop als textuur (<code>buildHighlightTile</code>, <code>buildTileGlow</code>). De rand is uitgesneden langs de tegelrand (<code>assets/turnflock/garden/board/highlight/cutout.py</code>): het beeld heeft geen doorzichtigheid en de witte lijn is even wit als de achtergrond, dus de halo is losgemaakt van het wit met het blauwe kanaal en de binnengloed van het groen met het rode. Het kwart rechtsboven is gespiegeld naar alle hoeken, want links loopt de halo van het beeld af en onderaan is de lijn breder. Kosten: de tegel ${fmt(glowCost.tris)} driehoeken, de gloed 2 driehoeken en 1 extra tekenopdracht (eigen materiaal). Code: <code>src/render/parts/garden/highlight.ts</code>, maten: <code>data/themes/garden/highlight.json</code>.`,
    };
  });

  later(sheet, 'garden-glow-game-size', 'Gloeiende tegel op spelgrootte', () => {
    const boards: [number, number, number[]][] = [[4, 4, [5, 6]], [6, 6, hintGlowCells(HINT_CHICKS.map((c) => c.step), 6)], [8, 8, [18, 27]]];
    const shots = boards.map(([cols, rows, lit]) => {
      const phone = boardPixels(cols, rows, GAP, 390 - 2 * CONFIG.camera.marginX);
      return figure(phoneShot(gardenBoard(cols, rows, lit), cols, rows), `${cols}×${rows}, tegel ${phone.tile.toFixed(0)} px · telefoon 390 px, echte grootte`, 'game');
    });
    return {
      body: `<div class="gb-row three">${shots.join('')}</div>`,
      note: `Steeds twee gloeiende vakken, een lichte en een donkere tegel. Het beeld is ${HL.cutout.pixels} px voor ${(TILE.tile.body + 2 * W.reach).toFixed(2)} cel: de gloed van de grootste tegel (65 px) is op een telefoon ongeveer 88 px breed, dus het beeld heeft daar 2 beeldpunten per CSS-punt (op een 3×-scherm 2 per 3 schermpunten); bij kleinere tegels meer. Het voorbeeld zelf had maar ongeveer 98 px per cel; de uitsnede is daaruit opgeschaald, dus de lijn is iets zachter dan in code zou kunnen. Onder de gekantelde camera oogt hij niet wazig of getrapt.`,
    };
  });

  later(sheet, 'garden-glow-source', 'Beeld of code', () => {
    const lit = hintGlowCells(HINT_CHICKS.map((c) => c.step), 6);
    return {
      body: `<div class="gb-row two">
        ${figure(phoneShot(gardenBoard(6, 6, lit), 6, 6), 'Beeld (standaard, <code>\'picture\'</code>)', 'game')}
        ${figure(phoneShot(painted(gardenBoard(6, 6, lit)), 6, 6), 'Code (keuze, <code>\'painted\'</code>)', 'game')}
      </div>`,
      note: 'De code-versie blijft als keuze: <code>buildTileGlow(\'painted\')</code>, of <code>glow.style</code> in de data. Hij is geschilderd met het profiel (kleur en dekking tegen de afstand tot de rand) dat uit hetzelfde beeld is gemeten, op 512 px. Op spelgrootte is het verschil klein: de lijn in code is iets strakker, het beeld heeft de vlekjes van het origineel in de binnengloed.',
    };
  });

  later(sheet, 'garden-glow-pulse', 'Pulseren', () => {
    const steps = [0, 0.25, 0.5, 0.75].map((f) => f * W.pulse.seconds);
    return {
      body: `<div class="gb-row four">
        ${steps.map((t, i) => figure(still(pulsed(i % 2 === 1, glowPulse(t)), VIEWS.close, 500, 0.62), `t = ${t.toFixed(2)} s · dekking ${glowPulse(t).toFixed(2)} · ${i % 2 === 1 ? 'donkere' : 'lichte'} tegel`)).join('')}
      </div>`,
      note: `<code>buildTileGlow</code> heeft een eigen materiaal: het spel zet elke beeldschijf <code>glow.material.opacity = glowPulse(t)</code>, een zachte golf van ${W.pulse.high} naar ${W.pulse.low} en terug in ${W.pulse.seconds} s. Ook op het laagste punt blijft de lijn te zien.`,
    };
  });

  later(sheet, 'garden-hint', 'Hint in de tuin (voorstel)', () => {
    const lit = hintGlowCells(HINT_CHICKS.map((c) => c.step), 6);
    const hintBoard = (): THREE.Group => {
      const board = gardenBoard(6, 6, lit);
      for (const c of HINT_CHICKS) board.add(onCell(standIn(c.dir), c.x, c.y, 6, 6));
      return board;
    };
    return {
      body: `<div class="gb-row two">
        ${figure(still(hintBoard(), VIEWS.top, 1200), 'Bovenaanzicht')}
        ${figure(phoneShot(hintBoard(), 6, 6), 'Spelcamera, telefoon 390 px, echte grootte', 'game')}
      </div>`,
      note: `Eén opdracht, drie kuikens (gele bollen: plaatsvervangers, de kuikens zijn van een andere sessie). Kuiken (1,3) kijkt naar rechts en loopt naar (2,3), een donkere tegel; kuiken (3,2) kijkt omhoog en loopt naar (3,1), een lichte tegel; kuiken (5,4) loopt tegen de rand en blijft staan. <code>hintGlowCells</code> geeft vakken ${lit.join(' en ')}: die gloeien, op de plek waar de kuikens heen gaan; het kuiken dat botst krijgt geen gloed. In plaats van de pijlen van het robotthema; de regel van de hint (welke opdracht, wanneer) verandert niet.`,
    };
  });

  // After the cards above have been filled (same promise, later in line). An inlined picture is a
  // data URL: its size is read from it, with no fetch.
  const inline = glowPictureSource.startsWith('data:') ? Math.floor((glowPictureSource.length - glowPictureSource.indexOf(',') - 1) * 3 / 4) : 0;
  const bytes = inline ? Promise.resolve(inline) : fetch(glowPictureSource).then((r) => r.blob()).then((b) => b.size);
  void glowPictureReady.then(() => bytes).then((n) => {
    const note = sheet.querySelector('#garden-tile-highlight .note');
    note?.insertAdjacentHTML('beforeend', ` Het beeld kost ${kb(n)} (in het losse HTML-bestand als base64 ongeveer ${kb((n * 4) / 3)}).`);
  }).catch(() => undefined);
}
