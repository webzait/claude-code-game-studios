import { CONFIG } from '../../config';
import DIRT from '../../../data/themes/garden/dirt.json';
import { boardPixels, buildDirtTile } from '../../render/parts/garden/board';
import { buildDirtTileModelled, dirtTileReady } from '../../render/parts/garden/dirt';
import dirtPicture from '../../../assets/turnflock/garden/board/dirt/dirt-tile.webp';
import { cost, figure, fmt, GAP, gameView, gardenBoard, img, section, still, VIEWS } from './render';
import refSheetDirt from './ref-13-sheet-tile-dirt.webp';

/** The middle `px` square of `canvas`, one picture pixel per screen pixel: the board's centre at the phone's own resolution. */
function middle(canvas: HTMLCanvasElement, px: number, dpr: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = px;
  out.getContext('2d')!.drawImage(canvas, (canvas.width - px) / 2, (canvas.height - px) / 2, px, px, 0, 0, px, px);
  out.className = 'gb-zoom';
  out.style.width = `${px}px`;
  out.style.maxWidth = '100%';
  out.dataset.dpr = String(dpr);
  return out;
}

/** The reference picture drawn `px` wide (the size a tile has on the phone, in its own pixels). */
function refAt(px: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = Math.round(px * 1.15);
  const image = new Image();
  image.onload = () => {
    const g = out.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, (out.width - px * 1.1) / 2, (out.height - px * 1.1) / 2, px * 1.1, px * 1.1);
  };
  image.src = refSheetDirt;
  out.className = 'gb-zoom';
  out.style.width = `${out.width}px`;
  out.style.maxWidth = '100%';
  return out;
}

/** Bytes of an imported file (a data URL in the single-file build). */
async function bytes(url: string): Promise<number> {
  try {
    return (await (await fetch(url)).blob()).size;
  } catch {
    return 0;
  }
}

/**
 * Parts sheet: the garden dirt tile (a new tile type) next to 13-sheet-tile-dirt: the cut-out
 * picture, the tile made from it, the earlier modelled tile, and boards with dirt between grass
 * under the game's camera at three phone sizes. The cards fill in once the picture has loaded.
 */
