// PROTOTYPE - NOT FOR PRODUCTION
import type { ColorId } from '../config';

const PULSE_PITCH: Record<ColorId, number> = { red: 110, blue: 131, yellow: 165, green: 147, orange: 123, purple: 98 };
const SCALE = [0, 2, 4, 7, 9];

/** Small synthesised sound set (Web Audio). Silent until the first user gesture unlocks it. */
export class Sfx {
  muted = false;
  private ctx: AudioContext | null = null;
  private lastClick = 0;

  /** Call from a user gesture (required by mobile Safari). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** The burst itself: a soft rubbery thump, pitched per colour. */
  pulse(color: ColorId): void {
    const f = PULSE_PITCH[color];
    this.tone(f * 1.9, 0.22, 0.5, 'sine', f * 0.7);
    this.tone(f * 3.8, 0.09, 0.12, 'triangle', f * 2);
  }

  /** A marble tick; `speed` scales the loudness. Rate-limited. */
  click(speed: number): void {
    const now = performance.now();
    if (now - this.lastClick < 28) return;
    this.lastClick = now;
    const v = Math.min(1, speed / 9);
    this.tone(1500 + v * 900, 0.035, 0.03 + v * 0.07, 'triangle');
  }

  /** A marble drops into the catcher; the n-th one climbs a pentatonic scale. */
  collect(n: number): void {
    const semis = SCALE[n % 5] + 12 * Math.floor(n / 5);
    const f = 523.25 * Math.pow(2, semis / 12);
    this.tone(f, 0.32, 0.22, 'sine');
    this.tone(f * 2, 0.18, 0.06, 'sine');
  }

  win(): void {
    [0, 4, 7, 12].forEach((s, i) => this.tone(523.25 * Math.pow(2, s / 12), 0.35, 0.2, 'triangle', undefined, i * 0.09));
  }

  lose(): void {
    this.tone(330, 0.3, 0.18, 'triangle', 262);
    this.tone(262, 0.4, 0.16, 'triangle', 196, 0.22);
  }
}
