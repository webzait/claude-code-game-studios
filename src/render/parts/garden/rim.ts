/**
 * Garden board: the rim.
 *
 * `buildRim` (the default, under the robot theme's name) is the owner's picture `03-rim-vines`
 * itself: corners, plain braid and decorated pieces cut from it into `rim-atlas.webp`
 * (`assets/turnflock/garden/board/rim/build-rim.py`), laid flat just above the tiles as a nine-part
 * frame that fits every board from 4×4 to 8×8 without stretching. Where the pieces go is worked
 * out in `layout.ts` (`rimQuads`).
 *
 * `buildRimModel` is the earlier rim modelled in code: a braid of thin glossy twigs with leaves,
 * vines and white flowers at fixed places, and grass growing against its inside. Kept as a choice.
 *
 * Sizes and colours: `data/themes/garden/rim.json`. Design: `design/themes/garden-board-rim.md`.
 */
import * as THREE from 'three';
import RIM from '../../../../data/themes/garden/rim.json';
import UNDER from '../../../../data/themes/garden/underlay.json';
import { Mesher, mergeAll, once, plainMaterial, shade, shadowed, tube } from './geometry';
import { painted } from './paint';
import { boardFootprint, braidTwists, rimDecorLayout, rimPath, rimQuads, RoundedPath, seeded, type DecorPlace, type RimQuad } from './layout';
import { furMesh } from './grass';
import atlasUrl from '../../../../assets/turnflock/garden/board/rim/rim-atlas.webp';

const G = { rim: RIM.rim, decor: RIM.decor, underlay: UNDER.underlay };
const C = RIM.colors;

/**
 * Bark of the twigs: grain lines that run along the twig (texture u) with lighter streaks
 * between them; v runs once round the twig. Repeats both ways without a seam.
 */
