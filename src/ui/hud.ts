import { CONFIG } from '../config';
import { COMMANDS, type Color, type Command } from '../engine/types';
import { mountHintButton, setHintPrice, type PriceState } from './coins';
import { END_DEFS, renderEndCard, type EndCard } from './endCard';

/** What the level HUD needs to draw one frame of status. */
export interface HudModel {
  levelNumber: number;
  /** Replaces `LEVEL n` in the header, for boards that are not levels. */
  levelLabel?: string;
  levelName: string;
  collected: number;
  total: number;
  movesLeft: number;
  canUndo: boolean;
  canReplay: boolean;
  canScan: boolean;
  inputLocked: boolean;
  colorsInLevel: ReadonlySet<Color>;
  /** Command to softly highlight, or null. */
  nudge: Command | null;
  hint: string;
  hintWarn: boolean;
  /** Price of the next move, shown on the Hint button before it is tapped. */
  hintCost: number;
  /** Whether that price can be paid, is waived, or the move is already revealed. */
  hintState: PriceState;
}

/** Callbacks from the level HUD to the game. */
export interface HudHandlers {
  command(c: Command): void;
  undo(): void;
  restart(): void;
  replay(): void;
  scan(): void;
  back(): void;
}

/** Look up an element that the page is known to contain. */
export const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Level screen overlay: status, the four command buttons, tools and the result card. */
export class Hud {
  private buttons = new Map<Command, HTMLButtonElement>();
  private lastCollected = -1;

  constructor(handlers: HudHandlers, isLevelOpen: () => boolean) {
    mountHintButton(el<HTMLButtonElement>('scan'));
    el('card').insertAdjacentHTML('afterbegin', END_DEFS);
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.cmd'))) {
      const command = button.dataset.cmd as Command;
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
    el('scan').addEventListener('click', () => handlers.scan());
    el('levelBack').addEventListener('click', () => handlers.back());
    window.addEventListener('keydown', (e) => {
      if (!isLevelOpen()) return;
      const keys: Record<string, Command> = { '1': 'red', '2': 'blue', '3': 'yellow', ' ': 'forward', ArrowUp: 'forward' };
      const command = keys[e.key];
      const button = command ? this.buttons.get(command) : undefined;
      if (button && !button.disabled && !button.hidden) handlers.command(command);
      else if (e.key === 'z' || e.key === 'Backspace') handlers.undo();
      else if (e.key === 'r') handlers.restart();
      else if (e.key === 'h') handlers.scan();
    });
  }

  /** Redraw status and button states. */
  update(m: HudModel): void {
    el('levelWord').textContent = m.levelLabel ?? 'LEVEL';
    el('levelNo').textContent = m.levelLabel ? '–' : String(m.levelNumber);
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
    const scan = el<HTMLButtonElement>('scan');
    setHintPrice(scan, m.hintCost, m.hintState);
    scan.disabled = !m.canScan || m.hintState === 'used';
    const hint = el('hint');
    hint.textContent = m.hint;
    hint.classList.toggle('warn', m.hintWarn);
  }

  /** Forget the collected count, so a new level does not animate the counter. */
  resetCounter(): void {
    this.lastCollected = -1;
  }

  /** Briefly show a command button as pressed (used by replay). */
  flash(command: Command): void {
    const button = this.buttons.get(command);
    if (!button) return;
    button.classList.add('pressed');
    window.setTimeout(() => button.classList.remove('pressed'), 140);
  }

  /** Show the end-of-round pop-up. `animate` false shows its end state at once (reduced motion). */
  showCard(card: EndCard, animate: boolean): void {
    const host = el('card');
    renderEndCard(el('cardBody'), card, animate);
    host.hidden = false;
    host.classList.remove('tf-end-play');
    if (animate) {
      void host.offsetWidth;
      host.classList.add('tf-end-play');
    }
  }

  /** Hide the result card. */
  hideCard(): void {
    el('card').hidden = true;
    el('cardBody').innerHTML = '';
  }
}
