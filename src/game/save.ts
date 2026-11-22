import { CONFIG } from '../config';
import { HEADING_STYLES, type HeadingStyle } from '../render/heading';
import { DEFAULT_LAB, type LabSettings } from './lab';
import { emptyLedger, readLedger, type Ledger } from './ledger';
import { PURCHASE_OUTCOMES, type PurchaseOutcome } from './shop';

/** Current save format. Raise it and extend `migrate` when the shape changes. */
export const SAVE_VERSION = 6;
/** Storage key of the current format. */
export const SAVE_KEY = 'turnflock.save';
/** Storage key of the first prototype's format (version 1). */
export const LEGACY_KEY = 'turnflock.progress.v1';

/** Everything kept between visits. */
export interface SaveData {
  version: number;
  /** Best move count per solved level id. */
  best: Record<string, number>;
  /** Coins in the wallet. */
  coins: number;
  /** Coins each level has already paid out, by level id. */
  paid: Record<string, number>;
  settings: {
    mute: boolean;
    /** null follows the device's reduced-motion preference. */
    reduceMotion: boolean | null;
    /** A shape on each robot colour and its button, for players who cannot tell the colours apart. */
    colourShapes: boolean;
  };
  lab: LabSettings;
  /** The test ledger: pretend purchases, rewards and spends, with running totals. */
  ledger: Ledger;
}

/** The minimal storage the save needs; `localStorage` fits, and tests pass a plain object. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A fresh save. */
export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, best: {}, coins: CONFIG.coins.start, paid: {}, settings: { mute: false, reduceMotion: null, colourShapes: false }, lab: { ...DEFAULT_LAB }, ledger: emptyLedger() };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring any stored value to the current format. Version 1 stored solved level
 * positions; they are mapped to ids through `save.v1LevelOrder` in the config. Unknown or damaged
 * data gives a fresh save rather than an error.
 */
export function migrate(raw: unknown, levelIds: readonly string[]): SaveData {
  const save = defaultSave();
  if (!isRecord(raw)) return save;
  if (raw.version === undefined && Array.isArray(raw.solved)) {
    // Version 1: { solved: number[], level: number }. Best scores were not kept; record par-unknown wins as 0.
    for (const index of raw.solved) {
      // Positions meant the level order of that time, kept in config; today's order is a different one.
      const id = typeof index === 'number' ? CONFIG.save.v1LevelOrder[index] : undefined;
      if (id && levelIds.includes(id)) save.best[id] = 0;
    }
    return save;
  }
  // Version 2 had no coins: the player keeps progress and starts with the opening balance.
  // Versions 3 and 4 differ only in a vibration setting that the game no longer has: a stored one is ignored.
  // Version 4 had no colour shapes: everything is kept and the shapes start switched off.
  // Version 5 had no test shop and no ledger: everything is kept, the ledger starts empty and the shop switches take their defaults.
  const withCoins = raw.version === SAVE_VERSION || raw.version === 5 || raw.version === 4 || raw.version === 3;
  if (!withCoins && raw.version !== 2) return save;
  if (isRecord(raw.best)) {
    for (const [id, moves] of Object.entries(raw.best)) {
      if (levelIds.includes(id) && typeof moves === 'number' && moves >= 0) save.best[id] = moves;
    }
  }
  if (withCoins) {
    if (typeof raw.coins === 'number' && raw.coins >= 0) save.coins = Math.floor(raw.coins);
    if (isRecord(raw.paid)) {
      for (const [id, amount] of Object.entries(raw.paid)) {
        if (levelIds.includes(id) && typeof amount === 'number' && amount >= 0) save.paid[id] = amount;
      }
    }
  }
  if (isRecord(raw.settings)) {
    save.settings.mute = raw.settings.mute === true;
    save.settings.reduceMotion = typeof raw.settings.reduceMotion === 'boolean' ? raw.settings.reduceMotion : null;
    save.settings.colourShapes = raw.settings.colourShapes === true;
  }
  if (isRecord(raw.lab)) {
    const lab = raw.lab;
    if (lab.exitRule === 'many' || lab.exitRule === 'single') save.lab.exitRule = lab.exitRule;
    if (typeof lab.yellowEarly === 'boolean') save.lab.yellowEarly = lab.yellowEarly;
    if (typeof lab.moveSlack === 'number' && lab.moveSlack >= 0 && lab.moveSlack <= 9) save.lab.moveSlack = lab.moveSlack;
    if (typeof lab.speed === 'number' && lab.speed > 0.2 && lab.speed < 4) save.lab.speed = lab.speed;
    if (typeof lab.unlockAll === 'boolean') save.lab.unlockAll = lab.unlockAll;
    if (lab.board === 'roomy' || lab.board === 'classic') save.lab.board = lab.board;
    if (typeof lab.freeHelp === 'boolean') save.lab.freeHelp = lab.freeHelp;
    if (typeof lab.decor === 'boolean') save.lab.decor = lab.decor;
    if (lab.robots === 'kit' || lab.robots === 'builtin') save.lab.robots = lab.robots;
    // Saves from before the switch existed have no heading style: they get the default, the whole robot turning.
    if (HEADING_STYLES.includes(lab.heading as HeadingStyle)) save.lab.heading = lab.heading as HeadingStyle;
    if (lab.boardPieces === 'kit' || lab.boardPieces === 'builtin') save.lab.boardPieces = lab.boardPieces;
    // Saves from before the path existed have no level screen choice: they get the default, the path.
    if (lab.levelScreen === 'path' || lab.levelScreen === 'grid') save.lab.levelScreen = lab.levelScreen;
    if (typeof lab.shop === 'boolean') save.lab.shop = lab.shop;
    if (PURCHASE_OUTCOMES.includes(lab.purchaseOutcome as PurchaseOutcome)) save.lab.purchaseOutcome = lab.purchaseOutcome as PurchaseOutcome;
  }
  if (withCoins) save.ledger = readLedger(raw.ledger, CONFIG.shop.ledgerMax);
  return save;
}

/** Read the save, migrating an older one. Storage that throws gives a fresh save. */
export function loadSave(store: KeyValueStore, levelIds: readonly string[]): SaveData {
  try {
    const text = store.getItem(SAVE_KEY) ?? store.getItem(LEGACY_KEY);
    return text ? migrate(JSON.parse(text), levelIds) : defaultSave();
  } catch {
    return defaultSave();
  }
}

/** Write the save. Returns false when storage refused it; the game goes on regardless. */
export function writeSave(store: KeyValueStore, data: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Forget progress and coins. Settings, lab switches and the test ledger are kept. */
export function resetProgress(data: SaveData): SaveData {
  return { ...data, best: {}, coins: CONFIG.coins.start, paid: {} };
}
