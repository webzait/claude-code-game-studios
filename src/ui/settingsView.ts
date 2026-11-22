import { CONFIG } from '../config';
import { DEFAULT_LAB, usesCertifiedRules, type LabSettings } from '../game/lab';
import { MUSIC_VARIANTS, scoreOf } from '../music/tracks';
import parts from '../../data/parts.json';
import { SHAPE_COLOURS, shapeOf, shapesInWords, shapeSvg } from './colourShapes';
import pkg from '../../package.json';
import { soundSet, soundSetIds } from '../sound/sets';

/**
 * The settings screens: the player's own settings, and the test lab on a
 * screen of its own behind a small entry. Built from the controls designed on
 * the parts sheet (`tf-set-*`): real buttons with role "switch" and
 * radio groups, each tied to its title and explanation.
 */

let serial = 0;
/** A page-unique id, so several frames can sit on one sheet. */
export const uid = (name: string): string => `tf-set-${name}-${++serial}`;

export const h = (html: string): HTMLElement => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

export const svg = (body: string, size = 24): string => `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${body}</svg>`;
export const line = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const ICON = {
  back: svg(line('M14.5 5 7.5 12l7 7', 3.6)),
  next: svg(line('M9.5 5l7 7-7 7', 3.2)),
  check: svg(line('M5 12.6l4.6 4.6L19 7.6', 3.6)),
  cross: svg(line('M6.5 6.5l11 11M17.5 6.5l-11 11', 3.4)),
  warn: svg(`<path d="M12 3.2 22 20.4H2z" fill="#f4c62f" stroke="#7a5b00" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.4v5.2" fill="none" stroke="#3f2f00" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="#3f2f00"/>`),
};

/** A button from the button family (`tf-btn`), with a text label. Width `0` fills the grid cell. */
export function keycap(kind: string, text: string, width: number, extra = ''): HTMLButtonElement {
  const b = parts.buttons;
  const style = `--w:${width ? `${width}px` : '100%'};--h:40px;--d:5px;--r:14px;--fs:15px;--press-fraction:${b.pressFraction}`;
  return h(`<button type="button" class="tf-btn ${kind}" style="${style}" ${extra}><span class="tf-clip"><span class="tf-face"><span class="tf-label">${text}</span></span></span></button>`) as HTMLButtonElement;
}

/** The round-cornered back button of the top bar. */
export function backButton(name: string): HTMLButtonElement {
  const style = `--w:48px;--h:42px;--d:6px;--r:15px;--press-fraction:${parts.buttons.pressFraction}`;
  return h(`<button type="button" class="tf-btn tf-utility" style="${style}" aria-label="${name}"><span class="tf-clip"><span class="tf-face">${ICON.back}</span></span></button>`) as HTMLButtonElement;
}

/** An on/off switch: a real button with role "switch". */
export function toggle(labelId: string, on: boolean, onChange: (on: boolean) => void, hintId = ''): HTMLButtonElement {
  const el = h(`<button type="button" class="tf-set-switch" role="switch" aria-checked="${on}" aria-labelledby="${labelId}"${hintId ? ` aria-describedby="${hintId}"` : ''}><span class="tf-set-knob">${ICON.check}</span></button>`) as HTMLButtonElement;
  el.addEventListener('click', () => {
    const next = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return el;
}

/** A segmented choice: a radio group with one tab stop; arrow keys move and choose. */
export function segmented<T>(labelId: string, options: readonly { label: string; value: T }[], current: T, onPick: (value: T) => void, hintId = ''): HTMLElement {
  const el = h(`<div class="tf-set-seg" role="radiogroup" aria-labelledby="${labelId}"${hintId ? ` aria-describedby="${hintId}"` : ''}></div>`);
  const buttons = options.map((option) => {
    const chosen = option.value === current;
    const b = h(`<button type="button" role="radio" data-value="${String(option.value)}" aria-checked="${chosen}" tabindex="${chosen ? 0 : -1}"><span>${option.label}</span></button>`) as HTMLButtonElement;
    el.appendChild(b);
    return b;
  });
  if (!buttons.some((b) => b.tabIndex === 0) && buttons[0]) buttons[0].tabIndex = 0;
  const choose = (index: number, focus: boolean): void => {
    buttons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    });
    if (focus) buttons[index].focus();
    onPick(options[index].value);
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => choose(i, false));
    b.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : step ? (i + step + buttons.length) % buttons.length : -1;
      if (target < 0) return;
      event.preventDefault();
      choose(target, true);
    });
  });
  return el;
}

