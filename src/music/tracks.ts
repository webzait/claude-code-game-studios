import { CONFIG } from '../config';
import data from '../../data/music.json';
import type { RenderOptions, Score } from './synth';

/** The music variants there are, by id (data/music.json). */
export type MusicVariant = keyof typeof data;
export const MUSIC_VARIANTS = Object.keys(data) as MusicVariant[];

/** True for the id of a variant that exists. */
export const isMusicVariant = (value: unknown): value is MusicVariant => typeof value === 'string' && Object.hasOwn(data, value);

/** The variant the game plays unless the test lab says otherwise (`music.variant` in the config). */
export const DEFAULT_VARIANT: MusicVariant = isMusicVariant(CONFIG.music.variant) ? CONFIG.music.variant : MUSIC_VARIANTS[0];

/** The score of a variant. (`notesOf` checks it adds up; the unit tests run that for every variant.) */
export const scoreOf = (variant: MusicVariant): Score => data[variant] as unknown as Score;

/** How a variant is rendered: its tempo and the shared loudness settings, all from the config. */
export function renderOptionsOf(variant: MusicVariant): RenderOptions {
  const { tempo, level, peakLimit, sampleRate } = CONFIG.music;
  return { bpm: tempo[variant], level, peakLimit, sampleRate };
}
