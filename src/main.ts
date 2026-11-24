import './ui/style.css';
import './ui/tf-buttons.css';
import './ui/tf-coins.css';
import './ui/tf-levels.css';
import './ui/tf-end.css';
import './ui/tf-settings.css';
import './ui/tf-scene.css';
import './ui/tf-shop.css';
// After the robot theme's sheets, so a theme's rules win over them (design/themes.md).
import { applyPageTheme } from './ui/themes';
import { applyGardenDecor } from './ui/themes/garden/gardenArt';
import { resolveTheme } from './render/themes';
import { AudioHub, Sfx, type PlayedSound } from './audio';
import { movePlan, soundSet } from './sound/sets';
import { CONFIG } from './config';
import type { Color, Command, Robot, RobotEvent } from './engine/types';
import { previewStep, witnessNext, type RescueResult, type ScanResult } from './game/assist';
import { CelebrationRun, planCelebration, type CelebrationPlan, type CelebrationVariant } from './game/celebration';
import { extraMovesPrice, hintPrice, payout, rewardFor, settlePaid, undoQuote, type UndoQuote } from './game/coins';
import type { ThemeId } from './game/theme';
import { applyLab, levelScreenView, rulesFor, usesCertifiedRules, type LabSettings } from './game/lab';
import { emptyLedger, record, type LedgerEntry } from './game/ledger';
import { MemorySink, type MetricsEvent } from './game/metrics';
import { isUnlocked, mainAction, starsFor, starsOfBest } from './game/progress';
import { ECONOMY_VERSION, loadSave, resetProgress, writeSave, type KeyValueStore, type SaveData } from './game/save';
import { Session } from './game/session';
import { configuredPacks, plusOpens, receiptLine, SimulatedProvider, walletAfter, type CoinPack, type PurchaseProvider } from './game/shop';
import { renderInBackground } from './music/background';
import { MusicController, WebAudioMusic } from './music/player';
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
import { improvableLevels } from './ui/levelPath';
import { renderLevels, type MapNode } from './ui/screens';
import { applyColourShapes } from './ui/colourShapes';
import { ledgerPanel } from './ui/ledgerView';
import { labChangedCount, labScreen, playerScreen } from './ui/settingsView';
import { ShopView, type PurchaseReport } from './ui/shopView';

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
  /** The hint picture on the board: what the hinted command will do to each robot. Empty when no hint is shown. */
  hintPicture: Pick<RobotEvent, 'id' | 'turned' | 'outcome' | 'toX' | 'toY' | 'tileTurned'>[];
  /** Where every robot is and which way it faces (0 = north, clockwise), in the logical state. */
  robots: Pick<Robot, 'id' | 'x' | 'y' | 'dir' | 'collected'>[];
  certified: boolean;
  best: Record<string, number>;
  coins: number;
  kitReady: boolean;
  lab: LabSettings;
  /** The active theme and the root element's `data-theme`. */
  theme: { setting: ThemeId; page: string | undefined };
  events: MetricsEvent[];
  /** The test shop sheet is open. */
  shopOpen: boolean;
  /** The test ledger's lines, oldest first. */
  ledger: LedgerEntry[];
  /** The latest sounds asked for, oldest first. */
  sounds: PlayedSound[];
  /** The loudest sample leaving the game at this moment (0–1). */
  soundPeak: number;
  /** Music: the variant that should be heard (null: none), whether a source is sounding, and the audio context's state. */
  music: { playing: string | null; sounding: boolean; context: string };
  /** The latest win's celebration: what was planned, whether its effect still plays and whether the pop-up was asked for. */
  celebration: (CelebrationPlan & { active: boolean; cardShown: boolean }) | null;
}

declare global {
  interface Window {
    /** The running game, exposed for automated checks. */
    turnflock: Game;
  }
}

const wait = (seconds: number): Promise<void> => new Promise((r) => window.setTimeout(r, seconds * 1000));
/** The few words under a hint picture; the picture itself says who turns and who steps where. */
const COMMAND_LABEL: Record<Command, string> = { red: 'Red turns, then all step', blue: 'Blue turns, then all step', yellow: 'Yellow turns, then all step', forward: 'All step forward' };
const LEVEL_IDS = LEVELS.map((l) => l.id);

