import RIM from '../../../data/themes/garden/rim.json';
import { CONFIG } from '../../config';
import * as robot from '../../render/parts/board';
import { boardPixels, buildRim } from '../../render/parts/garden/board';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, robotBoard, section, still, VIEWS } from './render';
import refBoard from './ref-01-board-full.webp';
import refRim from './ref-03-rim-vines.webp';

/** Parts sheet: the garden rim next to 03-rim-vines, the whole board next to 01-board-full, and the board at four sizes under the game camera. */
export function addRimAndBoardCards(sheet: HTMLElement): void {
  const R = RIM.rim;
  const rim6 = buildRim(6, 6, GAP);
  const rimCost = cost(rim6);
  const robotRimCost = cost(robot.buildRim(6, 6, GAP));
  section(sheet, 'garden-rim', 'Rand van gevlochten takken', `<div class="gb-row two">
      ${figure(img(refRim, 'Voorbeeld rand'), 'Voorbeeld 03-rim-vines', 'ref')}
      ${figure(still(rim6, VIEWS.top, 1400), 'Rand 6×6 · bovenaanzicht')}
    </div><div class="gb-row two">
      ${figure(still(buildRim(6, 6, GAP), VIEWS.quarter, 1400), 'Driekwart')}
      ${figure(still(buildRim(6, 6, GAP), VIEWS.front, 1400), 'Voorkant')}
    </div>`,
  `Een volle vlecht: ${R.strands} bundels van elk ${R.twigsPerBundle} dunne takjes, in elkaar gedraaid langs een afgeronde rechthoek, met ${R.fineTwigs} fijne takjes die er de andere kant op overheen lopen, op glanzende bast. Elk aantal slagen rond het bord is een heel getal, zodat de vlecht op elk bordformaat naadloos sluit. Blaadjes, ranken en witte bloemetjes staan op vaste plekken: een vast deel van elke zijde (zie <code>decor.clusters</code>), nooit willekeurig. Langs de binnenkant groeit gras tegen de takken op. Kosten (6×6): ${fmt(rimCost.tris)} driehoeken, ${rimCost.draws} tekenopdrachten (robotrand: ${fmt(robotRimCost.tris)} en ${robotRimCost.draws}). Code: <code>src/render/parts/garden/rim.ts</code> en <code>underlay.ts</code>, maten: <code>data/themes/garden/rim.json</code> en <code>underlay.json</code>.`);

  const lit = [7, 8];
  section(sheet, 'garden-board-full', 'Het hele bord, naast het voorbeeld', `<div class="gb-row two">
      ${figure(img(refBoard, 'Voorbeeld bord'), 'Voorbeeld 01-board-full', 'ref')}
      ${figure(still(gardenBoard(6, 6), VIEWS.top, 1400), 'Tuinbord 6×6 · bovenaanzicht')}
    </div>`,
  'Zelfde opzet als het voorbeeld: 6×6 grastegels in een gevlochten rand, het grasbed ertussen. Het voorbeeld heeft overal dezelfde tegel; hier staat het dambord van licht en donker, zoals bij de robottegels.');

  const sizes: [number, number][] = [[4, 4], [5, 7], [6, 6], [8, 8]];
  for (const [cols, rows] of sizes) {
    const make = () => gardenBoard(cols, rows, cols === 6 ? lit : [], cols === 5 ? [rows * cols - 3, 12] : []);
    const board = make();
    const c = cost(board);
    const r = cost(robotBoard(cols, rows));
    const phone = boardPixels(cols, rows, GAP, 390 - 2 * CONFIG.camera.marginX);
    const game = gameView(make(), cols, rows, 390, Math.round(390 * (rows / cols) * 0.95 + 40), 3);
    game.style.width = '390px';
    game.className = 'gb-phone';
    section(sheet, `garden-board-${cols}x${rows}`, `Tuinbord ${cols}×${rows}`, `<div class="gb-row two">
        ${figure(still(board, VIEWS.top, 1400), 'Bovenaanzicht')}
        ${figure(game, `Spelcamera (${CONFIG.board.roomy.tilt}° gekanteld, perspectief) op een telefoon van 390 px, echte grootte`, 'game')}
      </div>`,
    `${cols * rows} tegels${cols === 6 ? ', twee gloeiend (hint)' : ''}${cols === 5 ? ', twee zandtegels' : ''}. Tegel ${phone.tile.toFixed(1)} px, rand ${phone.frame.toFixed(1)} px op de telefoon. Bord samengevoegd: ${fmt(c.tris)} driehoeken, ${c.draws} tekenopdrachten (robotbord: ${fmt(r.tris)} en ${r.draws}).`);
  }
}
