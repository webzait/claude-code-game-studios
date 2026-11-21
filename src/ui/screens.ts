import { CONFIG } from '../config';
import type { LabSettings } from '../game/lab';
import type { SaveData } from '../game/save';
import type { District } from '../levels/index';
import { el, STAR } from './hud';

const LOCK =
  '<svg viewBox="0 0 24 24" class="lock"><rect x="5" y="10.5" width="14" height="10" rx="3" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

/** One level node on the map. */
export interface MapNode {
  number: number;
  name: string;
  unlocked: boolean;
  /** 0 when not solved yet. */
  stars: number;
  solved: boolean;
  current: boolean;
}

/** Draw the home screen's texts. */
export function renderHome(model: { district: string; solved: number; total: number; playLabel: string }): void {
  el('homeStatus').textContent = `${model.district} · ${model.solved}/${model.total} routes restored`;
  el('play').textContent = model.playLabel;
}

/** Draw the district map: its level nodes, landmark status and the districts not built yet. */
export function renderMap(model: {
  district: District;
  nodes: MapNode[];
  landmarkText: string;
  landmarkNext: string;
  landmarkOn: boolean;
  others: readonly District[];
  onPick: (index: number) => void;
}): void {
  el('mapName').textContent = model.district.name;
  el('mapTheme').textContent = model.district.theme;
  el('mapLore').textContent = model.district.lore;
  el('mapCount').textContent = `${model.nodes.filter((n) => n.solved).length}/${model.nodes.length}`;
  el('landmarkLine').innerHTML = `<span class="lamp${model.landmarkOn ? ' on' : ''}"></span><span></span>`;
  const line = el('landmarkLine').lastElementChild as HTMLElement;
  line.textContent = model.landmarkText;
  const small = document.createElement('small');
  small.textContent = model.landmarkNext;
  line.appendChild(small);

  const nodes = el('nodes');
  nodes.innerHTML = '';
  model.nodes.forEach((node, index) => {
    const button = document.createElement('button');
    button.className = `node${node.solved ? ' done' : ''}${node.current ? ' current' : ''}`;
    button.id = `node-${node.number}`;
    button.disabled = !node.unlocked;
    button.setAttribute('aria-label', `Level ${node.number}, ${node.name}${node.unlocked ? '' : ', locked'}${node.solved ? `, solved, ${node.stars} stars` : ''}`);
    if (!node.unlocked) button.innerHTML = LOCK;
    else {
      const number = document.createElement('span');
      number.textContent = String(node.number);
      button.appendChild(number);
      if (node.solved) {
        const mini = document.createElement('span');
        mini.className = 'mini';
        mini.innerHTML = [1, 2, 3].map((i) => STAR.replace('<svg', `<svg class="${i <= node.stars ? 'on' : ''}"`)).join('');
        button.appendChild(mini);
      }
      button.addEventListener('click', () => model.onPick(index));
    }
    nodes.appendChild(button);
  });

  const list = el('districts');
  list.innerHTML = '';
  for (const d of model.others) {
    const row = document.createElement('div');
    row.className = 'district';
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = d.accent;
    const text = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = d.name;
    const theme = document.createElement('span');
    theme.textContent = d.theme;
    text.append(name, theme);
    const state = document.createElement('em');
    state.textContent = 'Not built yet';
    row.append(swatch, text, state);
    list.appendChild(row);
  }
}

/** What the settings screen can change. */
export interface SettingsHandlers {
  setMute(mute: boolean): void;
  setReduceMotion(value: boolean | null): void;
  setLab(patch: Partial<LabSettings>): void;
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
      setting('Progress', 'Solved levels and the lighthouse', reset),
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
      setting('Unlock all', 'Open every level', segmented('unlockAll', onOff, save.lab.unlockAll, (v) => handlers.setLab({ unlockAll: v }))),
    ]),
  );
  body.scrollTop = scroll;
}
