import TILE from '../../../data/themes/garden/tile.json';
import { CONFIG } from '../../config';
import * as robot from '../../render/parts/board';
import { boardPixels } from '../../render/parts/garden/board';
import { buildFloorTile, buildFloorTileCode } from '../../render/parts/garden/grass';
import atlasUrl from '../../../assets/turnflock/garden/board/tile/grass-tile.webp';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, section, still, VIEWS } from './render';
import refTile from './ref-02-tile-grass.webp';
import refSheetGrass from './ref-11-sheet-tile-grass.webp';
import refBoard from './ref-01-board-full.webp';

/** Size in kB of the atlas as the build inlines it (base64 data URL) or serves it (a file). */
async function atlasKb(): Promise<string> {
  try {
    const blob = await (await fetch(atlasUrl)).blob();
    return (blob.size / 1024).toFixed(1);
  } catch {
    return '?';
  }
}

/**
 * Parts sheet: the garden grass tile, light and dark, from the owner's picture 02-tile-grass:
 * the cut-out atlas next to the original, the tile from several sides, and the tile on boards of
 * several sizes as the game's tilted camera sees them on a phone.
 */
export function addGrassTileCards(sheet: HTMLElement): void {
  const T = TILE.tile;
  const I = TILE.image;
  const PX = 1000;
  const tileCost = cost(buildFloorTile(false, false));
  const robotTileCost = cost(robot.buildFloorTile(false, false));
  const el = section(sheet, 'garden-tile-grass', 'Grastegel', `<div class="gb-row three">
      ${figure(img(refTile, 'Voorbeeld grastegel'), 'Voorbeeld 02-tile-grass', 'ref')}
      ${figure(`<img src="${atlasUrl}" alt="Uitgesneden grastegel" style="background: repeating-conic-gradient(#d9d9d9 0 25%, #ffffff 0 50%) 0 0 / 24px 24px">`, 'Uitgesneden WebP (bovenkant van boven gezien, en de strook zijkant), op dambordachtergrond', 'ref')}
      ${figure(still(buildFloorTile(false, true), VIEWS.close, PX, 0.62), 'Grastegel, licht · schuin van boven')}
    </div><div class="gb-row four">
      ${figure(img(refSheetGrass, 'Voorbeeld sheet'), 'Voorbeeld 11-sheet', 'ref small')}
      ${figure(still(buildFloorTile(true, true), VIEWS.close, 500, 0.62), 'Grastegel, donker (dambord)')}
      ${figure(still(buildFloorTile(false, true), VIEWS.quarter, 500), VIEWS.quarter.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.top, 500), VIEWS.top.label)}
    </div><div class="gb-row four">
      ${figure(still(buildFloorTile(false, true), VIEWS.front, 500), VIEWS.front.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.side, 500), VIEWS.side.label)}
      ${figure(still(buildFloorTileCode(false, true), VIEWS.close, 500, 0.62), 'Ter vergelijking: de eerdere tegel in code (<code>buildFloorTileCode</code>)')}
      ${figure(img(refBoard, 'Voorbeeld bord'), 'Voorbeeld 01-board-full: zo staan de tegels op het bord', 'ref')}
    </div>`,
  `Het beeld van de eigenaar zelf: <code>02-tile-grass</code> uitgesneden (transparante, donzige rand, de witte achtergrond uit de randkleuren gehaald) en teruggerekend naar bovenaanzicht, als textuur op een rondgehoekt vlak op tegelhoogte ${T.height}. Daaronder een dun lichaam (${I.wall} breed) met de strook zijkant-gras uit hetzelfde beeld, want onder de gekantelde camera zie je de voorkant van elke tegel (ongeveer een tiende van de tegel); zonder lichaam zweeft het beeld boven zijn schaduw. De donkere tegel is hetzelfde beeld met een tint. Eén textuur (512 × 640 px, <span class="gb-kb">…</span> kB), één materiaal: op het bord één tekenopdracht voor alle tegels. Kosten per tegel: ${fmt(tileCost.tris)} driehoeken, ${tileCost.draws} tekenopdrachten (robottegel: ${fmt(robotTileCost.tris)} en ${robotTileCost.draws}). Code: <code>src/render/parts/garden/grass.ts</code>, maten: <code>data/themes/garden/tile.json</code> (<code>image</code>), uitsnijden: <code>assets/turnflock/garden/board/tile/cut.py</code>.`);
  void atlasKb().then((kb) => el.querySelectorAll('.gb-kb').forEach((n) => (n.textContent = kb)));

  // On the board at game size: the game's camera on a 390 px phone, at three board sizes.
  const sizes: [number, number][] = [[4, 4], [6, 6], [8, 8]];
  const games = sizes.map(([cols, rows]) => {
    const phone = boardPixels(cols, rows, GAP, 390 - 2 * CONFIG.camera.marginX);
    const canvas = gameView(gardenBoard(cols, rows), cols, rows, 390, Math.round(390 * 0.95 + 40), 3);
    canvas.style.width = '390px';
    canvas.className = 'gb-phone';
    return figure(canvas, `${cols}×${rows}, tegel ${phone.tile.toFixed(0)} px breed op de telefoon (beeld op 3× schermdichtheid)`, 'game');
  });
  section(sheet, 'garden-tile-grass-game', 'Grastegel op spelgrootte', `<div class="gb-row three">${games.join('')}</div>`,
    `De grastegel op het bord onder de spelcamera (${CONFIG.board.roomy.tilt}° gekanteld, perspectief), op een telefoon van 390 px, echte grootte. De textuur is ${I.atlas.top} px voor de bovenkant: ruim twee keer de grootste tegel op de telefoon (8×8 tot 4×4), zodat hij ook op 3× schermdichtheid scherp blijft.`);
}
