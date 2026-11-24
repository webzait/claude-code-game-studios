// Garden theme buttons and icons (design/themes/garden-buttons.md): the generated pictures are up to date, every symbol
// stands out from the block it sits on, and the theme's CSS only applies under [data-theme="garden"] and never changes
// a button's footprint (touch targets and the gap between helpers and commands, finding B11).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import data from '../../data/themes/garden/buttons.json';
import { contrast, glyphSvg, SHAPES, starPoints, type GlyphTone } from '../../tools/asset-pipeline/garden-buttons/art';
import { gardenFiles, OUT, type GardenButtons } from '../../tools/asset-pipeline/garden-buttons/build';

const DATA = data as unknown as GardenButtons;
const CSS = readFileSync(`${OUT}buttons.css`, 'utf8');
/** WCAG's minimum for symbols and other non-text parts of a control. */
const NON_TEXT = 3;
const glyphs = Object.entries(DATA.glyphs).filter((e): e is [string, [string, string, string[]]] => !e[0].startsWith('_'));

/** The CSS rules of a style sheet as [selector list, body], comments and at-rules left out. */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1].trim(), m[2]]);
  return out;
}

describe('garden buttons: generated files', () => {
  it('pictures and tokens on disk match the design data', () => {
    const files = gardenFiles(DATA);
    for (const [name, content] of Object.entries(files)) expect(readFileSync(OUT + name, 'utf8'), `${name}: run npx tsx tools/asset-pipeline/garden-buttons/build.ts`).toBe(content);
  });

  it('every picture the css names exists', () => {
    const named = [...CSS.matchAll(/url\('\.\/([^']+)'\)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(20);
    for (const name of named) expect(existsSync(OUT + name), name).toBe(true);
  });

  it('every glyph uses a known shape and tone and is one svg', () => {
    for (const [name, [shape, tone]] of glyphs) {
      expect(SHAPES[shape], name).toBeDefined();
      const svg = glyphSvg(shape, DATA.glyphTones[tone] as GlyphTone, 'g');
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'), name).toBe(true);
      expect(svg.endsWith('</svg>'), name).toBe(true);
    }
  });

  it('a star has ten points starting straight up', () => {
    const points = starPoints(32, 32, 20, 10).slice(1, -1).split('L');
    expect(points).toHaveLength(10);
    expect(points[0]).toBe('32 12');
  });
});

describe('garden buttons: legibility', () => {
  it('every symbol stands out from each block it sits on', () => {
    for (const [name, [, toneName, blocks]] of glyphs) {
      const tone = DATA.glyphTones[toneName] as GlyphTone;
      for (const block of blocks) {
        const face = DATA.tones[block].main;
        // The outline carries the contrast where there is one (white on yellow); otherwise the fill does, at its palest.
        const best = Math.max(contrast(tone.fillBottom, face), tone.outline ? contrast(tone.outline, face) : 0);
        expect(best, `${name} on ${block}`).toBeGreaterThanOrEqual(NON_TEXT);
      }
    }
  });

  it('the command colours are the game colours of the chicks', () => {
    const game = readFileSync('src/ui/tf-buttons.css', 'utf8');
    for (const c of ['red', 'blue', 'yellow'] as const) {
      const main = new RegExp(`\\.tf-action\\.${c} \\{[^}]*--c-main: (#[0-9a-f]{6})`).exec(game)![1];
      expect(DATA.tones[c].main, c).toBe(main);
    }
  });

  it('forward stays clearly apart from blue', () => {
    expect(contrast(DATA.tones.forward.main, DATA.tones.blue.main)).toBeGreaterThanOrEqual(1.8);
  });
});

describe('garden buttons: the robot theme and the layout stay as they are', () => {
  it('every rule applies only under the garden theme', () => {
    const all = rules(CSS);
    expect(all.length).toBeGreaterThan(40);
    for (const [selectors] of all) for (const s of selectors.split(/,(?![^(]*\))/)) expect(s.trim().startsWith('[data-theme="garden"]'), s.trim()).toBe(true);
  });

  it('no rule changes a footprint or a gap', () => {
    for (const [selectors, body] of rules(CSS)) {
      if (selectors.includes('.back .ico') || selectors.includes('.tf-status-tab .ico')) continue; // pictures inside, not targets
      expect(body, selectors).not.toMatch(/(^|[;\s])--(w|h|d|tool-[a-z]+|tools-clear|tag-over)\s*:/);
      expect(body, selectors).not.toMatch(/(^|[;\s])(width|height|min-width|min-height|margin|padding|gap)\s*:/);
    }
  });
});
