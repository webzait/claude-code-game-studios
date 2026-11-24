/**
 * The garden theme's button symbols and icons, drawn as SVG (design/themes/garden-buttons.md).
 *
 * The owner's sheets (design/reference/turnflock/garden/18, 19, 20) are about 130 pixels across, far too small to cut
 * out and stay sharp on a phone, so every picture is redrawn here as vector art in their style: fat rounded shapes, a
 * soft top-to-bottom fill, an outline where the sheet has one, and a shade under the shape. Pure functions only:
 * build.ts writes their output to src/ui/themes/garden/, and the unit tests check them.
 */

/** A part of a symbol: a filled outline, or a thick round-capped line of width `w` (in the 48-unit box). */
export type Prim = { fill: string; evenodd?: boolean; rotate?: number } | { line: string; w: number };

/** How a symbol is painted (data/themes/garden/buttons.json, `glyphTones`). */
export interface GlyphTone {
  fillTop: string;
  fillBottom: string;
  outline: string | null;
  shade: string;
  shadeOpacity: number;
}

const f = (n: number): string => (Math.round(n * 100) / 100).toString();
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

/** An arc of radius r round (cx, cy) from angle a0 to a1 in degrees, screen coordinates (clockwise when a1 > a0). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`;
}

/** A filled arrowhead whose tip lies `len` beyond (x, y) along `deg`, `half` wide on each side. */
function head(x: number, y: number, deg: number, len: number, half: number, back = 0): string {
  const [tx, ty] = pt(x, y, len, deg);
  const [bx, by] = pt(x, y, back, deg + 180);
  const [lx, ly] = pt(bx, by, half, deg - 90);
  const [rx, ry] = pt(bx, by, half, deg + 90);
  return `M${f(tx)} ${f(ty)}L${f(lx)} ${f(ly)}L${f(rx)} ${f(ry)}Z`;
}

/** A polygon of `n` points alternating between radius `outer` and `inner`, the first one straight up. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5): string {
  const out: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const [x, y] = pt(cx, cy, i % 2 ? inner : outer, -90 + (180 / n) * i);
    out.push(`${f(x)} ${f(y)}`);
  }
  return `M${out.join('L')}Z`;
}

/** The block arrow of reference 18, pointing up; turned for the other directions. */
const ARROW_UP = 'M24 6.5 39.5 22.5H30.5V39.5H17.5V22.5H8.5Z';
const turned = (deg: number): Prim[] => [{ fill: ARROW_UP, rotate: deg }];

/** The gear of reference 19: eight square teeth round a ring with a hole. */
function gear(): string {
  const pts: string[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const c = (360 / teeth) * i - 90;
    for (const [r, d] of [[13, -15], [17.5, -10], [17.5, 10], [13, 15]] as const) {
      const [x, y] = pt(24, 24, r, c + d);
      pts.push(`${f(x)} ${f(y)}`);
    }
  }
  const [hx, hy] = [24, 24];
  return `M${pts.join('L')}ZM${hx + 5.6} ${hy}A5.6 5.6 0 1 0 ${hx - 5.6} ${hy}A5.6 5.6 0 1 0 ${hx + 5.6} ${hy}Z`;
}

/** Every symbol shape, in a 48-unit box. */
export const SHAPES: Record<string, Prim[]> = {
  // Reference 18, top right: a C open to the right, the arrowhead on its upper end, turning clockwise.
  turn: [{ line: arc(22, 26, 12, 45, 282), w: 8 }, { fill: head(...pt(22, 26, 12, 280), 10, 13, 7.5, 2) }],
  forward: turned(0),
  next: turned(90),
  back: turned(-90),
  // Reference 18, bottom left: a ring open on the left, turning back (anticlockwise): start again.
  restart: [{ line: arc(26, 25, 12, 140, -100), w: 7.5 }, { fill: head(...pt(26, 25, 12, -98), -188, 12.5, 7.5, 2) }],
  // One step back: the arrowhead points left, the line bends round under it.
  undo: [{ fill: 'M6 17 18 7V27Z' }, { line: 'M16 17H28A9.5 9.5 0 0 1 28 36H18', w: 7.5 }],
  // A bulb with a rounded glass, a neck and a base.
  hint: [{ fill: 'M24 5A12.5 12.5 0 0 1 31.5 27.5L30.5 31H17.5L16.5 27.5A12.5 12.5 0 0 1 24 5Z' }, { line: 'M19 37.5H29', w: 5.5 }],
  // Reference 19: the house with a door cut out.
  home: [{ fill: 'M24 6.5 42.5 22H37.5V40.5H29V31.5Q29 29 26.5 29H21.5Q19 29 19 31.5V40.5H10.5V22H5.5Z' }],
  play: [{ fill: 'M14 8.5 39 24 14 39.5Z' }],
  prev: [{ line: 'M28.5 10.5 15 24 28.5 37.5', w: 7.5 }],
  chevron: [{ line: 'M19.5 10.5 33 24 19.5 37.5', w: 7.5 }],
  gear: [{ fill: gear(), evenodd: true }],
  // Reference 19: a speaker with two waves.
  sound: [{ fill: 'M7 18H14L24 9V39L14 30H7Z' }, { line: arc(25, 24, 7.5, -45, 45), w: 4.5 }, { line: arc(25, 24, 14, -48, 48), w: 4.5 }],
  plus: [{ line: 'M24 10V38M10 24H38', w: 8 }],
};

