import { CONFIG } from '../config';
import type { AudioHub } from '../audio';
import { renderSteps, type Loop } from './synth';
import { renderOptionsOf, scoreOf, type MusicVariant } from './tracks';

/** Something that can make the music heard. The game uses Web Audio; tests use a recorder. */
export interface MusicOutput {
  /** Get a variant ready ahead of time, so the first touch does not have to wait for it. */
  prepare(variant: MusicVariant): void;
  /** Play this variant, looping, in place of whatever plays now. */
  play(variant: MusicVariant): void;
  /** Stop. `atOnce` cuts it short (the page went to the background); otherwise it fades out. */
  stop(atOnce: boolean): void;
}

/** What decides whether music plays. */
export interface MusicState {
  /** The player's Music setting. */
  enabled: boolean;
  variant: MusicVariant;
  /** The screen on show. */
  screen: string;
  /** False while the page is in the background. */
  visible: boolean;
}

/**
 * Decides when the music plays: only when the player has it switched on, has touched the page
 * (browsers allow no sound before that), the page is in front, and the screen on show is one
 * with music. It holds no audio itself, so the rule is tested without a browser.
 */
export class MusicController {
  private unlocked = false;
  private current: MusicVariant | null = null;
  private state: MusicState;

  /** @param screens The screens that have music (`music.screens` in the config). */
  constructor(private output: MusicOutput, private screens: readonly string[], initial: MusicState) {
    this.state = { ...initial };
    if (initial.enabled) output.prepare(initial.variant);
  }

  /** The variant playing now, or null. */
  get playing(): MusicVariant | null {
    return this.current;
  }

  /** The player touched the page or pressed a key: sound is allowed from now on. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.sync();
  }

  /** Change any of the deciding facts; the music follows. */
  set(change: Partial<MusicState>): void {
    Object.assign(this.state, change);
    this.sync();
  }

  private sync(): void {
    const { enabled, variant, screen, visible } = this.state;
    const wanted = enabled && this.unlocked && visible && this.screens.includes(screen) ? variant : null;
    if (wanted === this.current) return;
    this.current = wanted;
    if (wanted) this.output.play(wanted);
    else this.output.stop(!visible);
  }
}

/**
 * Render a variant without holding the page up: a few milliseconds of work, then a pause for
 * the browser, until it is done.
 * @param sliceMs Longest stretch of work at a time.
 * @param pause Resolves when the next stretch may start.
 */
export async function renderInSlices(variant: MusicVariant, sliceMs: number, pause: () => Promise<void> = () => new Promise((r) => setTimeout(r, 0)), now: () => number = () => performance.now()): Promise<Loop> {
  const steps = renderSteps(scoreOf(variant), renderOptionsOf(variant));
  for (;;) {
    const until = now() + sliceMs;
    do {
      const step = steps.next();
      if (step.done) return step.value;
    } while (now() < until);
    await pause();
  }
}

interface Playing {
  variant: MusicVariant;
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** Context time at which the source started, and the place in the loop it started from. */
  startedAt: number;
  offset: number;
  seconds: number;
}

/**
 * The music through Web Audio: the rendered loop in one looping buffer source behind a gain
 * for fades. It shares the sound effects' audio context and never touches their volume.
 */
export class WebAudioMusic implements MusicOutput {
  /** The one rendered variant kept in memory (a loop is some megabytes). */
  private ready: { variant: MusicVariant; loop: Promise<Loop>; buffer?: AudioBuffer } | null = null;
  private wanted: MusicVariant | null = null;
  private now: Playing | null = null;
  /** Where each variant stopped, so it carries on from there instead of starting over. */
  private position = new Map<MusicVariant, number>();

  /**
   * @param render Makes the loop of a variant. The game renders in a background worker; the default works in slices on the main thread.
   */
  constructor(
    private hub: AudioHub,
    private render: (variant: MusicVariant) => Promise<Loop> = (variant) => renderInSlices(variant, CONFIG.music.renderSliceMs),
    private settings: Pick<typeof CONFIG.music, 'volume' | 'fadeIn' | 'fadeOut'> = CONFIG.music,
  ) {}

  /** True while a source is sounding or fading in. */
  get sounding(): boolean {
    return this.now !== null;
  }

  prepare(variant: MusicVariant): void {
    void this.loop(variant);
  }

  private loop(variant: MusicVariant): Promise<Loop> {
    if (this.ready?.variant !== variant) {
      const loop = this.render(variant);
      // A failed render is not kept, and the game plays on without music.
      loop.catch(() => {
        if (this.ready?.loop === loop) this.ready = null;
      });
      this.ready = { variant, loop };
    }
    return this.ready.loop;
  }

  play(variant: MusicVariant): void {
    this.wanted = variant;
    try {
      // Touch the audio context now, while the browser still counts this as the player's touch.
      this.hub.resume(true);
    } catch {
      return;
    }
    this.loop(variant).then(
      (loop) => {
        if (this.wanted !== variant || this.now?.variant === variant) return;
        try {
          this.start(variant, loop);
        } catch {
          // No audio on this device or page: the game plays on in silence.
        }
      },
      () => undefined,
    );
  }

  private start(variant: MusicVariant, loop: Loop): void {
    this.halt(this.settings.fadeOut);
    const ctx = this.hub.context();
    const entry = this.ready?.variant === variant ? this.ready : null;
    let buffer = entry?.buffer;
    if (!buffer) {
      buffer = ctx.createBuffer(2, loop.left.length, loop.sampleRate);
      buffer.getChannelData(0).set(loop.left);
      buffer.getChannelData(1).set(loop.right);
      if (entry) entry.buffer = buffer;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const at = ctx.currentTime;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(this.settings.volume, at + this.settings.fadeIn);
    source.connect(gain).connect(ctx.destination);
    const offset = (this.position.get(variant) ?? 0) % buffer.duration;
    source.start(at, offset);
    this.now = { variant, source, gain, startedAt: at, offset, seconds: buffer.duration };
  }

  stop(atOnce: boolean): void {
    this.wanted = null;
    // Even "at once" takes a few hundredths of a second: a hard cut would click.
    this.halt(atOnce ? 0.03 : this.settings.fadeOut);
  }

  private halt(fade: number): void {
    const playing = this.now;
    if (!playing) return;
    this.now = null;
    try {
      const ctx = this.hub.context();
      const at = ctx.currentTime;
      this.position.set(playing.variant, (playing.offset + at - playing.startedAt) % playing.seconds);
      playing.gain.gain.cancelScheduledValues(at);
      playing.gain.gain.setValueAtTime(playing.gain.gain.value, at);
      playing.gain.gain.linearRampToValueAtTime(0, at + fade);
      playing.source.stop(at + fade + 0.02);
      playing.source.onended = () => playing.gain.disconnect();
    } catch {
      // Already gone.
    }
  }
}
