import { describe, expect, it } from 'vitest';
import { iconType, inlineLinkIcons } from '../../tools/single-file/inlineLinkIcons';

// The single-file build puts index.html's link icons into the page (tools/single-file/inlineLinkIcons.ts,
// design/themes/garden-icon.md), so the one file carries its own tab and home-screen icon.

const BYTES = new Uint8Array([1, 2, 3]); // base64 "AQID"
const PAGE = '<head><link rel="icon" type="image/png" href="./fav-x1.png" /><link rel="apple-touch-icon" href="./touch-x2.png" /><link rel="stylesheet" href="./fav-x1.png" /></head>';

describe('inlineLinkIcons', () => {
  it('turns the icon and touch-icon hrefs into data URLs and names the inlined files', () => {
    const files = new Map([['fav-x1.png', BYTES], ['touch-x2.png', BYTES]]);
    const { html, inlined } = inlineLinkIcons(PAGE, files);
    expect(html).toContain('<link rel="icon" type="image/png" href="data:image/png;base64,AQID" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="data:image/png;base64,AQID" />');
    expect(inlined).toEqual(['fav-x1.png', 'touch-x2.png']);
  });
  it('leaves other links, and hrefs that match no file, alone', () => {
    const { html, inlined } = inlineLinkIcons(PAGE, new Map([['fav-x1.png', BYTES]]));
    expect(html).toContain('<link rel="stylesheet" href="./fav-x1.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="./touch-x2.png" />');
    expect(inlined).toEqual(['fav-x1.png']);
  });
  it('knows the icon media types and nothing else', () => {
    expect(iconType('a.PNG')).toBe('image/png');
    expect(iconType('a.webp')).toBe('image/webp');
    expect(iconType('a.js')).toBeNull();
  });
});
