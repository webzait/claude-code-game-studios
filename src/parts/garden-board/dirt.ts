import { buildDirtTile } from '../../render/parts/garden/board';
import { cost, figure, fmt, img, section, still, VIEWS } from './render';
import refSheetDirt from './ref-13-sheet-tile-dirt.webp';

/** Parts sheet: the garden dirt tile (a new tile type) next to 13-sheet-tile-dirt. */
export function addDirtTileCards(sheet: HTMLElement): void {
  const PX = 1000;
  const dirtCost = cost(buildDirtTile(false, false));
  section(sheet, 'garden-tile-dirt', 'Zandtegel (nieuw tegeltype)', `<div class="gb-row three">
      ${figure(img(refSheetDirt, 'Voorbeeld zandtegel'), 'Voorbeeld 13-sheet-tile-dirt', 'ref small')}
      ${figure(still(buildDirtTile(false, true), VIEWS.close, PX, 0.62), 'Zandtegel · schuin van boven')}
      ${figure(still(buildDirtTile(false, true), VIEWS.quarter, PX, 0.62), VIEWS.quarter.label)}
    </div>`,
  `Een verzonken vloertje van warme aarde met korrels en steentjes, in een kader van afgeronde kleiblokjes, met kort gras rond de voet en pollen over de voorrand (<code>buildDirtTile</code>). Het spel kent dit tegeltype nog niet; voorstellen staan in <code>design/themes/garden-board.md</code>. Kosten: ${fmt(dirtCost.tris)} driehoeken, ${dirtCost.draws} tekenopdrachten. Code: <code>src/render/parts/garden/dirt.ts</code>, maten: <code>data/themes/garden/dirt.json</code>.`);
}
