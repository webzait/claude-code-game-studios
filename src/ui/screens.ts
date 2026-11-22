import { el } from './hud';

/** One level on the selection screen. */
export interface MapNode {
  number: number;
  name: string;
  unlocked: boolean;
  /** 0 when not solved yet. */
  stars: number;
  solved: boolean;
  /** The level the main button points at. */
  target: boolean;
}

/**
 * Draw the level selection: one page of level tiles, the progress in the
 * header, the pager and the main action. Pages keep the screen usable with
 * hundreds of levels; one page always fits without scrolling.
 */
export function renderLevels(model: {
  nodes: MapNode[];
  page: number;
  pageSize: number;
  /** Text of the main action, e.g. "Play level 3". */
  playLabel: string;
  onPick: (index: number) => void;
  onPage: (page: number) => void;
}): void {
  const { nodes, page, pageSize, onPick } = model;
  const pages = Math.max(1, Math.ceil(nodes.length / pageSize));
  const solved = nodes.filter((n) => n.solved).length;
  const stars = nodes.reduce((sum, n) => sum + n.stars, 0);
  el('mapCount').textContent = String(solved);
  el('mapTotal').textContent = `/ ${nodes.length}`;
  el('mapStars').textContent = String(stars);
  el('mapProgress').setAttribute('aria-label', `${solved} of ${nodes.length} levels, ${stars} of ${nodes.length * 3} stars`);
  el('continueLabel').textContent = model.playLabel;
  el('continue').setAttribute('aria-label', model.playLabel);
  // With a single page there is nothing to leaf through.
  el('pager').hidden = pages < 2;
  const first = page * pageSize + 1;
  const last = Math.min(first + pageSize - 1, nodes.length);
  el('pageLabel').textContent = `Levels ${first}–${last}`;
  el('pageInfo').setAttribute('aria-label', `Page ${page + 1} of ${pages}`);
  el('pageDots').innerHTML = Array.from({ length: pages }, (_, p) => `<i class="${p === page ? 'on' : nodes.slice(p * pageSize, (p + 1) * pageSize).every((n) => n.solved) ? 'full' : ''}"></i>`).join('');
  el<HTMLButtonElement>('pagePrev').disabled = page === 0;
  el<HTMLButtonElement>('pageNext').disabled = page >= pages - 1;
  el('pagePrev').onclick = () => model.onPage(page - 1);
  el('pageNext').onclick = () => model.onPage(page + 1);
  const box = el('nodes');
  box.innerHTML = '';
  for (const node of nodes.slice(first - 1, last)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `node-${node.number}`;
    button.textContent = String(node.number);
    const mark = document.createElement('span');
    let state: string;
    let spoken: string;
    if (!node.unlocked) {
      state = 'is-locked';
      spoken = 'locked';
      button.disabled = true;
    } else if (!node.solved) {
      // Open and unsolved. Only the one the main button points at is dressed as "next".
      state = node.target ? 'is-next' : 'is-open';
      spoken = node.target ? 'play next' : 'not solved yet';
    } else {
      state = `s${node.stars}${node.target ? ' is-target' : ''}`;
      spoken = `${node.stars} of 3 stars`;
    }
    mark.className = node.solved ? 'tf-levels-stars' : 'tf-levels-mark';
    button.className = `tf-levels-tile ${state}`;
    button.setAttribute('aria-label', `Level ${node.number}, ${node.name}, ${spoken}`);
    if (node.target) button.setAttribute('aria-current', 'true');
    // An open level that is not the next one (only with "unlock all") shows its number alone.
    if (state !== 'is-open') button.appendChild(mark);
    if (node.unlocked) button.addEventListener('click', () => onPick(node.number - 1));
    box.appendChild(button);
  }
}
