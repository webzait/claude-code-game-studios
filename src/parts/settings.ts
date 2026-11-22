import { CONFIG } from '../config';
import { DEFAULT_LAB, usesCertifiedRules, type LabSettings } from '../game/lab';
import parts from '../../data/parts.json';
import pkg from '../../package.json';

/**
 * The settings screen as a standalone mock-up for the parts sheet: player
 * settings, the test lab on its own screen, and every control in every
 * state. It keeps its own state and is not wired to the game's save.
 */

/** Where the test lab lives: its own screen behind a small entry, or left out (public release). */
type LabPlace = 'screen' | 'none';

/** One phone frame to draw. */
export interface SettingsFrame {
  /** Frame size in CSS px. */
  width: number;
  height: number;
  /** Which screen the frame opens on. */
  view?: 'settings' | 'lab';
  lab?: LabPlace;
  /** Lab values that differ from the default at the start. */
  changed?: Partial<LabSettings>;
  /** Start with the reset control armed. */
  armed?: boolean;
  /** Let the frame grow to its content instead of scrolling, to show everything at once. */
  full?: boolean;
}

interface PlayerSettings {
  sound: boolean;
  reduceMotion: boolean | null;
  shapes: boolean;
}

let serial = 0;
/** A page-unique id, so several frames can sit on one sheet. */
const uid = (name: string): string => `tf-set-${name}-${++serial}`;

const h = (html: string): HTMLElement => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

const svg = (body: string, size = 24): string => `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${body}</svg>`;
const line = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ICON = {
  back: svg(line('M14.5 5 7.5 12l7 7', 3.6)),
  next: svg(line('M9.5 5l7 7-7 7', 3.2)),
  check: svg(line('M5 12.6l4.6 4.6L19 7.6', 3.6)),
  cross: svg(line('M6.5 6.5l11 11M17.5 6.5l-11 11', 3.4)),
  warn: svg(`<path d="M12 3.2 22 20.4H2z" fill="#f4c62f" stroke="#7a5b00" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.4v5.2" fill="none" stroke="#3f2f00" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="#3f2f00"/>`),
};

/** A button from the button family (`tf-btn`), with a text label. Width `0` fills the grid cell. */
function keycap(kind: string, text: string, width: number, extra = ''): HTMLButtonElement {
  const b = parts.buttons;
  const style = `--w:${width ? `${width}px` : '100%'};--h:40px;--d:5px;--r:14px;--fs:15px;--press-fraction:${b.pressFraction}`;
  return h(`<button type="button" class="tf-btn ${kind}" style="${style}" ${extra}><span class="tf-clip"><span class="tf-face"><span class="tf-label">${text}</span></span></span></button>`) as HTMLButtonElement;
}

