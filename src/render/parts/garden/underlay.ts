/**
 * Garden board: the underlay (`buildUnderlay`), a plate tucked under the braid whose top is the grass
 * bed between the tiles. Sizes and colours: `data/themes/garden/underlay.json`. Reference: `01-board-full`.
 */
import * as THREE from 'three';
import TILE from '../../../../data/themes/garden/tile.json';
import UNDER from '../../../../data/themes/garden/underlay.json';
import { Mesher, once, outlineRect, plainMaterial, shadowed } from './geometry';
import { fur, mottle, painted } from './paint';
import { boardFootprint, seeded } from './layout';
import { imageTexture } from './rim';
import bedUrl from '../../../../assets/turnflock/garden/board/bed/bed.webp';
import bladesUrl from '../../../../assets/turnflock/garden/board/bed/blades.webp';

const T = TILE.tile;
const I = TILE.image;
const G = { underlay: UNDER.underlay, blades: UNDER.blades };
const C = UNDER.colors;

/** The grass bed between the tiles, seen from above: deeper green, dense short blades; repeats every `bedRepeat` cells. */
export function bedTexture(): THREE.Texture | null {
  const u = G.underlay;
  return painted('bed', u.texture, u.texture, (g, n) => {
    const rand = seeded(u.seed);
    g.fillStyle = C.bed;
    g.fillRect(0, 0, n, n);
    mottle(g, n, n, rand, 20, [C.bedLight, C.bedDark], 0.3, true);
    fur(g, n, n, rand, Math.round(n * n * 0.09), [C.bedDark, C.bedLight, C.bed, TILE.colors.blade], 0.6, n * 0.03, true);
  }, true);
}

const bed = imageTexture(bedUrl, true);

const blades = imageTexture(bladesUrl, true);
if (blades.texture) blades.texture.wrapT = THREE.ClampToEdgeWrapping;

/**
 * The blade cards that make up the whole bed (`blades.webp`): see-through between the blades,
 * with smooth cut edges where the renderer antialiases (`alphaToCoverage`), matte and toned like
 * the tiles. Each card is darker at its root (vertex colours), as the blades in front shade it.
 */
export const bladeMaterial = new THREE.MeshLambertMaterial({
  map: blades.texture,
  alphaTest: G.blades.alphaTest,
  alphaToCoverage: true,
  side: THREE.DoubleSide,
  vertexColors: true,
  color: new THREE.Color(1, 1, 1).multiplyScalar(G.blades.tone),
});

/** Settles once the grass bed pictures (`bed.webp`, `blades.webp`, built by `assets/turnflock/garden/board/bed/build-bed.py`) have loaded. */
export const bedReady: Promise<void> = Promise.all([bed.ready, blades.ready]).then(() => undefined);

/**
 * The grass bed's material: a sharp repeating patch of pointed blades in the colours of
 * `01-board-full` (`bed.webp`, see `design/themes/garden-board-bed.md`), lit like the tiles and
 * scaled by `bedTone` so it sits with them as in the picture. Outside a browser, or before it
 * loads in the tests, the painted bed (`bedTexture`) stands in.
 */
export const bedMaterial = new THREE.MeshLambertMaterial({
  map: bed.texture ?? bedTexture(),
  // Under the blades the bed is only the shade between them, so it is darker there.
  color: new THREE.Color(1, 1, 1).multiplyScalar(blades.texture ? G.blades.ground : G.underlay.bedTone),
});

/**
 * Underlay: one plate under the whole board, `lip` wider than the rim all round, its top the
 * grass bed at y = 0 that shows between the tiles (a deeper green, dense short blades), its sides
 * dark soil. `pegs` adds one socket per tile, as on the robot underlay (hidden in the game).
 */