/** How much a filled shape is rounded: it is stroked in its own paint with this width. */
const ROUND = 3;
/** How far the shade sits under the symbol. */
const DROP = 2;

/** One primitive painted in `paint`, grown by `grow` on each side. */
function paintPrim(p: Prim, paint: string, grow: number): string {
  if ('line' in p) return `<path d="${p.line}" fill="none" stroke="${paint}" stroke-width="${f(p.w + grow * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const transform = p.rotate ? ` transform="rotate(${p.rotate} 24 24)"` : '';
  const rule = p.evenodd ? ' fill-rule="evenodd"' : '';
  return `<path d="${p.fill}"${rule} fill="${paint}" stroke="${paint}" stroke-width="${f(ROUND + grow * 2)}" stroke-linejoin="round"${transform}/>`;
}

/**
 * A symbol as a standalone SVG: the shade, the outline (when the tone has one) and the fill, each layer the same
 * shape. `id` keeps the gradient ids apart when several pictures share a page.
 */
export function glyphSvg(shape: string, tone: GlyphTone, id: string): string {
  const prims = SHAPES[shape];
  if (!prims) throw new Error(`Unknown garden symbol: ${shape}`);
  const o = tone.outline ? 2.6 : 0;
  const layer = (paint: string, grow: number): string => prims.map((p) => paintPrim(p, paint, grow)).join('');
  const grad = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="42"><stop offset="0" stop-color="${tone.fillTop}"/><stop offset="1" stop-color="${tone.fillBottom}"/></linearGradient>`;
  const shade = `<g transform="translate(0 ${DROP})" opacity="${tone.shadeOpacity}">${layer(tone.shade, o + 0.6)}</g>`;
  const outline = tone.outline ? layer(tone.outline, o) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs>${grad}</defs>${shade}${outline}${layer(`url(#${id})`, 0)}</svg>`;
}

/** Colours of the icons (data/themes/garden/buttons.json, `icons`). */
export interface IconColours {
  coin: { rim: string; edge: string; face: string[]; ring: string; star: string[]; starEdge: string };
  star: { fill: string[]; edge: string; deep: string };
  starOff: { fill: string[]; edge: string; deep: string };
  gem: { light: string; main: string; mid: string; dark: string; edge: string };
  heart: { fill: string[]; edge: string };
  chick: { body: string[]; edge: string; beak: string; eye: string };
}

const stops = (colours: string[]): string => colours.map((c, i) => `<stop offset="${f(i / Math.max(1, colours.length - 1))}" stop-color="${c}"/>`).join('');
const vgrad = (id: string, colours: string[], y1 = 4, y2 = 60): string => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">${stops(colours)}</linearGradient>`;
const svg64 = (defs: string, body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
/** The chubby star of reference 20: deep points, rounded by a thick stroke in its own colour. */
const CHUBBY = (cx: number, cy: number, r: number): string => starPoints(cx, cy, r, r * 0.6);

/** Reference 20, first: a thick gold coin seen from the front, a ring and a raised star on its face. */
export function coinSvg(c: IconColours['coin'], id = 'gc'): string {
  const defs = vgrad(`${id}f`, c.face, 8, 54) + vgrad(`${id}s`, c.star, 20, 44);
  return svg64(
    defs,
    `<circle cx="32" cy="34.5" r="27" fill="${c.edge}"/>` +
      `<circle cx="32" cy="31" r="27" fill="${c.rim}"/>` +
      `<circle cx="32" cy="31" r="24" fill="url(#${id}f)"/>` +
      `<circle cx="32" cy="31" r="18.5" fill="none" stroke="${c.ring}" stroke-width="2.6" opacity=".85"/>` +
      `<path d="${CHUBBY(32, 32.6, 11.5)}" fill="${c.starEdge}" stroke="${c.starEdge}" stroke-width="4.5" stroke-linejoin="round" opacity=".8"/>` +
      `<path d="${CHUBBY(32, 31.4, 11.5)}" fill="url(#${id}s)" stroke="url(#${id}s)" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<path d="M12.5 24A21 21 0 0 1 28 10.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".7"/>`,
  );
}

/** Reference 20, second: a fat gold star with a darker underside and a gloss on its upper left. Off: an empty slot. */
export function starSvg(c: IconColours['star'], id = 'gs', off = false): string {
  const defs = vgrad(`${id}f`, c.fill, 6, 56);
  const gloss = off ? '' : `<path d="M21 23.5Q24 16.5 29 13.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`;
  return svg64(
    defs,
    `<path d="${CHUBBY(32, 37, 24.5)}" fill="${c.deep}" stroke="${c.deep}" stroke-width="11" stroke-linejoin="round"/>` +
      `<path d="${CHUBBY(32, 34, 24.5)}" fill="${c.edge}" stroke="${c.edge}" stroke-width="11" stroke-linejoin="round"/>` +
      `<path d="${CHUBBY(32, 34, 23.5)}" fill="url(#${id}f)" stroke="url(#${id}f)" stroke-width="8.5" stroke-linejoin="round"/>` +
      gloss,
  );
}

/** Reference 20, third: a magenta gem, a flat table on top, facets down to a point. */
export function gemSvg(c: IconColours['gem']): string {
  // Girdle at y 24 from x 5 to 59; crown up to the table at y 11; the point at y 58.
  return svg64(
    '',
    `<path d="M18 9H46L60 24 32 59 4 24Z" fill="${c.edge}" stroke="${c.edge}" stroke-width="3" stroke-linejoin="round" transform="translate(0 1.5)"/>` +
      `<path d="M18 9H46L60 24 32 59 4 24Z" fill="${c.main}" stroke="${c.main}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path d="M4 24H60L32 59Z" fill="${c.mid}"/>` +
      `<path d="M18 24H46L32 59Z" fill="${c.main}"/>` +
      `<path d="M4 24 18 9 22 24ZM60 24 46 9 42 24Z" fill="${c.mid}"/>` +
      `<path d="M22 24 26 13H38L42 24Z" fill="${c.light}"/>` +
      `<path d="M18 9H46L38 13H26Z" fill="${c.light}" opacity=".75"/>` +
      `<path d="M32 59 46 24H60Z" fill="${c.dark}" opacity=".7"/>` +
      `<path d="M27 15.5H35" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>`,
  );
}

/** Reference 20, fourth: a glossy red heart. */
export function heartSvg(c: IconColours['heart'], id = 'gh'): string {
  const d = 'M32 56C29 53 6 40 6 22.5 6 13.5 12.5 7.5 20 7.5 25.5 7.5 29.6 10.6 32 15 34.4 10.6 38.5 7.5 44 7.5 51.5 7.5 58 13.5 58 22.5 58 40 35 53 32 56Z';
  return svg64(
    vgrad(`${id}f`, c.fill, 8, 54),
    `<path d="${d}" fill="${c.edge}" transform="translate(0 2.5)"/>` +
      `<path d="${d}" fill="url(#${id}f)" stroke="${c.edge}" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<path d="M13 19.5Q14.5 13 21 12.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>` +
      `<circle cx="13.6" cy="25.4" r="1.9" fill="#fff" opacity=".6"/>`,
  );
}

/** A small chick for the "chicks home" counter of the top bar (the robot theme has a robot there). */
export function chickSvg(c: IconColours['chick'], id = 'gk'): string {
  return svg64(
    vgrad(`${id}f`, c.body, 8, 58),
    `<path d="M32 10C42 10 47 17 46.5 25 54 27 58 35 55 44 51.5 54 42 58 32 58 19 58 9 51 9 40 9 32 14 27 19 25.5 18 17 23 10 32 10Z" fill="url(#${id}f)" stroke="${c.edge}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M16 41Q22 47 30 43" fill="none" stroke="${c.edge}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M44.5 22.5 54 25.5 45.5 29.5Z" fill="${c.beak}" stroke="${c.beak}" stroke-width="2" stroke-linejoin="round"/>` +
      `<circle cx="38" cy="21" r="3.2" fill="${c.eye}"/><circle cx="39" cy="20" r="1" fill="#fff"/>` +
      `<path d="M30 10.5Q28 4 33 3.5M33 10.5Q35 5 39 6.5" fill="none" stroke="${c.edge}" stroke-width="2.6" stroke-linecap="round"/>`,
  );
}

/** The three stars of a level tile in a row (1 to 3 earned), for the test grid of the level screen. */
export function starStripSvg(on: IconColours['star'], off: IconColours['starOff'], earned: number): string {
  const one = (x: number, y: number, lit: boolean): string => {
    const c = lit ? on : off;
    return `<g transform="translate(${x} ${y}) scale(.235)"><path d="${CHUBBY(32, 36, 26)}" fill="${c.deep}" stroke="${c.deep}" stroke-width="7" stroke-linejoin="round"/><path d="${CHUBBY(32, 33, 25)}" fill="url(#s${lit ? 'on' : 'off'})" stroke="${c.edge}" stroke-width="5" stroke-linejoin="round"/></g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 19"><defs>${vgrad('son', on.fill, 6, 56)}${vgrad('soff', off.fill, 6, 56)}</defs>${one(1.5, 3, earned >= 1)}${one(18.5, 0.5, earned >= 2)}${one(35.5, 3, earned >= 3)}</svg>`;
}

/**
 * WCAG contrast ratio between two `#rrggbb` colours, 1 to 21. Used by the tests: a symbol must stand out from its
 * button at least as well as the robot theme's symbols do.
 */
export function contrast(a: string, b: string): number {
  const lum = (hex: string): number => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
