import { el } from './hud';
import { pathSteps, pathSway } from './levelPath';

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

/** What the level selection draws. */
export interface LevelsModel {
  /**
   * `path`: the current level and the next few. `improve`: the completed levels that have fewer
   * than three stars, to play again. `grid`: every level on pages (test view).
   */
  view: 'path' | 'grid' | 'improve';
  nodes: MapNode[];
  /**
   * The levels the `improve` view offers to play again, in play order: the completed ones with
   * fewer than three stars, or every level once all of them are completed.
   */
  improvable: MapNode[];
  /** That list is every level: the player chooses any level to play again. */
  replayAll: boolean;
  /** The star total was tapped: open the levels to improve, or leave them again. */
  onImprove: () => void;
  /** Icon of the main action. */
  playIcon: 'play' | 'back';
  /** Position of the level to play now; null when every level is completed. */
  current: number | null;
  /** Locked levels shown after the current one on the path. */
  ahead: number;
  /** `winding`: the steps sway left and right. Anything else: one straight column. */
  layout: string;
  page: number;
  pageSize: number;
  /** Text of the main action, e.g. "Play level 3"; null hides the button. */
  playLabel: string | null;
  /** The grid is on show because of a test switch; names which one. */
  gridNote: string;
  onPick: (index: number) => void;
  onPage: (page: number) => void;
}

/**
 * Draw the level selection. For a player that is the path: the level to play
 * now, large, and the next few as locked steps; completed levels are not
 * shown. The paged grid of every level remains as a test view.
 */
export function renderLevels(model: LevelsModel): void {
  const { nodes, view } = model;
  const solved = nodes.filter((n) => n.solved).length;
  const stars = nodes.reduce((sum, n) => sum + n.stars, 0);
  const done = view === 'path' && model.current === null;
  const map = el('map');
  map.classList.toggle('tf-levels-a', view !== 'path');
  map.classList.toggle('tf-levels-i', view === 'improve');
  map.classList.toggle('tf-levels-p', view === 'path');
  map.classList.toggle('tf-levels-straight', model.layout !== 'winding');
  el('gridView').hidden = view === 'path';
  el('pathView').hidden = view !== 'path' || done;
  el('doneView').hidden = !done;
  el('pager').hidden = view === 'path';
  el('pathProgress').hidden = view !== 'path' || done;
  // Only the view on show keeps its content: both name their levels `node-N`, and a hidden copy would double them.
  if (view === 'path') el('nodes').replaceChildren();
  if (view !== 'path' || done) el('steps').replaceChildren();
  el('mapCount').textContent = String(solved);
  el('mapTotal').textContent = `/ ${nodes.length}`;
  el('mapStars').textContent = String(stars);
  el('mapProgress').setAttribute('aria-label', `${solved} of ${nodes.length} levels, ${stars} of ${nodes.length * 3} stars`);
  // For a player the star total is a button: it opens the levels that can still be improved. With none it only tells the total.
  const count = model.improvable.filter((n) => n.stars < 3).length;
  const starButton = el<HTMLButtonElement>('toImprove');
  el('starSum').textContent = String(stars);
  el('starMax').textContent = `/${nodes.length * 3}`;
  el('improveCount').textContent = String(count);
  el('improveCount').hidden = count === 0 || view === 'improve';
  starButton.disabled = model.improvable.length === 0;
  starButton.setAttribute('aria-pressed', String(view === 'improve'));
  starButton.setAttribute('aria-label', `${stars} of ${nodes.length * 3} stars${model.replayAll ? '. Choose a level to play again' : count > 0 ? `. Improve ${count} level${count === 1 ? '' : 's'}` : ''}`);
  starButton.onclick = () => model.onImprove();
  el('continue').classList.toggle('tf-levels-backbtn', model.playIcon === 'back');
  el('continue').hidden = model.playLabel === null;
  el('continueLabel').textContent = model.playLabel ?? '';
  el('continue').setAttribute('aria-label', model.playLabel ?? '');
  // Completed with nothing to offer: the dock would be an empty panel.
  map.querySelector<HTMLElement>('.tf-levels-dock')!.hidden = done && model.playLabel === null;
  if (view !== 'path') {
    el('gridNote').textContent = model.gridNote;
    renderGrid(model);
  } else if (done) {
    el('doneText').textContent = `${stars} of ${nodes.length * 3} stars`;
  } else {
    renderPath(model, solved);
  }
}

