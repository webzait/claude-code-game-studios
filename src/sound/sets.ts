import { CONFIG } from '../config';
import type { Command } from '../engine/types';
import DATA from '../../data/sound-sets.json';
import type { Recipe } from './synth';

/**
 * The sound sets: the catalogue (`data/sound-sets.json`), which sound belongs to which moment of a
 * move, and the rule that keeps fast tapping tidy. No browser code. Design: design/button-sounds.md.
 */

/** Every sound the game can make. */
export const SOUND_NAMES = ['tap', 'press-red', 'press-blue', 'press-yellow', 'press-forward', 'turn', 'step', 'bump', 'deny', 'exit', 'win', 'fail', 'scan', 'coin', 'perfect'] as const;
/** A sound the game can make. */
export type SoundName = (typeof SOUND_NAMES)[number];

/** The sounds every set must answer for itself; the rest (exit, win, fail, hint, coin, perfect) are shared and come from the base set. */
export const BUTTON_SOUNDS: readonly SoundName[] = ['tap', 'press-red', 'press-blue', 'press-yellow', 'press-forward', 'turn', 'step', 'bump', 'deny'];

/**
 * When a move's sounds play. `tap`: one sound at the touch, as the game first did. `motion`: the
 * button answers at the touch, and the turn and the step sound when the robots actually turn and step.
 */
export type Timing = 'tap' | 'motion';

/** One set, ready to use: every sound resolved, with its loudness and pitch from the config. */
export interface SoundSet {
  readonly id: string;
  /** Short name for the test lab. */
  readonly name: string;
  readonly blurb: string;
  /** Name and one-line description in Dutch, for the listening page. */
  readonly nl: { readonly name: string; readonly blurb: string };
  readonly timing: Timing;
  /** Loudness of this set against the others (`audio.sets.<id>.gain`). */
  readonly gain: number;
  /** Pitch shift of this set in semitones (`audio.sets.<id>.pitch`). */
  readonly pitch: number;
  readonly recipes: Readonly<Record<SoundName, Recipe>>;
  /** The sounds this set defines itself; the others are the shared ones from the base set. */
  readonly own: readonly SoundName[];
}

interface RawSet {
  name: string;
  blurb: string;
  nl: { name: string; blurb: string };
  timing: string;
  sounds: Record<string, Recipe | string | undefined>;
}

const RAW = DATA as unknown as Record<string, RawSet>;
/** The set that supplies every sound another set leaves out. */
export const BASE_SET = 'classic';
const tuning = CONFIG.audio.sets as Record<string, { gain: number; pitch: number } | undefined>;

/** Ids of all sets, in the order they are offered. */
export function soundSetIds(): string[] {
  return Object.keys(RAW);
}

/** True when `id` names a set. */
export function isSoundSet(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(RAW, id);
}

/** The three-star win jingle; its notes are tuned in the config (`celebration.sound.perfect`). */
const PERFECT: Recipe = CONFIG.celebration.sound.perfect.map(([freq, at, length]) => ({ wave: 'triangle', freq, at, length, attack: 0.01 })) as Recipe;

function recipeOf(set: RawSet, name: SoundName, depth = 0): Recipe {
  if (name === 'perfect' && set.sounds[name] === undefined && RAW[BASE_SET].sounds[name] === undefined) return PERFECT;
  const own = set.sounds[name] ?? RAW[BASE_SET].sounds[name] ?? [];
  // A name instead of a recipe means "the same as that sound" within the set.
  if (typeof own === 'string') return depth < 3 ? recipeOf(set, own as SoundName, depth + 1) : [];
  return own;
}

/** A set by id; an unknown id gives the configured default set. */
export function soundSet(id: string): SoundSet {
  const key = isSoundSet(id) ? id : isSoundSet(CONFIG.audio.set) ? CONFIG.audio.set : BASE_SET;
  const raw = RAW[key];
  const recipes = Object.fromEntries(SOUND_NAMES.map((name) => [name, recipeOf(raw, name)])) as Record<SoundName, Recipe>;
  return { id: key, name: raw.name, blurb: raw.blurb, nl: raw.nl, timing: raw.timing === 'motion' ? 'motion' : 'tap', gain: tuning[key]?.gain ?? 1, pitch: tuning[key]?.pitch ?? 0, recipes, own: SOUND_NAMES.filter((name) => raw.sounds[name] !== undefined) };
}

/**
 * Loudness and pitch one sound of a set is rendered with. A set's `gain` and `pitch` apply to its own
 * sounds only: the shared ones (exit, win, fail, hint, coin) sound the same whichever set is chosen.
 */
export function tuningOf(set: SoundSet, name: SoundName): { gain: number; pitch: number } {
  return set.own.includes(name) ? { gain: set.gain, pitch: set.pitch } : { gain: 1, pitch: 0 };
}

/** The sounds of one move, by the moment they belong to. */
export interface MovePlan {
  /** At the touch of the button. */
  readonly tap: readonly SoundName[];
  /** When the robots start turning. */
  readonly turn: readonly SoundName[];
  /** When the robots start stepping. */
  readonly step: readonly SoundName[];
}

/**
 * Which sounds a command makes and when, from what the engine reported for each robot
 * (`moved`, `exited`, `blocked…`) and whether any robot turned.
 */
export function movePlan(command: Command, outcomes: readonly string[], anyTurned: boolean, timing: Timing): MovePlan {
  const walk: SoundName = outcomes.includes('exited') ? 'exit' : outcomes.every((o) => o.startsWith('blocked')) ? 'bump' : 'step';
  if (timing === 'tap') return { tap: [walk === 'step' && command !== 'forward' ? 'turn' : walk], turn: [], step: [] };
  return { tap: [`press-${command}`], turn: anyTurned ? ['turn'] : [], step: [walk] };
}

/**
 * Sounds of one group never overlap: a new one fades the previous one out. `press` is the buttons,
 * `motion` the robots; everything else is free. This bounds how loud fast tapping can get.
 */
export function soundGroup(name: SoundName): 'press' | 'motion' | null {
  if (name === 'tap' || name === 'deny' || name.startsWith('press-')) return 'press';
  if (name === 'turn' || name === 'step' || name === 'bump') return 'motion';
  return null;
}

/** The fast-tapping rule's numbers (`audio.rapid` in the config). */
export interface RapidRule {
  /** The same sound is not started again within this many seconds. */
  readonly minGap: number;
  /** The same sound again within this many seconds plays softer. */
  readonly softWindow: number;
  /** How much softer (0–1). */
  readonly softGain: number;
}

/**
 * How loud a sound may start, given when the same sound last started: 0 (skip it) inside `minGap`,
 * softer inside `softWindow`, full otherwise. Keeps a burst of taps from stacking up.
 */
export function rapidGain(now: number, last: number | undefined, rule: RapidRule): number {
  if (last === undefined) return 1;
  const since = now - last;
  if (since < rule.minGap) return 0;
  return since < rule.softWindow ? rule.softGain : 1;
}
