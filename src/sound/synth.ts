/**
 * The game's sound synthesiser: a recipe (plain data, `data/sound-sets.json`) is rendered to samples by
 * arithmetic alone. The game plays exactly these samples and the checks measure exactly these samples,
 * so what is measured (length, peak, silent edges) is what is played. No files, no browser API.
 * Design: design/button-sounds.md.
 */

/** Basic wave of one layer. `noise` is a fixed pseudo-random sequence, the same on every run. */
export type Wave = 'sine' | 'triangle' | 'square' | 'saw' | 'noise';

/** A filter over one layer's wave, applied before its volume envelope. */
export interface LayerFilter {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  /** Corner or centre frequency in Hz. */
  readonly freq: number;
  /** Resonance; about 0.7 is neutral. */
  readonly q?: number;
}

/** One voice of a sound. A sound is a few of these added together. */
export interface Layer {
  readonly wave: Wave;
  /** Pitch in Hz at the start (not used by noise). */
  readonly freq?: number;
  /** Pitch in Hz the layer glides to; absent means a steady pitch. */
  readonly freqEnd?: number;
  /** Seconds the glide takes; the whole layer when absent. */
  readonly glide?: number;
  /** Seconds after the start of the sound at which this layer begins. */
  readonly at?: number;
  /** Seconds this layer lasts: it fades to silence over this time. */
  readonly length: number;
  /** Seconds of fade-in. Never below `MIN_ATTACK`, so a layer cannot start with a click. */
  readonly attack?: number;
  /** Loudness of this layer; 1 is the loudness of one of the game's first sounds. */
  readonly gain?: number;
  readonly filter?: LayerFilter;
  /** A bell-like colour: the pitch is wobbled at `ratio` times its own frequency, `index` deep, fading over `decay` seconds. */
  readonly fm?: { readonly ratio: number; readonly index: number; readonly decay: number };
}

/** A whole sound. An empty recipe is silence. */
export type Recipe = readonly Layer[];

/** How a recipe is rendered. */
export interface RenderOptions {
  readonly sampleRate: number;
  /** Shift of every pitch, in semitones. */
  readonly pitch?: number;
  /** Loudness multiplier for the whole sound. */
  readonly gain?: number;
}

/** Shortest fade-in a layer can have, in seconds. */
export const MIN_ATTACK = 0.001;
/** Every layer ends with a straight fade to exact silence of at most this many seconds. */
export const RELEASE = 0.004;
/** Level the envelope has decayed to at the end of a layer, before that last fade (-80 dB). */
const FLOOR = 0.0001;
const DEFAULT_ATTACK = 0.005;

/** Total length of a recipe in seconds. */
export function recipeSeconds(recipe: Recipe): number {
  return recipe.reduce((end, layer) => Math.max(end, (layer.at ?? 0) + layer.length), 0);
}

/** A small fixed pseudo-random generator (mulberry32), so noise is identical on every run and device. */
function noiseSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** A two-pole filter (the widely used "cookbook" form), run over samples in place. */
function applyFilter(samples: Float32Array, filter: LayerFilter, sampleRate: number, pitchRatio: number): void {
  const freq = Math.min(filter.freq * pitchRatio, sampleRate * 0.45);
  const w = (2 * Math.PI * freq) / sampleRate;
  const alpha = Math.sin(w) / (2 * (filter.q ?? 0.707));
  const cos = Math.cos(w);
  let b0: number;
  let b1: number;
  let b2: number;
  if (filter.type === 'lowpass') {
    b1 = 1 - cos;
    b0 = b2 = b1 / 2;
  } else if (filter.type === 'highpass') {
    b1 = -(1 + cos);
    b0 = b2 = (1 + cos) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    samples[i] = y;
  }
}

/** The volume envelope of a layer at `t` seconds into it: fade in, die away, and end on exact silence. */
export function envelope(t: number, length: number, attack: number): number {
  if (t <= 0 || t >= length) return 0;
  const a = Math.min(Math.max(attack, MIN_ATTACK), length / 2);
  const body = t < a ? t / a : Math.pow(FLOOR, (t - a) / (length - a));
  const release = Math.min(RELEASE, length / 4);
  return t > length - release ? (body * (length - t)) / release : body;
}

