import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataUrlBytes } from '../../src/parts/gardenIcon';

// The garden theme's app icons (design/themes/garden-icon.md), made by
// assets/turnflock/garden/icon/build-icon-garden.py, follow the robot icons' format.

/** Width, height, PNG colour type and whether a transparency chunk is present. */
function png(path: string): { width: number; height: number; colourType: number; transparency: boolean } {
  const b = readFileSync(resolve(path));
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  const colourType = b[25];
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType, transparency: colourType === 6 || colourType === 4 || b.includes(Buffer.from('tRNS')) };
}

describe('garden app icons', () => {
  it('the home-screen icon is 180x180 and opaque, like the robot one', () => {
    const garden = png('assets/turnflock/garden/icon/icon-180-garden.png');
    const robot = png('assets/turnflock/brand/icon-180.png');
    expect(garden).toMatchObject({ width: 180, height: 180, transparency: false });
    expect(robot).toMatchObject({ width: 180, height: 180, transparency: false });
  });
  it('the tab icon is 64x64 with transparent (rounded) corners, like the robot one', () => {
    expect(png('assets/turnflock/garden/icon/favicon-64-garden.png')).toMatchObject({ width: 64, height: 64, transparency: true });
    expect(png('assets/turnflock/brand/favicon-64.png')).toMatchObject({ width: 64, height: 64, transparency: true });
  });
  it('the reference picture the icons are cut from is in the repo', () => {
    const webp = readFileSync(resolve('design/reference/turnflock/garden/27-app-icon-garden.webp'));
    expect(webp.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });
});

describe('dataUrlBytes', () => {
  it('counts the decoded bytes of a base64 data URL, padding included', () => {
    expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,QUI=')).toBe(2);
    expect(dataUrlBytes('data:image/png;base64,QQ==')).toBe(1);
  });
  it('is null for a plain URL or a data URL that is not base64', () => {
    expect(dataUrlBytes('./assets/icon-180.abc.png')).toBeNull();
    expect(dataUrlBytes('data:text/plain,hello')).toBeNull();
  });
});
