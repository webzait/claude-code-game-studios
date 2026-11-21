import { CONFIG } from '../config';
import type { LabSettings } from '../game/lab';
import type { SaveData } from '../game/save';
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

/** What the settings screen can change. */
export interface SettingsHandlers {
  setMute(mute: boolean): void;
  setReduceMotion(value: boolean | null): void;
  setLab(patch: Partial<LabSettings>): void;
  /** Labels of the board-size test boards. */
  readonly testBoards: readonly string[];
  /** Open one of the board-size test boards. */
  previewBoard(index: number): void;
  resetProgress(): void;
}

function segmented<T>(id: string, options: { label: string; value: T }[], current: T, onPick: (value: T) => void): HTMLElement {
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.id = id;
  seg.setAttribute('role', 'group');
  for (const option of options) {
    const button = document.createElement('button');
    button.textContent = option.label;
    button.id = `${id}-${option.label.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
    button.setAttribute('aria-pressed', String(option.value === current));
    button.addEventListener('click', () => onPick(option.value));
    seg.appendChild(button);
  }
  return seg;
}

function setting(label: string, detail: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting';
  const text = document.createElement('div');
  text.className = 'label';
  text.textContent = label;
  if (detail) {
    const small = document.createElement('small');
    small.textContent = detail;
    text.appendChild(small);
  }
  row.append(text, control);
  return row;
}

function group(title: string, about: string, rows: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'group';
  const heading = document.createElement('h2');
  heading.textContent = title;
  box.appendChild(heading);
  if (about) {
    const p = document.createElement('p');
    p.className = 'about';
    p.textContent = about;
    box.appendChild(p);
  }
  box.append(...rows);
  return box;
}

/** Draw the settings screen, including the test lab. Redrawn after every change. */
export function renderSettings(save: SaveData, handlers: SettingsHandlers): void {
  const body = el('settingsBody');
  const scroll = body.scrollTop;
  body.innerHTML = '';
  const onOff = [
    { label: 'On', value: true },
    { label: 'Off', value: false },
  ];
  const reset = document.createElement('button');
  reset.className = 'danger';
  reset.id = 'resetProgress';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    // Two taps: the page cannot show a system confirm dialog.
    if (reset.classList.contains('armed')) handlers.resetProgress();
    else {
      reset.classList.add('armed');
      reset.textContent = 'Tap again to erase';
    }
  });
  body.append(
    group('Game', '', [
      setting('Sound', '', segmented('sound', onOff, !save.settings.mute, (v) => handlers.setMute(!v))),
      setting(
        'Reduce motion',
        'Auto follows this device',
        segmented(
          'motion',
          [
            { label: 'Auto', value: null as boolean | null },
            { label: 'On', value: true as boolean | null },
            { label: 'Off', value: false as boolean | null },
          ],
          save.settings.reduceMotion,
          handlers.setReduceMotion,
        ),
      ),
      setting('Progress', 'Solved levels, stars and coins', reset),
    ]),
    group('Test lab', 'For the test phase only. Changes apply when a level starts.', [
      setting(
        'Exit rule',
        save.lab.exitRule === 'many' ? 'Several robots may enter together (certified)' : 'One robot per turn. Levels are re-checked; some cannot be proven',
        segmented(
          'exitRule',
          [
            { label: 'Many', value: 'many' as const },
            { label: 'Single', value: 'single' as const },
          ],
          save.lab.exitRule,
          (v) => handlers.setLab({ exitRule: v }),
        ),
      ),
      setting('Yellow early', 'Level 2 uses yellow instead of blue', segmented('yellowEarly', onOff, save.lab.yellowEarly, (v) => handlers.setLab({ yellowEarly: v }))),
      setting(
        'Spare moves',
        'Moves allowed over the shortest solution',
        segmented(
          'slack',
          CONFIG.lab.slackOptions.map((n) => ({ label: `+${n}`, value: n })),
          save.lab.moveSlack,
          (v) => handlers.setLab({ moveSlack: v }),
        ),
      ),
      setting(
        'Speed',
        'Animation speed',
        segmented(
          'speed',
          CONFIG.lab.speedOptions.map((n) => ({ label: `${n}x`, value: n })),
          save.lab.speed,
          (v) => handlers.setLab({ speed: v }),
        ),
      ),
      setting('Backdrop', 'Harbour and bushes behind the game', segmented('decor', onOff, save.lab.decor, (v) => handlers.setLab({ decor: v }))),
      setting(
        'Robots',
        'Kit: the supplied 3D model. Built-in: drawn in code',
        segmented(
          'robots',
          [
            { label: 'Kit', value: 'kit' as const },
            { label: 'Built-in', value: 'builtin' as const },
          ],
          save.lab.robots,
          (v) => handlers.setLab({ robots: v }),
        ),
      ),
      setting(
        'Board pieces',
        'Kit: the supplied modules. Built-in: drawn in code',
        segmented(
          'boardPieces',
          [
            { label: 'Kit', value: 'kit' as const },
            { label: 'Built-in', value: 'builtin' as const },
          ],
          save.lab.boardPieces,
          (v) => handlers.setLab({ boardPieces: v }),
        ),
      ),
      setting(
        'Board size test',
        'Opens a test board. Not a level; nothing is saved',
        segmented(
          'testBoard',
          handlers.testBoards.map((label, value) => ({ label, value })),
          -1,
          (v) => handlers.previewBoard(v),
        ),
      ),
      setting(
        'Board',
        'Roomy: larger, against the top. Classic: as before',
        segmented(
          'boardLayout',
          [
            { label: 'Roomy', value: 'roomy' as const },
            { label: 'Classic', value: 'classic' as const },
          ],
          save.lab.board,
          (v) => handlers.setLab({ board: v }),
        ),
      ),
      setting('Free help', 'Hints and extra moves cost no coins', segmented('freeHelp', onOff, save.lab.freeHelp, (v) => handlers.setLab({ freeHelp: v }))),
      setting('Unlock all', 'Open every level', segmented('unlockAll', onOff, save.lab.unlockAll, (v) => handlers.setLab({ unlockAll: v }))),
    ]),
  );
  body.scrollTop = scroll;
}
