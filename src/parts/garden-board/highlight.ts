import HL from '../../../data/themes/garden/highlight.json';
import { buildHighlightTile, buildTileGlow, hintGlowCells } from '../../render/parts/garden/board';
import { cost, figure, fmt, img, section, still, VIEWS } from './render';
import refSheetGlow from './ref-12-sheet-tile-highlight.webp';

/** Parts sheet: the garden glowing tile next to 12-sheet-tile-highlight, and the glow alone with the hint rule. */
export function addHighlightCards(sheet: HTMLElement): void {
  const W = HL.glow;
  const PX = 1000;
  const glowCost = cost(buildHighlightTile(false, false));
  section(sheet, 'garden-tile-highlight', 'Gloeiende tegel', `<div class="gb-row three">
      ${figure(img(refSheetGlow, 'Voorbeeld gloeiende tegel'), 'Voorbeeld 12-sheet-tile-highlight', 'ref small')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.close, PX, 0.66), 'Gloeiende tegel · schuin van boven')}
      ${figure(still(buildHighlightTile(false, true), VIEWS.quarter, PX, 0.66), VIEWS.quarter.label)}
    </div>`,
  `Een grastegel met een lichtere, gelere bovenkant en een geelgroene gloeirand (<code>buildHighlightTile</code>); de gloed zelf is ook los te krijgen (<code>buildTileGlow</code>) om op een gewone tegel te leggen, met een eigen materiaal zodat het spel hem kan laten ademen (${W.pulse.low}–${W.pulse.high} in ${W.pulse.seconds} s). Voorstel voor de hint in de tuin: in plaats van de pijlen van het robotthema gloeien de vakken waar de kuikens heen lopen (<code>hintGlowCells</code>). Kosten: ${fmt(glowCost.tris)} driehoeken + 2 voor de gloed, 1 extra tekenopdracht per gloed. Code: <code>src/render/parts/garden/highlight.ts</code>, maten: <code>data/themes/garden/highlight.json</code>.`);

  const cells = hintGlowCells([{ toX: 2, toY: 1, outcome: 'moved' }, { toX: 0, toY: 0, outcome: 'blocked-wall' }, { toX: 3, toY: 0, outcome: 'exited' }], 6);
  section(sheet, 'garden-glow', 'Gloed los', `<div class="gb-row three">${figure(still(buildTileGlow(), VIEWS.top, 500, 0.7), 'Gloed van boven')}</div>`,
    `Hint-regel als voorbeeld: kuiken 1 loopt naar (2,1), kuiken 2 botst, kuiken 3 loopt naar de uitgang (3,0) → gloeiende vakken ${cells.join(', ')}.`, false);
}