export interface RowParts {
  row: HTMLElement;
  titleId: string;
  hintId: string;
  /** Show or hide the "Changed" marker; `was` names the default value. */
  mark(changed: boolean, was?: string): void;
  /** Replace the explanation line. */
  explain(text: string): void;
}

/** A row: title, one-line explanation, and a control beside it or (stacked) under it. */
export function row(title: string, hint: string, opts: { stack?: boolean; chip?: string } = {}): RowParts {
  const titleId = uid('t');
  const hintId = uid('h');
  const el = h(`<div class="tf-set-row${opts.stack ? ' stack' : ''}">
    <div class="tf-set-text"><div class="tf-set-title"><span id="${titleId}">${title}</span>${opts.chip ?? ''}<span class="tf-set-chip changed" hidden></span></div><div class="tf-set-hint" id="${hintId}">${hint}</div></div>
  </div>`);
  const chip = el.querySelector<HTMLElement>('.tf-set-chip.changed')!;
  return {
    row: el,
    titleId,
    hintId,
    mark(changed, was) {
      el.classList.toggle('changed', changed);
      chip.hidden = !changed;
      chip.textContent = changed ? `Changed${was ? ` · default ${was}` : ''}` : '';
    },
    explain(text) {
      el.querySelector('.tf-set-hint')!.textContent = text;
    },
  };
}

/** A panel with its section header. */
export function panel(title: string, chip = '', about = ''): { panel: HTMLElement; body: HTMLElement } {
  const id = uid('s');
  const el = h(`<section class="tf-set-panel" aria-labelledby="${id}"><div class="tf-set-head"><h3 id="${id}">${title}</h3>${chip}</div>${about ? `<p class="tf-set-about">${about}</p>` : ''}<div class="tf-set-rows"></div></section>`);
  return { panel: el, body: el.querySelector('.tf-set-rows')! };
}

export const chip = (kind: string, text: string): string => `<span class="tf-set-chip ${kind}">${text}</span>`;
export const TEST = chip('test', 'Testing only');
/** The preview in the "Colour shapes" row: each robot colour with its shape. */
export const shapesPreview = (): string =>
  `<span class="tf-set-shapes" role="img" aria-label="${shapesInWords()}">${SHAPE_COLOURS.map((color) => `<i class="${color}" data-shape="${shapeOf(color)}">${shapeSvg(shapeOf(color))}</i>`).join('')}</span>`;

/** The "Colour shapes" row: its switch, and the preview on a line of its own under the explanation. */
export function shapesRow(on: boolean, set: (on: boolean) => void): HTMLElement {
  const r = row('Colour shapes', 'Adds a shape to each colour.');
  r.row.dataset.key = 'colourShapes';
  r.row.querySelector('.tf-set-text')!.insertAdjacentHTML('beforeend', shapesPreview());
  r.row.appendChild(toggle(r.titleId, on, set, r.hintId));
  return r.row;
}
export const ON_OFF = (on: boolean): string => (on ? 'On' : 'Off');

