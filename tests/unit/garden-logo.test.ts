import { describe, expect, it } from 'vitest';
import garden from '../../data/themes/garden/logo.json';
import { gardenLogoVars, logoGrow, showGardenLogo, showRobotLogo, type GardenLogo } from '../../src/ui/themes/garden/logo';

// The garden theme's logo (design/themes/garden-logo.md): the owner's chick logo in the robot logo's place,
// as wide as the robot logo, so its height grows by the ratio of the two shapes.

/** A stand-in for the <img> and the screen: records what is set. */
function stubs(): { img: { attrs: Record<string, string>; setAttribute(n: string, v: string): void }; screen: { props: Record<string, string>; style: { setProperty(n: string, v: string): void } } } {
  const img = { attrs: {} as Record<string, string>, setAttribute(n: string, v: string) { img.attrs[n] = v; } };
  const screen = { props: {} as Record<string, string>, style: { setProperty(n: string, v: string) { screen.props[n] = v; } } };
  return { img, screen };
}

describe('garden logo', () => {
  it('the config matches the picture the build script writes (560x299) and the robot logo (768x360)', () => {
    expect(garden.picture).toEqual({ width: 560, height: 299 });
    expect(garden.robot).toEqual({ width: 768, height: 360 });
  });
  it('grows by the ratio of the two shapes, so at the same width the word is as large as the robot one', () => {
    expect(logoGrow()).toBeCloseTo((768 / 360) / (560 / 299), 6);
    const robotHeightAt265 = 265 * 360 / 768;
    expect(robotHeightAt265 * logoGrow()).toBeCloseTo(265 * 299 / 560, 6);
  });
  it('a shape like the robot logo does not grow; widthVsRobot scales it', () => {
    const same: GardenLogo = { ...garden, picture: { width: 768, height: 360 } };
    expect(logoGrow(same)).toBe(1);
    expect(logoGrow({ ...same, widthVsRobot: 1.2 })).toBeCloseTo(1.2, 6);
  });
  it('the style values carry the growth, the width factor and the shadow', () => {
    expect(gardenLogoVars()).toEqual({ '--tg-logo-grow': '1.1390', '--tg-logo-wide': '1', '--tg-logo-shadow': garden.shadow });
  });
  it('shows the garden picture with its own size, and puts the robot one back', () => {
    const { img, screen } = stubs();
    showGardenLogo(img, screen, garden, 'garden.webp');
    expect(img.attrs).toEqual({ src: 'garden.webp', width: '560', height: '299' });
    expect(screen.props['--tg-logo-grow']).toBe('1.1390');
    showRobotLogo(img, 'logo.webp');
    expect(img.attrs).toEqual({ src: 'logo.webp', width: '768', height: '360' });
  });
});
