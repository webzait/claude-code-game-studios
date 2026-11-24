import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import config from '../../data/config.json';
import TILE from '../../data/themes/garden/tile.json';
import RIM from '../../data/themes/garden/rim.json';
import UNDER from '../../data/themes/garden/underlay.json';
import { boardFootprint, boardPixels, buildFloorTile, buildRim, buildUnderlay, rimDecorLayout } from '../../src/render/parts/garden/board';
import { braidTwists, RIM_PX, rimDecorSlots, rimPath, rimQuads, RoundedPath, seeded, sideSpec, type Side } from '../../src/render/parts/garden/layout';
import { buildRimModel } from '../../src/render/parts/garden/rim';
import { boxOf, outwardShare, SIZES } from './garden-helpers';

const GAP = config.board.grid.gap;
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const FADE = RIM.atlas.fade / RIM_PX;

/** Inner length of a board side, and where its straight run between the corners starts and ends (cells). */
function run(side: Side, cols: number, rows: number): { from: number; to: number; length: number } {
  const { innerW, innerD } = boardFootprint(cols, rows, GAP);
  const spec = sideSpec(side);
  const length = side === 'top' || side === 'bottom' ? innerW : innerD;
  return { from: spec.cornerStart / RIM_PX, to: length - (spec.length - spec.cornerEnd) / RIM_PX, length };
}

describe("garden rim as the owner's picture (buildRim)", () => {
  it('is one flat mesh, facing up, just above the tiles', () => {
    for (const [cols, rows] of SIZES) {
      const rim = buildRim(cols, rows, GAP);
      const meshes: THREE.Mesh[] = [];
      rim.traverse((n) => {
        if (n instanceof THREE.Mesh) meshes.push(n);
      });
      expect(meshes).toHaveLength(1);
      const box = boxOf(rim);
      expect(box.min.y).toBeGreaterThan(TILE.tile.height);
      expect(box.max.y - box.min.y).toBeLessThan(0.01);
      const { agree, total } = outwardShare(rim);
      expect(total).toBeGreaterThan(0);
      expect(agree).toBe(total);
    }
  });

  it('never stretches the picture: every piece is drawn at the one scale', () => {
    for (const [cols, rows] of SIZES) {
      for (const q of rimQuads(cols, rows, GAP)) {
        expect(Math.abs(q.sx1 - q.sx0)).toBeCloseTo(Math.abs(q.x1 - q.x0) * RIM_PX, 6);
        expect(Math.abs(q.sy1 - q.sy0)).toBeCloseTo(Math.abs(q.z1 - q.z0) * RIM_PX, 6);
      }
    }
  });

  it('the plain braid runs along every side from corner to corner without a gap', () => {
    for (const [cols, rows] of SIZES) {
      const quads = rimQuads(cols, rows, GAP);
      for (const side of SIDES) {
        const { from, to, length } = run(side, cols, rows);
        const horizontal = side === 'top' || side === 'bottom';
        const pieces = quads
          .filter((q) => q.kind === 'tile' && q.side === side)
          .map((q) => (horizontal ? [q.x0, q.x1] : [q.z0, q.z1]).map((v) => v + length / 2))
          .sort((a, b) => a[0] - b[0]);
        expect(pieces.length).toBeGreaterThan(0);
        expect(pieces[0][0]).toBeCloseTo(from - FADE, 6);
        expect(pieces[pieces.length - 1][1]).toBeCloseTo(to + FADE, 6);
        for (let i = 1; i < pieces.length; i++) expect(pieces[i][0]).toBeCloseTo(pieces[i - 1][1], 9);
      }
    }
  });

  it('the straight-side pieces keep clear of the tiles', () => {
    for (const [cols, rows] of SIZES) {
      const tilesW = cols * TILE.tile.size + (cols - 1) * GAP;
      const tilesD = rows * TILE.tile.size + (rows - 1) * GAP;
      for (const q of rimQuads(cols, rows, GAP).filter((p) => p.kind !== 'corner')) {
        const overlapX = Math.min(Math.max(q.x0, q.x1), tilesW / 2) - Math.max(Math.min(q.x0, q.x1), -tilesW / 2);
        const overlapZ = Math.min(Math.max(q.z0, q.z1), tilesD / 2) - Math.max(Math.min(q.z0, q.z1), -tilesD / 2);
        expect(overlapX <= 1e-9 || overlapZ <= 1e-9).toBe(true);
      }
    }
  });

  it('leaves and flowers sit at fixed places, between the corners, overlapping only by their faded ends', () => {
    for (const [cols, rows] of SIZES) {
      const slots = rimDecorSlots(cols, rows, GAP);
      expect(rimDecorSlots(cols, rows, GAP)).toEqual(slots);
      for (const side of SIDES) {
        const { from, to } = run(side, cols, rows);
        const mine = slots.filter((p) => p.side === side).sort((a, b) => a.start - b.start);
        mine.forEach((p, i) => expect(p.start).toBeGreaterThanOrEqual((i === 0 ? from : mine[i - 1].end) - FADE - 1e-9));
        if (mine.length) expect(mine[mine.length - 1].end).toBeLessThanOrEqual(to + FADE + 1e-9);
      }
    }
  });

  it('keeps every decorated piece on 6x6 and larger, and both flowers on every board', () => {
    for (const [cols, rows] of [[6, 6], [8, 8], [6, 8], [8, 6]] as const) {
      expect(rimDecorSlots(cols, rows, GAP).map((p) => p.name).sort()).toEqual([...RIM.image.decorOrder].sort());
    }
    for (const [cols, rows] of SIZES) {
      const names = rimDecorSlots(cols, rows, GAP).map((p) => p.name);
      expect(names).toContain('left-g');
      expect(names).toContain('right-d');
      for (const side of SIDES) expect(names.some((n) => n.startsWith(side)) || side === 'bottom').toBe(true);
    }
  });

  it('costs a few dozen triangles', () => {
    for (const [cols, rows] of SIZES) {
      let tris = 0;
      buildRim(cols, rows, GAP).traverse((n) => {
        if (n instanceof THREE.Mesh) tris += n.geometry.index!.count / 3;
      });
      expect(tris).toBeLessThan(120);
    }
  });
});

