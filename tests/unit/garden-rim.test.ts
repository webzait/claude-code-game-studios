import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import config from '../../data/config.json';
import TILE from '../../data/themes/garden/tile.json';
import RIM from '../../data/themes/garden/rim.json';
import UNDER from '../../data/themes/garden/underlay.json';
import { boardFootprint, boardPixels, buildFloorTile, buildRim, buildUnderlay, rimDecorLayout } from '../../src/render/parts/garden/board';
import { braidTwists, rimPath, RoundedPath, seeded } from '../../src/render/parts/garden/layout';
import { boxOf, outwardShare, SIZES } from './garden-helpers';

const GAP = config.board.grid.gap;

describe('garden rim, underlay and board', () => {
  it('faces outward', () => {
    for (const part of [buildRim(6, 6, GAP), buildRim(4, 7, GAP), buildUnderlay(5, 5, GAP, true)]) {
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
    expect(rimDecorLayout(6, 6, GAP)).toHaveLength(RIM.decor.clusters.length);
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
