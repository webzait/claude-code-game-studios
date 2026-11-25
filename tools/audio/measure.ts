// npm run sounds: measures every button sound of every set as the game plays it and writes the
// table to production/qa/evidence/button-sounds/measurements.md. Numbers only; how a set sounds is
// for a listener to judge (npm run build:sounds).
import { writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { buttonFacts, busyPeak } from '../../src/sound/report';
import { soundSet, soundSetIds } from '../../src/sound/sets';

const db = (v: number): string => (v > 0 ? `${(20 * Math.log10(v)).toFixed(1)} dB` : '-');
const lines: string[] = [
  '# Button sounds: measurements',
  '',
  'Written by `npm run sounds` from the same samples the game plays (48 kHz, volume included).',
  '`Heard` is the time until the sound has fallen for good below a tenth of its peak; `onset` the time until it first reaches half its peak;',
  '`edge` the first or last sample as a share of the peak (0 = starts and ends on silence, so no click).',
  `Volume \`audio.volume\` = ${CONFIG.audio.volume}; full scale is 1 (0 dB).`,
  '',
];
for (const id of soundSetIds()) {
  const set = soundSet(id);
  lines.push(`## ${set.name} (\`${id}\`, timing \`${set.timing}\`, gain ${set.gain}, pitch ${set.pitch})`, '', '| Sound | Length | Heard | Onset | Peak | Peak dB | Level (RMS) | Edge |', '|---|---|---|---|---|---|---|---|');
  for (const f of buttonFacts(id)) {
    lines.push(`| ${f.name} | ${Math.round(f.seconds * 1000)} ms | ${Math.round(f.heardMs)} ms | ${f.onsetMs.toFixed(1)} ms | ${f.peak.toFixed(3)} | ${db(f.peak)} | ${db(f.rms)} | ${f.edge.toFixed(4)} |`);
  }
  lines.push('', `A busy moment with this set (one button sound + one robot sound + the two loudest shared sounds at once): ${busyPeak(id).toFixed(3)} (${db(busyPeak(id))}).`, '');
}
writeFileSync('production/qa/evidence/button-sounds/measurements.md', lines.join('\n'));
console.log(lines.join('\n'));
