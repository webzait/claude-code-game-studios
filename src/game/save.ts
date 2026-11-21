import { DEFAULT_LAB, type LabSettings } from './lab';

/** Current save format. Raise it and extend `migrate` when the shape changes. */
export const SAVE_VERSION = 2;
/** Storage key of the current format. */
export const SAVE_KEY = 'turnflock.save';
/** Storage key of the first prototype's format (version 1). */
export const LEGACY_KEY = 'turnflock.progress.v1';

/** Everything kept between visits. */
export interface SaveData {
  version: number;
  /** Best move count per solved level id. */
  best: Record<string, number>;
  settings: {
    mute: boolean;
    /** null follows the device's reduced-motion preference. */
    reduceMotion: boolean | null;
  };
  lab: LabSettings;
}

/** The minimal storage the save needs; `localStorage` fits, and tests pass a plain object. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A fresh save. */
export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, best: {}, settings: { mute: false, reduceMotion: null }, lab: { ...DEFAULT_LAB } };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring any stored value to the current format. Version 1 stored solved level
 * positions; they are mapped to ids through `levelIds`. Unknown or damaged
 * data gives a fresh save rather than an error.
 */
export function migrate(raw: unknown, levelIds: readonly string[]): SaveData {
  const save = defaultSave();
  if (!isRecord(raw)) return save;
  if (raw.version === undefined && Array.isArray(raw.solved)) {
    // Version 1: { solved: number[], level: number }. Best scores were not kept; record par-unknown wins as 0.
    for (const index of raw.solved) {
      if (typeof index === 'number' && levelIds[index]) save.best[levelIds[index]] = 0;
    }
    return save;
  }
  if (raw.version !== SAVE_VERSION) return save;
  if (isRecord(raw.best)) {
    for (const [id, moves] of Object.entries(raw.best)) {
      if (levelIds.includes(id) && typeof moves === 'number' && moves >= 0) save.best[id] = moves;
    }
  }
  if (isRecord(raw.settings)) {
    save.settings.mute = raw.settings.mute === true;
    save.settings.reduceMotion = typeof raw.settings.reduceMotion === 'boolean' ? raw.settings.reduceMotion : null;
  }
  if (isRecord(raw.lab)) {
    const lab = raw.lab;
    if (lab.exitRule === 'many' || lab.exitRule === 'single') save.lab.exitRule = lab.exitRule;
    if (typeof lab.yellowEarly === 'boolean') save.lab.yellowEarly = lab.yellowEarly;
    if (typeof lab.moveSlack === 'number' && lab.moveSlack >= 0 && lab.moveSlack <= 9) save.lab.moveSlack = lab.moveSlack;
    if (typeof lab.speed === 'number' && lab.speed > 0.2 && lab.speed < 4) save.lab.speed = lab.speed;
    if (typeof lab.unlockAll === 'boolean') save.lab.unlockAll = lab.unlockAll;
    if (lab.board === 'roomy' || lab.board === 'classic') save.lab.board = lab.board;
  }
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

/** Forget progress. Settings and lab switches are kept. */
export function resetProgress(data: SaveData): SaveData {
  return { ...data, best: {} };
}