/** The round-cornered back button of the top bar. */
function backButton(name: string): HTMLButtonElement {
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
    const b = h(`<button type="button" role="radio" aria-checked="${chosen}" tabindex="${chosen ? 0 : -1}"><span>${option.label}</span></button>`) as HTMLButtonElement;
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

interface RowParts {
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

const chip = (kind: string, text: string): string => `<span class="tf-set-chip ${kind}">${text}</span>`;
/** The colour-blind aid's preview: one shape per robot colour. */
const SHAPES = `<span class="tf-set-shapes" aria-label="Red circle, blue square, yellow diamond"><i class="red"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.4"/></svg></i><i class="blue"><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.8" y="2.8" width="6.4" height="6.4" rx="1"/></svg></i><i class="yellow"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.8 10.2 6 6 10.2 1.8 6z"/></svg></i></span>`;
const TEST = chip('test', 'Testing only');
const ON_OFF = (on: boolean): string => (on ? 'On' : 'Off');

/** The destructive control: a calm button, then an armed step that says exactly what is lost and what is kept. */
export function resetControl(armed = false, done = false): HTMLElement {
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
const solverNote = (): HTMLElement =>
  h(`<p class="tf-set-note" role="note">${ICON.warn}<span><b>Test rule.</b> Levels are certified for “Many”. Here the solver re-checks each level when it opens; one it cannot prove may have no solution.</span></p>`);

const LAB_KEYS = Object.keys(DEFAULT_LAB) as (keyof LabSettings)[];

/** The test lab's rows, grouped, with change markers, the solver note and "Back to defaults". */
function labContent(start: Partial<LabSettings>): { groups: HTMLElement[]; bar: HTMLElement; count: () => number; onCount: (fn: (n: number) => void) => void } {
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
    const name = (v: LabSettings[K]): string => options.find((o) => o.value === v)?.label ?? String(v);
    const draw = (): void => {
      const old = r.row.querySelector('.tf-set-seg');
      const seg = segmented(r.titleId, options, lab[key], (v) => {
        lab[key] = v;
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
  function flag(key: 'yellowEarly' | 'decor' | 'freeHelp' | 'unlockAll', title: string, hint: string): HTMLElement {
    const r = row(title, hint);
    const sw = toggle(r.titleId, lab[key], (on) => {
      lab[key] = on;
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
    choice('robots', 'Robots', 'Kit: supplied 3D model. Built-in: drawn in code.', kit),
    choice('boardPieces', 'Board pieces', 'Kit: supplied modules. Built-in: drawn in code.', kit),
    choice('board', 'Board framing', 'Roomy: larger, against the top. Classic: as before.', [
      { label: 'Roomy', value: 'roomy' },
      { label: 'Classic', value: 'classic' },
    ]),
    flag('decor', 'Backdrop', 'Harbour and bushes behind the game.'),
  );

  const shortcuts = panel('Shortcuts');
  shortcuts.body.append(flag('freeHelp', 'Free help', 'Hints and extra moves cost no coins.'), flag('unlockAll', 'Unlock all levels', 'Open every level, solved or not.'));

  const sizes = panel('Board size test');
  const sizeRow = row('Open a test board', 'Not a level; nothing is saved.', { stack: true });
  const sizeButtons = h(`<div class="tf-set-quad" role="group" aria-labelledby="${sizeRow.titleId}"></div>`);
  for (const label of ['5×5', '6×6', '8×8', '4×7']) sizeButtons.appendChild(keycap('tf-utility', label, 0, `aria-label="Open the ${label} test board"`));
  sizeRow.row.appendChild(sizeButtons);
  sizes.body.appendChild(sizeRow.row);

  defaults.addEventListener('click', () => {
    Object.assign(lab, DEFAULT_LAB);
    refresh();
    // The button is now disabled; keep keyboard focus on the result instead of losing it.
    status.focus();
  });
  refresh();
  return { groups: [rules.panel, look.panel, shortcuts.panel, sizes.panel], bar, count, onCount: (fn) => listeners.push(fn) };
}

/** The player's own settings. */
function playerPanels(frame: SettingsFrame): HTMLElement[] {
  const player: PlayerSettings = { sound: true, reduceMotion: null, shapes: false };
  const game = panel('Game');
  const flag = (key: 'sound' | 'shapes', title: string, hint: string): HTMLElement => {
    const r = row(title, hint);
    r.row.appendChild(toggle(r.titleId, player[key], (on) => (player[key] = on), r.hintId));
    return r.row;
  };
  const motion = row('Reduce motion', 'Calmer animations. Auto follows this device.', { stack: true });
  motion.row.appendChild(
    segmented<boolean | null>(motion.titleId, [{ label: 'Auto', value: null }, { label: 'On', value: true }, { label: 'Off', value: false }], player.reduceMotion, (v) => (player.reduceMotion = v), motion.hintId),
  );
  const shapes = flag('shapes', 'Colour shapes', 'Adds a shape to each colour.');
  shapes.querySelector('.tf-set-hint')!.insertAdjacentHTML('beforeend', ` ${SHAPES}`);
  game.body.append(flag('sound', 'Sound', 'Game sounds.'), shapes, motion.row);

  const out = [game.panel];
  const progress = panel('Progress');
  progress.body.append(resetControl(frame.armed));
  out.push(progress.panel);
  return out;
}

/** One phone frame holding the settings screen, and the lab screen when the lab has its own. */
export function settingsFrame(frame: SettingsFrame): HTMLElement {
  const place = frame.lab ?? 'screen';
  const el = h(`<div class="tf-set-frame${frame.full ? ' full' : ''}" style="--fw:${frame.width}px;--fh:${frame.height}px"></div>`);
  const screen = (title: string, backName: string, chipHtml = ''): { root: HTMLElement; back: HTMLButtonElement; scroll: HTMLElement } => {
    const id = uid('scr');
    const root = h(`<section class="tf-set-screen" aria-labelledby="${id}"><header class="tf-set-top"><h2 class="tf-set-name" id="${id}">${title}${chipHtml}</h2></header><div class="tf-set-scroll" tabindex="-1"><div class="tf-set-col"></div></div></section>`);
    const back = backButton(backName);
    root.querySelector('.tf-set-top')!.prepend(back);
    return { root, back, scroll: root.querySelector('.tf-set-col')! };
  };

  const main = screen('Settings', 'Back to levels');
  main.scroll.append(...playerPanels(frame));
  const about = panel('About');
  about.body.append(h(`<div class="tf-set-row slim"><div class="tf-set-text"><div class="tf-set-title">Turnflock</div></div><div class="tf-set-value">Version ${pkg.version}</div></div>`));
  main.scroll.append(about.panel);
  el.appendChild(main.root);

  if (place === 'screen') {
    const lab = labContent(frame.changed ?? {});
    const labScreen = screen('Test lab', 'Back to settings', TEST);
    labScreen.scroll.append(h(`<p class="tf-set-intro">Switches for the test phase. Changes apply when a level starts.</p>`), ...lab.groups);
    labScreen.root.appendChild(lab.bar);
    labScreen.root.classList.add('lab');
    const entryCount = h(`<span class="tf-set-chip changed" hidden></span>`);
    const entry = h(`<button type="button" class="tf-set-entry"><span class="tf-set-title">Test lab ${TEST}</span><span class="tf-set-entry-end"></span></button>`);
    entry.querySelector('.tf-set-entry-end')!.append(entryCount, h(`<span class="tf-set-chev">${ICON.next}</span>`));
    const sync = (n: number): void => {
      entryCount.hidden = n === 0;
      entryCount.textContent = `${n} changed`;
    };
    lab.onCount(sync);
    sync(lab.count());
    about.body.appendChild(entry);
    const show = (which: 'settings' | 'lab', focus: boolean): void => {
      main.root.hidden = which !== 'settings';
      labScreen.root.hidden = which !== 'lab';
      if (focus) (which === 'lab' ? labScreen.back : entry).focus();
    };
    entry.addEventListener('click', () => show('lab', true));
    labScreen.back.addEventListener('click', () => show('settings', true));
    el.appendChild(labScreen.root);
    show(frame.view ?? 'settings', false);
  }
  return el;
}

/** A static sample for the states table: one control with a caption. */
const sample = (control: HTMLElement, caption: string): HTMLElement => {
  const cell = h(`<div class="tf-set-cell"><span class="tf-set-cap">${caption}</span></div>`);
  cell.prepend(control);
  return cell;
};

/** Add the settings cards to the parts sheet. */
export function addSettingsCards(sheet: HTMLElement): void {
  const card = (id: string, title: string, dims: string, note: string): HTMLElement => {
    const el = h(`<section class="card wide" id="${id}"><h2>${title}</h2><p class="dims">${dims}</p><div class="tf-set-stage"></div><p class="note">${note}</p></section>`);
    sheet.appendChild(el);
    return el.querySelector('.tf-set-stage')!;
  };
  const titled = (text: string, ...frames: HTMLElement[]): HTMLElement => {
    const box = h(`<figure class="tf-set-fig"><figcaption>${text}</figcaption></figure>`);
    box.append(...frames);
    return box;
  };
  const noop = (): void => {};
  const changed: Partial<LabSettings> = { exitRule: 'single', speed: 1.5, unlockAll: true };

  // 1. The controls, each in every state, on a 320 px wide panel (the narrowest phone).
  {
    const stage = card(
      'settings-controls',
      'Instellingen · bedieningselementen',
      'schakelaar 68×44 px · keuzeknop 44 px hoog · rij min. 64 px · alles op een paneel van 320 px breed',
      'Alles is echte HTML met tekst: schakelaar = <code>button role="switch"</code>, keuze = <code>role="radiogroup"</code> met pijltjestoetsen, beide gekoppeld aan titel en uitleg. De stand is nooit alleen kleur: het vinkje op de knop en het opstaande witte blokje tonen hem ook. Raakvlakken zijn minstens 44×44 px.',
    );
    stage.classList.add('controls');
    const box = (title: string, ...children: HTMLElement[]): HTMLElement => {
      const p = h(`<div class="tf-set-demo" id="settings-demo-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><h3 class="btn-title">${title}</h3><div class="tf-set-panel"><div class="tf-set-rows"></div></div></div>`);
      p.querySelector('.tf-set-rows')!.append(...children);
      stage.appendChild(p);
      return p;
    };
    const stateRow = (...cells: HTMLElement[]): HTMLElement => {
      const r = h(`<div class="tf-set-states"></div>`);
      r.append(...cells);
      return r;
    };
    const sw = (on: boolean, state = ''): HTMLElement => {
      const id = uid('x');
      const s = toggle(id, on, noop);
      s.removeAttribute('aria-labelledby');
      s.setAttribute('aria-label', `Sample switch, ${state || 'rest'}`);
      if (state === 'disabled') s.disabled = true;
      else if (state) s.classList.add(state);
      return s;
    };
    box(
      'Schakelaar',
      stateRow(sample(sw(false), 'uit'), sample(sw(true), 'aan'), sample(sw(true, 'pressed'), 'ingedrukt'), sample(sw(true, 'focus'), 'focus')),
      stateRow(sample(sw(false, 'disabled'), 'uit · niet beschikbaar'), sample(sw(true, 'disabled'), 'aan · niet beschikbaar')),
    );

    const seg = (labels: string[], pick: number, state = ''): HTMLElement => {
      const title = uid('x');
      const s = segmented(title, labels.map((label, value) => ({ label, value })), pick, noop);
      s.removeAttribute('aria-labelledby');
      s.setAttribute('aria-label', `Sample choice, ${labels.length} options${state ? `, ${state}` : ''}`);
      const chosen = s.querySelectorAll('button')[pick];
      if (state === 'disabled') s.querySelectorAll('button').forEach((b) => (b.disabled = true));
      else if (state === 'pressed') s.querySelectorAll('button')[(pick + 1) % labels.length].classList.add('pressed');
      else if (state) chosen.classList.add(state);
      return s;
    };
    const wide = (el: HTMLElement, caption: string): HTMLElement => {
      const c = sample(el, caption);
      c.classList.add('wide');
      return c;
    };
    box(
      'Keuze met 2, 3 en 4 opties',
      wide(seg(['Many', 'Single file'], 0), '2 opties'),
      wide(seg(['Kit', 'Built-in'], 1), '2 opties · lange tekst gekozen'),
      wide(seg(['Auto', 'On', 'Off'], 0), '3 opties'),
      wide(seg(['Small', 'Normal', 'Large', 'Largest'], 1), '4 opties (voorbeeld; de game heeft er nu geen met 4)'),
      wide(seg(['Roomy', 'Classic'], 0, 'pressed'), 'ingedrukt: “Classic” wordt aangeraakt'),
      wide(seg(['+1', '+2', '+3'], 1, 'focus'), 'focus'),
      wide(seg(['0.75×', '1×', '1.5×'], 1, 'disabled'), 'niet beschikbaar'),
    );

    const plain = row('Sound', 'Game sounds.');
    plain.row.appendChild(toggle(plain.titleId, true, noop, plain.hintId));
    const stacked = row('Reduce motion', 'Calmer animations. Auto follows this device.', { stack: true });
    stacked.row.appendChild(segmented(stacked.titleId, [{ label: 'Auto', value: 0 }, { label: 'On', value: 1 }, { label: 'Off', value: 2 }], 0, noop, stacked.hintId));
    const fresh = row('Colour shapes', 'Adds a shape to each colour.');
    fresh.row.querySelector('.tf-set-hint')!.insertAdjacentHTML('beforeend', ` ${SHAPES}`);
    fresh.row.appendChild(toggle(fresh.titleId, false, noop, fresh.hintId));
    const head = panel('Game');
    head.body.append(plain.row, stacked.row, fresh.row);
    const rowsBox = h(`<div class="tf-set-demo" id="settings-demo-rows"><h3 class="btn-title">Sectiekop en rijen (titel + één regel uitleg)</h3></div>`);
    rowsBox.appendChild(head.panel);
    stage.appendChild(rowsBox);

    const mark = row('Unlock all levels', 'Open every level, solved or not.');
    mark.row.appendChild(toggle(mark.titleId, true, noop, mark.hintId));
    mark.mark(true, 'Off');
    const rule = row('Exit rule', 'Only one robot may enter the exit per turn.', { stack: true });
    rule.row.append(segmented(rule.titleId, [{ label: 'Many', value: 0 }, { label: 'Single file', value: 1 }], 1, noop, rule.hintId), solverNote());
    rule.mark(true, 'Many');
    const labDemo = labContent({ exitRule: 'single', unlockAll: true });
    const labClean = labContent({});
    box('Testlab: afwijking, solver-melding, terug naar standaard', mark.row, rule.row, labDemo.bar, labClean.bar);

    const reset = (title: string, armed: boolean, done: boolean): void => {
      const p = h(`<div class="tf-set-demo" id="settings-demo-reset-${armed ? 'armed' : done ? 'done' : 'rest'}"><h3 class="btn-title">${title}</h3></div>`);
      const pr = panel('Progress');
      pr.body.append(resetControl(armed, done));
      p.appendChild(pr.panel);
      stage.appendChild(p);
    };
    reset('Voortgang wissen · rust', false, false);
    reset('Voortgang wissen · tweede stap (gewapend)', true, false);
    reset('Voortgang wissen · daarna', false, true);
  }

  // 2. The chosen arrangement: the lab on its own screen behind a small entry.
  {
    const stage = card(
      'settings-screen',
      'Instellingenscherm · testlab als apart scherm',
      'telefoon 390×844 px · het scherm leeft: schakelaars, keuzes, “Back to defaults” en de wis-stap werken',
      'De speler ziet alleen zijn eigen instellingen; onderaan staat één kleine rij “Test lab”. Voor een publieke release vervalt alleen die rij (zie het vierde kader) en laadt de game altijd de standaardwaarden van het lab.',
    );
    stage.append(
      titled('Spelersinstellingen', settingsFrame({ width: 390, height: 844 })),
      titled('Testlab · alles standaard', settingsFrame({ width: 390, height: 844, view: 'lab' })),
      titled('Testlab · drie afwijkingen (volledige lengte)', settingsFrame({ width: 390, height: 844, view: 'lab', changed, full: true })),
      titled('Publieke release: zonder testlab', settingsFrame({ width: 390, height: 844, lab: 'none' })),
    );
  }

  // 3. The same screens at the other screen sizes.
  {
    const stage = card(
      'settings-sizes',
      'Instellingenscherm · andere schermmaten',
      '320×568 · 430×932 · 768×1024 px',
      'De terugknop zit in de vaste bovenbalk en scrolt niet mee; in het testlab blijft “Back to defaults” in de vaste onderbalk. Op een tablet blijft de kolom 520 px breed.',
    );
    for (const [width, height] of [[320, 568], [430, 932], [768, 1024]] as const) {
      stage.append(
        titled(`${width}×${height} · instellingen`, settingsFrame({ width, height })),
        titled(`${width}×${height} · testlab`, settingsFrame({ width, height, view: 'lab', changed })),
      );
    }
  }
}
