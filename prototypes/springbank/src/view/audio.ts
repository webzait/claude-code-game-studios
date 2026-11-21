// PROTOTYPE - NOT FOR PRODUCTION
// Sound made in code with Web Audio: no files. Started on the first touch, as iPhone Safari requires.
import { tune } from '../sim/tune.ts';

export class Sound {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTick = 0;
  private lastBell = 0;
  muted = false;

  /** Create or resume the audio context. Call from a pointer or key event. */
  start(): void {
    if (!this.ac) {
      const w = window as unknown as { GAME_AUDIO?: AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext || w.webkitAudioContext;
      if (!w.GAME_AUDIO && !Ctor) return;
      this.ac = w.GAME_AUDIO || new Ctor();
      this.out = this.ac.createGain(); this.out.connect(this.ac.destination);
      const n = (this.noise = this.ac.createBuffer(1, this.ac.sampleRate * 0.6, this.ac.sampleRate)), d = n.getChannelData(0);
      let s = 12345; // a fixed noise table: not gameplay, but the same every run
      for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) | 0; d[i] = (s >>> 0) / 2147483648 - 1; }
      this.apply();
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }
  setMuted(m: boolean): void { this.muted = m; this.apply(); }
  private apply(): void { if (this.out) this.out.gain.value = this.muted ? 0 : tune.volume; }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, at = 0): void {
    if (!this.ac || !this.out) return;
    const t = this.ac.currentTime + at, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  private whoosh(dur: number, from: number, to: number, vol: number): void {
    if (!this.ac || !this.out || !this.noise) return;
    const t = this.ac.currentTime, src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.out); src.start(t); src.stop(t + dur);
  }

  /** A ball lands in the tray: the pitch climbs as the pile grows. */
  catch(held: number, capacity: number): void {
    if (!this.ac || this.ac.currentTime - this.lastTick < 0.035) return;
    this.lastTick = this.ac.currentTime;
    const f = 260 * Math.pow(2, (held / Math.max(1, capacity)) * 1.6);
    this.tone(f, f * 0.7, 0.07, 'triangle', 0.16);
    this.tone(90, 60, 0.05, 'sine', 0.12);
  }
  /** The discharge: a low thump, a spring twang and a rush of air, all scaled by power (0 to 1). */
  launch(power: number): void {
    const p = Math.sqrt(Math.min(1, power));
    this.tone(150 + 60 * p, 38, 0.28 + 0.3 * p, 'sine', 0.5 + 0.45 * p);
    this.tone(210, 420 + 300 * p, 0.16, 'triangle', 0.14 + 0.12 * p);
    this.whoosh(0.3 + 0.35 * p, 500, 2600 + 2500 * p, 0.18 + 0.4 * p);
  }
  score(nth: number): void {
    if (!this.ac || this.ac.currentTime - this.lastBell < 0.03) return;
    this.lastBell = this.ac.currentTime;
    const f = 784 * Math.pow(2, (nth % 8) / 12);
    this.tone(f, f, 0.22, 'sine', 0.2); this.tone(f * 2, f * 2, 0.1, 'sine', 0.07);
  }
  full(): void { this.tone(140, 90, 0.06, 'square', 0.05); }
  win(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.28, 'triangle', 0.22, i * 0.09)); }
  lose(): void { [330, 247].forEach((f, i) => this.tone(f, f * 0.94, 0.35, 'triangle', 0.2, i * 0.18)); }
}
