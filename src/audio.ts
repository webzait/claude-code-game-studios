import { CONFIG } from './config';
import { rapidGain, soundGroup, soundSet, tuningOf, type SoundName } from './sound/sets';
import { renderRecipe } from './sound/synth';

export type { SoundName } from './sound/sets';

/** One sound the player asked for, kept for automated checks. */
export interface PlayedSound {
  readonly name: SoundName;
  readonly set: string;
  /** Page time in milliseconds (`performance.now()`) at which it was started. */
  readonly at: number;
  /** Loudness it started with after the fast-tapping rule: 1 full, 0 skipped. */
  readonly gain: number;
}

type Note = [frequency: number, start: number, length: number, type?: OscillatorType];

/**
 * The classic effects as plain notes: frequency in hertz, start and length in seconds, and wave shape.
 * The music checks (key, headroom) and the music listening page read these; the game itself plays the
 * active sound set (`src/sound/sets.ts`).
 */
export const SOUNDS: Record<string, Note[]> = {
  tap: [[520, 0, 0.05, 'triangle']],
  turn: [[392, 0, 0.07, 'triangle'], [494, 0.05, 0.07, 'triangle']],
  step: [[262, 0, 0.06, 'sine']],
  bump: [[150, 0, 0.09, 'square']],
  exit: [[659, 0, 0.09, 'triangle'], [988, 0.07, 0.14, 'triangle']],
  win: [[523, 0, 0.12, 'triangle'], [659, 0.1, 0.12, 'triangle'], [784, 0.2, 0.12, 'triangle'], [1047, 0.3, 0.3, 'triangle']],
  fail: [[330, 0, 0.16, 'sine'], [247, 0.14, 0.26, 'sine']],
  scan: [[880, 0, 0.06, 'sine'], [1175, 0.07, 0.1, 'sine']],
  coin: [[1568, 0, 0.04, 'triangle'], [2093, 0.035, 0.08, 'triangle']],
  // The win jingle with a sparkle on top, for a three-star win; its notes are tuned in the config.
  perfect: CONFIG.celebration.sound.perfect.map(([frequency, start, length]): Note => [frequency, start, length, 'triangle']),
};

/**
 * The page's one audio context, shared by the sound effects and the music: phones allow only a
 * few, and one touch then unlocks sound for both.
 */
export class AudioHub {
  private ctx: AudioContext | null = null;

  /** The context, made on first use. Throws where the browser has no Web Audio. */
  context(): AudioContext {
    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    return this.ctx;
  }

  /** `running`, `suspended`, `closed`, or `none` while nothing has asked for sound yet. */
  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Let a paused context run again. `create` makes the context when there is none yet. */
  resume(create = false): void {
    const ctx = create ? this.context() : this.ctx;
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => undefined);
  }

  /** Pause all sound work (the page went to the background). */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }
}

/**
 * The game's sound effects. Every sound is synthesised in the page from the active set's recipe
 * (`src/sound/synth.ts`), kept as a ready buffer and started at once. Silent when muted or unsupported.
 *
 * All effects go through one volume control of their own (`audio.volume`); music or a celebration
 * added later gets its own and can share `context`.
 */
export class Sfx {
  /** The page's audio output, once the first sound has been asked for. */
  context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private meter: AnalyserNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private lastStart = new Map<SoundName, number>();
  private groupGain = new Map<string, GainNode>();
  /** The latest sounds asked for, oldest first (for checks). */
  readonly played: PlayedSound[] = [];

  /**
   * @param isMuted The player's Sound setting, read at every sound.
   * @param setId The active sound set, read at every sound, so a switch is heard on the next tap.
   * @param hub The page's one audio context, shared with the music.
   */
  constructor(
    private isMuted: () => boolean,
    private setId: () => string = () => CONFIG.audio.set,
    private hub: AudioHub = new AudioHub(),
  ) {}

  /** Play a sound. Browsers only allow this after the player has touched the page. */
  play(name: SoundName): void {
    if (this.isMuted()) return;
    const set = soundSet(this.setId());
    const recipe = set.recipes[name];
    if (recipe.length === 0) return;
    try {
      const ctx = this.output();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const gain = rapidGain(now, this.lastStart.get(name), CONFIG.audio.rapid);
      this.note({ name, set: set.id, at: performance.now(), gain });
      if (gain === 0) return;
      this.lastStart.set(name, now);
      const key = `${set.id}/${name}`;
      let buffer = this.buffers.get(key);
      if (!buffer) {
        const samples = renderRecipe(recipe, { sampleRate: ctx.sampleRate, ...tuningOf(set, name) });
        buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.getChannelData(0).set(samples);
        this.buffers.set(key, buffer);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const voice = ctx.createGain();
      voice.gain.value = gain;
      source.connect(voice).connect(this.bus!);
      const group = soundGroup(name);
      if (group) {
        // One sound per group at a time: the previous one is faded out quickly instead of piling up.
        const previous = this.groupGain.get(group);
        if (previous) {
          previous.gain.cancelScheduledValues(now);
          previous.gain.setValueAtTime(previous.gain.value, now);
          previous.gain.linearRampToValueAtTime(0, now + CONFIG.audio.rapid.fadeOut);
        }
        this.groupGain.set(group, voice);
        source.onended = () => {
          if (this.groupGain.get(group) === voice) this.groupGain.delete(group);
        };
      }
      source.start(now);
    } catch {
      // No audio on this device or page: the game plays on in silence.
    }
  }

  /** The loudest sample leaving the game right now (0–1), for checks. 0 before the first sound. */
  peak(): number {
    if (!this.meter) return 0;
    const data = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(data);
    return data.reduce((max, v) => Math.max(max, Math.abs(v)), 0);
  }

  private output(): AudioContext {
    if (!this.context) {
      this.context = this.hub.context();
      this.bus = this.context.createGain();
      this.bus.gain.value = CONFIG.audio.volume;
      this.meter = this.context.createAnalyser();
      this.meter.fftSize = 2048;
      this.bus.connect(this.meter).connect(this.context.destination);
    }
    return this.context;
  }

  private note(sound: PlayedSound): void {
    this.played.push(sound);
    if (this.played.length > 200) this.played.shift();
  }
}