/** The destructive control: a calm button, then an armed step that says exactly what is lost and what is kept. */
export function resetControl(armed = false, done = false, onErase: () => void = () => {}): HTMLElement {
  const r = row('Reset progress', 'Erases best scores, stars and coins.');
  const wrap = h(`<div class="tf-set-reset"></div>`);
  const status = h(`<p class="tf-set-done" role="status"></p>`);
  const open = keycap('tf-utility tf-set-danger', 'Reset…', 96, 'aria-haspopup="true"');
  const titleId = uid('c');
  const confirm = h(`<div class="tf-set-confirm" role="group" aria-labelledby="${titleId}" hidden>
    <p class="tf-set-confirm-title" id="${titleId}">Erase all progress?</p>
    <ul>
      <li class="lose">${ICON.cross}<span><b>You lose:</b> best scores, stars and coins.</span></li>
      <li class="keep">${ICON.check}<span><b>You keep:</b> your settings.</span></li>
    </ul>
    <div class="tf-set-confirm-actions"></div>
  </div>`);
  const keep = keycap('tf-utility', 'Keep', 0);
  const erase = keycap('tf-action red tf-set-erase', 'Erase', 0);
  confirm.querySelector('.tf-set-confirm-actions')!.append(keep, erase);
  const arm = (on: boolean, focus: boolean): void => {
    confirm.hidden = !on;
    r.row.hidden = on;
    if (focus) (on ? keep : open).focus();
  };
  open.addEventListener('click', () => {
    status.textContent = '';
    arm(true, true);
  });
  keep.addEventListener('click', () => arm(false, true));
  erase.addEventListener('click', () => {
    onErase();
    arm(false, true);
    status.textContent = 'Progress erased. Your settings are unchanged.';
  });
  confirm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') arm(false, true);
  });
  r.row.appendChild(open);
  wrap.append(r.row, confirm, status);
  if (armed) arm(true, false);
  if (done) status.textContent = 'Progress erased. Your settings are unchanged.';
  return wrap;
}

/** The honest note under a test rule. */
export const solverNote = (): HTMLElement =>
  h(`<p class="tf-set-note" role="note">${ICON.warn}<span><b>Test rule.</b> Levels are certified for “Many”. Here the solver re-checks each level when it opens; one it cannot prove may have no solution.</span></p>`);

const LAB_KEYS = Object.keys(DEFAULT_LAB) as (keyof LabSettings)[];

/** What the test lab does with its values; without hooks it only keeps them (parts sheet). */
export interface LabHooks {
  /** A value changed; `lab` is the whole new set. */
  onChange?: (lab: LabSettings) => void;
  /** Labels of the board-size test boards. */
  boards?: readonly string[];
  /** Open one of the test boards. */
  openBoard?: (index: number) => void;
  /** More panels for the end of the list (the game adds the coin ledger). */
  panels?: readonly HTMLElement[];
}

