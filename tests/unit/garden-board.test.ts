import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import G from '../../data/themes/garden/board.json';
import config from '../../data/config.json';
import * as robot from '../../src/render/parts/board';
import {
  boardFootprint, boardPixels, buildDirtTile, buildFloorTile, buildHighlightTile, buildRim, buildTileGlow, buildUnderlay, hintGlowCells, rimDecorLayout,
} from '../../src/render/parts/garden/board';
import { braidTwists, rimPath, RoundedPath, seeded } from '../../src/render/parts/garden/layout';

const GAP = config.board.grid.gap;
/** Every board size the game uses: 4×4 to 8×8, square or not. */
const SIZES: [number, number][] = [];
for (let c = 4; c <= 8; c++) for (let r = 4; r <= 8; r++) SIZES.push([c, r]);

const boxOf = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);

/**
 * Share of a single-sided mesh's triangles whose winding agrees with their vertex normals, so
 * the face the camera sees is its outside. Double-sided meshes (leaves, fur, flowers) are skipped.
 */
function outwardShare(object: THREE.Object3D): { agree: number; total: number } {
  let agree = 0;
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if ((node.material as THREE.Material).side === THREE.DoubleSide) return;
    const g = node.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const index = g.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const [i0, i1, i2] = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      if (face.lengthSq() < 1e-14) continue;
      n.fromBufferAttribute(nor, i0).add(new THREE.Vector3().fromBufferAttribute(nor, i1)).add(new THREE.Vector3().fromBufferAttribute(nor, i2));
      total++;
      if (face.dot(n) > 0) agree++;
    }
  });
  return { agree, total };
}

