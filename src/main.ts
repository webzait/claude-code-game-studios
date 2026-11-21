import './ui/style.css';
import './ui/tf-buttons.css';
import './ui/tf-scene.css';
import { Sfx } from './audio';
import { CONFIG } from './config';
import { step } from './engine/engine';
import type { Color, Command } from './engine/types';
import { witnessNext, type RescueResult, type ScanResult } from './game/assist';
import { extraMovesPrice, hintPrice, payout, rewardFor } from './game/coins';
import { applyLab, rulesFor, usesCertifiedRules, type LabSettings } from './game/lab';
import { MemorySink, type MetricsEvent } from './game/metrics';
import { isUnlocked, resumeIndex, starsFor } from './game/progress';
import { loadSave, resetProgress, writeSave, type KeyValueStore, type SaveData } from './game/save';
import { Session } from './game/session';
import { LEVELS, TEST_BOARDS, type GameLevel } from './levels/index';
import { BoardView } from './render/boardView';
import { loadKit } from './render/kit';
import coinIcon from '../assets/turnflock/ui/coin.webp';
import hintIcon from '../assets/turnflock/ui/hint.webp';
import extraMovesIcon from '../assets/turnflock/ui/extra-moves.webp';
import decorLarge from '../assets/turnflock/decor/decor-bush-large.webp';
import decorSmall from '../assets/turnflock/decor/decor-bush-small.webp';
import decorClover from '../assets/turnflock/decor/decor-tuft-clover.webp';
import decorSprig from '../assets/turnflock/decor/decor-sprig-top.webp';
import { SolverClient } from './solver/client';
import type { CertifyResult } from './solver/requests';
import { el, Hud } from './ui/hud';
import { renderLevels, renderSettings, type MapNode } from './ui/screens';

type ScreenName = 'map' | 'level' | 'settings';

/** What automated checks may read from the running game. */
export interface Snapshot {
  screen: ScreenName;
  level: number;
  status: string;
  movesLeft: number;
  budget: number;
  collected: number;
  total: number;
  commands: Command[];
  replaying: boolean;
  hint: string;
  certified: boolean;
  best: Record<string, number>;
  coins: number;
  kitReady: boolean;
  lab: LabSettings;
  events: MetricsEvent[];
}

declare global {
  interface Window {
    /** The running game, exposed for automated checks. */
    turnflock: Game;
  }
}

const wait = (seconds: number): Promise<void> => new Promise((r) => window.setTimeout(r, seconds * 1000));
const COMMAND_LABEL: Record<Command, string> = { red: 'Red turn', blue: 'Blue turn', yellow: 'Yellow turn', forward: 'Forward' };
const LEVEL_IDS = LEVELS.map((l) => l.id);

/** `localStorage`, or a throwaway store when the browser blocks it. */
function storage(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }
}

/** Glue between screens, session (logic), board view (3D), solver and save. */
class Game {
  private store = storage();
  private save: SaveData = loadSave(this.store, LEVEL_IDS);
  private metrics = new MemorySink();
  private sfx = new Sfx(() => this.save.settings.mute);
  private solver = new SolverClient();
  private view = new BoardView(el<HTMLCanvasElement>('board'));
  private hud: Hud;
  /** True once the asset kit's 3D models are in use. */
  private kitReady = false;
  private screen: ScreenName = 'map';
  /** Page of the level selection on show; null opens the page of the current level. */
  private page: number | null = null;
  private levelIndex = 0;
  /** A board-size test board is open instead of a level. */
  private preview = false;
  private previewIndex = 0;
  private level: GameLevel = LEVELS[0];
  private session = new Session(LEVELS[0], { budget: LEVELS[0].par + CONFIG.moveSlack });
  /** Shortest solution length under the rules in play. */
  private par = LEVELS[0].par;
  /** A known winning command list under the rules in play, when there is one. */
  private witness: readonly Command[] | null = LEVELS[0].witness;
  /** False when the level could not be proven solvable under a test rule. */
  private certified = true;
  /** Coins paid out by the latest win, shown on the result card. */
  private earnedNow = 0;
  private usedBackup = false;
  /** A paid hint revealed a move during this attempt. */
  private usedHint = false;
  /** Animations still queued; more than one speeds playback up. */
  private pending = 0;
  private chain: Promise<void> = Promise.resolve();
  /** Bumped by undo, restart and screen changes so stale animations and solver answers are dropped. */
  private generation = 0;
  private replaying = false;
  private busy = false;
  private touched = false;
  private hint = '';
  private hintWarn = false;
  private nudge: Command | null = null;
  private scanKey = '';
  private scanResult: ScanResult | null = null;

