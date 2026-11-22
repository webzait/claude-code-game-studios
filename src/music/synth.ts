/**
 * The game's background music is made here, in code: a small score (data/music.json) is
 * rendered to one stereo buffer that loops without a seam. Nothing in this file touches the
 * browser, so the same code renders in the game, on the listening page and in the tests.
 *
 * The loop has no seam by construction: every note that still rings at the end of the loop
 * is written on at the start (the buffer wraps), so the last sample runs into the first one
 * exactly as any sample runs into the next.
 */

/** One chord of a score: the note the bass plays, and its tones from low to high (MIDI numbers). */
export interface Chord {
  bass: number;
  tones: number[];
}

/** One instrument line of a score. */
export interface Voice {
  instrument: InstrumentName;
  /** Loudness of the voice in the mix, before the whole track is levelled. */
  gain: number;
  /** Place between the left (-1) and right (1) speaker. */
  pan: number;
  /** Length in beats of a token that names none. */
  step: number;
  /** Semitones added to every note. */
  transpose?: number;
  /** Beats between the tones of a chord played with `*`, low to high: a soft strum. */
  strum?: number;
  /** Bar phrases by name. See `parsePhrase` for the tokens. */
  phrases: Record<string, string>;
  /** One phrase name per bar, separated by spaces; `-` is a bar of rest. */
  form: string;
}

/** A piece of music as data. */
export interface Score {
  /** Name shown to a listener. */
  title: string;
  /** One line on what it is meant to sound like. */
  mood: string;
  beatsPerBar: number;
  /** Beats an off-beat eighth note is played late; 0 is straight time. */
  swing?: number;
  chords: Record<string, Chord>;
  /** One chord name per bar, separated by spaces. Its length is the length of the piece. */
  progression: string;
  voices: Voice[];
}

/** How a score is turned into sound. */
export interface RenderOptions {
  /** Beats per minute. */
  bpm: number;
  /** Samples per second of the buffer. */
  sampleRate: number;
  /** Loudness (root mean square) every track is brought to, so variants compare fairly. 0 leaves the mix as written. */
  level: number;
  /** The highest sample value allowed; a track that would pass it is turned down instead. */
  peakLimit: number;
}

/** A rendered loop. */
export interface Loop {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  /** Length in seconds. */
  seconds: number;
}

/** One sounding note. */
export interface NoteEvent {
  instrument: InstrumentName;
  /** MIDI note number; unused by the shaker. */
  midi: number;
  /** Start in beats from the top of the loop. */
  beat: number;
  /** Written length in beats (held instruments sound this long; struck ones ring out on their own). */
  beats: number;
  gain: number;
  pan: number;
}

interface Partial {
  /** Frequency as a multiple of the note's. */
  ratio: number;
  amp: number;
  /** Seconds in which this partial falls to about a third (struck instruments). */
  decay: number;
  /** Detune in cents (held instruments: a slow, soft chorus). */
  cents?: number;
  /** Extra pan of this partial. */
  spread?: number;
}

interface Instrument {
  /** `struck` rings out by itself; `held` sounds for the written length; `noise` is a short hiss. */
  kind: 'struck' | 'held' | 'noise';
  /** Seconds to full loudness. */
  attack: number;
  /** Seconds to silence after a held note ends. */
  release: number;
  partials: Partial[];
}

/**
 * The instruments. All are sums of a few sine waves, so nothing can alias or sound harsh;
 * the character comes from which overtones there are and how fast each one fades.
 */
const INSTRUMENTS = {
  /** Wooden bar: a round tone with a quick bright knock on top. */
  marimba: { kind: 'struck', attack: 0.004, release: 0, partials: [{ ratio: 1, amp: 1, decay: 0.42 }, { ratio: 4, amp: 0.22, decay: 0.07 }, { ratio: 9.2, amp: 0.05, decay: 0.03 }] },
  /** Thumb piano: clear and short, a little glassy. */
  kalimba: { kind: 'struck', attack: 0.003, release: 0, partials: [{ ratio: 1, amp: 1, decay: 0.55 }, { ratio: 2, amp: 0.1, decay: 0.3 }, { ratio: 5.4, amp: 0.1, decay: 0.05 }] },
  /** Soft electric piano: long, mellow, with a faint chime at the start. */
  keys: { kind: 'struck', attack: 0.006, release: 0, partials: [{ ratio: 1, amp: 1, decay: 1.3 }, { ratio: 2, amp: 0.28, decay: 0.7 }, { ratio: 3, amp: 0.06, decay: 0.4 }, { ratio: 7, amp: 0.05, decay: 0.09 }] },
  /** Small bell: a long, thin ring. */
  bell: { kind: 'struck', attack: 0.003, release: 0, partials: [{ ratio: 1, amp: 1, decay: 1.5 }, { ratio: 2.76, amp: 0.16, decay: 0.5 }, { ratio: 5.4, amp: 0.05, decay: 0.15 }] },
  /** Plucked string, muted: short and dry. */
  pluck: { kind: 'struck', attack: 0.003, release: 0, partials: [{ ratio: 1, amp: 1, decay: 0.2 }, { ratio: 2, amp: 0.4, decay: 0.12 }, { ratio: 3, amp: 0.18, decay: 0.08 }, { ratio: 4, amp: 0.08, decay: 0.05 }] },
  /** Round bass, with enough overtone to be heard on a phone speaker. */
  bass: { kind: 'struck', attack: 0.012, release: 0, partials: [{ ratio: 1, amp: 1, decay: 0.6 }, { ratio: 2, amp: 0.5, decay: 0.4 }, { ratio: 3, amp: 0.15, decay: 0.2 }] },
  /** Warm held chord sound, slowly swelling, slightly wide. */
  pad: { kind: 'held', attack: 0.7, release: 1.4, partials: [{ ratio: 1, amp: 1, decay: 0, cents: -5, spread: -0.5 }, { ratio: 1, amp: 1, decay: 0, cents: 5, spread: 0.5 }, { ratio: 2, amp: 0.12, decay: 0, cents: 2 }] },
  /** A soft shake, like a little rice in a tin. */
  shaker: { kind: 'noise', attack: 0.004, release: 0, partials: [{ ratio: 1, amp: 1, decay: 0.035 }] },
} satisfies Record<string, Instrument>;

