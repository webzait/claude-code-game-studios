import RIM from '../../../data/themes/garden/rim.json';
import { CONFIG } from '../../config';
import * as robot from '../../render/parts/board';
import { boardPixels, buildRim } from '../../render/parts/garden/board';
import { buildRimModel, rimReady } from '../../render/parts/garden/rim';
import { bedReady } from '../../render/parts/garden/underlay';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, robotBoard, section, still, VIEWS } from './render';
import refBoard from './ref-01-board-full.webp';
import refRim from './ref-03-rim-vines.webp';
import atlasUrl from '../../../assets/turnflock/garden/board/rim/rim-atlas.webp';
import bedUrl from '../../../assets/turnflock/garden/board/rim/bed.webp';

/** Size in kB of the file behind `url` (a data URI in the single-file build). */
async function kilobytes(url: string): Promise<string> {
  try {
    const blob = await (await fetch(url)).blob();
    return (blob.size / 1024).toFixed(1).replace('.', ',');
  } catch {
    return '?';
  }
}

/** A picture on a checkerboard, so its see-through parts show. */
const onChecker = (src: string, alt: string): string =>
  `<img src="${src}" alt="${alt}" style="background:repeating-conic-gradient(#d9d4e8 0% 25%, #f4f1fa 0% 50%) 0 0/16px 16px">`;

/**
 * Parts sheet: the garden rim as the owner's picture next to 03-rim-vines, the pieces it is cut
 * into, the whole board next to 01-board-full, and the board at several sizes under the game
 * camera. The rim and bed pictures load first; the cards fill in once they have.
 */
export function addRimAndBoardCards(sheet: HTMLElement): void {
  const ids = ['garden-rim', 'garden-board-full', 'garden-board-sizes', 'garden-rim-model'];
  const cards = ids.map((id) => section(sheet, id, 'Rand en bord · laden…', '', ''));
  void Promise.all([rimReady, bedReady, kilobytes(atlasUrl), kilobytes(bedUrl)]).then(([, , atlasKb, bedKb]) => fill(cards, atlasKb, bedKb));
}

