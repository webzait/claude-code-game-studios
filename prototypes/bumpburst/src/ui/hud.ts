// PROTOTYPE - NOT FOR PRODUCTION
import { COLORS, SYMBOLS, type ColorId } from '../config';
import type { Game } from '../game/game';
import type { LevelDef } from '../levels/types';
import { symbolSvg } from '../render/symbols';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * k);
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`;
}

/** The DOM layer: level label, goal counter, pulse pips, colour buttons, title and result sheets. */
export class Hud {
  readonly buttons = $('buttons');
  private goal = $('goal');
  private got = $('got');
  private pips = $('pips');
  private result = $('result');
  private title = $('title');
  private lastGot = 0;

  get titleOpen(): boolean { return !this.title.hidden; }
  get resultOpen(): boolean { return !this.result.hidden; }

  /** Fills the static parts for a level and builds one big button per colour on the board. */
  setLevel(level: LevelDef, colors: ColorId[]): void {
    $('lvl-num').textContent = `LEVEL ${level.id}`;
    $('lvl-name').textContent = level.name;
    $('hint').textContent = level.hint;
    $('need').textContent = String(level.target);
    this.buttons.innerHTML = '';
    colors.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'burst';
      b.dataset.color = c;
      b.style.setProperty('--c', COLORS[c]);
      b.style.setProperty('--d', shade(COLORS[c], 0.68));
      b.setAttribute('aria-label', `Burst ${c} (key ${i + 1})`);
      b.innerHTML = symbolSvg(SYMBOLS[c], 34);
      this.buttons.appendChild(b);
    });
    this.lastGot = 0;
  }

  /** Mirrors the game's counters; locks the buttons while a pulse resolves. */
  update(game: Game): void {
    const { level } = game;
    if (game.collected !== this.lastGot) {
      this.lastGot = game.collected;
      this.goal.classList.remove('bump');
      void this.goal.offsetWidth;
      this.goal.classList.add('bump');
    }
    this.got.textContent = String(game.collected);
    this.goal.classList.toggle('done', game.collected >= level.target);
    const total = Math.max(level.pulses, game.pulsesLeft + game.history.length);
    let html = '<span>PULSES</span>';
    for (let i = 0; i < total; i++) html += `<span class="pip${i < game.pulsesLeft ? '' : ' used'}"></span>`;
    this.pips.innerHTML = html;
    const locked = game.phase !== 'ready';
    const fresh = level.id === 1 && game.history.length === 0 && !locked;
    for (const b of Array.from(this.buttons.children)) {
      b.classList.toggle('locked', locked);
      b.classList.toggle('nudge', fresh);
    }
  }

  showResult(game: Game, isLast: boolean): void {
    const won = game.phase === 'won';
    const main = $('res-main');
    const alt = $('res-alt');
    if (won) {
      const perfect = game.collected === game.total;
      $('res-title').textContent = isLast ? 'All five cleared!' : perfect ? 'Perfect!' : 'Level clear';
      const spare = game.pulsesLeft > 0 ? ` with ${game.pulsesLeft} pulse${game.pulsesLeft > 1 ? 's' : ''} to spare` : '';
      $('res-sub').textContent = `${game.collected} of ${game.total} marbles caught${spare}.`;
      main.textContent = isLast ? 'Back to level 1' : 'Next level';
      main.dataset.action = 'next';
      alt.hidden = false;
    } else {
      $('res-title').textContent = 'Out of pulses';
      $('res-sub').textContent = `Caught ${game.collected}, needed ${game.level.target}. Try another order.`;
      main.textContent = 'Try again';
      main.dataset.action = 'retry';
      alt.hidden = true;
    }
    this.result.hidden = false;
  }

  hideResult(): void { this.result.hidden = true; }

  /** Title sheet with one dot per level; a level opens once the one before it is cleared. */
  showTitle(levels: LevelDef[], cleared: number): void {
    const dots = $('dots');
    dots.innerHTML = '';
    for (const l of levels) {
      const b = document.createElement('button');
      b.textContent = String(l.id);
      b.dataset.level = String(l.id);
      b.disabled = l.id > cleared + 1;
      b.classList.toggle('done', l.id <= cleared);
      b.setAttribute('aria-label', `Level ${l.id}: ${l.name}`);
      dots.appendChild(b);
    }
    this.title.hidden = false;
  }

  hideTitle(): void { this.title.hidden = true; }

  setMuted(muted: boolean): void { $('btn-mute').classList.toggle('off', muted); }
}