describe('garden board parts', () => {
  it('grass tile fills one cell and is as high as the robot tile', () => {
    const box = boxOf(buildFloorTile(false, false));
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(G.tile.size);
    expect(size.x).toBeGreaterThan(0.9);
    expect(box.max.y).toBeCloseTo(boxOf(robot.buildFloorTile(false, false)).max.y, 3);
    expect(box.min.y).toBeCloseTo(0, 3);
  });

  it('light and dark grass tiles differ only in tone', () => {
    const light = boxOf(buildFloorTile(false, false)).getSize(new THREE.Vector3());
    const dark = boxOf(buildFloorTile(true, false)).getSize(new THREE.Vector3());
    expect(dark.distanceTo(light)).toBeLessThan(1e-6);
  });

  it('pegs hang below the tile only when asked for', () => {
    expect(boxOf(buildFloorTile(false, true)).min.y).toBeCloseTo(-G.tile.pegHeight, 3);
    expect(boxOf(buildDirtTile(false, true)).min.y).toBeCloseTo(-G.tile.pegHeight, 3);
  });

  it('every closed part faces outward', () => {
    const parts = [buildFloorTile(false, true), buildFloorTile(true, false), buildHighlightTile(false, false), buildDirtTile(false, true), buildRim(6, 6, GAP), buildRim(4, 7, GAP), buildUnderlay(5, 5, GAP, true)];
    for (const part of parts) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });

  it('highlight tile carries its glow and the glow does not change its size', () => {
    const tile = buildHighlightTile(false, false);
    const glow = tile.userData.glow as THREE.Mesh;
    expect(glow).toBeInstanceOf(THREE.Mesh);
    expect(glow.name).toBe('tile-glow');
    const material = glow.material as THREE.MeshBasicMaterial;
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBe(G.glow.pulse.high);
    expect(boxOf(tile).getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(G.tile.size);
    // Each glow has a material of its own, so one can pulse without the others.
    expect(buildTileGlow().material).not.toBe(buildTileGlow().material);
  });

  it('the rim sits outside the tiles and inside the footprint on every board size', () => {
    for (const [cols, rows] of SIZES) {
      const { innerW, innerD, outerW, outerD } = boardFootprint(cols, rows, GAP);
      const tilesW = cols * G.tile.size + (cols - 1) * GAP;
      const tilesD = rows * G.tile.size + (rows - 1) * GAP;
      expect(innerW).toBeGreaterThan(tilesW);
      expect(innerD).toBeGreaterThan(tilesD);
      const braid = (buildRim(cols, rows, GAP).children[0] as THREE.Mesh).geometry;
      braid.computeBoundingBox();
      const box = braid.boundingBox!;
      // The braid stays within the outside of the footprint.
      expect(box.max.x).toBeLessThanOrEqual(outerW / 2 + 1e-3);
      expect(box.max.z).toBeLessThanOrEqual(outerD / 2 + 1e-3);
      // ...and keeps clear of the tiles.
      const pos = braid.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const inside = Math.abs(pos.getX(i)) < tilesW / 2 && Math.abs(pos.getZ(i)) < tilesD / 2;
        expect(inside).toBe(false);
      }
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-3);
    }
  });

  it('the braid closes on itself without a seam', () => {
    for (const [cols, rows] of SIZES) {
      const path = rimPath(cols, rows, GAP);
      const twists = braidTwists(path.length);
      expect(Number.isInteger(twists)).toBe(true);
      expect(twists).toBeGreaterThanOrEqual(1);
      const start = path.at(0);
      const end = path.at(path.length);
      expect(Math.hypot(start.x - end.x, start.z - end.z)).toBeLessThan(1e-9);
    }
  });

  it('rounded path is continuous and keeps its corners round', () => {
    const path = new RoundedPath(3, 2, 0.5);
    expect(path.length).toBeCloseTo(2 * 5 + 2 * 3 + 2 * Math.PI * 0.5, 9);
    let prev = path.at(0);
    const step = path.length / 2000;
    for (let i = 1; i <= 2000; i++) {
      const p = path.at(i * step);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(step * 1.01);
      expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1, 9);
      prev = p;
    }
  });

  it('decorations sit at the same places every time', () => {
    expect(rimDecorLayout(6, 6, GAP)).toEqual(rimDecorLayout(6, 6, GAP));
    expect(rimDecorLayout(6, 6, GAP)).toHaveLength(G.decor.clusters.length);
    const a = buildRim(5, 7, GAP);
    const b = buildRim(5, 7, GAP);
    const points = (o: THREE.Object3D): number[] => {
      o.updateMatrixWorld(true);
      return o.children.filter((c) => c instanceof THREE.Group).map((c) => c.position.toArray()).flat();
    };
    expect(points(a)).toEqual(points(b));
  });

  it('decorations stay on the straight sides and apart from each other on every board size', () => {
    for (const [cols, rows] of SIZES) {
      const path = rimPath(cols, rows, GAP);
      const places = rimDecorLayout(cols, rows, GAP);
      for (const p of places) {
        const along = p.side === 'top' || p.side === 'bottom';
        const t = along ? p.x : p.z;
        const half = (along ? path.a : path.b) - path.r;
        expect(Math.abs(t)).toBeLessThanOrEqual(half + 1e-9);
        // On the rim's centre line, on its own side.
        if (along) expect(Math.abs(p.z)).toBeCloseTo(path.b, 9);
        else expect(Math.abs(p.x)).toBeCloseTo(path.a, 9);
      }
      for (let i = 0; i < places.length; i++) for (let j = i + 1; j < places.length; j++) {
        expect(Math.hypot(places[i].x - places[j].x, places[i].z - places[j].z)).toBeGreaterThanOrEqual(G.decor.minGap);
      }
    }
  });

  it('every side of the rim carries at least one decoration and two sides carry a flower', () => {
    const places = rimDecorLayout(6, 6, GAP);
    for (const side of ['top', 'right', 'bottom', 'left']) expect(places.some((p) => p.side === side)).toBe(true);
    expect(places.filter((p) => p.kind === 'flower').map((p) => p.side).sort()).toEqual(['left', 'right']);
  });

  it('underlay is a little wider than the rim and its top is the floor', () => {
    for (const [cols, rows] of [[4, 4], [5, 7], [8, 8]] as const) {
      const { outerW, outerD } = boardFootprint(cols, rows, GAP);
      const box = boxOf(buildUnderlay(cols, rows, GAP));
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(outerW + 2 * G.underlay.lip, 3);
      expect(size.z).toBeCloseTo(outerD + 2 * G.underlay.lip, 3);
      expect(box.max.y).toBeCloseTo(0, 3);
      expect(box.min.y).toBeCloseTo(-G.underlay.height, 3);
    }
  });

  it('board pixels follow the garden footprint', () => {
    const px = boardPixels(6, 6, GAP, 366);
    const { outerW, outerD } = boardFootprint(6, 6, GAP);
    expect(px.width).toBe(366);
    expect(px.unit).toBeCloseTo(366 / outerW, 9);
    expect(px.height).toBeCloseTo(outerD * px.unit, 9);
  });

  it('a whole 8x8 board stays within the triangle budget', () => {
    let tris = 0;
    const board = new THREE.Group();
    board.add(buildUnderlay(8, 8, GAP), buildRim(8, 8, GAP));
    for (let i = 0; i < 64; i++) board.add(buildFloorTile(i % 2 === 1, false));
    board.traverse((n) => {
      if (n instanceof THREE.Mesh) tris += (n.geometry.index ? n.geometry.index.count : n.geometry.getAttribute('position').count) / 3;
    });
    // The robot board of this size has about 19,600. The full braid of thin twigs (asked for by the owner)
    // costs most of the difference; it is one draw call, which a phone handles easily.
    expect(tris).toBeLessThan(70000);
  });
});

describe('garden hint', () => {
  it('lights the cells the flock steps onto', () => {
    const cells = hintGlowCells([
      { toX: 2, toY: 1, outcome: 'moved' },
      { toX: 0, toY: 0, outcome: 'blocked-wall' },
      { toX: 3, toY: 0, outcome: 'exited' },
    ], 6);
    expect(cells).toEqual([8, 3]);
  });

  it('lights a shared cell once and nothing for a blocked command', () => {
    expect(hintGlowCells([{ toX: 1, toY: 1, outcome: 'moved' }, { toX: 1, toY: 1, outcome: 'moved' }], 4)).toEqual([5]);
    expect(hintGlowCells([{ toX: 1, toY: 1, outcome: 'blocked-robot' }, { toX: 2, toY: 1, outcome: 'blocked-cycle' }], 4)).toEqual([]);
  });
});

describe('seeded random', () => {
  it('gives the same numbers for the same seed', () => {
    const a = seeded(42);
    const b = seeded(42);
    const one = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(one);
    for (const v of one) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
