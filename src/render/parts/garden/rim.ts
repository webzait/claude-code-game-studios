/**
 * Garden board: the rim. Three versions, all under the same contract (`cols`, `rows`, `gap`):
 *
 * - `buildRim` (the default) = `buildRimBoard`: the rim cut from the owner's `01-board-full`
 *   together with the strip of lawn inside it, so rim and lawn are of one piece
 *   (`board-rim-atlas.webp`). The owner's choice (2026-11-25).
 * - `buildRimModel`: modelled in code, one compact braid of five strands with leaves, vines and
 *   white flowers, a contact shadow and a grass fringe.
 * - `buildRimImage`: the rim cut from `03-rim-vines` alone (`rim-atlas.webp`).
 *
 * The pictures are cut by `assets/turnflock/garden/board/rim/build-rim.py` and laid out by
 * `rimQuads` in `layout.ts`. Sizes: `data/themes/garden/rim.json`. Design:
 * `design/themes/garden-board-rim.md`.
 */
import * as THREE from 'three';
import RIM from '../../../../data/themes/garden/rim.json';
import UNDER from '../../../../data/themes/garden/underlay.json';
import { Mesher, mergeAll, once, shade, shadowed, tube } from './geometry';
import { painted } from './paint';
import { boardFootprint, braidTwists, RIM_PICTURES, rimDecorLayout, rimPath, rimQuads, RoundedPath, seeded, type DecorPlace, type RimPicture, type RimQuad } from './layout';
import { furMesh } from './grass';
import atlasUrl from '../../../../assets/turnflock/garden/board/rim/rim-atlas.webp';
import boardAtlasUrl from '../../../../assets/turnflock/garden/board/rim/board-rim-atlas.webp';

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

/**
 * The leaves, vines and flowers: their own colours, lit softly and with little reflection of the
 * surroundings, so they keep the reference's bright yellow-green and white.
 */
export const decorMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, envMapIntensity: 0.25, side: THREE.DoubleSide });

/** The leaves and vines: as `decorMaterial`, tinted (`decor.leafTint`) so the scene's cool light leaves them as fresh as the reference. */
export const leafMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, envMapIntensity: 0.25, side: THREE.DoubleSide, color: new THREE.Color().setRGB(...(G.decor.leafTint as [number, number, number])), emissive: new THREE.Color(G.decor.leafGlow) });

/** The glossy bark of the twigs. */
export const barkMaterial = new THREE.MeshPhysicalMaterial({ map: barkTexture(), vertexColors: true, roughness: G.rim.gloss.roughness, clearcoat: G.rim.gloss.clearcoat, clearcoatRoughness: G.rim.gloss.clearcoatRoughness });

/** Where the braid's centre runs at `s` along the rim, raised to `centreY`. */
export function braidCentre(path: RoundedPath, s: number): { p: THREE.Vector3; out: THREE.Vector3 } {
  const q = path.at(s);
  return { p: new THREE.Vector3(q.x, G.rim.centreY, q.z), out: new THREE.Vector3(q.nx, 0, q.nz) };
}

/** How far the braid reaches sideways from its centre line (half the rim's width). */
export const BRAID_REACH = G.rim.radius * (G.rim.strandOffset + G.rim.strandRadius);

/** How high the braid's top sits above its centre line. */
export const BRAID_TOP = BRAID_REACH * G.rim.flatten;

/**
 * The braid, after `03-rim-vines`: one compact rope. `strands` thick strands twist tightly round
 * the rim's centre line, overlapping so no gap shows between them, round a core of the same bark;
 * each strand has `ridges` shallow fibre grooves that turn with it. The rope is flattened a little
 * (`flatten`) and keeps to the rim's width. The twist count round the rim is a whole number, so
 * the braid closes without a seam on every board size. Vertex colours darken where the strands
 * meet and brighten their upper side, which with the glossy bark gives the reference's shine.
 */