function fill(cards: HTMLElement[], atlasKb: string, bedKb: string): void {
  const I = RIM.image;
  const rim5 = buildRim(5, 5, GAP);
  const rimCost = cost(buildRim(6, 6, GAP));
  const modelCost = cost(buildRimModel(6, 6, GAP));
  const robotRimCost = cost(robot.buildRim(6, 6, GAP));
  set(cards[0], 'Rand uit het beeld van de eigenaar', `<div class="gb-row two">
      ${figure(img(refRim, 'Voorbeeld rand'), 'Voorbeeld 03-rim-vines', 'ref')}
      ${figure(still(rim5, VIEWS.top, 1400), 'Rand 5×5 (de maat van het voorbeeld) · bovenaanzicht')}
    </div><div class="gb-row two">
      ${figure(onChecker(atlasUrl, 'Uitgesneden stukken'), `De uitgesneden stukken: rim-atlas.webp, ${atlasKb} kB`)}
      ${figure(still(buildRim(6, 6, GAP), VIEWS.close, 1400), 'Rand 6×6 · schuin van voren')}
    </div>`,
  `De rand is het beeld <code>03-rim-vines</code> zelf, in stukken gesneden (<code>assets/turnflock/garden/board/rim/build-rim.py</code>): vier hoeken, per zijde een stuk gewone vlecht dat herhaald wordt (afgekapt aan het eind, nooit uitgerekt) en zeven stukken met blaadjes en bloemetjes op vaste plekken. Plat gelegd op hoogte ${I.height} (tegels op 0,2), op één schaal: ${I.pxPerCell} beeldpixels per cel. Stukken lopen in elkaar over met een zachte overgang van ${RIM.atlas.fade} beeldpixels. Kosten (6×6): ${fmt(rimCost.tris)} driehoeken, ${rimCost.draws} tekenopdracht, plaatje ${atlasKb} kB (robotrand: ${fmt(robotRimCost.tris)} driehoeken en ${robotRimCost.draws}; de vlecht in code: ${fmt(modelCost.tris)} en ${modelCost.draws}).`);

  set(cards[1], 'Het hele bord, naast het voorbeeld', `<div class="gb-row two">
      ${figure(img(refBoard, 'Voorbeeld bord'), 'Voorbeeld 01-board-full', 'ref')}
      ${figure(still(gardenBoard(6, 6), VIEWS.top, 1400), 'Tuinbord 6×6 · bovenaanzicht')}
    </div>`,
  `Zelfde opzet als het voorbeeld: 6×6 grastegels in de rand, het grasbed ertussen. Het grasbed is een herhalend stukje uit <code>01-board-full</code> (<code>bed.webp</code>, ${bedKb} kB). Het voorbeeld heeft overal dezelfde tegel; hier staat het dambord van licht en donker, zoals bij de robottegels.`);

  const lit = [7, 8];
  const sizes: [number, number][] = [[4, 4], [5, 7], [6, 6], [7, 4], [8, 8]];
  const rows = sizes.map(([cols, rows]) => {
    const make = () => gardenBoard(cols, rows, cols === 6 ? lit : [], cols === 5 ? [rows * cols - 3, 12] : []);
    const c = cost(make());
    const r = cost(robotBoard(cols, rows));
    const phone = boardPixels(cols, rows, GAP, 390 - 2 * CONFIG.camera.marginX);
    const game = gameView(make(), cols, rows, 390, Math.round(390 * (rows / cols) * 0.95 + 40), 3);
    game.className = 'gb-phone';
    return `<h3>${cols}×${rows}</h3><div class="gb-row two">
        ${figure(still(make(), VIEWS.top, 1400), 'Bovenaanzicht')}
        ${figure(game, `Spelcamera (${CONFIG.board.roomy.tilt}° gekanteld, perspectief) op een telefoon van 390 px, echte grootte`, 'game')}
      </div><p class="note">${cols * rows} tegels${cols === 6 ? ', twee gloeiend (hint)' : ''}${cols === 5 ? ', twee zandtegels' : ''}. Tegel ${phone.tile.toFixed(1)} px, rand ${phone.frame.toFixed(1)} px op de telefoon. Bord samengevoegd: ${fmt(c.tris)} driehoeken, ${c.draws} tekenopdrachten (robotbord: ${fmt(r.tris)} en ${r.draws}).</p>`;
  });
  set(cards[2], 'Tuinbord in vijf formaten', rows.join(''), 'Elk formaat met dezelfde stukken: de hoeken blijven, de rechte zijden worden langer met meer herhaalde vlecht, de blaadjes en bloemetjes schuiven mee naar hun vaste plek. Op 4×4 is de linkerzijde te kort voor beide versierde stukken; dan valt het tweede bosje blaadjes weg (vaste volgorde, nooit willekeurig).');

  set(cards[3], 'Ter vergelijking: de vlecht in code (buildRimModel)', `<div class="gb-row two">
      ${figure(still(buildRimModel(6, 6, GAP), VIEWS.top, 1400), 'Vlecht in code 6×6 · bovenaanzicht')}
      ${figure(still(buildRim(6, 6, GAP), VIEWS.top, 1400), 'Beeld 6×6 · bovenaanzicht')}
    </div>`,
  `De eerdere rand, in code nagebouwd, blijft als keuze bestaan onder <code>buildRimModel</code>: ${fmt(modelCost.tris)} driehoeken, ${modelCost.draws} tekenopdrachten. Standaard is nu het beeld (<code>buildRim</code>).`);
}

function set(card: HTMLElement, title: string, body: string, note: string): void {
  card.innerHTML = `<h2>${title}</h2>${body}<p class="note">${note}</p>`;
}
