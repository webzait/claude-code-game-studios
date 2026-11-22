import './ui/style.css';
import './ui/tf-buttons.css';
import './ui/tf-coins.css';
import './ui/tf-levels.css';
import './ui/tf-end.css';
import './ui/tf-settings.css';
import './ui/tf-scene.css';
import { Sfx } from './audio';
import { deviceVibrate, Haptics } from './haptics';
import { CONFIG } from './config';
import { step } from './engine/engine';
import type { Color, Command } from './engine/types';
import { witnessNext, type RescueResult, type ScanResult } from './game/assist';
import { extraMovesPrice, hintPrice, payout, rewardFor } from './game/coins';
import { applyLab, rulesFor, usesCertifiedRules, type LabSettings } from './game/lab';
import { MemorySink, type MetricsEvent } from './game/metrics';
import { isUnlocked, mainAction, starsFor, starsOfBest } from './game/progress';
import { loadSave, resetProgress, writeSave, type KeyValueStore, type SaveData } from './game/save';
import { Session } from './game/session';
import { LEVELS, TEST_BOARDS, type GameLevel } from './levels/index';
import { BoardView } from './render/boardView';
import { loadKit } from './render/kit';
import decorLarge from '../assets/turnflock/decor/decor-bush-large.webp';
import decorSmall from '../assets/turnflock/decor/decor-bush-small.webp';
import decorClover from '../assets/turnflock/decor/decor-tuft-clover.webp';
import decorSprig from '../assets/turnflock/decor/decor-sprig-top.webp';
import { SolverClient } from './solver/client';
import type { CertifyResult } from './solver/requests';
import { CoinCounters, coinInfo, type RewardView } from './ui/coins';
import { el, Hud } from './ui/hud';
import { setupLogo } from './ui/logo';
import { renderLevels, type MapNode } from './ui/screens';
import { labChangedCount, labScreen, playerScreen } from './ui/settingsView';