/** A save whose levels were paid under earlier amounts, brought to today's once (`settlePaid`). Coins are untouched. */
function settled(save: SaveData): SaveData {
  if (save.economy === ECONOMY_VERSION) return save;
  return { ...save, paid: settlePaid(save.paid, save.best, LEVELS), economy: ECONOMY_VERSION };
}

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
/**
 * The decor pictures around the board for a theme: the robot theme's bushes by their `data-art`
 * name, the garden's own picture per place (design/themes/garden-backdrop.md).
 */
function showDecor(theme: ThemeId): void {
  const layer = document.querySelector('.tf-decor-layer');
  if (!layer) return;
  if (theme === 'garden') {
    applyGardenDecor(layer);
    return;
  }
  const art: Record<string, string> = { 'decor-large': decorLarge, 'decor-small': decorSmall, 'decor-clover': decorClover, 'decor-sprig': decorSprig };
  for (const img of Array.from(layer.querySelectorAll<HTMLImageElement>('img[data-art]'))) {
    const src = art[img.dataset.art ?? ''] ?? '';
    if (img.getAttribute('src') !== src) img.src = src;
  }
}

class Game {
  private store = storage();
  private save: SaveData = settled(loadSave(this.store, LEVEL_IDS));
  private metrics = new MemorySink();
  /** One audio context for effects and music. */
  private audio = new AudioHub();
  private sfx = new Sfx(() => this.save.settings.mute, () => this.soundSetId, this.audio);
  private musicOut = new WebAudioMusic(this.audio, renderInBackground);
  private music = new MusicController(this.musicOut, CONFIG.music.screens, { enabled: this.save.settings.music, variant: this.save.lab.music, screen: 'map', visible: !document.hidden });
  private solver = new SolverClient();
  private view = new BoardView(el<HTMLCanvasElement>('board'));
  private hud: Hud;
  private counters: CoinCounters;
  /** True once the asset kit's 3D models are in use. */
  private kitReady = false;
  private screen: ScreenName = 'map';
  /** Page of the level selection on show; null opens the page of the current level. */
  private page: number | null = null;
  /** The level selection shows the completed levels that can still be improved, instead of the path. */
  private improving = false;
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
  /** Undos taken in this attempt; the first `coins.freeUndosPerLevel` of them are free. */
  private undosTaken = 0;
  /** A tools button the hint line points at, ringed like a nudged command. */
  private point: 'undo' | 'restart' | 'scan' | null = null;
  /** Animations still queued; more than one speeds playback up. */
  private pending = 0;
  private chain: Promise<void> = Promise.resolve();
  /** Bumped by undo, restart and screen changes so stale animations and solver answers are dropped. */
  private generation = 0;
  /** The celebration of the latest win, from the last robot's exit until its effect has ended. */
  private run: CelebrationRun | null = null;
  private replaying = false;
  private busy = false;
  private touched = false;
  private hint = '';
  private hintWarn = false;
  private nudge: Command | null = null;
  /** What the hinted command will do, as drawn on the board. */
  private hintPicture: readonly RobotEvent[] = [];
  private scanKey = '';
  private scanResult: ScanResult | null = null;
  /** The button that opened the coin explainer; focus returns to it. */
  private coinInfoOpener: HTMLElement | null = null;
  /** The settings screen is being opened from the test lab. */
  private fromLab = false;
  /**
   * The purchase layer. The game only knows the interface; this build has the simulated provider alone,
   * which charges nothing and makes no request. Its outcome is the test lab's switch.
   */
  private provider: PurchaseProvider = new SimulatedProvider(configuredPacks(), {
    outcome: () => this.save.lab.purchaseOutcome,
    delay: (ms) => wait((this.reduced ? ms / 2 : ms) / 1000),
    processingMs: CONFIG.shop.processingMs,
  });
  private shop: ShopView;
  /** The wallet just fell short of a price on the puzzle screen: the hint line carries the "Get coins" link. */
  private offerCoins = false;
  /** What the solver said about the lost position on show, so its pop-up can be redrawn after a visit to the shop. */
  private lastRescue: RescueResult | null = null;