/** Names of the instruments a score may use. */
export type InstrumentName = keyof typeof INSTRUMENTS;
export const INSTRUMENT_NAMES = Object.keys(INSTRUMENTS) as InstrumentName[];

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a note name such as `C4` (middle C, 60) or `F#3`. */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note name: ${name}`);
  return NOTE_OFFSETS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
}

/** Frequency in hertz of a MIDI note (A4 = 69 = 440 Hz). */
export const hertz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** The chord names of a score, one per bar. */
export const barsOf = (score: Score): string[] => score.progression.trim().split(/\s+/);

/**
 * The notes of one bar phrase. Tokens are separated by spaces, each `pitch` or `pitch:beats`:
 * `.` rest, `C5` a named note, `0`..`9` that tone of the bar's chord, `b` the chord's bass note,
 * `f` the fifth above it, `*` the whole chord, `x` a shaker hit. A token without `:beats`
 * lasts the voice's `step`.
 */
export function parsePhrase(text: string, voice: Voice, chord: Chord, startBeat: number, swing = 0): NoteEvent[] {
  const notes: NoteEvent[] = [];
  let beat = 0;
  for (const token of text.trim().split(/\s+/)) {
    const [pitch, length] = token.split(':');
    const beats = length === undefined ? voice.step : Number(length);
    if (!(beats > 0)) throw new Error(`Bad length in "${token}"`);
    const late = swing && Math.abs((beat % 1) - 0.5) < 1e-6 ? swing : 0;
    const at = startBeat + beat + late;
    const add = (midi: number, delayBeats = 0): void => {
      notes.push({ instrument: voice.instrument, midi: midi + (voice.transpose ?? 0), beat: at + delayBeats, beats, gain: voice.gain, pan: voice.pan });
    };
    if (pitch === '.') {
      // A rest.
    } else if (pitch === '*') chord.tones.forEach((tone, i) => add(tone, i * (voice.strum ?? 0)));
    else if (pitch === 'b') add(chord.bass);
    else if (pitch === 'f') add(chord.bass + 7);
    else if (pitch === 'x') add(0);
    else if (/^\d$/.test(pitch)) {
      const tone = chord.tones[Number(pitch)];
      if (tone === undefined) throw new Error(`Chord has no tone ${pitch}`);
      add(tone);
    } else add(midiOf(pitch));
    beat += beats;
  }
  return notes;
}

/** Every note of a score, in beats. Throws on a score that does not add up, so a typo cannot ship as wrong music. */
export function notesOf(score: Score): NoteEvent[] {
  const bars = barsOf(score);
  const notes: NoteEvent[] = [];
  for (const voice of score.voices) {
    const form = voice.form.trim().split(/\s+/);
    if (form.length !== bars.length) throw new Error(`${score.title}: a ${voice.instrument} voice has ${form.length} bars, the piece has ${bars.length}`);
    form.forEach((name, bar) => {
      if (name === '-') return;
      const phrase = voice.phrases[name];
      const chord = score.chords[bars[bar]];
      if (phrase === undefined) throw new Error(`${score.title}: no phrase "${name}"`);
      if (!chord) throw new Error(`${score.title}: no chord "${bars[bar]}"`);
      const found = parsePhrase(phrase, voice, chord, bar * score.beatsPerBar, score.swing ?? 0);
      const length = phrase.trim().split(/\s+/).reduce((sum, t) => sum + (t.includes(':') ? Number(t.split(':')[1]) : voice.step), 0);
      if (Math.abs(length - score.beatsPerBar) > 1e-6) throw new Error(`${score.title}: phrase "${name}" is ${length} beats, a bar is ${score.beatsPerBar}`);
      notes.push(...found);
    });
  }
  return notes;
}

/** Length of the loop in samples: whole bars at the given tempo. */
export function loopSamples(score: Score, options: Pick<RenderOptions, 'bpm' | 'sampleRate'>): number {
  return Math.round((barsOf(score).length * score.beatsPerBar * 60 * options.sampleRate) / options.bpm);
}

/** A small repeatable random source, so the shaker's hiss is the same in every render. */
function randomSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

/** Add one note to the buffer, wrapping past the end back to the start. */
function addNote(left: Float32Array, right: Float32Array, note: NoteEvent, start: number, lengthSeconds: number, sampleRate: number, index: number): void {
  const total = left.length;
  const instrument: Instrument = INSTRUMENTS[note.instrument];
  const attack = Math.max(1, Math.round(instrument.attack * sampleRate));
  const frequency = hertz(note.midi);
  // Higher notes of a struck instrument die away sooner, as they do on a real one.
  const shorten = instrument.kind === 'struck' ? (261.63 / frequency) ** 0.35 : 1;
  for (const [p, partial] of instrument.partials.entries()) {
    const pan = Math.max(-1, Math.min(1, note.pan + (partial.spread ?? 0)));
    const angle = ((pan + 1) * Math.PI) / 4;
    const gl = Math.cos(angle) * note.gain * partial.amp;
    const gr = Math.sin(angle) * note.gain * partial.amp;
    const held = instrument.kind === 'held';
    const f = frequency * partial.ratio * 2 ** ((partial.cents ?? 0) / 1200);
    if (instrument.kind !== 'noise' && f >= sampleRate / 2) continue;
    const decay = partial.decay * shorten * sampleRate;
    const hold = Math.max(attack, Math.round(lengthSeconds * sampleRate));
    // A struck note is written for six decay times (about -52 dB) and its last fifth is faded to exactly zero.
    const length = held ? hold + Math.max(1, Math.round(instrument.release * sampleRate)) : Math.round(decay * 6);
    const fadeFrom = held ? hold : Math.round(length * 0.8);
    const fall = held ? 1 : Math.exp(-1 / decay);
    // The sine is turned a fixed angle per sample (a rotation), which costs far less than a sine call each.
    const step = (TAU * f) / sampleRate;
    const cos = Math.cos(step);
    const sin = Math.sin(step);
    const phase = held ? p * 1.7 + index : 0;
    let s = Math.sin(phase);
    let c = Math.cos(phase);
    const random = instrument.kind === 'noise' ? randomSource(index * 7919 + 17) : null;
    let previous = 0;
    let level = 1;
    let at = start % total;
    for (let i = 0; i < length; i++) {
      // Raised-cosine swell and fade: no corner anywhere, so no click.
      let env = level;
      if (i < attack) env *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attack);
      else if (i >= fadeFrom) env *= 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeFrom)) / (length - fadeFrom));
      let value = s;
      if (random) {
        const white = random() * 2 - 1;
        // The difference of neighbours keeps only the airy top of the noise.
        value = (white - previous) * 0.5;
        previous = white;
      } else {
        const next = s * cos + c * sin;
        c = c * cos - s * sin;
        s = next;
      }
      left[at] += value * env * gl;
      right[at] += value * env * gr;
      level *= fall;
      if (++at === total) at = 0;
    }
  }
}

/** Root mean square and highest absolute value of a stereo pair. */
export function loudness(left: Float32Array, right: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    sum += left[i] * left[i] + right[i] * right[i];
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  return { rms: Math.sqrt(sum / (2 * left.length || 1)), peak };
}

/**
 * Render a score step by step: each `next()` adds one note and yields the share done (0..1), so a
 * caller can spread the work over many frames. The return value is the finished, levelled loop.
 */
export function* renderSteps(score: Score, options: RenderOptions): Generator<number, Loop, void> {
  const total = loopSamples(score, options);
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  const notes = notesOf(score);
  const samplesPerBeat = (60 * options.sampleRate) / options.bpm;
  for (const [index, note] of notes.entries()) {
    addNote(left, right, note, Math.round(note.beat * samplesPerBeat) % total, (note.beats * 60) / options.bpm, options.sampleRate, index);
    yield (index + 1) / notes.length;
  }
  // Bring every track to the same loudness, then make sure no sample can pass the limit.
  const { rms, peak } = loudness(left, right);
  const scale = options.level <= 0 ? 1 : rms > 0 ? Math.min(options.level / rms, options.peakLimit / peak) : 0;
  for (let i = 0; i < total; i++) {
    left[i] *= scale;
    right[i] *= scale;
  }
  return { left, right, sampleRate: options.sampleRate, seconds: total / options.sampleRate };
}

/** Render a score in one go. */
export function renderLoop(score: Score, options: RenderOptions): Loop {
  const steps = renderSteps(score, options);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