export function barkTexture(): THREE.Texture | null {
  const r = G.rim;
  return painted('bark', r.texture, r.texture, (g, n) => {
    const rand = seeded(r.seed);
    const grad = g.createLinearGradient(0, 0, 0, n);
    grad.addColorStop(0, C.bark);
    grad.addColorStop(0.5, C.barkLight);
    grad.addColorStop(1, C.bark);
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
    g.lineCap = 'round';
    // Sizes below are drawn for a 256 px texture and scaled, so a larger texture is sharper, not finer.
    const k = n / 256;
    for (let i = 0; i < 46; i++) {
      const y = rand() * n;
      const amp = (1 + rand() * 4) * k;
      const waves = 1 + Math.floor(rand() * 3);
      const phase = rand() * Math.PI * 2;
      const dark = rand() < 0.6;
      g.strokeStyle = dark ? C.barkDark : C.barkLight;
      g.globalAlpha = dark ? 0.35 + rand() * 0.35 : 0.45 + rand() * 0.35;
      g.lineWidth = (dark ? 1.2 + rand() * 2.6 : 1 + rand() * 2) * k;
      // A grain line may stop part-way, as the grain does where two fibres meet.
      const from = rand() < 0.4 ? rand() * n : 0;
      const to = from > 0 ? from + n * (0.25 + rand() * 0.5) : n;
      for (const dy of [-n, 0, n]) {
        g.beginPath();
        for (let x = from; x <= to; x += 2 * k) {
          const yy = y + dy + Math.sin((x / n) * Math.PI * 2 * waves + phase) * amp;
          if (x === from) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
        if (to > n) {
          g.beginPath();
          for (let x = 0; x <= to - n; x += 2 * k) {
            const yy = y + dy + Math.sin(((x + n) / n) * Math.PI * 2 * waves + phase) * amp;
            if (x === 0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
          }
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
  }, true);
}

/** The glossy bark of the twigs. */
export const barkMaterial = new THREE.MeshPhysicalMaterial({ map: barkTexture(), vertexColors: true, roughness: G.rim.gloss.roughness, clearcoat: G.rim.gloss.clearcoat, clearcoatRoughness: G.rim.gloss.clearcoatRoughness });

/** Where the braid's centre runs at `s` along the rim, raised to `centreY`. */
export function braidCentre(path: RoundedPath, s: number): { p: THREE.Vector3; out: THREE.Vector3 } {
  const q = path.at(s);
  return { p: new THREE.Vector3(q.x, G.rim.centreY, q.z), out: new THREE.Vector3(q.nx, 0, q.nz) };
}

/** How far the braid reaches from its centre line: the bundles' twist plus a bundle's own reach. */
export const BRAID_REACH = G.rim.twist + G.rim.bundleRadius + G.rim.twigRadius;

/** A fixed pseudo-random number in [0, 1) for twig `k`, so every twig has its own, unchanging thickness. */
export const twigJitter = (k: number): number => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The braid, after `03-rim-vines`: `strands` bundles twisted round the rim's centre line, each a
 * bundle of `twigsPerBundle` thin twigs twisting round the bundle's own centre, `fineTwigs` very
 * thin twigs winding the other way over the whole braid, and a core of the same bark so no gap
 * shows through. Every twist count round the rim is a whole number, so the braid closes without a seam
 * on every board size. Vertex colours brighten the upper side of each twig, which with the glossy
 * bark material gives the shine of the reference.
 */
export function braidGeometry(path: RoundedPath): THREE.BufferGeometry {
  const r = G.rim;
  const m = new Mesher();
  const L = path.length;
  const twists = braidTwists(L);
  const twigTurns = Math.max(1, Math.round(L / r.twigPitch));
  const fineTurns = Math.max(1, Math.round(L / r.finePitch));
  const samples = Math.ceil(L * r.perUnit);
  const bark = Math.max(1, Math.round(L / r.barkRepeat));
  const up = new THREE.Vector3(0, 1, 0);
  const tone = (around: number): THREE.Color => shade(0.74 + 0.34 * Math.max(0, around) ** 0.8);
  let twig = 0;
  for (let k = 0; k < r.strands; k++) {
    for (let j = 0; j < r.twigsPerBundle; j++) {
      const points: THREE.Vector3[] = [];
      const radii: number[] = [];
      const own = twigJitter(twig);
      for (let i = 0; i < samples; i++) {
        const { p, out } = braidCentre(path, (L * i) / samples);
        const theta = Math.PI * 2 * ((twists * i) / samples + k / r.strands);
        const phi = Math.PI * 2 * ((twigTurns * i) / samples + j / r.twigsPerBundle + k * 0.17);
        const bundle = p.addScaledVector(out, Math.cos(theta) * r.twist).addScaledVector(up, Math.sin(theta) * r.twist * r.flatten);
        points.push(bundle.addScaledVector(out, Math.cos(phi) * r.bundleRadius).addScaledVector(up, Math.sin(phi) * r.bundleRadius * 0.9));
        radii.push(r.twigRadius * (0.86 + 0.28 * own) * (1 + 0.07 * Math.sin(Math.PI * 2 * ((7 + j) * i / samples) + own * 6)));
      }
      tube(m, points, radii, r.radial, (i) => (i / samples) * bark, own, (_, around) => tone(around), true);
      twig++;
    }
  }
  // Fine twigs, winding the other way over the outside of the braid.
  for (let f = 0; f < r.fineTwigs; f++) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < samples; i++) {
      const { p, out } = braidCentre(path, (L * i) / samples);
      const psi = Math.PI * 2 * (-(fineTurns * i) / samples + f / r.fineTwigs);
      // Keep them to the visible upper half, where the reference shows its fine twigs.
      const a = Math.PI / 2 + 0.95 * Math.sin(psi);
      points.push(p.addScaledVector(out, Math.cos(a) * r.fineReach).addScaledVector(up, Math.sin(a) * r.fineReach * r.flatten * 1.05));
    }
    tube(m, points, points.map(() => r.fineRadius), r.fineRadial, (i) => (i / samples) * bark, f * 0.31, (_, around) => tone(around), true);
  }
  const core: THREE.Vector3[] = [];
  const coreSamples = Math.ceil(samples / 3);
  for (let i = 0; i < coreSamples; i++) core.push(braidCentre(path, (L * i) / coreSamples).p);
  tube(m, core, core.map(() => r.core), 6, (i) => (i / coreSamples) * bark * 0.5, 0, () => shade(0.78), true);
  return m.build();
}

/** The grass that grows up against the inside of the rim, leaning in over the bed. */
export function rimGrass(cols: number, rows: number, gap: number): THREE.BufferGeometry {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const m = new Mesher();
  const h = G.underlay.edgeGrass;
  const radius = Math.max(0.05, G.rim.cornerRadius - G.rim.width / 2);
  const outer = new RoundedPath(innerW / 2 + 0.03, innerD / 2 + 0.03, radius);
  const inner = new RoundedPath(innerW / 2 - 0.02, innerD / 2 - 0.02, Math.max(0.03, radius - 0.05));
  const samples = Math.ceil(outer.length * 10);
  const repeats = Math.max(1, Math.round(outer.length / 0.24));
  const rowsOut: number[][] = [[], []];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const a = outer.at(f * outer.length);
    const b = inner.at(f * inner.length);
    rowsOut[0].push(m.vertex(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(0, 1, 0), f * repeats, 0, shade(0.7)));
    rowsOut[1].push(m.vertex(new THREE.Vector3(b.x, h, b.z), new THREE.Vector3(0, 1, 0), f * repeats, 1, shade(0.95)));
  }
  m.grid(rowsOut);
  return m.build();
}

/** A leaf lying along +x from its stalk at the origin: pointed, its midrib raised, its tip curling down. */
export function leafGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const m = new Mesher();
  const across = [-1, -0.5, 0, 0.5, 1];
  const rows: number[][] = [];
  const light = new THREE.Color(C.leafLight);
  const leaf = new THREE.Color(C.leaf);
  const dark = new THREE.Color(C.leafDark);
  for (let i = 0; i <= d.leafSteps; i++) {
    const t = i / d.leafSteps;
    const half = (d.leafWidth / 2) * Math.sin(Math.PI * t ** 0.8) ** 0.6;
    rows.push(across.map((a) => {
      const y = -0.18 * d.leafLength * t * t + (1 - a * a) * half * 0.45 + 0.02 * Math.sin(Math.PI * t);
      const c = leaf.clone().lerp(light, (1 - Math.abs(a)) * 0.55 * Math.sin(Math.PI * t)).lerp(dark, (1 - t) ** 3 * 0.6 + Math.abs(a) * 0.15);
      return m.vertex(new THREE.Vector3(d.leafLength * t, y, a * half), new THREE.Vector3(0, 1, 0), t, a, c);
    }));
  }
  m.grid(rows);
  return m.build(true);
}

/** One petal along +x, starting at the flower's heart: a rounded tip and a gently cupped face. */
export function petalGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const m = new Mesher();
  const across = [-1, -0.5, 0, 0.5, 1];
  const rows: number[][] = [];
  const white = new THREE.Color(C.petal);
  const deep = new THREE.Color(C.petalShade);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const half = (d.petalWidth / 2) * Math.sqrt(Math.max(0, 1 - (1.7 * t - 1) ** 2)) ** 0.7 + 0.004;
    rows.push(across.map((a) => {
      const y = 0.22 * d.petal * t * t + a * a * half * 0.3;
      return m.vertex(new THREE.Vector3(d.heart * 0.5 + d.petal * t, y, a * half), new THREE.Vector3(0, 1, 0), t, a, deep.clone().lerp(white, Math.min(1, t * 1.6)));
    }));
  }
  m.grid(rows);
  return m.build(true);
}

