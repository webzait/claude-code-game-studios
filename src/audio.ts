import { CONFIG } from './config';

/** Sounds the game can make. */
export type SoundName = 'tap' | 'turn' | 'step' | 'bump' | 'exit' | 'win' | 'fail' | 'scan' | 'milestone';

type Note = [frequency: number, start: number, length: number, type?: OscillatorType];

const SOUNDS: Record<SoundName, Note[]> = {
  tap: [[520, 0, 0.05, 'triangle']],
  turn: [[392, 0, 0.07, 'triangle'], [494, 0.05, 0.07, 'triangle']],
  step: [[262, 0, 0.06, 'sine']],
  bump: [[150, 0, 0.09, 'square']],
  exit: [[659, 0, 0.09, 'triangle'], [988, 0.07, 0.14, 'triangle']],
  win: [[523, 0, 0.12, 'triangle'], [659, 0.1, 0.12, 'triangle'], [784, 0.2, 0.12, 'triangle'], [1047, 0.3, 0.3, 'triangle']],
  fail: [[330, 0, 0.16, 'sine'], [247, 0.14, 0.26, 'sine']],
  scan: [[880, 0, 0.06, 'sine'], [1175, 0.07, 0.1, 'sine']],
  milestone: [[392, 0, 0.18, 'triangle'], [523, 0.16, 0.18, 'triangle'], [659, 0.32, 0.18, 'triangle'], [784, 0.48, 0.5, 'triangle']],
};

/** Small synthesised sound effects (Web Audio, no files). Silent when muted or unsupported. */
export class Sfx {
  private context: AudioContext | null = null;

  constructor(private isMuted: () => boolean) {}

  /** Play a sound. Browsers only allow this after the player has touched the page. */
  play(name: SoundName): void {
    if (this.isMuted()) return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      for (const [frequency, start, length, type] of SOUNDS[name]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type ?? 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(CONFIG.audio.volume, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + length + 0.02);
      }
    } catch {
      // No audio on this device or page: the game plays on in silence.
    }
  }
}
