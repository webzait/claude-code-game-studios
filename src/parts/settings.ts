import type { LabSettings } from '../game/lab';
import pkg from '../../package.json';
import { h, ICON, labContent, NEW, panel, resetControl, row, screenShell, segmented, solverNote, TEST, toggle, uid } from '../ui/settingsView';

/**
 * The settings screen as a standalone mock-up for the parts sheet: player
 * settings, the test lab on its own screen, and every control in every
 * state. It keeps its own state; the game builds its screens from the same controls (src/ui/settingsView.ts).
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
  vibration: boolean;
  shapes: boolean;
  largeText: boolean;
}

/** The player's own settings. */
function playerPanels(frame: SettingsFrame, additions: boolean): HTMLElement[] {
  const player: PlayerSettings = { sound: true, reduceMotion: null, vibration: true, shapes: false, largeText: false };
  const game = panel('Game');
  const flag = (key: 'sound' | 'vibration' | 'shapes' | 'largeText', title: string, hint: string, isNew = false): HTMLElement => {
    const r = row(title, hint, { chip: isNew ? NEW : '' });
    r.row.appendChild(toggle(r.titleId, player[key], (on) => (player[key] = on), r.hintId));
    return r.row;
  };
  const motion = row('Reduce motion', 'Calmer animations. Auto follows this device.', { stack: true });
  motion.row.appendChild(
    segmented<boolean | null>(motion.titleId, [{ label: 'Auto', value: null }, { label: 'On', value: true }, { label: 'Off', value: false }], player.reduceMotion, (v) => (player.reduceMotion = v), motion.hintId),
  );
  game.body.append(flag('sound', 'Sound', 'Game sounds.'));
  if (additions) game.body.append(flag('vibration', 'Vibration', 'A short buzz on moves and wins.', true));
  game.body.append(motion.row);

  const out = [game.panel];
  if (additions) {
    const see = panel('Easier to see', NEW);
    const shapes = flag('shapes', 'Colour shapes', 'Adds a shape to each colour.');
    shapes.querySelector('.tf-set-hint')!.insertAdjacentHTML(
      'beforeend',
      ` <span class="tf-set-shapes" aria-label="Red circle, blue square, yellow diamond"><i class="red"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.4"/></svg></i><i class="blue"><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.8" y="2.8" width="6.4" height="6.4" rx="1"/></svg></i><i class="yellow"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.8 10.2 6 6 10.2 1.8 6z"/></svg></i></span>`,
    );
    see.body.append(shapes, flag('largeText', 'Larger text', 'Bigger labels and numbers.'));
    out.push(see.panel);
  }

  const progress = panel('Progress');
  progress.body.append(resetControl(frame.armed));
  out.push(progress.panel);
  return out;
}

/** One phone frame holding the settings screen, and the lab screen when the lab has its own. */
export function settingsFrame(frame: SettingsFrame): HTMLElement {
  const place = frame.lab ?? 'screen';
  const el = h(`<div class="tf-set-frame${frame.full ? ' full' : ''}" style="--fw:${frame.width}px;--fh:${frame.height}px"></div>`);
  const screen = screenShell;

  const main = screen('Settings', 'Back to levels');
  main.scroll.append(...playerPanels(frame, true));
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
    const fresh = row('Vibration', 'A short buzz on moves and wins.', { chip: NEW });
    fresh.row.appendChild(toggle(fresh.titleId, true, noop, fresh.hintId));
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
      'De speler ziet alleen zijn eigen instellingen; onderaan staat één kleine rij “Test lab”. Voor een publieke release vervalt alleen die rij (zie het vierde kader) en laadt de game altijd de standaardwaarden van het lab. De paarse labels “New idea” markeren voorstellen; ze horen niet in de game.',
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