/** The test lab's rows, grouped, with change markers, the solver note and "Back to defaults". */
export function labContent(start: Partial<LabSettings>, hooks: LabHooks = {}): { groups: HTMLElement[]; bar: HTMLElement; count: () => number; onCount: (fn: (n: number) => void) => void } {
  const lab: LabSettings = { ...DEFAULT_LAB, ...start };
  const refreshers: (() => void)[] = [];
  const listeners: ((n: number) => void)[] = [];
  const count = (): number => LAB_KEYS.filter((k) => lab[k] !== DEFAULT_LAB[k]).length;

  const status = h(`<p class="tf-set-status" role="status" tabindex="-1"></p>`);
  const defaults = keycap('tf-utility', 'Back to defaults', 164);
  const bar = h(`<div class="tf-set-bar"></div>`);
  bar.append(status, defaults);

  const refresh = (): void => {
    for (const fn of refreshers) fn();
    const n = count();
    status.innerHTML = n === 0 ? `${ICON.check}<span><b>All at default</b><br>The certified game.</span>` : `<span><b>${n} changed</b><br>Not the certified game.</span>`;
    status.classList.toggle('ok', n === 0);
    defaults.disabled = n === 0;
    for (const fn of listeners) fn(n);
  };

  /** A choice row bound to one lab key. */
  function choice<K extends keyof LabSettings>(key: K, title: string, hint: string | ((v: LabSettings[K]) => string), options: readonly { label: string; value: LabSettings[K] }[]): HTMLElement {
    const r = row(title, typeof hint === 'string' ? hint : hint(lab[key]), { stack: true });
    r.row.dataset.key = key;
    const name = (v: LabSettings[K]): string => options.find((o) => o.value === v)?.label ?? String(v);
    const draw = (): void => {
      const old = r.row.querySelector('.tf-set-seg');
      const seg = segmented(r.titleId, options, lab[key], (v) => {
        lab[key] = v;
        hooks.onChange?.({ ...lab });
        refresh();
      }, r.hintId);
      if (old) old.replaceWith(seg);
      else r.row.appendChild(seg);
    };
    draw();
    let shown = lab[key];
    refreshers.push(() => {
      if (shown !== lab[key]) {
        // Changed from outside (Back to defaults): redraw the control.
        const active = r.row.contains(document.activeElement);
        if (!active) draw();
        shown = lab[key];
      }
      r.mark(lab[key] !== DEFAULT_LAB[key], name(DEFAULT_LAB[key]));
      if (typeof hint !== 'string') r.explain(hint(lab[key]));
    });
    return r.row;
  }

  /** A switch row bound to one lab key. */
  function flag(key: 'yellowEarly' | 'decor' | 'freeHelp' | 'unlockAll' | 'shop', title: string, hint: string): HTMLElement {
    const r = row(title, hint);
    r.row.dataset.key = key;
    const sw = toggle(r.titleId, lab[key], (on) => {
      lab[key] = on;
      hooks.onChange?.({ ...lab });
      refresh();
    }, r.hintId);
    r.row.appendChild(sw);
    refreshers.push(() => {
      sw.setAttribute('aria-checked', String(lab[key]));
      r.mark(lab[key] !== DEFAULT_LAB[key], ON_OFF(DEFAULT_LAB[key]));
    });
    return r.row;
  }

  const rules = panel('Rules');
  const exitRow = choice('exitRule', 'Exit rule', (v) => (v === 'many' ? 'Several robots may enter the exit in one turn.' : 'Only one robot may enter the exit per turn.'), [
    { label: 'Many', value: 'many' },
    { label: 'Single file', value: 'single' },
  ]);
  const note = solverNote();
  exitRow.appendChild(note);
  refreshers.push(() => {
    note.hidden = usesCertifiedRules(lab);
  });
  rules.body.append(
    exitRow,
    choice('moveSlack', 'Spare moves', 'Moves allowed over the shortest solution.', CONFIG.lab.slackOptions.map((n) => ({ label: `+${n}`, value: n }))),
    flag('yellowEarly', 'Yellow early', 'Level 2 uses yellow instead of blue.'),
  );

  const look = panel('Look');
  const kit = [
    { label: 'Kit', value: 'kit' as const },
    { label: 'Built-in', value: 'builtin' as const },
  ];
  look.body.append(
    choice('speed', 'Animation speed', 'How fast the robots move.', CONFIG.lab.speedOptions.map((n) => ({ label: `${n}×`, value: n }))),
    choice('heading', 'Robot turns', 'Face up: the whole robot turns, eyes in view. To player: it turns but leans to you. Symbol: only the arrow turns.', [
      { label: 'Face up', value: 'faceUp' },
      { label: 'To player', value: 'towardPlayer' },
      { label: 'Symbol', value: 'symbol' },
    ]),
    choice('robots', 'Robots', 'Kit: supplied 3D model. Built-in: drawn in code.', kit),
    choice('boardPieces', 'Board pieces', 'Kit: supplied modules. Built-in: drawn in code.', kit),
    choice('board', 'Board framing', 'Roomy: larger, against the top. Classic: as before.', [
      { label: 'Roomy', value: 'roomy' },
      { label: 'Classic', value: 'classic' },
    ]),
    flag('decor', 'Backdrop', 'Harbour and bushes behind the game.'),
    choice('levelScreen', 'Level screen', 'Path: the current level and the next few. Grid: every level on pages, as before.', [
      { label: 'Path', value: 'path' },
      { label: 'Grid', value: 'grid' },
    ]),
  );

  const shortcuts = panel('Shortcuts');
  shortcuts.body.append(flag('freeHelp', 'Free help', 'Hints, extra moves and Undo cost no coins.'), flag('unlockAll', 'Unlock all levels', 'Open every level, solved or not. Shows the grid of all levels.'));

  const shop = panel('Coin shop', '', 'A pretend shop for testing. No purchase here is real and nothing is ever charged.');
  shop.body.append(
    flag('shop', 'Test shop', 'The plus button opens the test shop. Off: it explains coins and says there is nothing to buy.'),
    choice('purchaseOutcome', 'Purchase outcome', (v) => (v === 'success' ? 'A test purchase goes through and adds the coins.' : v === 'cancelled' ? 'A test purchase ends as cancelled. The coins do not change.' : 'A test purchase fails. The coins do not change.'), [
      { label: 'Succeeds', value: 'success' },
      { label: 'Cancelled', value: 'cancelled' },
      { label: 'Fails', value: 'failed' },
    ]),
  );

  const sound = panel('Sound');
  sound.body.append(
    choice('soundSet', 'Button sounds', (v) => soundSet(v).blurb, soundSetIds().map((id) => ({ label: soundSet(id).name, value: id }))),
  );

  const music = panel('Music');
  music.body.append(
    choice('music', 'Background music', (v) => scoreOf(v).mood, MUSIC_VARIANTS.map((value) => ({ label: scoreOf(value).title, value }))),
  );

  const sizes = panel('Board size test');
  const sizeRow = row('Open a test board', 'Not a level; nothing is saved.', { stack: true });
  const sizeButtons = h(`<div class="tf-set-quad" role="group" aria-labelledby="${sizeRow.titleId}"></div>`);
  (hooks.boards ?? ['5×5', '6×6', '8×8', '4×7']).forEach((label, index) => {
    const open = keycap('tf-utility', label, 0, `aria-label="Open the ${label} test board"`);
    open.addEventListener('click', () => hooks.openBoard?.(index));
    sizeButtons.appendChild(open);
  });
  sizeRow.row.appendChild(sizeButtons);
  sizes.body.appendChild(sizeRow.row);

  defaults.addEventListener('click', () => {
    Object.assign(lab, DEFAULT_LAB);
    hooks.onChange?.({ ...lab });
    refresh();
    // The button is now disabled; keep keyboard focus on the result instead of losing it.
    status.focus();
  });
  refresh();
  return { groups: [rules.panel, look.panel, sound.panel, music.panel, shortcuts.panel, shop.panel, ...(hooks.panels ?? []), sizes.panel], bar, count, onCount: (fn) => listeners.push(fn) };
}