/** A white flower: five petals round a yellow heart, facing up (+y). */
export function flowerGeometry(): THREE.BufferGeometry {
  const d = G.decor;
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const p = petalGeometry();
    p.rotateY((k * Math.PI * 2) / 5 + 0.3);
    parts.push(p);
  }
  const heart = new THREE.SphereGeometry(d.heart, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  heart.scale(1, 0.8, 1);
  heart.translate(0, 0.01, 0);
  const pos = heart.getAttribute('position');
  const top = new THREE.Color(C.heart);
  const low = new THREE.Color(C.heartDark);
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const c = low.clone().lerp(top, Math.min(1, pos.getY(i) / (d.heart * 0.6)));
    colors.push(c.r, c.g, c.b);
  }
  heart.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const flat = [...parts, heart].map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  return mergeAll(flat);
}

/** The vine that winds round the braid through a decoration, along its side and never into a corner. */
export function vinePoints(place: DecorPlace, path: RoundedPath): THREE.Vector3[] {
  const d = G.decor;
  const r = G.rim;
  const along = place.side === 'top' || place.side === 'bottom';
  const half = (along ? path.a : path.b) - path.r;
  const t = along ? place.x : place.z;
  const from = Math.max(-half, t - d.vineLength / 2);
  const to = Math.min(half, t + d.vineLength / 2);
  const reach = BRAID_REACH + 0.004;
  const points: THREE.Vector3[] = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const at = from + (to - from) * k;
    const theta = Math.PI * 0.15 + (place.flip ? -1 : 1) * k * d.vineTurns * Math.PI * 2;
    const base = along ? new THREE.Vector3(at, r.centreY, place.z) : new THREE.Vector3(place.x, r.centreY, at);
    base.x += place.nx * Math.cos(theta) * reach;
    base.z += place.nz * Math.cos(theta) * reach;
    base.y += Math.sin(theta) * reach * (r.flatten + 0.25);
    points.push(base);
  }
  return points;
}

