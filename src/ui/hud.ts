import { CONFIG } from '../config';
import { COMMANDS, type Color, type Command } from '../engine/types';
import PARTS from '../../data/parts.json';
import { mountPricedButton, setPrice, type PriceState } from './coins';
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
  /** Price of the next Undo, shown on the Undo button before it is tapped. */
  undoCost: number;
  /** Whether that price can be paid or is waived. A `short` Undo stays tappable; the tap is answered in words. */
  undoState: Exclude<PriceState, 'used'>;
  /** A tools button to point the player at (the ring the command buttons use), or null. */
  point: 'undo' | 'restart' | 'scan' | null;
  /** Show the quiet "Get coins" link after the hint text: the wallet just fell short and the test shop is on. */
  getCoins: boolean;
}

/** Callbacks from the level HUD to the game. */
export interface HudHandlers {
  command(c: Command): void;
  /** A command button was touched while it cannot be used (the level is over, or a replay or check is running). */
  refused(): void;
  undo(): void;
  restart(): void;
  scan(): void;
  back(): void;
  /** The "Get coins" link was tapped; `opener` gets the focus back afterwards. */
  getCoins(opener: HTMLElement): void;
}

/** Look up an element that the page is known to contain. */
export const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Level screen overlay: status, the four command buttons, tools and the result card. */
export class Hud {
  private buttons = new Map<Command, HTMLButtonElement>();
  private lastCollected = -1;
  /** Called whenever the pop-up is put away, so whatever it was animating can finish at once. */
  onCardHidden: (() => void) | null = null;
  private getCoins: HTMLButtonElement;

  constructor(handlers: HudHandlers, isLevelOpen: () => boolean) {
    this.getCoins = document.createElement('button');
    this.getCoins.type = 'button';
    this.getCoins.id = 'getCoins';
    this.getCoins.className = 'tf-get-coins';
    this.getCoins.textContent = 'Get coins';
    this.getCoins.addEventListener('click', () => handlers.getCoins(this.getCoins));
    // The bottom area's build (finding B9) comes from data/parts.json: one depth and corner rule for every block,
    // the size of a tool and the space between two, and the clear space between the tools and the command row (finding B11).
    const family = PARTS.buttons.family;
    const controls = el('tools').parentElement!;
    controls.style.setProperty('--tf-depth', String(family.depth));
    controls.style.setProperty('--tf-round', String(family.radius));
    const tools = PARTS.buttons.tools;
    controls.style.setProperty('--tools-clear', `${tools.clearance}px`);
    for (const [name, px] of [['h', tools.height], ['w', tools.width], ['r', tools.radius], ['gap', tools.gap]] as const) el('tools').style.setProperty(`--tool-${name}`, `${px}px`);
    mountPricedButton(el<HTMLButtonElement>('undo'));
    mountPricedButton(el<HTMLButtonElement>('scan'));
    el('card').insertAdjacentHTML('afterbegin', END_DEFS);
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.cmd'))) {
      const command = button.dataset.cmd as Command;
      // pointerdown, not click: the game answers on touch, not on release.
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!button.disabled) handlers.command(command);
        else handlers.refused();
      });
      this.buttons.set(command, button);
    }
    el('undo').addEventListener('click', () => handlers.undo());
    el('restart').addEventListener('click', () => handlers.restart());
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
    const undo = el<HTMLButtonElement>('undo');
    setPrice(undo, 'Undo', m.undoCost, m.undoState);
    undo.disabled = !m.canUndo;
    el<HTMLButtonElement>('restart').disabled = !m.canUndo;
    const scan = el<HTMLButtonElement>('scan');
    setPrice(scan, 'Hint', m.hintCost, m.hintState);
    scan.disabled = !m.canScan || m.hintState === 'used';
    scan.classList.toggle('showing', m.hintState === 'used');
    for (const id of ['undo', 'restart', 'scan'] as const) el(id).classList.toggle('nudge', m.point === id && !el<HTMLButtonElement>(id).disabled);
    const hint = el('hint');
    const hadFocus = document.activeElement === this.getCoins;
    hint.textContent = m.hint;
    if (m.getCoins) {
      hint.append(this.getCoins);
      if (hadFocus) this.getCoins.focus();
    }
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
    this.onCardHidden?.();
  }
}
