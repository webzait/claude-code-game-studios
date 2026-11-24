/**
 * Writes the garden theme's button pictures and colour tokens from data/themes/garden/buttons.json:
 *   src/ui/themes/garden/glyph-*.svg       one symbol per button (art.ts, SHAPES)
 *   src/ui/themes/garden/icon-*.svg        coin, star, empty star, gem, heart, chick, the star strips
 *   src/ui/themes/garden/buttons-tokens.css the colours and measures as custom properties under [data-theme="garden"]
 *
 * Run from the repo root:  npx tsx tools/asset-pipeline/garden-buttons/build.ts
 * The unit test tests/unit/garden-buttons.test.ts fails when the files on disk differ from what this would write.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chickSvg, coinSvg, gemSvg, glyphSvg, heartSvg, starStripSvg, starSvg, type GlyphTone, type IconColours } from './art';

/** The design data, as data/themes/garden/buttons.json holds it. */
export interface GardenButtons {
  finish: Record<string, number | string>;
  tones: Record<string, Record<string, string>>;
  glyphTones: Record<string, GlyphTone | string>;
  glyphs: Record<string, [string, string, string[]] | string>;
  icons: IconColours & { _about?: string };
  topBar: Record<string, string | string[]>;
}

export const OUT = 'src/ui/themes/garden/';

/** Every file the theme's buttons need, by file name, with its content. */
export function gardenFiles(data: GardenButtons): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [name, spec] of Object.entries(data.glyphs)) {
    if (name.startsWith('_') || typeof spec === 'string') continue;
    const tone = data.glyphTones[spec[1]];
    if (!tone || typeof tone === 'string') throw new Error(`Glyph ${name}: unknown tone ${spec[1]}`);
    files[`glyph-${name}.svg`] = glyphSvg(spec[0], tone, 'g') + '\n';
  }
  const i = data.icons;
  files['icon-coin.svg'] = coinSvg(i.coin) + '\n';
  files['icon-star.svg'] = starSvg(i.star) + '\n';
  files['icon-star-off.svg'] = starSvg(i.starOff, 'gs', true) + '\n';
  files['icon-gem.svg'] = gemSvg(i.gem) + '\n';
  files['icon-heart.svg'] = heartSvg(i.heart) + '\n';
  files['icon-chick.svg'] = chickSvg(i.chick) + '\n';
  for (const n of [0, 1, 2, 3]) files[`icon-stars-${n}.svg`] = starStripSvg(i.star, i.starOff, n) + '\n';
  files['buttons-tokens.css'] = tokens(data);
  return files;
}

/** The custom properties the hand-written garden CSS (buttons.css) reads. */
export function tokens(data: GardenButtons): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data.finish)) if (!key.startsWith('_')) lines.push(`  --g-${key}: ${value};`);
  for (const [tone, c] of Object.entries(data.tones)) {
    if (tone.startsWith('_') || typeof c === 'string') continue;
    for (const [part, value] of Object.entries(c)) lines.push(`  --g-${tone}-${part}: ${value};`);
  }
  for (const [key, value] of Object.entries(data.topBar)) {
    if (key.startsWith('_')) continue;
    if (Array.isArray(value)) value.forEach((v, n) => lines.push(`  --g-bar-${key}-${n}: ${v};`));
    else lines.push(`  --g-bar-${key}: ${value};`);
  }
  return `/* Written by tools/asset-pipeline/garden-buttons/build.ts from data/themes/garden/buttons.json: do not edit by hand. */\n[data-theme="garden"] {\n${lines.join('\n')}\n}\n`;
}

if (process.argv[1]?.endsWith('build.ts')) {
  const data = JSON.parse(readFileSync('data/themes/garden/buttons.json', 'utf8')) as GardenButtons;
  const files = gardenFiles(data);
  for (const [name, content] of Object.entries(files)) writeFileSync(OUT + name, content);
  console.log(`Wrote ${Object.keys(files).length} files to ${OUT}`);
}