type ScreenName = 'map' | 'level' | 'settings' | 'lab';

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
  private haptics = new Haptics(() => this.save.settings.vibration, deviceVibrate(window.navigator));
  private solver = new SolverClient();
  private view = new BoardView(el<HTMLCanvasElement>('board'));
  private hud: Hud;
  private counters: CoinCounters;
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
  /** The latest win's reward, as shown on the result card. */
  private lastReward: RewardView | null = null;
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
  /** The button that opened the coin explainer; focus returns to it. */
  private coinInfoOpener: HTMLElement | null = null;
  /** The settings screen is being opened from the test lab. */
  private fromLab = false;

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
    this.counters = new CoinCounters([el('mapCoins'), el('levelCoins')], () => this.reduced, (button) => this.tap(() => this.openCoinInfo(button)));
    this.hud.onCardHidden = () => this.counters.settle();
    el('coinInfoBody').innerHTML = coinInfo('coinInfoTitle');
    el('coinInfoClose').addEventListener('click', () => this.tap(() => this.closeCoinInfo()));
    el('coinInfo').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeCoinInfo();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCoinInfo();
    });
    el('toSettings').addEventListener('click', () => this.tap(() => this.show('settings')));
    new ResizeObserver(() => this.view.resize()).observe(document.querySelector('.stage') as HTMLElement);
    // Kit artwork: images are bundled; the page sets them here so one build works from any folder.
    for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('img[data-art]'))) {
      const art: Record<string, string> = { 'decor-large': decorLarge, 'decor-small': decorSmall, 'decor-clover': decorClover, 'decor-sprig': decorSprig };
      img.src = art[img.dataset.art ?? ''] ?? '';
    }
    this.applySettings();
    setupLogo(el('map'), CONFIG.logo, { reducedMotion: this.reduced });
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

  /** The plus button: there is no shop, so it explains what coins are and what they cost. */
  private openCoinInfo(opener: HTMLElement): void {
    this.coinInfoOpener = opener;
    el('coinInfo').hidden = false;
    el('coinInfoClose').focus();
  }

  private closeCoinInfo(): void {
    if (el('coinInfo').hidden) return;
    el('coinInfo').hidden = true;
    this.coinInfoOpener?.focus();
    this.coinInfoOpener = null;
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
    for (const name of ['map', 'level', 'settings', 'lab'] as const) el(name).hidden = name !== screen;
    this.hud.hideCard();
    this.closeCoinInfo();
    this.view.skip();
    this.counters.set(this.save.coins);
    if (screen === 'map') {
      this.page = null;
      this.drawMap();
    }
    if (screen === 'settings') this.drawSettings();
    if (screen === 'lab') this.drawLab();
  }

  private drawMap(): void {
    const best = this.save.best;
    const main = mainAction(LEVELS, best);
    const nodes: MapNode[] = LEVELS.map((level, index) => ({
      number: index + 1,
      name: level.name,
      unlocked: isUnlocked(LEVEL_IDS, best, index, this.save.lab.unlockAll),
      solved: best[level.id] !== undefined,
      stars: starsOfBest(best[level.id], level.par),
      target: index === main.index,
    }));
    const pageSize = CONFIG.levelsPerPage;
    // The screen opens on the page of the level the main button points at.
    this.page ??= Math.floor(main.index / pageSize);
    el('continue').onclick = () => this.tap(() => this.startLevel(main.index));
    renderLevels({
      nodes,
      page: this.page,
      pageSize,
      playLabel: main.kind === 'play' ? `Play level ${main.index + 1}` : main.kind === 'improve' ? `Improve level ${main.index + 1}` : 'Play again',
      onPick: (index) => this.tap(() => this.startLevel(index)),
      onPage: (page) => {
        this.page = page;
        this.tap(() => this.drawMap());
      },
    });
  }

  /** The player's own settings. The controls keep their own state, so a change only saves and applies. */
  private drawSettings(): void {
    const change = (apply: () => void): void => {
      apply();
      this.persist();
      this.applySettings();
      this.sfx.play('tap');
    };
    const screen = playerScreen({
      mute: this.save.settings.mute,
      reduceMotion: this.save.settings.reduceMotion,
      vibration: this.save.settings.vibration,
      canVibrate: this.haptics.supported,
      labChanged: labChangedCount(this.save.lab),
      setMute: (mute) => change(() => (this.save.settings.mute = mute)),
      setReduceMotion: (value) => change(() => (this.save.settings.reduceMotion = value)),
      setVibration: (on) =>
        change(() => {
          this.save.settings.vibration = on;
          this.haptics.play('move');
        }),
      resetProgress: () => change(() => (this.save = resetProgress(this.save))),
      back: () => this.tap(() => this.show('map')),
      openLab: () => this.tap(() => this.show('lab')),
    });
    el('settings').replaceChildren(screen.root);
    // Coming back from the lab, keyboard focus returns to the row that led there.
    if (this.fromLab) screen.entry.focus();
    this.fromLab = false;
  }

  /** The test lab, on a screen of its own behind the entry at the bottom of the settings. */
  private drawLab(): void {
    const screen = labScreen(this.save.lab, {
      boards: TEST_BOARDS.map((b) => `${b.board.width}×${b.board.height}`),
      openBoard: (index) => this.tap(() => this.startPreview(index)),
      onChange: (lab) => {
        this.save.lab = lab;
        this.persist();
        this.applySettings();
        this.sfx.play('tap');
      },
      back: () =>
        this.tap(() => {
          this.fromLab = true;
          this.show('settings');
        }),
    });
    el('lab').replaceChildren(screen.root);
    screen.back.focus();
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
        this.hud.showCard(
          {
            kind: 'info',
            title: 'Not proven solvable',
            text: result.kind === 'unsolvable' ? 'With the single-file exit rule this level has no solution in a fair number of moves.' : 'The check for the single-file exit rule could not finish for this level.',
            levels: () => this.tap(() => this.show('map')),
            second: {
              label: 'Play anyway',
              action: () => {
                this.hud.hideCard();
                this.setHint('Test rule: this level is not proven solvable', true);
              },
            },
          },
          !this.reduced,
        );
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
    const price = hintPrice(this.save.lab.freeHelp);
    const revealed = this.scanResult?.kind === 'on-route' && this.nudge !== null;
    this.counters.set(this.save.coins);
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
      hintCost: price,
      hintState: revealed ? 'used' : price === 0 ? 'free' : this.save.coins < price ? 'short' : 'ok',
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
    this.haptics.play('move');
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
      this.hud.showCard(
        {
          kind: 'info',
          title: 'Test board cleared',
          text: 'This board only shows how the board scales. Nothing was saved.',
          levels: () => this.tap(() => this.show('map')),
          second: { label: 'Again', action: () => this.tap(() => this.startPreview(this.previewIndex)) },
        },
        !this.reduced,
      );
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
    // Saved below, before anything moves; the counter only shows it once the pop-up's coins have flown over (B6).
    if (earned > 0) this.counters.hold(this.save.coins);
    this.lastReward = { reward, spare: Math.max(0, this.session.budget - moves), earned, balance: this.save.coins, helped: this.usedBackup || this.usedHint };
    if (earned > 0) this.track({ type: 'coins_earned', level: id, amount: earned, balance: this.save.coins });
    this.persist();
    this.track({ type: 'level_win', level: id, moves, par: this.par, stars, usedBackup: this.usedBackup });
    this.sfx.play('win');
    this.haptics.play('win');
    this.view.celebrate();
    this.refresh();
    const generation = this.generation;
    void wait(this.reduced ? 0.2 : 0.55).then(() => {
      if (generation === this.generation) this.showWin(moves, stars);
    });
  }

  private showWin(moves: number, stars: 1 | 2 | 3): void {
    if (!this.lastReward) return;
    this.hud.showCard(
      {
        kind: 'win',
        stars,
        moves,
        par: this.par,
        backup: this.usedBackup,
        last: this.levelIndex === LEVELS.length - 1,
        reward: this.lastReward,
        next: () => this.tap(() => this.startLevel(this.levelIndex + 1)),
        retry: () => this.restart(),
        levels: () => this.tap(() => this.show('map')),
      },
      !this.reduced,
    );
    this.counters.pour(el('cardBody').querySelector<HTMLElement>('.tf-coin-total .tf-coin-ico'), () => this.sfx.play('coin'));
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
    const hint = (): void => {
      this.hud.hideCard();
      void this.scan();
    };
    this.hud.showCard(
      {
        kind: 'lost',
        offer: offer ? { price, state: price === 0 ? 'free' : afford ? 'ok' : 'short', coins: this.save.coins, take: () => this.useBackup() } : undefined,
        note: offer
          ? undefined
          : rescue.kind === 'hopeless'
            ? 'Extra moves would not solve it from here, so there is no offer. Undo and Retry are free.'
            : 'We could not check in time whether extra moves would help, so there is no offer. Undo and Retry are free.',
        undo: () => this.undo(),
        retry: () => this.restart(),
        hint: offer ? undefined : hint,
      },
      !this.reduced,
    );
  }

  private useBackup(): void {
    const price = extraMovesPrice(this.save.lab.freeHelp);
    if (this.save.coins < price) {
      // The offer stays tappable when it is too expensive; the counter answers.
      this.counters.short();
      this.sfx.play('bump');
      return;
    }
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
          this.counters.short();
          this.setHint(`That costs ${price} coins. You have ${this.save.coins}.`, true);
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