export function braidGeometry(path: RoundedPath): THREE.BufferGeometry {
  const r = G.rim;
  const m = new Mesher();
  const L = path.length;
  const twists = braidTwists(L);
  const samples = Math.ceil(L * r.perUnit);
  const bark = Math.max(1, Math.round(L / r.barkRepeat));
  const up = new THREE.Vector3(0, 1, 0);
  const R = r.radius;
  const strandR = R * r.strandRadius;
  const offset = R * r.strandOffset;
  for (let k = 0; k <= r.strands; k++) {
    const isCore = k === r.strands;
    const rows: number[][] = [];
    for (let i = 0; i <= samples; i++) {
      const s = (L * (i % samples)) / samples;
      const { p, out } = braidCentre(path, s);
      const theta = Math.PI * 2 * ((twists * i) / samples + k / r.strands);
      // The strand's centre, and the direction from the rope's centre to it (for the shade between strands).
      const toStrand = out.clone().multiplyScalar(Math.cos(theta)).addScaledVector(up, Math.sin(theta) * r.flatten);
      const centre = isCore ? p : p.clone().addScaledVector(out, Math.cos(theta) * offset).addScaledVector(up, Math.sin(theta) * offset * r.flatten);
      const radius = isCore ? R * r.core : strandR;
      const row: number[] = [];
      const radial = isCore ? r.coreRadial : r.radial;
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        // Round the strand in the plane across the rim: outward and up.
        const dir = out.clone().multiplyScalar(Math.cos(phi)).addScaledVector(up, Math.sin(phi));
        const ridge = isCore ? 1 : 1 - r.ridgeDepth * (0.5 + 0.5 * Math.cos(r.ridges * (phi - theta * 2)));
        const pos = centre.clone().addScaledVector(out, Math.cos(phi) * radius * ridge).addScaledVector(up, Math.sin(phi) * radius * ridge * r.flatten);
        const normal = out.clone().multiplyScalar(Math.cos(phi) * r.flatten).addScaledVector(up, Math.sin(phi)).normalize();
        const facing = isCore ? 0 : Math.max(-1, Math.min(1, dir.dot(toStrand.clone().normalize())));
        const light = (0.66 + 0.4 * Math.max(0, normal.y) ** 0.8) * (0.8 + 0.2 * (0.5 + 0.5 * facing)) * (0.93 + 0.07 * ridge);
        row.push(m.vertex(pos, normal, (i / samples) * bark, j / radial + k * 0.29, shade(Math.min(1.08, light))));
      }
      rows.push(row);
    }
    m.grid(rows, true);
  }
  return m.build();
}

/** The grass that grows up against the inside of the rim, leaning in over the bed. */
export function rimGrass(cols: number, rows: number, gap: number): THREE.BufferGeometry {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const m = new Mesher();
  const g = G.rim.grass;
  const radius = Math.max(0.05, G.rim.cornerRadius - G.rim.width / 2);
  // From the bed in front of the braid up and onto its inner side.
  const foot = new RoundedPath(innerW / 2 - g.base, innerD / 2 - g.base, Math.max(0.03, radius - g.base));
  const tip = new RoundedPath(innerW / 2 + g.lean, innerD / 2 + g.lean, radius + g.lean);
  const samples = Math.ceil(foot.length * 10);
  const repeats = Math.max(1, Math.round(foot.length / g.bladeRepeat));
  const rowsOut: number[][] = [[], []];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const a = tip.at(f * tip.length);
    const b = foot.at(f * foot.length);
    rowsOut[0].push(m.vertex(new THREE.Vector3(a.x, g.height, a.z), new THREE.Vector3(0, 1, 0), f * repeats, 1, shade(0.95)));
    rowsOut[1].push(m.vertex(new THREE.Vector3(b.x, 0.002, b.z), new THREE.Vector3(0, 1, 0), f * repeats, 0, shade(0.7)));
  }
  m.grid(rowsOut);
  return m.build();
}

/** The soft shadow the braid lays on the grass bed along its inside: see-through, darkest under the braid. */
export const contactMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });

/**
 * A ring on the grass bed along the inside of the braid, darkest (`contact.opacity`) under it and
 * fading to nothing `contact.width` in front of it, so the braid sits in the grass instead of on it.
 */