/** One decoration (leaves, a leaf, or a flower with leaves) in place on the braid. */
export function decoration(place: DecorPlace): THREE.Group {
  const r = G.rim;
  const group = new THREE.Group();
  // Local frame: x outward, z along the side (mirrored by `flip`), y up; the root sits on the braid's top, towards the outside.
  const out = new THREE.Vector3(place.nx, 0, place.nz);
  const along = new THREE.Vector3(place.ax, 0, place.az).multiplyScalar(place.flip ? -1 : 1);
  const basis = new THREE.Matrix4().makeBasis(out, new THREE.Vector3(0, 1, 0), along);
  group.quaternion.setFromRotationMatrix(basis);
  group.position.set(place.x, r.centreY + (r.twist + r.bundleRadius) * r.flatten + r.twigRadius * 0.6, place.z).addScaledVector(out, r.twist * 0.35);
  const leaf = once('garden-leaf', leafGeometry);
  /** A leaf pointing `angle` degrees from outward towards "along", tipped up by `lift` degrees, scaled by `size`. */
  const addLeaf = (angle: number, lift: number, size: number, dx = 0, dz = 0): void => {
    const mesh = new THREE.Mesh(leaf, plainMaterial);
    mesh.scale.setScalar(size);
    mesh.rotation.set(0, (-angle * Math.PI) / 180, (lift * Math.PI) / 180, 'YXZ');
    mesh.position.set(dx, 0, dz);
    group.add(mesh);
  };
  // The leaves lie on the braid as in the reference: along the rim either way, and one reaching out over its edge.
  if (place.kind === 'leaf') addLeaf(55, 6, 0.85, -0.04, 0);
  if (place.kind === 'leaves') {
    addLeaf(-78, 7, 0.82, -0.02, -0.03);
    addLeaf(12, 10, 0.95, -0.05, 0);
    addLeaf(72, 6, 0.85, -0.02, 0.04);
  }
  if (place.kind === 'flower') {
    addLeaf(-150, 4, 0.8, 0.02, -0.08);
    addLeaf(120, 6, 0.9, 0.02, 0.08);
    addLeaf(40, 6, 0.75, 0.04, 0.12);
    const flower = new THREE.Mesh(once('garden-flower', flowerGeometry), plainMaterial);
    flower.position.set(-0.02, 0.04, 0);
    flower.rotation.z = -0.18;
    group.add(flower);
  }
  return group;
}

/**
 * Whole board frame: a braid of three twigs round the board, with leaves, vines and white flowers
 * at fixed places (`rimDecorLayout`), and the grass that grows against its inside. It fits any
 * board from 4×4 to 8×8, square or not: the braid follows the footprint and twists a whole
 * number of times, the decorations sit at fixed fractions of each side.
 */
export function buildRimModel(cols: number, rows: number, gap: number): THREE.Group {
  const path = rimPath(cols, rows, gap);
  const frame = new THREE.Group();
  frame.add(new THREE.Mesh(braidGeometry(path), barkMaterial));
  frame.add(furMesh(rimGrass(cols, rows, gap)));
  const vines = new Mesher();
  const vineTone = new THREE.Color(C.vine);
  for (const place of rimDecorLayout(cols, rows, gap)) {
    frame.add(decoration(place));
    const points = vinePoints(place, path);
    tube(vines, points, points.map((_, i) => G.decor.vineRadius * (1 - 0.5 * Math.abs(i / (points.length - 1) - 0.5) * 2) + 0.004), 5, () => 0, 0, (_, around) => vineTone.clone().multiplyScalar(0.8 + 0.25 * Math.max(0, around)), false);
  }
  frame.add(new THREE.Mesh(vines.build(), plainMaterial));
  return shadowed(frame);
}

