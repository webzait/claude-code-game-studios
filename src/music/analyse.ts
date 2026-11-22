import type { Loop } from './synth';

/** What can be said about a loop from its numbers alone. Nothing here judges how it sounds. */
export interface LoopReport {
  seconds: number;
  /** Highest absolute sample value (1 would be the ceiling). */
  peak: number;
  /** Overall loudness (root mean square). */
  rms: number;
  /** Mean of all samples; near zero means no offset that would thump when the music starts or stops. */
  dcOffset: number;
  /** Largest jump between two neighbouring samples anywhere inside the loop. */
  largestStep: number;
  /** The jump from the last sample back to the first. A click at the loop point would show here. */
  seamStep: number;
  /** Loudest and quietest second of the loop (rms), to show it neither swells nor drops out. */
  loudestSecond: number;
  quietestSecond: number;
  /** Share of the sound's energy under 150 Hz (hardly heard on a phone speaker) and over 4 kHz (where harshness lives). */
  energyBelow150Hz: number;
  energyAbove4kHz: number;
}

const round = (value: number, digits = 5): number => +value.toFixed(digits);

/** In-place radix-2 FFT of a complex signal given as two arrays. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const cos = Math.cos(angle * k);
        const sin = Math.sin(angle * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cos - im[b] * sin;
        const ti = re[b] * sin + im[b] * cos;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/** Measure a loop. */
export function analyse(loop: Loop): LoopReport {
  const { left, right, sampleRate } = loop;
  const n = left.length;
  let peak = 0;
  let sum = 0;
  let dc = 0;
  let largestStep = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    sum += left[i] * left[i] + right[i] * right[i];
    dc += left[i] + right[i];
    if (i > 0) largestStep = Math.max(largestStep, Math.abs(left[i] - left[i - 1]), Math.abs(right[i] - right[i - 1]));
  }
  const seamStep = Math.max(Math.abs(left[0] - left[n - 1]), Math.abs(right[0] - right[n - 1]));
  let loudest = 0;
  let quietest = Infinity;
  for (let start = 0; start + sampleRate <= n; start += sampleRate) {
    let s = 0;
    for (let i = start; i < start + sampleRate; i++) s += left[i] * left[i] + right[i] * right[i];
    const rms = Math.sqrt(s / (2 * sampleRate));
    loudest = Math.max(loudest, rms);
    quietest = Math.min(quietest, rms);
  }
  // Spectrum: the average of windowed frames across the whole loop.
  const size = 4096;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let low = 0;
  let high = 0;
  let all = 0;
  for (let start = 0; start + size <= n; start += size) {
    for (let i = 0; i < size; i++) {
      re[i] = (left[start + i] + right[start + i]) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < size / 2; k++) {
      const power = re[k] * re[k] + im[k] * im[k];
      const f = (k * sampleRate) / size;
      all += power;
      if (f < 150) low += power;
      if (f > 4000) high += power;
    }
  }
  return {
    seconds: round(n / sampleRate, 3),
    peak: round(peak, 4),
    rms: round(Math.sqrt(sum / (2 * n)), 4),
    dcOffset: round(dc / (2 * n), 6),
    largestStep: round(largestStep),
    seamStep: round(seamStep),
    loudestSecond: round(loudest, 4),
    quietestSecond: round(quietest, 4),
    energyBelow150Hz: round(all ? low / all : 0, 4),
    energyAbove4kHz: round(all ? high / all : 0, 6),
  };
}