/** The path: the current level as a large button, then the locked steps, nearest first. */
function renderPath(model: LevelsModel, solved: number): void {
  const { nodes } = model;
  const steps = pathSteps(nodes.length, model.current, model.ahead);
  if (steps.current === null) return;
  const current = nodes[steps.current];
  el('pathWhere').textContent = `Level ${current.number} of ${nodes.length}`;
  el('pathBar').style.width = `${(solved / nodes.length) * 100}%`;
  const list = el('steps');
  list.replaceChildren();
  list.style.setProperty('--n', String(Math.max(1, model.ahead)));
  list.setAttribute('aria-label', steps.ahead.length > 0 ? `Level ${current.number} and the next ${steps.ahead.length}` : `Level ${current.number}, the last level`);
  const item = (step: number, content: HTMLElement): void => {
    const li = document.createElement('li');
    li.style.setProperty('--i', String(step));
    li.style.setProperty('--x', String(pathSway(step)));
    li.appendChild(content);
    list.appendChild(li);
  };
  const button = document.createElement('button');
  button.type = 'button';
  button.id = `node-${current.number}`;
  button.className = 'tf-levels-step is-current';
  button.setAttribute('aria-current', 'step');
  button.setAttribute('aria-label', `Play level ${current.number}, ${current.name}`);
  button.innerHTML = `<small aria-hidden="true">LEVEL</small><span aria-hidden="true">${current.number}</span>`;
  button.addEventListener('click', () => model.onPick(current.number - 1));
  item(0, button);
  steps.ahead.forEach((index, i) => {
    const node = nodes[index];
    // Not a control: a locked level cannot be opened, so it is text that says so.
    const step = document.createElement('span');
    step.id = `node-${node.number}`;
    step.className = 'tf-levels-step is-locked';
    step.innerHTML = `<span aria-hidden="true">${node.number}</span><i class="tf-levels-lock" aria-hidden="true"></i><span class="tf-levels-vh">Level ${node.number}, locked</span>`;
    item(i + 1, step);
  });
  // The last level is in sight: the path ends in a finish, so a short path still reads as a whole.
  if (steps.ahead.length < model.ahead) {
    const finish = document.createElement('span');
    finish.className = 'tf-levels-step is-finish';
    finish.innerHTML = `${FLAG}<span class="tf-levels-vh">End of the levels</span>`;
    item(steps.ahead.length + 1, finish);
  }
  watchTrail();
  drawTrail();
}

const FLAG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"></path><path d="M7 5h10.5l-2.6 3.6 2.6 3.6H7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg>`;

let trailWatch: ResizeObserver | null = null;

/** The trail follows the steps, so it is drawn again whenever the path changes size. */
function watchTrail(): void {
  if (trailWatch || typeof ResizeObserver === 'undefined') return;
  trailWatch = new ResizeObserver(() => drawTrail());
  trailWatch.observe(el('pathView'));
}

/** The dotted trail: one smooth line through the middle of every step, from the current level onwards. */
function drawTrail(): void {
  const box = el('pathView').getBoundingClientRect();
  const points = Array.from(el('steps').children, (li) => {
    const r = li.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  });
  let d = '';
  points.forEach((p, i) => {
    if (i === 0) d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    else {
      const mid = ((points[i - 1].y + p.y) / 2).toFixed(1);
      d += ` C${points[i - 1].x.toFixed(1)} ${mid} ${p.x.toFixed(1)} ${mid} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }
  });
  for (const path of Array.from(el('pathTrail').querySelectorAll('path'))) path.setAttribute('d', box.height > 0 && points.length > 1 ? d : '');
}

/** The grid: one page of level tiles and the pager. Pages keep it usable with hundreds of levels. */
function renderGrid(model: LevelsModel): void {
  const { page, pageSize, onPick } = model;
  const nodes = model.view === 'improve' ? model.improvable : model.nodes;
  const pages = Math.max(1, Math.ceil(nodes.length / pageSize));
  // With a single page there is nothing to leaf through.
  if (pages < 2) el('pager').hidden = true;
  const first = page * pageSize + 1;
  const last = Math.min(first + pageSize - 1, nodes.length);
  // The levels to improve are not consecutive, so their pages are counted instead of named by level.
  el('pageLabel').textContent = model.view === 'improve' && !model.replayAll ? `Page ${page + 1} of ${pages}` : `Levels ${first}–${last}`;
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