  constructor() {
    this.hud = new Hud(
      {
        command: (c) => this.command(c),
        undo: () => this.undo(),
        restart: () => this.restart(),
        replay: () => void this.replay(),
        scan: () => void this.scan(),
        back: () => this.show('map'),
      },
      () => this.screen === 'level',
    );
    el('toSettings').addEventListener('click', () => this.tap(() => this.show('settings')));
    el('continue').addEventListener('click', () => this.tap(() => this.startLevel(resumeIndex(LEVEL_IDS, this.save.best))));
    el('settingsBack').addEventListener('click', () => this.tap(() => this.show('map')));
    new ResizeObserver(() => this.view.resize()).observe(document.querySelector('.stage') as HTMLElement);
    // Kit artwork: images are bundled; the page sets them here so one build works from any folder.
    for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img[data-art]'))) {
      const art: Record<string, string> = { coin: coinIcon, hint: hintIcon, extra: extraMovesIcon, 'decor-large': decorLarge, 'decor-small': decorSmall, 'decor-clover': decorClover, 'decor-sprig': decorSprig };
      img.src = art[img.dataset.art ?? ''] ?? '';
    }
    this.applySettings();
    this.show('map');
    // The 3D kit loads in the background; a level already on show is redrawn with it.
    loadKit()
      .then((kit) => {
        this.kitReady = true;
        this.view.setKit(kit);
        if (this.screen === 'level' && this.session.commands.length === 0) {
          this.view.loadLevel(this.level);
          this.view.resize();
        }
      })
      .catch(() => {
        // The built-in shapes stay in use; nothing else depends on the kit.
        this.kitReady = false;
      });
  }

  private tap(action: () => void): void {
    this.sfx.play('tap');
    action();
  }

  private get reduced(): boolean {
    return this.save.settings.reduceMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private persist(): void {
    writeSave(this.store, this.save);
  }

  private track(event: MetricsEvent): void {
    this.metrics.track(event);
  }

  private applySettings(): void {
    document.documentElement.classList.toggle('reduce-motion', this.reduced);
    this.view.setMotion(this.save.lab.speed, this.reduced);
    this.view.setLayout(CONFIG.board[this.save.lab.board]);
    this.view.setStyle({ kitRobots: this.save.lab.robots === 'kit', kitBoard: this.save.lab.boardPieces === 'kit', heading: this.save.lab.heading });
    document.documentElement.classList.toggle('no-decor', !this.save.lab.decor);
  }

  // ---------------------------------------------------------------- screens

  private show(screen: ScreenName): void {
    this.generation++;
    this.pending = 0;
    this.replaying = false;
    this.busy = false;
    this.screen = screen;
    for (const name of ['map', 'level', 'settings'] as const) el(name).hidden = name !== screen;
    this.hud.hideCard();
    this.view.skip();
    if (screen === 'map') {
      this.page = null;
      this.drawMap();
    }
    if (screen === 'settings') this.drawSettings();
  }

  private drawMap(): void {
    const best = this.save.best;
    const resume = resumeIndex(LEVEL_IDS, best);
    const nodes: MapNode[] = LEVELS.map((level, index) => {
      const moves = best[level.id];
      return {
        number: index + 1,
        name: level.name,
        unlocked: isUnlocked(LEVEL_IDS, best, index, this.save.lab.unlockAll),
        solved: moves !== undefined,
        // A win carried over from the first prototype has no move count: show one star.
        stars: moves === undefined ? 0 : moves === 0 ? 1 : starsFor(moves, level.par, false),
        current: index === resume && moves === undefined,
      };
    });
    const pageSize = CONFIG.levelsPerPage;
    this.page ??= Math.floor(resume / pageSize);
    const allDone = nodes.every((n) => n.solved);
    renderLevels({
      nodes,
      page: this.page,
      pageSize,
      coins: this.save.coins,
      continueLabel: allDone ? `Play again · Level ${resume + 1}` : best[LEVEL_IDS[0]] === undefined ? 'Play · Level 1' : `Continue · Level ${resume + 1}`,
      onPick: (index) => this.tap(() => this.startLevel(index)),
      onPage: (page) => {
        this.page = page;
        this.tap(() => this.drawMap());
      },
    });
  }

  private drawSettings(): void {
    renderSettings(this.save, {
      setMute: (mute) => {
        this.save.settings.mute = mute;
        this.afterSetting();
      },
      setReduceMotion: (value) => {
        this.save.settings.reduceMotion = value;
        this.afterSetting();
      },
      testBoards: TEST_BOARDS.map((b) => `${b.board.width}×${b.board.height}`),
      previewBoard: (index) => this.tap(() => this.startPreview(index)),
      setLab: (patch) => {
        Object.assign(this.save.lab, patch);
        this.afterSetting();
      },
      resetProgress: () => {
        this.save = resetProgress(this.save);
        this.afterSetting();
      },
    });
  }

  private afterSetting(): void {
    this.persist();
    this.applySettings();
    this.sfx.play('tap');
    this.drawSettings();
  }

  // ----------------------------------------------------------------- level

  /** Open a level. Under a test rule the level is first re-checked by the solver. */
  private startLevel(index: number): void {
    const lab = this.save.lab;
    const level = applyLab(LEVELS[index], lab);
    this.levelIndex = index;
    if (usesCertifiedRules(lab)) {
      this.begin(level, level.par, level.witness, true);
      return;
    }
    // Test rule: the stored par and witness do not apply. Show the level locked while the solver checks it.
    this.begin(level, level.par, null, false);
    this.busy = true;
    this.setHint('Checking this level under the test rule…', false);
    const generation = this.generation;
    void this.solver
      .ask<CertifyResult>({ kind: 'certify', board: level.board, state: level.start, maxMoves: level.par + 6, rules: rulesFor(lab), maxVisited: CONFIG.lab.certifyMaxVisited })
      .then((result) => {
        if (generation !== this.generation) return;
        if (result.kind === 'certified') {
          this.begin(level, result.par, result.witness, true);
          this.setHint(`Test rule: shortest solution is ${result.par} moves`, false);
          return;
        }
        this.busy = false;
        this.hud.showCard({
          title: 'Not proven solvable',
          text: result.kind === 'unsolvable' ? 'With the single-file exit rule this level has no solution in a fair number of moves.' : 'The check for the single-file exit rule could not finish for this level.',
          stars: 0,
          primary: { label: 'Levels', action: () => this.show('map') },
          secondary: {
            label: 'Play anyway',
            action: () => {
              this.hud.hideCard();
              this.setHint('Test rule: this level is not proven solvable', true);
            },
          },
        });
      });
  }

  /** Open a board-size test board: playable, but never scored, saved or paid. */
  private startPreview(index: number): void {
    const board = TEST_BOARDS[index];
    this.previewIndex = index;
    this.begin({ ...board, par: CONFIG.lab.previewMoves, witness: [] }, CONFIG.lab.previewMoves, null, false);
    this.preview = true;
    this.setHint(`${board.name} — a size test, not a level`, false);
  }

  private begin(level: GameLevel, par: number, witness: readonly Command[] | null, certified: boolean): void {
    this.show('level');
    this.level = level;
    this.par = par;
    this.witness = witness;
    this.certified = certified;
    this.preview = false;
    this.usedBackup = false;
    this.usedHint = false;
    this.touched = false;
    this.session = new Session(level, { budget: par + this.save.lab.moveSlack, rules: rulesFor(this.save.lab) });
    this.hud.resetCounter();
    this.view.loadLevel(level);
    this.view.resize();
    this.clearScan();
    this.track({ type: 'level_start', level: level.id });
    this.refresh();
  }

  private setHint(text: string, warn: boolean): void {
    this.hint = text;
    this.hintWarn = warn;
    this.refresh();
  }

  private clearScan(): void {
    this.hint = '';
    this.hintWarn = false;
    this.nudge = null;
    this.scanKey = '';
    this.scanResult = null;
  }

  private refresh(): void {
    const colors = new Set<Color>(this.level.start.robots.map((r) => r.color));
    const status = this.session.status;
    this.hud.update({
      levelNumber: this.levelIndex + 1,
      levelLabel: this.preview ? 'TEST' : undefined,
      levelName: this.level.name,
      collected: this.session.collected,
      total: this.session.total,
      movesLeft: this.session.movesLeft,
      canUndo: this.session.commands.length > 0 && !this.replaying && !this.busy,
      canReplay: this.session.commands.length > 0 && !this.replaying && !this.busy,
      canScan: status !== 'won' && !this.replaying && !this.busy,
      inputLocked: this.replaying || this.busy || status !== 'playing',
      colorsInLevel: colors,
      nudge: this.nudge ?? (this.levelIndex === 0 && !this.touched ? 'forward' : null),
      hint: this.hint,
      hintWarn: this.hintWarn,
      hintLabel: this.scanResult?.kind === 'on-route' && this.nudge === null && hintPrice(this.save.lab.freeHelp) > 0 ? String(hintPrice(this.save.lab.freeHelp)) : '',
    });
  }

  private command(command: Command): void {
    if (this.replaying || this.busy) return;
    const result = this.session.apply(command);
    if (!result) return;
    this.touched = true;
    this.clearScan();
    this.refresh();
    this.track({ type: 'command', level: this.level.id, command });
    this.playSounds(command, result.events.map((e) => e.outcome));
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

  private playSounds(command: Command, outcomes: string[]): void {
    if (outcomes.includes('exited')) this.sfx.play('exit');
    else if (outcomes.every((o) => o.startsWith('blocked'))) this.sfx.play('bump');
    else this.sfx.play(command === 'forward' ? 'step' : 'turn');
  }

  /** All animations done: show the outcome if the level ended. */
  private settle(): void {
    const status = this.session.status;
    if (status === 'won') this.onWin();
    else if (status === 'lost') void this.onLost();
  }

  private onWin(): void {
    if (this.preview) {
      this.view.celebrate();
      this.hud.showCard({ title: 'Test board cleared', text: 'This board only shows how the board scales. Nothing was saved.', stars: 0, primary: { label: 'Levels', action: () => this.tap(() => this.show('map')) }, secondary: { label: 'Again', action: () => this.tap(() => this.startPreview(this.previewIndex)) } });
      return;
    }
    const id = this.level.id;
    const moves = this.session.commands.length;
    const stars = starsFor(moves, this.par, this.usedBackup);
    const previous = this.save.best[id];
    if (previous === undefined || previous === 0 || moves < previous) this.save.best[id] = moves;
    const reward = rewardFor(moves, this.par, this.session.budget, this.usedBackup || this.usedHint);
    const earned = payout(reward.total, this.save.paid[id]);
    this.save.paid[id] = Math.max(this.save.paid[id] ?? 0, reward.total);
    this.save.coins += earned;
    this.earnedNow = earned;
    if (earned > 0) this.track({ type: 'coins_earned', level: id, amount: earned, balance: this.save.coins });
    this.persist();
    this.track({ type: 'level_win', level: id, moves, par: this.par, stars, usedBackup: this.usedBackup });
    this.sfx.play('win');
    this.view.celebrate();
    this.refresh();
    const generation = this.generation;
    void wait(this.reduced ? 0.2 : 0.55).then(() => {
      if (generation === this.generation) this.showWin(moves, stars);
    });
  }

  private showWin(moves: number, stars: number): void {
    const last = this.levelIndex === LEVELS.length - 1;
    this.hud.showCard({
      title: 'All home',
      text: `${moves} moves${stars === 3 ? ' · perfect' : ''}${this.usedBackup ? ' · with extra moves' : ''}`,
      stars,
      coins: this.earnedNow > 0 ? `+${this.earnedNow} · ${this.save.coins} in total` : `Best reward already paid · ${this.save.coins} in total`,
      primary: last ? { label: 'Levels', action: () => this.tap(() => this.show('map')) } : { label: 'Next', action: () => this.tap(() => this.startLevel(this.levelIndex + 1)) },
      secondary: { label: 'Replay', action: () => void this.replay() },
    });
  }

  /**
   * Out of moves. Retry is always the main, free way on. Extra moves are
   * offered only when the solver proved they are enough from this exact position.
   */
  private async onLost(): Promise<void> {
    this.sfx.play('fail');
    const generation = this.generation;
    const rescue = await this.solver.ask<RescueResult>({
      kind: 'rescue',
      board: this.level.board,
      state: this.session.state,
      extraMoves: CONFIG.extraMoves,
      rules: this.session.rules,
      maxVisited: CONFIG.scan.maxVisited,
    });
    if (generation !== this.generation || this.session.status !== 'lost') return;
    this.track({ type: 'level_fail', level: this.level.id, rescuable: rescue.kind === 'rescuable' ? 'yes' : rescue.kind === 'hopeless' ? 'no' : 'not-assessed' });
    const offer = rescue.kind === 'rescuable';
    const price = extraMovesPrice(this.save.lab.freeHelp);
    const afford = this.save.coins >= price;
    this.hud.showCard({
      title: 'Out of moves',
      text: `${this.session.total - this.session.collected} still on the board`,
      stars: 0,
      primary: { label: 'Retry', action: () => this.restart() },
      secondary: { label: 'Undo', action: () => this.undo() },
      extra: offer
        ? { label: price > 0 ? `+${CONFIG.extraMoves} moves · ${price} coins` : `+${CONFIG.extraMoves} moves`, action: () => this.useBackup(), disabled: !afford, icon: true }
        : {
            label: 'Hint',
            action: () => {
              this.hud.hideCard();
              void this.scan();
            },
          },
      note: offer
        ? afford
          ? `Checked: this position can be solved with them. You have ${this.save.coins} coins.`
          : `Checked: this position can be solved with them, but you have ${this.save.coins} coins.`
        : rescue.kind === 'hopeless'
          ? 'Extra moves would not solve this position, so they are not offered.'
          : 'Could not check whether extra moves would help, so they are not offered.',
    });
  }

  private useBackup(): void {
    const price = extraMovesPrice(this.save.lab.freeHelp);
    if (this.save.coins < price) return;
    this.save.coins -= price;
    this.persist();
    if (price > 0) this.track({ type: 'coins_spent', level: this.level.id, amount: price, on: 'extra_moves', balance: this.save.coins });
    this.session.grantBonus(CONFIG.extraMoves);
    this.usedBackup = true;
    this.hud.hideCard();
    this.clearScan();
    this.track({ type: 'extra_moves', level: this.level.id, price });
    this.sfx.play('scan');
    this.refresh();
  }

  private undo(): void {
    if (this.replaying || this.busy || !this.session.undo()) return;
    this.generation++;
    this.pending = 0;
    this.hud.hideCard();
    this.clearScan();
    this.sfx.play('tap');
    this.view.sync(this.session.state, true);
    this.refresh();
  }

  private restart(): void {
    if (this.replaying || this.busy) return;
    this.generation++;
    this.pending = 0;
    this.session.restart();
    this.usedBackup = false;
    // usedHint stays: a move that was paid for is still known after a restart.
    this.hud.hideCard();
    this.clearScan();
    this.sfx.play('tap');
    this.view.sync(this.session.state, true);
    this.refresh();
  }

  /**
   * Hint, in two steps. First tap: is this position still on a
   * route, and how far to go (or how many moves to undo). Second tap on the
   * same position: the next move is highlighted.
   */
  private async scan(): Promise<void> {
    if (this.preview) {
      this.setHint('No hints on a test board', false);
      return;
    }
    if (this.replaying || this.busy || this.session.status === 'won') return;
    const key = `${this.session.commands.join(',')}|${this.session.bonusMoves}`;
    if (this.scanKey === key && this.scanResult) {
      if (this.scanResult.kind === 'on-route' && this.nudge === null) {
        // Revealing the move is the paid step; the status before it is free.
        const price = hintPrice(this.save.lab.freeHelp);
        if (this.save.coins < price) {
          this.setHint(`The next move costs ${price} coins. You have ${this.save.coins}.`, true);
          return;
        }
        this.save.coins -= price;
        this.persist();
        if (price > 0) {
          this.usedHint = true;
          this.track({ type: 'coins_spent', level: this.level.id, amount: price, on: 'hint', balance: this.save.coins });
        }
        this.nudge = this.scanResult.next;
        this.track({ type: 'hint', level: this.level.id, result: 'on-route', rung: 2 });
        this.sfx.play('scan');
        this.setHint(`Next: ${COMMAND_LABEL[this.scanResult.next]}`, false);
      }
      return;
    }
    let result: ScanResult;
    const next = this.witness && this.session.bonusMoves === 0 ? witnessNext(this.witness, this.session.commands) : null;
    if (next) result = { kind: 'on-route', next, movesNeeded: this.witness!.length - this.session.commands.length };
    else {
      const generation = this.generation;
      this.busy = true;
      this.setHint('Thinking…', false);
      result = await this.solver.ask<ScanResult>({
        kind: 'scan',
        board: this.level.board,
        states: [...this.session.states],
        totalBudget: this.session.totalBudget,
        rules: this.session.rules,
        maxVisited: CONFIG.scan.maxVisited,
      });
      if (generation !== this.generation) return;
      this.busy = false;
    }
    this.scanKey = key;
    this.scanResult = result;
    this.track({ type: 'hint', level: this.level.id, result: result.kind, rung: 1 });
    this.sfx.play('scan');
    if (result.kind === 'on-route') this.setHint(`Solvable from here · ${result.movesNeeded} to go. Tap Hint again for the next move${hintPrice(this.save.lab.freeHelp) > 0 ? ` (${hintPrice(this.save.lab.freeHelp)} coins)` : ''}.`, false);
    else if (result.kind === 'dead-end') this.setHint(`Dead end. Undo ${result.undo} move${result.undo === 1 ? '' : 's'} to make it solvable again.`, true);
    else this.setHint('The hint could not be worked out for this position.', true);
  }

  /** Play the commands so far again from the start; the session is untouched. */
  private async replay(): Promise<void> {
    if (this.replaying || this.busy || this.session.commands.length === 0) return;
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
      const result = step(level.board, state, command, this.session.rules);
      state = result.state;
      this.hud.flash(command);
      await this.view.play(result.events, 1);
      await wait(CONFIG.anim.replayGap);
    }
    if (generation !== this.generation) return;
    this.view.sync(this.session.state, false);
    this.replaying = false;
    this.refresh();
    const status = this.session.status;
    if (status === 'won') this.showWin(this.session.commands.length, starsFor(this.session.commands.length, this.par, this.usedBackup));
    else if (status === 'lost') void this.onLost();
  }

  /** Read-only snapshot for automated checks. */
  snapshot(): Snapshot {
    return {
      screen: this.screen,
      level: this.levelIndex,
      status: this.session.status,
      movesLeft: this.session.movesLeft,
      budget: this.session.totalBudget,
      collected: this.session.collected,
      total: this.session.total,
      commands: [...this.session.commands],
      replaying: this.replaying,
      hint: this.hint,
      certified: this.certified,
      best: { ...this.save.best },
      coins: this.save.coins,
      kitReady: this.kitReady,
      lab: { ...this.save.lab },
      events: [...this.metrics.events],
    };
  }
}

window.turnflock = new Game();