export function contactShadow(cols: number, rows: number, gap: number): THREE.BufferGeometry {
  const { innerW, innerD } = boardFootprint(cols, rows, gap);
  const c = G.rim.contact;
  const radius = Math.max(0.05, G.rim.cornerRadius - G.rim.width / 2);
  const tone = new THREE.Color(c.color);
  const rings = [
    { off: c.under, a: c.opacity },
    { off: 0, a: c.opacity * 0.85 },
    { off: -c.width * 0.35, a: c.opacity * 0.35 },
    { off: -c.width, a: 0 },
  ];
  const paths = rings.map((r) => new RoundedPath(innerW / 2 + r.off, innerD / 2 + r.off, Math.max(0.03, radius + r.off)));
  const samples = Math.ceil(paths[0].length * 8);
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    rings.forEach((r, k) => {
      const p = paths[k].at(f * paths[k].length);
      pos.push(p.x, 0.003, p.z);
      col.push(tone.r, tone.g, tone.b, r.a);
    });
  }
  const n = rings.length;
  for (let i = 0; i < samples; i++) for (let k = 0; k < n - 1; k++) {
    const a = i * n + k;
    const b = (i + 1) * n + k;
    // Seen from above (+y): the path runs clockwise, rings go inward, so this order faces up.
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geometry.setIndex(index);
  return geometry;
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
    // A plump oval leaf with a short point, as in the reference.
    const half = (d.leafWidth / 2) * Math.sin(Math.PI * t ** 0.75) ** 0.45;
    rows.push(across.map((a) => {
      const y = -0.12 * d.leafLength * t * t + (1 - a * a) * half * 0.6 + 0.03 * Math.sin(Math.PI * t);
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
    // A round, puffy petal.
    const half = (d.petalWidth / 2) * Math.sqrt(Math.max(0, 1 - (1.8 * t - 1) ** 2)) ** 0.5 + 0.004;
    rows.push(across.map((a) => {
      const y = 0.18 * d.petal * t * t + (1 - a * a) * half * 0.35;
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
  const reach = BRAID_REACH + 0.006;
  const points: THREE.Vector3[] = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const at = from + (to - from) * k;
    const theta = Math.PI * 0.15 + (place.flip ? -1 : 1) * k * d.vineTurns * Math.PI * 2;
    const base = along ? new THREE.Vector3(at, r.centreY, place.z) : new THREE.Vector3(place.x, r.centreY, at);
    base.x += place.nx * Math.cos(theta) * reach;
    base.z += place.nz * Math.cos(theta) * reach;
    base.y += Math.sin(theta) * reach * (r.flatten + 0.06);
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
  group.position.set(place.x, r.centreY + BRAID_TOP * 0.92, place.z).addScaledVector(out, BRAID_REACH * 0.25);
  const leaf = once('garden-leaf', leafGeometry);
  /** A leaf pointing `angle` degrees from outward towards "along", tipped up by `lift` degrees, scaled by `size`. */
  const addLeaf = (angle: number, lift: number, size: number, dx = 0, dz = 0): void => {
    const mesh = new THREE.Mesh(leaf, leafMaterial);
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
    const flower = new THREE.Mesh(once('garden-flower', flowerGeometry), decorMaterial);
    flower.position.set(-0.02, 0.07, 0);
    flower.scale.setScalar(G.decor.flowerScale);
    flower.rotation.z = -0.12;
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
  const contact = new THREE.Mesh(contactShadow(cols, rows, gap), contactMaterial);
  contact.name = 'garden-rim-contact';
  // `fuse` would make it cast a shadow; it stays a mesh of its own.
  contact.userData.keepApart = true;
  contact.renderOrder = 1;
  frame.add(contact);
  if (G.rim.grass.height > 0) frame.add(furMesh(rimGrass(cols, rows, gap)));
  const vines = new Mesher();
  const vineTone = new THREE.Color(C.vine);
  for (const place of rimDecorLayout(cols, rows, gap)) {
    frame.add(decoration(place));
    const points = vinePoints(place, path);
    tube(vines, points, points.map((_, i) => G.decor.vineRadius * (1 - 0.5 * Math.abs(i / (points.length - 1) - 0.5) * 2) + 0.004), 5, () => 0, 0, (_, around) => vineTone.clone().multiplyScalar(0.8 + 0.25 * Math.max(0, around)), false);
  }
  frame.add(new THREE.Mesh(vines.build(), leafMaterial));
  shadowed(frame);
  // The soft shadow is itself a shadow: it neither casts nor takes one.
  contact.castShadow = false;
  contact.receiveShadow = false;
  return frame;
}

// ---------------------------------------------------------------------------------------------
// The rim as the owner's picture (the default `buildRim`).
// ---------------------------------------------------------------------------------------------

const IMG = RIM.image;

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

const boardAtlas = imageTexture(boardAtlasUrl, false);

/** Settles once the rim cut from 01-board-full (`board-rim-atlas.webp`) has loaded. */
export const rimBoardReady: Promise<void> = boardAtlas.ready;

/** The material of the rim cut from 01-board-full, as `rimMaterial`. */
export const rimBoardMaterial = new THREE.MeshBasicMaterial({ map: boardAtlas.texture, transparent: true, alphaTest: RIM.imageBoard.alphaTest, toneMapped: false });

/** Its shadow shape, as `rimDepthMaterial`. */
export const rimBoardDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: boardAtlas.texture, alphaTest: RIM.imageBoard.shadowAlpha });

/** Texture coordinates (0-1, three.js's v up) of the source point (`sx`, `sy`) of the atlas piece `name`. */
function atlasUv(pic: RimPicture, name: string, sx: number, sy: number): [number, number] {
  const p = pic.atlas.pieces.find((q) => q.name === name)!;
  const [x0, y0, x1, y1] = p.src;
  const [ax, ay, aw, ah] = p.atlas;
  // A repeating tile holds one period of the braid along its side.
  const period = (p as { period?: number }).period;
  const horizontal = p.side === 'top' || p.side === 'bottom';
  const w = period && horizontal ? period : x1 - x0;
  const h = period && !horizontal ? period : y1 - y0;
  const u = (ax + ((sx - x0) / w) * aw) / pic.atlas.size[0];
  const v = (ay + ((sy - y0) / h) * ah) / pic.atlas.size[1];
  return [u, 1 - v];
}

/** The flat geometry of every rim piece on a `cols` by `rows` board, facing up, layered by `RimQuad.layer`. */
export function rimImageGeometry(quads: readonly RimQuad[], pic: RimPicture = RIM_PICTURES.rim): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (const q of quads) {
    const y = pic.image.height + q.layer * pic.image.layer;
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
      uv.push(...atlasUv(pic, q.piece, sx, sy));
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
export function buildRimImage(cols: number, rows: number, gap: number): THREE.Group {
  const frame = new THREE.Group();
  const mesh = new THREE.Mesh(rimImageGeometry(rimQuads(cols, rows, gap)), rimMaterial);
  mesh.name = 'garden-rim';
  mesh.castShadow = true;
  mesh.customDepthMaterial = rimDepthMaterial;
  frame.add(mesh);
  return frame;
}

/**
 * The rim cut from `01-board-full` together with the strip of lawn inside it (its grass fringe and
 * the braid's shadow on the grass), so rim and lawn are of one piece. Laid out like
 * `buildRimImage`, but placed by the picture's tiles: its see-through middle lines up with the
 * game's tiles, which stand over it (it lies low, at `imageBoard.height`).
 */
export function buildRimBoard(cols: number, rows: number, gap: number): THREE.Group {
  const pic = RIM_PICTURES.board;
  const frame = new THREE.Group();
  const mesh = new THREE.Mesh(rimImageGeometry(rimQuads(cols, rows, gap, pic), pic), rimBoardMaterial);
  mesh.name = 'garden-rim-board';
  mesh.castShadow = true;
  mesh.customDepthMaterial = rimBoardDepthMaterial;
  frame.add(mesh);
  return frame;
}

/**
 * Whole board frame, under the robot theme's name: the rim cut from `01-board-full` with its lawn
 * strip (`buildRimBoard`), the owner's choice (2026-11-25). The modelled braid is `buildRimModel`,
 * the rim cut from `03-rim-vines` is `buildRimImage`.
 */
export const buildRim = buildRimBoard;