export function buildUnderlay(cols: number, rows: number, gap: number, pegs = false): THREE.Group {
  const u = G.underlay;
  const { outerW, outerD } = boardFootprint(cols, rows, gap);
  const w = outerW + 2 * u.lip;
  const d = outerD + 2 * u.lip;
  // Its corners follow the braid's outside, so no bed shows past the twigs.
  const radius = Math.min(u.cornerRadius, Math.min(w, d) / 2);
  const plate = new THREE.Group();

  // The bed: a flat top textured in world units, so the blades are the same size on every board.
  const bed = new THREE.ShapeGeometry(roundedShape(w, d, radius, 8));
  bed.rotateX(-Math.PI / 2);
  const pos = bed.getAttribute('position');
  const uv = bed.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / u.bedRepeat, -pos.getZ(i) / u.bedRepeat);
  plate.add(new THREE.Mesh(bed, bedMaterial));

  // The sides: dark soil, a rounded shoulder at the top and a chamfer underneath.
  const soil = new THREE.Color(C.soil);
  const deep = new THREE.Color(C.soilDark);
  const m = new Mesher();
  const ringsOf: { inset: number; y: number; out: number; up: number; c: THREE.Color }[] = [
    { inset: 0.03, y: -u.height, out: 0.5, up: -1, c: deep },
    { inset: 0, y: -u.height + 0.03, out: 1, up: -0.3, c: deep },
    { inset: 0, y: -0.025, out: 1, up: 0.2, c: soil },
    { inset: 0.012, y: -0.004, out: 0.6, up: 1, c: soil.clone().lerp(new THREE.Color(C.bedDark), 0.5) },
    { inset: 0.02, y: 0, out: 0, up: 1, c: new THREE.Color(C.bedDark) },
  ];
  const sideRows = ringsOf.map((ring) => {
    const len = Math.hypot(ring.out, ring.up);
    return outlineRect(w, d, radius, ring.inset, 8).map((p) => m.vertex(new THREE.Vector3(p.x, ring.y, p.z), new THREE.Vector3((p.nx * ring.out) / len, ring.up / len, (p.nz * ring.out) / len), 0, 0, ring.c));
  });
  m.grid(sideRows, true);
  plate.add(new THREE.Mesh(m.build(), plainMaterial));

  if (pegs) {
    const socket = once('garden-socket', () => {
      const g = new THREE.BoxGeometry(0.16, 0.04, 0.16);
      const count = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [soil.r, soil.g, soil.b]).flat(), 3));
      return g;
    });
    const pitch = T.size + gap;
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      const mesh = new THREE.Mesh(socket, plainMaterial);
      mesh.position.set((x - (cols - 1) / 2) * pitch, -0.02, (z - (rows - 1) / 2) * pitch);
      plate.add(mesh);
    }
  }
  shadowed(plate);
  if (blades.texture) {
    // The blades take the tiles' shadows but cast none (a cut-out casts a square one).
    const field = new THREE.Mesh(bladeFieldGeometry(cols, rows, gap), bladeMaterial);
    field.name = 'garden-bed-blades';
    field.castShadow = false;
    field.receiveShadow = true;
    // Kept out of the game's fusing (src/render/kit.ts), which turns every shadow on.
    field.userData.keepApart = true;
    plate.add(field);
  }
  return plate;
}

/** Half the width of a rounded square of half-size `half` and corner radius `r`, at `dz` from its middle (0 outside). */
function roundedHalf(half: number, r: number, dz: number): number {
  const a = Math.abs(dz);
  if (a >= half) return 0;
  const straight = half - r;
  if (a <= straight) return half;
  const k = a - straight;
  return straight + Math.sqrt(Math.max(0, r * r - k * k));
}

/**
 * Where the bed shows along one row at depth `z`: the stretches of x inside the rim's inner edge
 * (pushed out by `outset`) and outside every tile's wall (pulled in by `tuck`, so the cards end
 * inside the walls and no cut edge shows). Returned as [from, to] pairs, left to right.
 */
export function bedSpans(cols: number, rows: number, gap: number, z: number): [number, number][] {
  const b = G.blades;
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const a = innerW / 2 + b.outset;
  const d = innerD / 2 + b.outset;
  const r = Math.min(b.cornerRadius, a, d);
  const edge = roundedHalf(d, r, z) > 0 ? a - (d - roundedHalf(d, r, z)) : 0;
  if (edge <= 0) return [];
  const pitch = T.size + gap;
  const hw = I.wall / 2 - b.tuck;
  const rw = Math.max(0, I.wallRadius - b.tuck);
  const row = Math.min(rows - 1, Math.max(0, Math.round(z / pitch + (rows - 1) / 2)));
  const half = roundedHalf(hw, rw, z - (row - (rows - 1) / 2) * pitch);
  const spans: [number, number][] = [];
  let from = -edge;
  if (half > 0) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * pitch;
      const lo = Math.max(-edge, x - half);
      if (lo > from) spans.push([from, Math.min(lo, edge)]);
      from = Math.max(from, x + half);
    }
  }
  if (edge > from) spans.push([from, edge]);
  return spans.filter(([p, q]) => q - p > 0.004);
}

