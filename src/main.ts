import './ui/style.css';
import { CONFIG } from './config';
import { step } from './engine/engine';
import type { Color, Command } from './engine/types';
import { Session } from './game/session';
import { LEVELS } from './levels/index';
import { BoardView } from './render/boardView';
import { Hud } from './ui/hud';

const STORE_KEY = 'turnflock.progress.v1';

declare global {
  interface Window {
    /** The running game, exposed for automated checks. */
    turnflock: Game;
  }
}
const wait = (seconds: number): Promise<void> => new Promise((r) => window.setTimeout(r, seconds * 1000));

/** What automated checks may read from the running game. */
export interface Snapshot {
  level: number;
  status: string;
  movesLeft: number;
  collected: number;
  total: number;
  commands: Command[];
  replaying: boolean;
}

/** Glue between session (logic), board view (3D) and HUD (DOM). */
class Game {
  private view = new BoardView(document.getElementById('board') as HTMLCanvasElement);
  private hud: Hud;
  private levelIndex = 0;
  private session = new Session(LEVELS[0]);
  private solved = new Set<number>();
  /** Animations still queued; more than one speeds playback up. */
  private pending = 0;
  private chain: Promise<void> = Promise.resolve();
  /** Bumped by undo/restart/level change so stale animation chains stop. */
  private generation = 0;
  private replaying = false;
  private touched = false;

  constructor() {
    this.hud = new Hud({
      command: (c) => this.command(c),
      undo: () => this.undo(),
      restart: () => this.restart(),
      replay: () => void this.replay(),
      selectLevel: (i) => this.load(i),
    });
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as { solved?: number[]; level?: number };
      for (const i of saved.solved ?? []) this.solved.add(i);
      if (typeof saved.level === 'number' && LEVELS[saved.level]) this.levelIndex = saved.level;
    } catch {
      // Progress is a convenience; the game works without storage.
    }
    const stage = document.querySelector('.stage') as HTMLElement;
    new ResizeObserver(() => this.view.resize()).observe(stage);
    this.load(this.levelIndex);
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ solved: [...this.solved], level: this.levelIndex }));
    } catch {
      // Ignore: private mode or blocked storage.
    }
  }

  private load(index: number): void {
    this.generation++;
    this.pending = 0;
    this.replaying = false;
    this.touched = false;
    this.levelIndex = index;
    this.session = new Session(LEVELS[index]);
    this.hud.hideCard();
    this.view.loadLevel(this.session.level);
    this.view.resize();
    this.save();
    this.refresh();
  }

  private refresh(): void {
    const level = this.session.level;
    const colors = new Set<Color>(level.start.robots.map((r) => r.color));
    this.hud.update({
      levelIndex: this.levelIndex,
      levelCount: LEVELS.length,
      levelName: level.name,
      collected: this.session.collected,
      total: this.session.total,
      movesLeft: this.session.movesLeft,
      canUndo: this.session.commands.length > 0 && !this.replaying,
      canReplay: this.session.commands.length > 0 && !this.replaying,
      inputLocked: this.replaying || this.session.status !== 'playing',
      colorsInLevel: colors,
      solved: this.solved,
      nudge: this.levelIndex === 0 && !this.touched ? 'forward' : null,
    });
  }

  private command(command: Command): void {
    if (this.replaying) return;
    const result = this.session.apply(command);
    if (!result) return;
    this.touched = true;
    this.refresh();
    const generation = this.generation;
    this.pending++;
    this.chain = this.chain.then(async () => {
      if (generation !== this.generation) return;
      const speed = 1 + (this.pending - 1) * CONFIG.anim.queueSpeedup;
      await this.view.play(result.events, speed);
      if (generation !== this.generation) return;
      this.pending--;
      if (this.pending === 0) this.settle();
    });
  }

  /** All animations done: show the outcome if the level ended. */
  private settle(): void {
    const status = this.session.status;
    if (status === 'won') {
      this.solved.add(this.levelIndex);
      this.save();
      this.view.celebrate();
      this.refresh();
      const generation = this.generation;
      void wait(0.55).then(() => generation === this.generation && this.showWin());
    } else if (status === 'lost') {
      this.hud.showCard({
        title: 'Out of moves',
        text: `${this.session.total - this.session.collected} still on the board`,
        stars: 0,
        secondary: 'Undo',
        onSecondary: () => this.undo(),
        primary: 'Try again',
        onPrimary: () => this.restart(),
      });
    }
  }

  private showWin(): void {
    const used = this.session.commands.length;
    const over = used - LEVELS[this.levelIndex].par;
    const stars = over <= CONFIG.stars.three ? 3 : over <= CONFIG.stars.two ? 2 : 1;
    const last = this.levelIndex === LEVELS.length - 1;
    this.hud.showCard({
      title: last ? 'Flock complete' : 'All home',
      text: `${used} moves${stars === 3 ? ' · perfect' : ''}`,
      stars,
      secondary: 'Replay',
      onSecondary: () => void this.replay(),
      primary: last ? 'Play again' : 'Next level',
      onPrimary: () => this.load(last ? 0 : this.levelIndex + 1),
    });
  }

  private undo(): void {
    if (this.replaying || !this.session.undo()) return;
    this.generation++;
    this.pending = 0;
    this.hud.hideCard();
    this.view.sync(this.session.state, true);
    this.refresh();
  }

  private restart(): void {
    if (this.replaying) return;
    this.generation++;
    this.pending = 0;
    this.session.restart();
    this.hud.hideCard();
    this.view.sync(this.session.state, true);
    this.refresh();
  }

  /** Play the commands so far again from the start; the session is untouched. */
  private async replay(): Promise<void> {
    if (this.replaying || this.session.commands.length === 0) return;
    const generation = ++this.generation;
    this.pending = 0;
    this.replaying = true;
    this.hud.hideCard();
    this.refresh();
    const level = this.session.level;
    let state = level.start;
    this.view.sync(state, true);
    await wait(0.45);
    for (const command of this.session.commands) {
      if (generation !== this.generation) return;
      const result = step(level.board, state, command);
      state = result.state;
      this.hud.flash(command);
      await this.view.play(result.events, 1);
      await wait(CONFIG.anim.replayGap);
    }
    if (generation !== this.generation) return;
    this.view.sync(this.session.state, false);
    this.replaying = false;
    this.refresh();
    if (this.session.status !== 'playing') this.settle();
  }

  /** Read-only snapshot for automated checks. */
  snapshot(): Snapshot {
    return {
      level: this.levelIndex,
      status: this.session.status,
      movesLeft: this.session.movesLeft,
      collected: this.session.collected,
      total: this.session.total,
      commands: [...this.session.commands],
      replaying: this.replaying,
    };
  }
}

const game = new Game();
window.turnflock = game;