/** Render a recipe to samples (one channel, values around -1..1 before the game's volume). */
export function renderRecipe(recipe: Recipe, options: RenderOptions): Float32Array {
  const rate = options.sampleRate;
  const ratio = Math.pow(2, (options.pitch ?? 0) / 12);
  const out = new Float32Array(Math.ceil(recipeSeconds(recipe) * rate) + 1);
  recipe.forEach((layer, index) => {
    const count = Math.floor(layer.length * rate);
    const wave = new Float32Array(count);
    const from = (layer.freq ?? 440) * ratio;
    const to = (layer.freqEnd ?? layer.freq ?? 440) * ratio;
    const glide = layer.glide ?? layer.length;
    const noise = noiseSource(index * 7919 + 17);
    let phase = 0;
    let fmPhase = 0;
    for (let i = 0; i < count; i++) {
      const t = i / rate;
      if (layer.wave === 'noise') {
        wave[i] = noise();
        continue;
      }
      const freq = from * Math.pow(to / from, Math.min(t / glide, 1));
      let p = phase;
      if (layer.fm) {
        p += (layer.fm.index * Math.exp(-t / layer.fm.decay) * Math.sin(2 * Math.PI * fmPhase)) / (2 * Math.PI);
        fmPhase += (freq * layer.fm.ratio) / rate;
      }
      const cycle = p - Math.floor(p);
      wave[i] = layer.wave === 'sine' ? Math.sin(2 * Math.PI * p) : layer.wave === 'triangle' ? 1 - 4 * Math.abs(((cycle + 0.25) % 1) - 0.5) : layer.wave === 'square' ? (cycle < 0.5 ? 1 : -1) : 2 * cycle - 1;
      phase += freq / rate;
    }
    if (layer.filter) applyFilter(wave, layer.filter, rate, ratio);
    const offset = Math.round((layer.at ?? 0) * rate);
    const gain = (layer.gain ?? 1) * (options.gain ?? 1);
    for (let i = 0; i < count; i++) out[offset + i] += wave[i] * envelope(i / rate, layer.length, layer.attack ?? DEFAULT_ATTACK) * gain;
  });
  return out;
}

/** What can be measured about a rendered sound without hearing it. */
export interface SoundMeasure {
  /** Length in seconds. */
  readonly seconds: number;
  /** Largest sample value. */
  readonly peak: number;
  /** Average level (root mean square) over the part that is louder than a hundredth of the peak. */
  readonly rms: number;
  /** Milliseconds from the start until the sound first reaches half its peak: how soon it answers a tap. */
  readonly onsetMs: number;
  /** Milliseconds until it has fallen for good below a tenth of its peak: roughly how long it is heard. */
  readonly heardMs: number;
  /** Larger of the first and the last sample, as a share of the peak. 0 means it starts and ends on silence. */
  readonly edge: number;
}

/** Measure rendered samples. */
export function measure(samples: Float32Array, sampleRate: number): SoundMeasure {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return { seconds: samples.length / sampleRate, peak: 0, rms: 0, onsetMs: 0, heardMs: 0, edge: 0 };
  let onset = 0;
  while (Math.abs(samples[onset]) < peak / 2) onset++;
  let heard = samples.length - 1;
  while (heard > 0 && Math.abs(samples[heard]) < peak / 10) heard--;
  let sum = 0;
  let n = 0;
  for (const s of samples) {
    if (Math.abs(s) >= peak / 100) {
      sum += s * s;
      n++;
    }
  }
  return {
    seconds: samples.length / sampleRate,
    peak,
    rms: Math.sqrt(sum / Math.max(n, 1)),
    onsetMs: (onset / sampleRate) * 1000,
    heardMs: (heard / sampleRate) * 1000,
    edge: Math.max(Math.abs(samples[0]), Math.abs(samples[samples.length - 1])) / peak,
  };
}
