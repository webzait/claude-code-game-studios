import { CONFIG } from '../config';
import { BUTTON_SOUNDS, SOUND_NAMES, soundGroup, soundSet, tuningOf, type SoundName } from './sets';
import { measure, renderRecipe, type SoundMeasure } from './synth';

/** Sample rate the checks render at; phones play at 44100 or 48000. */
export const CHECK_RATE = 48000;

/** One sound of one set as the game plays it, volume included, with what was measured about it. */
export interface SoundFacts extends SoundMeasure {
  readonly name: SoundName;
}

/** Measure one sound of a set at the game's volume. */
export function soundFacts(setId: string, name: SoundName, sampleRate = CHECK_RATE): SoundFacts {
  const set = soundSet(setId);
  const tuning = tuningOf(set, name);
  const samples = renderRecipe(set.recipes[name], { sampleRate, pitch: tuning.pitch, gain: tuning.gain * CONFIG.audio.volume });
  return { name, ...measure(samples, sampleRate) };
}

/** The button sounds of a set that are not silent, measured. */
export function buttonFacts(setId: string): SoundFacts[] {
  return BUTTON_SOUNDS.map((name) => soundFacts(setId, name)).filter((f) => f.peak > 0);
}

/**
 * How loud a busy moment can get with this set: sounds of one group never overlap, so it is the
 * loudest button sound, plus the loudest robot sound, plus the two loudest shared sounds (say a
 * robot leaving while a coin lands). An estimate of the top; 1 is where the output would distort.
 */
export function busyPeak(setId: string): number {
  const loudest = { press: 0, motion: 0 };
  const free: number[] = [];
  for (const name of SOUND_NAMES) {
    const peak = soundFacts(setId, name).peak;
    const group = soundGroup(name);
    if (group) loudest[group] = Math.max(loudest[group], peak);
    else free.push(peak);
  }
  free.sort((a, b) => b - a);
  return loudest.press + loudest.motion + free[0] + free[1];
}