  constructor() {
    this.hud = new Hud(
      {
        command: (c) => this.command(c),
        refused: () => this.sfx.play('deny'),
        undo: () => this.undo(),
        restart: () => this.restart(),
        scan: () => void this.scan(),
        back: () => this.show('map'),
        getCoins: (opener) => this.tap(() => this.openCoins(opener)),
      },
      // Keys play the level only while nothing lies over it.
      () => this.screen === 'level' && !this.shop.isOpen && el('coinInfo').hidden === true,
    );
    this.shop = new ShopView(el('app'), {
      buy: (pack) => this.buyPack(pack),
      tap: () => this.sfx.play('tap'),
      closed: () => this.onShopClosed(),
    });
    this.counters = new CoinCounters([el('mapCoins'), el('levelCoins'), this.shop.balanceHost], () => this.reduced, (button) => this.tap(() => this.openCoins(button)));
    this.hud.onCardHidden = () => this.counters.settle();
    el('coinInfoBody').innerHTML = coinInfo('coinInfoTitle');
    el('coinInfoClose').addEventListener('click', () => this.tap(() => this.closeCoinInfo()));
    el('coinInfo').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeCoinInfo();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCoinInfo();
      this.run?.skip();
    });
    // A tap anywhere ends the celebration and brings the pop-up at once; the tap still does what it was aimed at.
    window.addEventListener('pointerdown', () => this.run?.skip(), true);
    el('toSettings').addEventListener('click', () => this.tap(() => this.show('settings')));
    new ResizeObserver(() => this.view.resize()).observe(document.querySelector('.stage') as HTMLElement);
    // Kit artwork: images are bundled; the page sets them in applySettings (per theme) so one build works from any folder.
    this.listenForSound();
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

  /**
   * Music may start at the player's first touch or key (browsers allow no sound before it), and all
   * sound stops while the page is in the background.
   */
  private listenForSound(): void {
    const touched = (): void => {
      this.music.unlock();
      // Some phones only accept the release of a touch, not its start: try again on each until sound runs.
      if (!document.hidden && this.music.playing) this.audio.resume();
    };
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) window.addEventListener(type, touched, { capture: true, passive: true });
    const seen = (visible: boolean): void => {
      this.music.set({ visible });
      if (visible) this.audio.resume();
      // The short fade-out gets its moment before the audio work is paused.
      else setTimeout(() => document.hidden && this.audio.suspend(), CONFIG.music.backgroundPauseMs);
    };
    document.addEventListener('visibilitychange', () => seen(!document.hidden));
    window.addEventListener('pagehide', () => seen(false));
    window.addEventListener('pageshow', () => seen(!document.hidden));
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

  /** The plus button and every "Get coins" link: the test shop, or with the shop switched off the explainer. */
  private openCoins(opener: HTMLElement): void {
    if (plusOpens(this.save.lab) === 'explainer') return this.openCoinInfo(opener);
    this.counters.settle();
    void this.provider.listPacks().then((packs) => this.shop.open(packs, opener));
  }

  /** One line of the test ledger, stamped with the time and the wallet as it is now. */
  private log(kind: LedgerEntry['kind'], item: string, coins: number): void {
    record(this.save.ledger, { at: Date.now(), kind, item, coins, balance: this.save.coins }, CONFIG.shop.ledgerMax);
  }

  /** A pack was confirmed in the shop: ask the purchase layer, and only on success add the coins. */
  private async buyPack(pack: CoinPack): Promise<PurchaseReport> {
    const result = await this.provider.buy(pack.id);
    const before = this.save.coins;
    this.save.coins = walletAfter(before, result);
    if (result.status === 'success') {
      this.log('bought', result.pack.id, result.pack.coins);
      this.persist();
      this.sfx.play('coin');
      // The shortage is over: the warning and its link go, and a hint that was being asked for is pointed at again.
      if (this.offerCoins) {
        this.offerCoins = false;
        this.hint = '';
        this.hintWarn = false;
        this.point = this.scanResult?.kind === 'on-route' && this.nudge === null ? 'scan' : null;
      }
    } else this.sfx.play('deny');
    this.track({ type: 'purchase', pack: pack.id, result: result.status, coins: this.save.coins - before, balance: this.save.coins });
    if (this.screen === 'level') this.refresh();
    else this.counters.set(this.save.coins);
    return { result, line: receiptLine(result, this.save.coins) };
  }

  /** Back from the shop: everything is as it was, and prices on show are judged against the wallet as it is now. */
  private onShopClosed(): void {
    if (this.screen !== 'level') return;
    if (this.session.status === 'lost' && !el('card').hidden && this.lastRescue) this.showLost(this.lastRescue, false);
    this.refresh();
  }

  /** The sound set that plays: the theme's own when it has one, else the one chosen in the test lab. */
  private get soundSetId(): string {
    return resolveTheme(this.save.settings.theme).soundSet ?? this.save.lab.soundSet;
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
    this.counters.setPlusLabel(plusOpens(this.save.lab) === 'shop' ? 'Get coins, test shop' : 'About coins');
    this.music.set({ enabled: this.save.settings.music, variant: this.save.lab.music });
    applyColourShapes(this.save.settings.colourShapes);
    this.view.setColourShapes(this.save.settings.colourShapes);
    // A theme switch rebuilds the board on show; no reload.
    const theme = resolveTheme(this.save.settings.theme);
    applyPageTheme(theme);
    showDecor(theme.id);
    this.view.setTheme(theme, this.session.state);
  }

  // ---------------------------------------------------------------- screens

  private show(screen: ScreenName): void {
    this.generation++;
    this.run?.cancel();
    this.pending = 0;
    this.replaying = false;
    this.busy = false;
    this.screen = screen;
    this.music.set({ screen });
    for (const name of ['map', 'level', 'settings', 'lab'] as const) el(name).hidden = name !== screen;
    this.hud.hideCard();
    this.closeCoinInfo();
    this.shop.close();
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
    const stars = nodes.map((n) => n.stars);
    // In their own list none of them is "the" target: every tile there is equally worth a replay.
    // With every level completed the player chooses any level to play again; before that only the ones with stars left to earn.
    const replayAll = main.kind !== 'play';
    const improvable = (replayAll ? nodes.map((_, index) => index) : improvableLevels(stars)).map((index) => ({ ...nodes[index], target: false }));
    const base = levelScreenView(this.save.lab);
    // Nothing left to improve, or the test grid is on: the list of levels to improve has no place.
    if (base === 'grid' || improvable.length === 0) this.improving = false;
    const view = this.improving ? 'improve' : base;
    if (view === 'improve') this.page = Math.min(this.page, Math.ceil(improvable.length / pageSize) - 1);
    const toggleImprove = (): void => {
      this.improving = !this.improving;
      this.page = this.improving ? 0 : null;
      this.drawMap();
    };
    // The path only knows "the level to play now". With everything completed it shows that state; what is left is improving, or playing again when the config asks for it.
    const complete = main.kind !== 'play';
    let playLabel: string | null;
    let action: () => void;
    if (view === 'improve') {
      playLabel = complete ? 'Back' : `Back to level ${main.index + 1}`;
      action = toggleImprove;
    } else if (view === 'path' && complete) {
      playLabel = 'Choose a level';
      action = toggleImprove;
    } else {
      playLabel = main.kind === 'play' ? `Play level ${main.index + 1}` : main.kind === 'improve' ? `Improve level ${main.index + 1}` : 'Play again';
      action = () => this.startLevel(main.index);
    }
    el('continue').onclick = () => this.tap(action);
    renderLevels({
      view,
      nodes,
      improvable,
      replayAll,
      current: complete ? null : main.index,
      ahead: CONFIG.levelsAhead,
      layout: CONFIG.levelPath.layout,
      page: this.page,
      pageSize,
      playLabel,
      playIcon: view === 'improve' ? 'back' : 'play',
      gridNote: view === 'improve' ? (replayAll ? 'Play a level again' : 'Improve your stars') : this.save.lab.unlockAll ? 'Test view · all levels unlocked' : 'Test view · grid',
      onPick: (index) => this.tap(() => this.startLevel(index)),
      onImprove: () => this.tap(toggleImprove),
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
      labChanged: labChangedCount(this.save.lab),
      setMute: (mute) => change(() => (this.save.settings.mute = mute)),
      music: this.save.settings.music,
      setMusic: (on) => change(() => (this.save.settings.music = on)),
      setReduceMotion: (value) => change(() => (this.save.settings.reduceMotion = value)),
      theme: this.save.settings.theme,
      setTheme: (theme) => change(() => (this.save.settings.theme = theme)),
      colourShapes: this.save.settings.colourShapes,
      setColourShapes: (on) => change(() => (this.save.settings.colourShapes = on)),
      resetProgress: () =>
        change(() => {
          const before = this.save.coins;
          this.save = resetProgress(this.save);
          this.log('set', 'balance', this.save.coins - before);
        }),
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
      panels: [
        ledgerPanel({
          balance: () => this.save.coins,
          ledger: () => this.save.ledger,
          levelNames: Object.fromEntries(LEVEL_IDS.map((id, index) => [id, `level ${index + 1}`])),
          clear: () => {
            this.save.ledger = emptyLedger();
            this.persist();
            this.sfx.play('tap');
          },
          setBalance: (coins) => {
            const before = this.save.coins;
            this.save.coins = coins;
            this.log('set', 'balance', coins - before);
            this.persist();
            this.counters.set(coins);
            this.sfx.play('tap');
          },
        }),
      ],
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
    this.undosTaken = 0;
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
    this.point = null;
    this.offerCoins = false;
    this.hintPicture = [];
    this.view.showHint(null);
    this.scanKey = '';
    this.scanResult = null;
  }

  private refresh(): void {
    const colors = new Set<Color>(this.level.start.robots.map((r) => r.color));
    const status = this.session.status;
    const price = hintPrice(this.save.lab.freeHelp);
    const undo = this.undoOffer();
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
      canScan: status !== 'won' && !this.replaying && !this.busy,
      inputLocked: this.replaying || this.busy || status !== 'playing',
      colorsInLevel: colors,
      nudge: this.nudge ?? (this.levelIndex === 0 && !this.touched ? 'forward' : null),
      hint: this.hint,
      hintWarn: this.hintWarn,
      hintCost: price,
      hintState: revealed ? 'used' : price === 0 ? 'free' : this.save.coins < price ? 'short' : 'ok',
      undoCost: undo.cost,
      undoState: undo.state,
      point: this.point,
      getCoins: this.offerCoins && plusOpens(this.save.lab) === 'shop',
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
    // The button answers at the touch; with a `motion` set the turn and the step sound when the robots make them.
    const sounds = movePlan(command, result.events.map((e) => e.outcome), result.events.some((e) => e.turned), soundSet(this.soundSetId).timing);
    for (const name of sounds.tap) this.sfx.play(name);
    const generation = this.generation;
    this.pending++;
    this.chain = this.chain.then(async () => {
      if (generation !== this.generation) return;
      const speed = 1 + (this.pending - 1) * CONFIG.anim.queueSpeedup;
      await this.view.play(result.events, speed, (beat) => sounds[beat].forEach((name) => this.sfx.play(name)));
      if (generation !== this.generation) return;
      this.pending--;
      if (this.pending === 0) this.settle();
    });
  }

  /** All animations done: show the outcome if the level ended. */
  private settle(): void {
    const status = this.session.status;
    if (status === 'won') this.onWin();
    else if (status === 'lost') void this.onLost();
  }

  private onWin(): void {
    if (this.preview) {
      this.celebrate(1, () =>
        this.hud.showCard(
          {
            kind: 'info',
            title: 'Test board cleared',
            text: 'This board only shows how the board scales. Nothing was saved.',
            levels: () => this.tap(() => this.show('map')),
            second: { label: 'Again', action: () => this.tap(() => this.startPreview(this.previewIndex)) },
          },
          !this.reduced,
        ),
      );
      return;
    }
    const id = this.level.id;
    const moves = this.session.commands.length;
    const stars = starsFor(moves, this.par, this.usedBackup);
    const previous = this.save.best[id];
    if (previous === undefined || previous === 0 || moves < previous) this.save.best[id] = moves;
    const reward = rewardFor(moves, this.par, this.session.budget, { hint: this.usedHint, extraMoves: this.usedBackup });
    const earned = payout(reward.total, this.save.paid[id]);
    this.save.paid[id] = Math.max(this.save.paid[id] ?? 0, reward.total);
    this.save.coins += earned;
    // Saved below, before anything moves; the counter only shows it once the pop-up's coins have flown over (B6).
    if (earned > 0) this.counters.hold(this.save.coins);
    this.lastReward = { reward, spare: Math.max(0, this.session.budget - moves), earned, balance: this.save.coins, helped: this.usedBackup || this.usedHint };
    if (earned > 0) {
      this.track({ type: 'coins_earned', level: id, amount: earned, balance: this.save.coins });
      this.log('earned', id, earned);
    }
    this.persist();
    this.track({ type: 'level_win', level: id, moves, par: this.par, stars, usedBackup: this.usedBackup });
    this.refresh();
    this.celebrate(stars, () => this.showWin(moves, stars));
  }

  /**
   * The moment between the last robot's exit and the pop-up: the celebration chosen in the test
   * lab plays on the board, `showCard` brings the pop-up while it plays on, and a tap skips it.
   * Everything the win earned is saved before this starts, so skipping or leaving loses nothing.
   */
  private celebrate(stars: 1 | 2 | 3, showCard: () => void): void {
    this.run?.cancel();
    const plan = planCelebration({ variant: this.save.lab.celebration, stars, reduced: this.reduced, muted: this.save.settings.mute });
    const generation = this.generation;
    this.run = new CelebrationRun(
      plan,
      {
        start: (p) => {
          if (p.sound) this.sfx.play(p.sound);
          this.view.celebrate(p);
        },
        stop: () => this.view.stopCelebration(),
        showCard: () => {
          if (generation === this.generation) showCard();
        },
      },
      (seconds, fn) => {
        const id = window.setTimeout(fn, seconds * 1000);
        return () => window.clearTimeout(id);
      },
    );
    this.run.begin();
  }

  /**
   * For checks and for looking: play a celebration on the board on show without winning anything.
   * Returns what was played. The board is put back as the level stands when it ends.
   */
  showCelebration(variant: CelebrationVariant, stars: 1 | 2 | 3 = 3, reduced = this.reduced): CelebrationPlan {
    const plan = planCelebration({ variant, stars, reduced, muted: true });
    this.view.sync(this.session.state, false);
    this.view.celebrate(plan);
    const generation = this.generation;
    void wait(plan.seconds + 0.05).then(() => {
      if (generation === this.generation && !this.view.celebrating) this.view.sync(this.session.state, false);
    });
    return plan;
  }

  /** What the board's last frame cost to draw. For measuring. */
  drawCost(): { calls: number; triangles: number } {
    return this.view.drawCost;
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
    this.lastRescue = rescue;
    this.showLost(rescue, !this.reduced);
  }

  /** The out-of-moves pop-up for a checked position, with every price judged against the wallet as it is now. */
  private showLost(rescue: RescueResult, animate: boolean): void {
    const offer = rescue.kind === 'rescuable';
    const price = extraMovesPrice(this.save.lab.freeHelp);
    const afford = this.save.coins >= price;
    const undoPrice = this.undoOffer();
    const short = (offer && price > 0 && !afford) || undoPrice.state === 'short';
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
            ? 'Extra moves would not solve it from here, so there is no offer. Retry is free.'
            : 'We could not check in time whether extra moves would help, so there is no offer. Retry is free.',
        undo: () => this.undo(),
        undoPrice,
        retry: () => this.restart(),
        hint: offer ? undefined : hint,
        // Short of coins: the shop is one quiet link under the free Retry. It opens over the pop-up and returns to it.
        getCoins: short && plusOpens(this.save.lab) === 'shop' ? () => this.tap(() => this.openCoins(el('end-getcoins'))) : undefined,
      },
      animate,
    );
  }

  private useBackup(): void {
    const price = extraMovesPrice(this.save.lab.freeHelp);
    if (this.save.coins < price) {
      // The offer stays tappable when it is too expensive; the counter answers.
      this.counters.short();
      this.sfx.play('deny');
      return;
    }
    this.save.coins -= price;
    if (price > 0) this.log('spent', 'extra_moves', -price);
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

  /** What the next Undo costs now. A board-size test board is never paid for. */
  private undoOffer(): UndoQuote {
    return undoQuote(this.save.coins, this.save.lab.freeHelp || this.preview, this.undosTaken);
  }

  /**
   * Take back one command. It costs `coins.undoCost` per step (finding B4);
   * Restart stays free, so a player without coins is never stuck.
   */
  private undo(): void {
    if (this.replaying || this.busy || this.session.commands.length === 0) return;
    const offer = this.undoOffer();
    if (offer.state === 'short') {
      // Refused: the counter shakes, a few words say why, and the free way out is ringed.
      this.counters.short();
      this.sfx.play('deny');
      this.track({ type: 'undo', level: this.level.id, price: offer.cost, refused: true });
      this.clearScan();
      this.point = 'restart';
      this.offerCoins = true;
      this.setHint(`Undo costs ${offer.cost} coins. Restart is free.`, true);
      return;
    }
    this.session.undo();
    this.undosTaken++;
    if (offer.cost > 0) {
      this.save.coins -= offer.cost;
      this.log('spent', 'undo', -offer.cost);
      this.persist();
      this.track({ type: 'coins_spent', level: this.level.id, amount: offer.cost, on: 'undo', balance: this.save.coins });
    }
    this.track({ type: 'undo', level: this.level.id, price: offer.cost, refused: false });
    this.generation++;
    this.run?.cancel();
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
    this.run?.cancel();
    this.pending = 0;
    this.session.restart();
    this.usedBackup = false;
    this.undosTaken = 0;
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
          this.offerCoins = true;
          this.setHint('Not enough coins for the next move.', true);
          return;
        }
        this.save.coins -= price;
        if (price > 0) this.log('spent', 'hint', -price);
        this.persist();
        if (price > 0) {
          this.usedHint = true;
          this.track({ type: 'coins_spent', level: this.level.id, amount: price, on: 'hint', balance: this.save.coins });
        }
        this.nudge = this.scanResult.next;
        this.point = null;
        // The picture comes from the engine's own step on the current state, so it shows exactly what the move will do.
        this.hintPicture = previewStep(this.level.board, this.session.state, this.nudge, this.session.rules);
        this.view.showHint(this.hintPicture);
        this.track({ type: 'hint', level: this.level.id, result: 'on-route', rung: 2 });
        this.sfx.play('scan');
        this.setHint(COMMAND_LABEL[this.scanResult.next], false);
      }
      return;
    }
    let result: ScanResult;
    const next = this.witness && this.session.bonusMoves === 0 ? witnessNext(this.witness, this.session.commands) : null;
    if (next) result = { kind: 'on-route', next, movesNeeded: this.witness!.length - this.session.commands.length };
    else {
      const generation = this.generation;
      this.busy = true;
      this.setHint('Checking…', false);
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
    if (result.kind === 'on-route') {
      // The Hint button is ringed with its price on it: the second tap shows the move.
      this.point = 'scan';
      this.setHint(`You can still win: ${result.movesNeeded} to go`, false);
    } else if (result.kind === 'dead-end') {
      // When only the start is still winnable, Restart gets there for free.
      const toStart = result.undo >= this.session.commands.length;
      this.point = toStart ? 'restart' : 'undo';
      this.setHint(toStart ? 'No win from here. Restart to try again.' : `No win from here. Undo ${result.undo} or Restart.`, true);
    } else this.setHint('Could not check this one in time.', true);
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
      hintPicture: this.hintPicture.map(({ id, turned, outcome, toX, toY, tileTurned }) => ({ id, turned, outcome, toX, toY, tileTurned })),
      robots: this.session.state.robots.map(({ id, x, y, dir, collected }) => ({ id, x, y, dir, collected })),
      certified: this.certified,
      best: { ...this.save.best },
      coins: this.save.coins,
      kitReady: this.kitReady,
      lab: { ...this.save.lab },
      theme: { setting: this.save.settings.theme, page: document.documentElement.dataset.theme },
      events: [...this.metrics.events],
      shopOpen: this.shop.isOpen,
      ledger: [...this.save.ledger.entries],
      sounds: [...this.sfx.played],
      soundPeak: this.sfx.peak(),
      music: { playing: this.music.playing, sounding: this.musicOut.sounding, context: this.audio.state },
      celebration: this.run ? { ...this.run.plan, active: this.run.active, cardShown: this.run.cardShown } : null,
    };
  }
}

window.turnflock = new Game();