export function addDirtTileCards(sheet: HTMLElement): void {
  const head = section(sheet, 'garden-tile-dirt', 'Zandtegel (nieuw tegeltype), uit het beeld van de eigenaar', '<p class="note">Laden…</p>', '');
  const boards = section(sheet, 'garden-tile-dirt-game', 'Zandtegel op spelgrootte, tussen grastegels', '<p class="note">Laden…</p>', '');
  void dirtTileReady.then(async () => {
    const PX = 1000;
    const tileCost = cost(buildDirtTile(false, false));
    const oldCost = cost(buildDirtTileModelled(false, false));
    const size = await bytes(dirtPicture);
    const A = DIRT.picture.atlas;
    head.innerHTML = `<h2>Zandtegel (nieuw tegeltype), uit het beeld van de eigenaar</h2>
      <div class="gb-row three">
        ${figure(img(refSheetDirt, 'Voorbeeld zandtegel'), 'Voorbeeld 13-sheet-tile-dirt (105 × 105 px)', 'ref small')}
        ${figure(`<img class="gb-cut" src="${dirtPicture}" alt="Uitgesneden zandtegel">`, `Uitgesneden: <code>dirt-tile.webp</code>, ${A.width} × ${A.top + A.pad + A.band} px, ${(size / 1024).toFixed(1)} kB. Boven de bovenkant (transparante hoeken), onder de voorwand.`, 'cut')}
        ${figure(still(buildDirtTile(false, true), VIEWS.close, PX, 0.62), 'Zandtegel · schuin van boven')}
      </div>
      <div class="gb-row three">
        ${figure(still(buildDirtTile(false, false), VIEWS.top, PX, 0.56), 'Bovenaanzicht')}
        ${figure(still(buildDirtTile(false, false), VIEWS.quarter, PX, 0.62), 'Driekwart (overal dezelfde tegel, geen dambord)')}
        ${figure(still(buildDirtTileModelled(false, true), VIEWS.close, PX, 0.62), 'Ter vergelijking: de eerdere zandtegel, in code nagebouwd (<code>style: \'modelled\'</code>)')}
      </div>
      <p class="note">Het beeld van de eigenaar is het onderdeel: de bovenkant van <code>13-sheet-tile-dirt</code> (aarden vloer in een kader van terracotta blokjes, gras over de onderste hoeken) ligt als textuur op een eenvoudig afgerond blok, de voorwand uit het beeld loopt rond de zijkant. Uitgesneden met <code>assets/turnflock/garden/board/dirt/cut.py</code>: wit en grijze schaduw eruit, kleuren aan de rand doorgetrokken (geen halo), opgeschaald met Lanczos en licht verscherpt. Eén textuur, één materiaal: alle zandtegels op een bord samen één tekenopdracht. Kosten: ${fmt(tileCost.tris)} driehoeken, ${tileCost.draws} tekenopdracht (de nagebouwde: ${fmt(oldCost.tris)} en ${oldCost.draws}). Code: <code>src/render/parts/garden/dirt.ts</code>, maten: <code>data/themes/garden/dirt.json</code>. Het spel kent dit tegeltype nog niet; voorstellen in <code>design/themes/garden-board-dirt.md</code>.</p>`;

    // Boards with dirt between grass under the game's camera: a dirt path on each.
    const layouts: [number, number, number[]][] = [
      [4, 4, [5, 10, 1, 14]],
      [6, 6, [14, 21, 20, 19, 25, 31, 8]],
      [8, 8, [27, 36, 35, 34, 42, 50, 19, 11]],
    ];
    const rows: string[] = [];
    const zooms: string[] = [];
    for (const [cols, rowsN, dirt] of layouts) {
      const phone = boardPixels(cols, rowsN, GAP, 390 - 2 * CONFIG.camera.marginX);
      const h = Math.round(390 * (rowsN / cols) * 0.95 + 40);
      const game = gameView(gardenBoard(cols, rowsN, [], dirt), cols, rowsN, 390, h, 3);
      game.style.width = '390px';
      game.className = 'gb-phone';
      const c = cost(gardenBoard(cols, rowsN, [], dirt));
      rows.push(figure(game, `${cols}×${rowsN}, tegel ${phone.tile.toFixed(0)} px · ${fmt(c.tris)} driehoeken, ${c.draws} tekenopdrachten`, 'game'));
      const tileDev = phone.tile * 3;
      zooms.push(`<div class="gb-row two" style="align-items: center">
        ${figure(middle(game, Math.round(tileDev * 2.3), 3), `${cols}×${rowsN}: midden van het bord, 1 beeldpunt = 1 schermpunt (telefoon met 3× scherm, tegel ${Math.round(tileDev)} punten)`, 'zoom')}
        ${figure(refAt(tileDev), `Voorbeeld op dezelfde grootte (${Math.round(tileDev)} punten)`, 'zoom')}
      </div>`);
    }
    boards.innerHTML = `<h2>Zandtegel op spelgrootte, tussen grastegels</h2>
      <div class="gb-row three">${rows.join('')}</div>
      <p class="note">Spelcamera (${CONFIG.board.roomy.tilt}° gekanteld, perspectief) op een telefoon van 390 px, echte grootte. De zandtegels vormen een pad tussen de grastegels (<code>buildFloorTile</code>).</p>
      ${zooms.join('')}
      <p class="note">Vergroot: het midden van elk bord zoals een telefoon met een 3× scherm het in zijn eigen beeldpunten toont, naast het voorbeeld geschaald naar dezelfde tegelgrootte. Het voorbeeld heeft maar ongeveer 80 rijen voor de bovenkant van de tegel; bij de grootste tegel (4×4, ongeveer ${Math.round(boardPixels(4, 4, GAP, 390 - 2 * CONFIG.camera.marginX).tile * 3)} punten breed) wordt het dus ruim twee keer opgerekt en is het iets zachter dan de grastegel ernaast; bij 6×6 en 8×8 valt dat weg.</p>`;
  });
}