/** One screen: a fixed top bar with a back button and a title, and a list that scrolls under it. */
export function screenShell(title: string, backName: string, chipHtml = ''): { root: HTMLElement; back: HTMLButtonElement; scroll: HTMLElement } {
  const id = uid('scr');
  const root = h(`<section class="tf-set-screen" aria-labelledby="${id}"><header class="tf-set-top"><h2 class="tf-set-name" id="${id}">${title}${chipHtml}</h2></header><div class="tf-set-scroll" tabindex="-1"><div class="tf-set-col"></div></div></section>`);
  const back = backButton(backName);
  root.querySelector('.tf-set-top')!.prepend(back);
  return { root, back, scroll: root.querySelector('.tf-set-col')! };
}

/** What the game's settings screen shows and what it can change. */
export interface PlayerSettingsModel {
  readonly mute: boolean;
  /** Background music on; separate from the sound effects. */
  readonly music: boolean;
  /** null follows the device. */
  readonly reduceMotion: boolean | null;
  /** A shape on each robot colour and its button. */
  readonly colourShapes: boolean;
  /** How many test lab values differ from the certified game. */
  readonly labChanged: number;
  setMute(mute: boolean): void;
  setMusic(on: boolean): void;
  setReduceMotion(value: boolean | null): void;
  setColourShapes(on: boolean): void;
  resetProgress(): void;
  back(): void;
  openLab(): void;
}