// ---------------------------------------------------------------------------------------------
// The rim as the owner's picture (the default `buildRim`).
// ---------------------------------------------------------------------------------------------

const IMG = RIM.image;
const ATLAS = RIM.atlas;

/**
 * A texture loaded from `url` (a WebP the build puts in the page), and a promise that settles
 * once it has loaded. Outside a browser (the unit tests) there is no image: the texture is null
 * and the promise settles at once.
 */
export function imageTexture(url: string, repeat: boolean): { texture: THREE.Texture | null; ready: Promise<void> } {
  if (typeof document === 'undefined') return { texture: null, ready: Promise.resolve() };
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  const ready = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      texture.image = image;
      texture.needsUpdate = true;
      resolve();
    };
    image.onerror = () => resolve();
    image.src = url;
  });
  return { texture, ready };
}

const atlas = imageTexture(atlasUrl, false);

/** The rim picture (`rim-atlas.webp`), null outside a browser. */
export const rimAtlas = atlas.texture;

/** Settles once the rim picture has loaded; a still drawn before that shows no rim. */
export const rimReady: Promise<void> = atlas.ready;

/**
 * The rim's material: the picture as it is, unlit, so its colours are the owner's (the light
 * and shade are painted in). Fully see-through pixels are dropped (`alphaTest`), so they hide
 * nothing behind them.
 */
export const rimMaterial = new THREE.MeshBasicMaterial({ map: rimAtlas, transparent: true, alphaTest: IMG.alphaTest, toneMapped: false });

/** For the rim's shadow: only the solid part of the picture casts one. Give it back after `fuse`. */
export const rimDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: rimAtlas, alphaTest: IMG.shadowAlpha });

/** Texture coordinates (0-1, three.js's v up) of the source point (`sx`, `sy`) of the atlas piece `name`. */
function atlasUv(name: string, sx: number, sy: number): [number, number] {
  const p = ATLAS.pieces.find((q) => q.name === name)!;
  const [x0, y0, x1, y1] = p.src;
  const [ax, ay, aw, ah] = p.atlas;
  // A repeating tile holds one period of the braid along its side.
  const period = (p as { period?: number }).period;
  const horizontal = p.side === 'top' || p.side === 'bottom';
  const w = period && horizontal ? period : x1 - x0;
  const h = period && !horizontal ? period : y1 - y0;
  const u = (ax + ((sx - x0) / w) * aw) / ATLAS.size[0];
  const v = (ay + ((sy - y0) / h) * ah) / ATLAS.size[1];
  return [u, 1 - v];
}

/** The flat geometry of every rim piece on a `cols` by `rows` board, facing up, layered by `RimQuad.layer`. */
export function rimImageGeometry(quads: readonly RimQuad[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (const q of quads) {
    const y = IMG.height + q.layer * IMG.layer;
    const base = pos.length / 3;
    const corners: [number, number, number, number][] = [
      [q.x0, q.z0, q.sx0, q.sy0],
      [q.x1, q.z0, q.sx1, q.sy0],
      [q.x1, q.z1, q.sx1, q.sy1],
      [q.x0, q.z1, q.sx0, q.sy1],
    ];
    for (const [x, z, sx, sy] of corners) {
      pos.push(x, y, z);
      nor.push(0, 1, 0);
      uv.push(...atlasUv(q.piece, sx, sy));
    }
    // Counter-clockwise seen from above (+y), so the face looks up.
    index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/**
 * Whole board frame: the owner's rim picture `03-rim-vines`, as a nine-part frame laid flat at
 * `image.height`, just above the tiles. The four corners come from the picture's own corners;
 * each straight side repeats a plain stretch of the picture's braid (cut short at the end, never
 * stretched); the leaves and flowers are pieces of the picture at fixed places along each side
 * (`rimDecorSlots`). Fits every board from 4×4 to 8×8, square or not. One mesh, one material.
 */
export function buildRim(cols: number, rows: number, gap: number): THREE.Group {
  const frame = new THREE.Group();
  const mesh = new THREE.Mesh(rimImageGeometry(rimQuads(cols, rows, gap)), rimMaterial);
  mesh.name = 'garden-rim';
  mesh.castShadow = true;
  mesh.customDepthMaterial = rimDepthMaterial;
  frame.add(mesh);
  return frame;
}
