import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import spec from '../../data/themes/garden/backdrop.json';
import { GARDEN_BACKDROP, sceneLayout, zones } from '../../src/ui/themes/garden/backdropLayout';

// Garden backdrop (design/themes/garden-backdrop.md): where the owner's picture falls on every phone.
// Portrait phones from the smallest supported (320×568) to large ones, plus a portrait tablet.
const PHONES: [number, number][] = [[320, 568], [353, 768], [360, 800], [375, 667], [390, 844], [412, 915], [430, 932]];
const TABLET: [number, number] = [768, 1024];
const SCREENS = [...PHONES, TABLET];
/** Rows of the owner's picture: the gazebo's base and the birdhouse roofs. */
const GAZEBO_BASE = 610;

describe('garden backdrop layout', () => {
  it('the paving tile starts exactly where the scene picture stops', () => {
    expect(spec.paving.pavingTop + spec.paving.period).toBe(spec.scene.sceneRows);
    expect(spec.paving.blend).toBeLessThan(spec.paving.period);
  });

  it.each(SCREENS)('%i×%i: the picture is the screen width and never distorted', (w, h) => {
    const s = sceneLayout(w, h);
    // One scale for both directions: the scene is width × (rows × scale).
    expect(s.scale * spec.source.width).toBeCloseTo(w, 6);
    expect(s.sceneEnd - s.sceneTop).toBeCloseTo(spec.scene.sceneRows * s.scale, 6);
  });

  it.each(SCREENS)('%i×%i: no empty edge: the sky starts above the screen and the paving reaches the bottom', (w, h) => {
    const s = sceneLayout(w, h);
    expect(s.sceneTop).toBeLessThanOrEqual(0);
    expect(s.sceneEnd + s.tiles * spec.paving.period * s.scale).toBeGreaterThanOrEqual(h);
  });

  it.each(SCREENS)('%i×%i: the anchor row lies on the board top edge, the lawn edge behind the board', (w, h) => {
    const z = zones(w, h);
    const s = sceneLayout(w, h);
    expect(s.rowY(spec.scene.anchorRow)).toBeCloseTo(z.boardTop, 6);
    const lawn = s.rowY(spec.scene.lawnEdgeRow);
    expect(lawn).toBeGreaterThan(z.boardTop);
    expect(lawn).toBeLessThan(z.boardTop + z.board);
  });

  it.each(PHONES.filter(([, h]) => h >= 768))('%i×%i: the gazebo stands in the strip between top bar and board', (w, h) => {
    const z = zones(w, h);
    const y = sceneLayout(w, h).rowY(GAZEBO_BASE);
    expect(y).toBeGreaterThan(z.top);
    expect(y).toBeLessThan(z.boardTop);
  });

  it('the stylesheet uses the same numbers as the data file', () => {
    const css = readFileSync('src/ui/themes/garden/garden-scene.css', 'utf8');
    expect(css).toContain(`100cqw / ${GARDEN_BACKDROP.width})`);
    expect(css).toContain(`${GARDEN_BACKDROP.anchorRow} * var(--gd-px)`);
    expect(css.match(new RegExp(`${GARDEN_BACKDROP.sceneRows} \\* var\\(--gd-px\\)`, 'g'))?.length).toBe(2);
    expect(css).toContain(GARDEN_BACKDROP.sky.top);
    expect(css).toContain(GARDEN_BACKDROP.sky.bottom);
    // Every garden rule is scoped to the theme: nothing changes the robot theme.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter((r) => r.includes('{'));
    for (const rule of rules) {
      const selector = rule.slice(0, rule.indexOf('{')).trim();
      if (selector.startsWith('@keyframes') || selector.startsWith('from') || selector.startsWith('to') || selector.startsWith('@media')) continue;
      for (const part of selector.split(',')) expect(part.trim(), part).toMatch(/^\[data-theme="garden"\]/);
    }
  });
});
