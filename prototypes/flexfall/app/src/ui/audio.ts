// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Sound, made in code with Web Audio: glass clicks, the rubber floor, marbles dropping home.

interface AudioWindow { GAME_AUDIO?: AudioContext; webkitAudioContext?: typeof AudioContext }

export class Sound {
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  muted = false;
  constructor(private readonly volume: () => number) {}

  /** Start (or resume) audio. Browsers allow it only after a tap or a key. */
  start(): void {
    const w = window as unknown as AudioWindow;
    if (!this.ac) {
      const Ctor = window.AudioContext ?? w.webkitAudioContext;
      if (!w.GAME_AUDIO && !Ctor) return;
      this.ac = w.GAME_AUDIO ?? new Ctor();
      this.out = this.ac.createGain(); this.out.connect(this.ac.destination); this.apply();
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }
  setMuted(m: boolean): void { this.muted = m; this.apply(); }
  apply(): void { if (this.out) this.out.gain.value = this.muted ? 0 : this.volume(); }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (!this.ac || !this.out || this.muted) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  /** Two marbles, or a marble and a wall: a short glassy click, louder when faster. */
  clack(speed: number, n: number): void {
    const v = Math.min(0.22, 0.03 + speed * 0.03), f = 2100 + ((n * 37) % 9) * 140;
    this.tone(f, f * 0.82, 0.045, 'sine', v); this.tone(f * 2.4, f * 2, 0.02, 'triangle', v * 0.4);
  }
  /** The floor being pulled up or pushed down. */
  flex(up: boolean): void {
    this.tone(up ? 95 : 170, up ? 190 : 80, 0.3, 'sine', 0.5); this.tone(up ? 240 : 320, up ? 330 : 200, 0.12, 'triangle', 0.12);
  }
  /** A marble dropped into the catcher: the pitch climbs with the count. */
  plink(count: number): void {
    const scale = [0, 2, 4, 7, 9], k = count % 15, f = 520 * Math.pow(2, (scale[k % 5] + 12 * Math.floor(k / 5)) / 12);
    this.tone(f, f * 0.995, 0.22, 'triangle', 0.22); this.tone(f * 2, f * 2, 0.1, 'sine', 0.08);
  }
  win(): void { [0, 4, 7, 12].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), 0.5, 'triangle', 0.2, i * 0.09)); }
  lose(): void { this.tone(220, 150, 0.45, 'sine', 0.3); this.tone(165, 110, 0.6, 'sine', 0.25, 0.15); }
  refuse(): void { this.tone(160, 140, 0.08, 'square', 0.06); }
}
