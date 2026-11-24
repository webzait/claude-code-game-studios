import TILE from '../../../data/themes/garden/tile.json';
import * as robot from '../../render/parts/board';
import { buildFloorTile } from '../../render/parts/garden/board';
import { cost, figure, fmt, img, section, still, VIEWS } from './render';
import refTile from './ref-02-tile-grass.webp';
import refSheetGrass from './ref-11-sheet-tile-grass.webp';

/** Parts sheet: the garden grass tile, light and dark, next to 02-tile-grass and 11-sheet-tile-grass. */
export function addGrassTileCards(sheet: HTMLElement): void {
  const T = TILE.tile;
  const PX = 1000;
  const tileCost = cost(buildFloorTile(false, false));
  const robotTileCost = cost(robot.buildFloorTile(false, false));
  section(sheet, 'garden-tile-grass', 'Grastegel', `<div class="gb-row three">
      ${figure(img(refTile, 'Voorbeeld grastegel'), 'Voorbeeld 02-tile-grass', 'ref')}
      ${figure(still(buildFloorTile(false, true), VIEWS.close, PX, 0.62), 'Grastegel, licht · schuin van boven')}
      ${figure(still(buildFloorTile(true, true), VIEWS.close, PX, 0.62), 'Grastegel, donker (dambord)')}
    </div><div class="gb-row four">
      ${figure(img(refSheetGrass, 'Voorbeeld sheet'), 'Voorbeeld 11-sheet', 'ref small')}
      ${figure(still(buildFloorTile(false, true), VIEWS.quarter, 500), VIEWS.quarter.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.front, 500), VIEWS.front.label)}
      ${figure(still(buildFloorTile(false, true), VIEWS.top, 500), VIEWS.top.label)}
    </div>`,
  `Zacht afgerond kussen van gras, ${T.body} cel breed binnen het vak (zodat het grasbed ertussen zichtbaar blijft), ${T.height} hoog zoals de robottegel. Donzige rand van grassprietjes rondom (boven over de afronding en langs de zijkant), vaag klaverpatroon in de bovenkant. De donkere tegel is ${Math.round((1 - TILE.colors.altShade) * 100)}% donkerder en heeft het patroon een halve slag gedraaid. Kosten per tegel: ${fmt(tileCost.tris)} driehoeken, ${tileCost.draws} tekenopdrachten (robottegel: ${fmt(robotTileCost.tris)} en ${robotTileCost.draws}); op het bord worden alle tegels samengevoegd, dus het aantal tekenopdrachten groeit niet mee. Code: <code>src/render/parts/garden/grass.ts</code>, maten: <code>data/themes/garden/tile.json</code>.`);
}
