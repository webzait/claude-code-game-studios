// npm run music:measure -> what can be measured about each music variant without ears:
// length, loudness, headroom, the loop seam, and how the voices balance.
// Writes production/qa/evidence/music/measurements.json and prints a table.
import { mkdirSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { analyse } from '../../src/music/analyse';
import { barsOf, loudness, notesOf, renderLoop, type Score } from '../../src/music/synth';
import { MUSIC_VARIANTS, renderOptionsOf, scoreOf } from '../../src/music/tracks';

const db = (x: number): string => `${(20 * Math.log10(x)).toFixed(1)} dB`;
const out: Record<string, unknown> = {};
for (const variant of MUSIC_VARIANTS) {
  const score = scoreOf(variant);
  const options = renderOptionsOf(variant);
  const started = performance.now();
  const loop = renderLoop(score, options);
  const renderMs = Math.round(performance.now() - started);
  const report = analyse(loop);
  const voices = score.voices.map((voice) => {
    const solo: Score = { ...score, voices: [voice] };
    // Unlevelled, so the voices compare as they sit in the mix.
    const raw = renderLoop(solo, { ...options, level: 0 });
    const mix = loudness(raw.left, raw.right);
    return { instrument: voice.instrument, share: mix.rms };
  });
  const loudest = Math.max(...voices.map((v) => v.share));
  out[variant] = {
    title: score.title,
    bpm: options.bpm,
    bars: barsOf(score).length,
    notes: notesOf(score).length,
    renderMs,
    memoryMB: +((loop.left.length * 8) / 1e6).toFixed(1),
    ...report,
    inGame: { volume: CONFIG.music.volume, peak: +(report.peak * CONFIG.music.volume).toFixed(3), rms: +(report.rms * CONFIG.music.volume).toFixed(4) },
    voices: voices.map((v) => ({ instrument: v.instrument, relative: db(v.share / loudest) })),
  };
}
mkdirSync('production/qa/evidence/music', { recursive: true });
writeFileSync('production/qa/evidence/music/measurements.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
