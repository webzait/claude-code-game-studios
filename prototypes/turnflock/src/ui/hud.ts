// PROTOTYPE - NOT FOR PRODUCTION
import { CONFIG } from '../config';
import { COMMANDS, type Color, type Command } from '../engine/types';

const TURN_ICON =
  '<svg viewBox="0 0 48 48"><path d="M37 24a13 13 0 1 1-4.6-9.9" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/><path d="M38.5 6.5v10h-10" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FORWARD_ICON =
  '<svg viewBox="0 0 48 48"><path d="M24 39V11M11 23 24 10l13 13" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const STAR =
  '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/** What the HUD needs to draw one frame of status. */
export interface HudModel {
  levelIndex: number;
  levelCount: number;
  levelName: string;
  collected: number;
  total: number;
  movesLeft: number;
  canUndo: boolean;
  canReplay: boolean;
  inputLocked: boolean;
  colorsInLevel: ReadonlySet<Color>;
  solved: ReadonlySet<number>;
  /** Command to softly highlight (level 1 teaches by doing), or null. */
  nudge: Command | null;
}

/** Callbacks from the HUD to the game controller. */
export interface HudHandlers {
  command(c: Command): void;
  undo(): void;
  restart(): void;
  replay(): void;
  selectLevel(index: number): void;
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** DOM overlay: status, the four command buttons, tools and the result card. */
export class Hud {
  private buttons = new Map<Command, HTMLButtonElement>();
  private lastCollected = -1;

  constructor(private handlers: HudHandlers) {
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.cmd'))) {
      const command = button.dataset.cmd as Command;
      button.innerHTML = command === 'forward' ? FORWARD_ICON : TURN_ICON;
      // pointerdown, not click: the game answers on touch, not on release.
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!button.disabled) handlers.command(command);
      });
      this.buttons.set(command, button);
    }
    el('undo').addEventListener('click', () => handlers.undo());
    el('restart').addEventListener('click', () => handlers.restart());
    el('replay').addEventListener('click', () => handlers.replay());
    window.addEventListener('keydown', (e) => {
      const keys: Record<string, Command> = { '1': 'red', '2': 'blue', '3': 'yellow', ' ': 'forward', ArrowUp: 'forward' };
      const command = keys[e.key];
      if (command && !this.buttons.get(command)?.disabled && !this.buttons.get(command)?.hidden) handlers.command(command);
      else if (e.key === 'z' || e.key === 'Backspace') handlers.undo();
      else if (e.key === 'r') handlers.restart();
    });
  }

  /** Redraw status and button states. */
  update(m: HudModel): void {
    el('levelNo').textContent = `LEVEL ${m.levelIndex + 1}`;
    el('levelName').textContent = m.levelName;
    el('collected').textContent = `${m.collected}/${m.total}`;
    el('moves').textContent = String(Math.max(m.movesLeft, 0));
    el('movesPill').classList.toggle('low', m.movesLeft <= CONFIG.lowMoves);
    if (m.collected > this.lastCollected && this.lastCollected >= 0) {
      const pill = el('collectedPill');
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
    }
    this.lastCollected = m.collected;
    for (const command of COMMANDS) {
      const button = this.buttons.get(command)!;
      button.hidden = command !== 'forward' && !m.colorsInLevel.has(command);
      button.disabled = m.inputLocked;
      button.classList.toggle('nudge', m.nudge === command && !m.inputLocked);
    }
    el<HTMLButtonElement>('undo').disabled = !m.canUndo;
    el<HTMLButtonElement>('restart').disabled = !m.canUndo;
    el<HTMLButtonElement>('replay').disabled = !m.canReplay;
    const dots = el('dots');
    if (dots.childElementCount !== m.levelCount) {
      dots.innerHTML = '';
      for (let i = 0; i < m.levelCount; i++) {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.textContent = String(i + 1);
        dot.setAttribute('aria-label', `Level ${i + 1}`);
        dot.addEventListener('click', () => this.handlers.selectLevel(i));
        dots.appendChild(dot);
      }
    }
    Array.from(dots.children).forEach((dot, i) => {
      dot.classList.toggle('current', i === m.levelIndex);
      dot.classList.toggle('done', m.solved.has(i));
    });
  }

  /** Briefly show a command button as pressed (used by replay). */
  flash(command: Command): void {
    const button = this.buttons.get(command);
    if (!button) return;
    button.classList.add('pressed');
    window.setTimeout(() => button.classList.remove('pressed'), 140);
  }

  /** Show the result card. `stars` 0 hides the star row. */
  showCard(opts: {
    title: string;
    text: string;
    stars: number;
    primary: string;
    onPrimary: () => void;
    secondary: string;
    onSecondary: () => void;
  }): void {
    el('cardTitle').textContent = opts.title;
    el('cardText').textContent = opts.text;
    el('stars').innerHTML = opts.stars > 0 ? [1, 2, 3].map((i) => STAR.replace('<svg', `<svg class="${i <= opts.stars ? 'on' : ''}"`)).join('') : '';
    const primary = el<HTMLButtonElement>('cardPrimary');
    const secondary = el<HTMLButtonElement>('cardSecondary');
    primary.textContent = opts.primary;
    secondary.textContent = opts.secondary;
    primary.onclick = opts.onPrimary;
    secondary.onclick = opts.onSecondary;
    el('card').hidden = false;
  }

  /** Hide the result card. */
  hideCard(): void {
    el('card').hidden = true;
  }
}
