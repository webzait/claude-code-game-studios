import './garden-board.css';
import { addDirtTileCards } from './dirt';
import { addHighlightCards } from './highlight';
import { addRimAndBoardCards } from './rim';
import { addGrassTileCards } from './tile';

/**
 * Parts sheet section: the garden theme's board, each part next to the owner's reference picture,
 * the whole board at several sizes, and the board under the game's tilted camera on a phone. Each
 * part's cards are in their own file here, so the part's session edits only that file. Not in the game yet.
 */
export function addGardenBoardCards(sheet: HTMLElement): void {
  const head = document.createElement('section');
  head.className = 'card wide garden-board';
  head.id = 'garden-board';
  head.innerHTML = `<h2>Tuinthema · het bord</h2><p class="note">Grastegel (licht en donker), gloeiende tegel, zandtegel, de rand van gevlochten takken met blaadjes en bloemetjes, de onderplaat met het grasbed. Steeds naast het voorbeeld van de eigenaar. Code: <code>src/render/parts/garden/</code>, maten en kleuren per onderdeel: <code>data/themes/garden/</code>. Nog niet in het spel.</p>`;
  sheet.appendChild(head);
  addGrassTileCards(sheet);
  addHighlightCards(sheet);
  addDirtTileCards(sheet);
  addRimAndBoardCards(sheet);
}