describe('garden rim modelled in code (buildRimModel), underlay and board', () => {
  it('faces outward', () => {
    for (const part of [buildRimModel(6, 6, GAP), buildRimModel(4, 7, GAP), buildUnderlay(5, 5, GAP, true)]) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });

  it('the rim sits outside the tiles and inside the footprint on every board size', () => {
    for (const [cols, rows] of SIZES) {
      const { innerW, innerD, outerW, outerD } = boardFootprint(cols, rows, GAP);
      const tilesW = cols * TILE.tile.size + (cols - 1) * GAP;
      const tilesD = rows * TILE.tile.size + (rows - 1) * GAP;
      expect(innerW).toBeGreaterThan(tilesW);
      expect(innerD).toBeGreaterThan(tilesD);
      const braid = (buildRimModel(cols, rows, GAP).children[0] as THREE.Mesh).geometry;
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
    expect(rimDecorLayout(6, 6, GAP)).toHaveLength(RIM.decor.clusters.length);
    const a = buildRimModel(5, 7, GAP);
    const b = buildRimModel(5, 7, GAP);
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
        expect(Math.hypot(places[i].x - places[j].x, places[i].z - places[j].z)).toBeGreaterThanOrEqual(RIM.decor.minGap);
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
      expect(size.x).toBeCloseTo(outerW + 2 * UNDER.underlay.lip, 3);
      expect(size.z).toBeCloseTo(outerD + 2 * UNDER.underlay.lip, 3);
      expect(box.max.y).toBeCloseTo(0, 3);
      expect(box.min.y).toBeCloseTo(-UNDER.underlay.height, 3);
    }
  });

  it('board pixels follow the garden footprint', () => {
    const px = boardPixels(6, 6, GAP, 366);
    const { outerW, outerD } = boardFootprint(6, 6, GAP);
    expect(px.width).toBe(366);
    expect(px.unit).toBeCloseTo(366 / outerW, 9);
    expect(px.height).toBeCloseTo(outerD * px.unit, 9);
  });

  it('a whole 8x8 board with the picture rim costs no more than the robot board', () => {
    let tris = 0;
    const board = new THREE.Group();
    board.add(buildUnderlay(8, 8, GAP), buildRim(8, 8, GAP));
    for (let i = 0; i < 64; i++) board.add(buildFloorTile(i % 2 === 1, false));
    board.traverse((n) => {
      if (n instanceof THREE.Mesh) tris += (n.geometry.index ? n.geometry.index.count : n.geometry.getAttribute('position').count) / 3;
    });
    // The robot board of this size has 19,596. The picture rim is a few dozen triangles (the code braid was about 39,000).
    expect(tris).toBeLessThan(19600);
  });
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