/** How many lab values are not at their default. */
export function labChangedCount(lab: LabSettings): number {
  return LAB_KEYS.filter((k) => lab[k] !== DEFAULT_LAB[k]).length;
}

/** The player's settings screen. `entry` is the row that leads to the test lab. */
export function playerScreen(m: PlayerSettingsModel): { root: HTMLElement; back: HTMLButtonElement; entry: HTMLButtonElement } {
  const screen = screenShell('Settings', 'Back to levels');
  screen.back.addEventListener('click', () => m.back());

  const game = panel('Game');
  const flag = (key: string, title: string, hint: string, on: boolean, set: (on: boolean) => void): HTMLElement => {
    const r = row(title, hint);
    r.row.dataset.key = key;
    r.row.appendChild(toggle(r.titleId, on, set, r.hintId));
    return r.row;
  };
  game.body.append(flag('sound', 'Sound', 'Game sounds.', !m.mute, (on) => m.setMute(!on)), flag('music', 'Music', 'Background music.', m.music, (on) => m.setMusic(on)));
  const motion = row('Reduce motion', 'Calmer animations. Auto follows this device.', { stack: true });
  motion.row.dataset.key = 'reduceMotion';
  motion.row.appendChild(
    segmented<boolean | null>(motion.titleId, [{ label: 'Auto', value: null }, { label: 'On', value: true }, { label: 'Off', value: false }], m.reduceMotion, (v) => m.setReduceMotion(v), motion.hintId),
  );
  game.body.append(shapesRow(m.colourShapes, (on) => m.setColourShapes(on)), motion.row);

  const progress = panel('Progress');
  progress.body.append(resetControl(false, false, () => m.resetProgress()));

  const about = panel('About');
  about.body.append(h(`<div class="tf-set-row slim"><div class="tf-set-text"><div class="tf-set-title">Turnflock</div></div><div class="tf-set-value">Version ${pkg.version}</div></div>`));
  const entry = h(`<button type="button" class="tf-set-entry"><span class="tf-set-title">Test lab ${TEST}</span><span class="tf-set-entry-end"><span class="tf-set-chip changed"${m.labChanged === 0 ? ' hidden' : ''}>${m.labChanged} changed</span><span class="tf-set-chev">${ICON.next}</span></span></button>`) as HTMLButtonElement;
  entry.addEventListener('click', () => m.openLab());
  about.body.appendChild(entry);

  screen.scroll.append(game.panel, progress.panel, about.panel);
  return { root: screen.root, back: screen.back, entry };
}

/** The test lab screen: its groups under an intro line, and "Back to defaults" in a bar fixed under the list. */
export function labScreen(lab: LabSettings, hooks: LabHooks & { back(): void }): { root: HTMLElement; back: HTMLButtonElement } {
  const content = labContent(lab, hooks);
  const screen = screenShell('Test lab', 'Back to settings', TEST);
  screen.back.addEventListener('click', () => hooks.back());
  screen.scroll.append(h(`<p class="tf-set-intro">Switches for the test phase. Changes apply when a level starts.</p>`), ...content.groups);
  screen.root.appendChild(content.bar);
  screen.root.classList.add('lab');
  return { root: screen.root, back: screen.back };
}