/**
 * The bed's blades: a row of see-through cards every `blades.step` cells from the far rim to the
 * near one, each card filling one stretch of bed along its row (`bedSpans`) and leaning back from
 * the camera by `lean` so the blades are seen face-on, as standing grass seen from the front. A
 * row along a gap is one long card; a row through a row of tiles is one short card per gap. Each
 * row takes its own strip of the atlas, its own offset along it and its own height, so neither
 * rows nor repeats line up. Within `rimBand` of the rim they grow up to `rimHeight` times taller,
 * standing against the braid as in the picture. Two triangles per card; lit as if lying flat,
 * like the bed round it.
 */
export function bladeFieldGeometry(cols: number, rows: number, gap: number): THREE.BufferGeometry {
  const b = G.blades;
  const rimTall = (distance: number): number => 1 + (b.rimHeight - 1) * Math.max(0, 1 - distance / b.rimBand);
  const { innerD } = boardFootprint(cols, rows, gap);
  const rand = seeded(b.seed);
  const lean = (b.lean * Math.PI) / 180;
  const atlasPx = (b.stripPx + b.padPx) * b.variants;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const far = -innerD / 2 - b.outset;
  const count = Math.ceil((innerD + 2 * b.outset) / b.step);
  for (let i = 0; i <= count; i++) {
    const z = far + (i + (rand() - 0.5) * b.jitter) * b.step;
    const h = b.height * (1 + (rand() * 2 - 1) * b.heightJitter);
    const variant = Math.floor(rand() * b.variants) % b.variants;
    const offset = rand();
    const vTop = 1 - (variant * (b.stripPx + b.padPx) + b.padPx / 2) / atlasPx;
    const vBottom = vTop - b.stripPx / atlasPx;
    const card = (x0: number, x1: number, tall: number): void => {
      const up = h * tall * Math.cos(lean);
      const back = h * tall * Math.sin(lean);
      const k = positions.length / 3;
      positions.push(x0, 0.003, z, x1, 0.003, z, x0, up, z - back, x1, up, z - back);
      const u0 = x0 / b.repeat + offset;
      const u1 = x1 / b.repeat + offset;
      uvs.push(u0, vBottom, u1, vBottom, u0, vTop, u1, vTop);
      const s = b.rootShade;
      colors.push(s, s, s, s, s, s, 1, 1, 1, 1, 1, 1);
      index.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
    };
    // Against the braid the blades stand taller, as in the picture: the rows near the far rim,
    // and the ends of every row that meet the rim on the left and right.
    const farTall = rimTall(z - far);
    const spans = bedSpans(cols, rows, gap, z);
    if (!spans.length) continue;
    const left = spans[0][0];
    const right = spans[spans.length - 1][1];
    spans.forEach(([x0, x1], n) => {
      let from = x0;
      let to = x1;
      if (farTall === 1 && n === 0 && to - from > 1.5 * b.rimBand) {
        card(left, left + b.rimBand, rimTall(0));
        from = left + b.rimBand;
      }
      if (farTall === 1 && n === spans.length - 1 && to - from > 1.5 * b.rimBand) {
        card(right - b.rimBand, right, rimTall(0));
        to = right - b.rimBand;
      }
      card(from, to, farTall);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(index);
  return g;
}

/** A rounded rectangle `w` by `d` as a flat shape (x, y), for the bed. */
export function roundedShape(w: number, d: number, r: number, steps: number): THREE.Shape {
  const points = outlineRect(w, d, r, 0, steps).slice(0, -1).map((p) => new THREE.Vector2(p.x, -p.z));
  return new THREE.Shape(points);
}
