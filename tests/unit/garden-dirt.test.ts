import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import DIRT from '../../data/themes/garden/dirt.json';
import { buildDirtTile } from '../../src/render/parts/garden/board';
import { buildDirtTileModelled, dirtAtlas, dirtBlock, dirtMaterial } from '../../src/render/parts/garden/dirt';
import { boxOf, outwardShare } from './garden-helpers';

const T = TILE.tile;

/** The picture tile's one mesh. */
function block(alt: boolean): THREE.Mesh {
  const meshes: THREE.Mesh[] = [];
  buildDirtTile(alt, false).traverse((n) => {
    if (n instanceof THREE.Mesh) meshes.push(n);
  });
  expect(meshes).toHaveLength(1);
  return meshes[0];
}

/** Position and texture coordinate of every vertex of `g`. */
function vertices(g: THREE.BufferGeometry): { p: THREE.Vector3; n: THREE.Vector3; u: number; v: number }[] {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  return Array.from({ length: pos.count }, (_, i) => ({
    p: new THREE.Vector3().fromBufferAttribute(pos, i),
    n: new THREE.Vector3().fromBufferAttribute(nor, i),
    u: uv.getX(i),
    v: uv.getY(i),
  }));
}

describe('garden dirt tile (the owner\'s picture)', () => {
  it('fills one cell as the grass tile does, stands on the floor, its top at the tile top', () => {
    const size = boxOf(buildDirtTile(false, false)).getSize(new THREE.Vector3());
    const box = boxOf(buildDirtTile(false, false));
    expect(size.x).toBeCloseTo(T.body, 3);
    expect(size.z).toBeCloseTo(T.body, 3);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(T.height, 3);
  });

  it('hangs its pegs below the tile only when asked for', () => {
    expect(boxOf(buildDirtTile(false, true)).min.y).toBeCloseTo(-T.pegHeight, 3);
  });

  it('faces outward, plain and mirrored', () => {
    for (const part of [buildDirtTile(false, true), buildDirtTile(true, false)]) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });

  it('is one mesh on the picture material: one draw call for every dirt tile on the board', () => {
    expect(block(false).material).toBe(dirtMaterial);
    expect(block(true).material).toBe(dirtMaterial);
  });

  it('shows the top of the picture on its top, the far side at the picture\'s top row', () => {
    const top = vertices(block(false).geometry).filter((x) => x.n.y > 0.99 && x.p.y > T.height - 1e-6);
    expect(top.length).toBeGreaterThan(8);
    for (const { p, u, v } of top) {
      expect(u).toBeCloseTo(p.x / T.body + 0.5, 5);
      expect(v).toBeCloseTo(dirtAtlas.top.v0 + (p.z / T.body + 0.5) * (dirtAtlas.top.v1 - dirtAtlas.top.v0), 5);
      expect(v).toBeGreaterThanOrEqual(dirtAtlas.top.v1 - 1e-6);
    }
  });

  it('wraps the band of the front wall round its side, inside the band, without a jump at the corners', () => {
    for (const alt of [false, true]) {
      const side = vertices(block(alt).geometry).filter((x) => x.n.y < 0.99);
      expect(side.length).toBeGreaterThan(8);
      for (const { v } of side) {
        expect(v).toBeLessThanOrEqual(dirtAtlas.band.v0 + 1e-6);
        expect(v).toBeGreaterThanOrEqual(dirtAtlas.band.v1 - 1e-6);
      }
      // Walk round the foot: u changes no faster than the distance walked (in tile widths), so
      // the band never jumps where one wall turns into the next.
      const foot = side.filter((x) => Math.abs(x.p.y) < 1e-6);
      foot.sort((a, b) => Math.atan2(a.p.z, a.p.x) - Math.atan2(b.p.z, b.p.x));
      for (let i = 0; i < foot.length; i++) {
        const next = foot[(i + 1) % foot.length];
        const walked = next.p.distanceTo(foot[i].p) / T.body;
        expect(Math.abs(next.u - foot[i].u)).toBeLessThanOrEqual(walked * 1.02 + 1e-6);
      }
    }
  });

  it('gives the same tile for alt, as the grass tile does (no checkerboard) unless picture.checker is on', () => {
    expect(DIRT.picture.checker).toBe(false);
    expect(block(true).geometry).toBe(block(false).geometry);
  });

  it('can mirror the picture for a checkerboard tile, keeping the grass on the near side', () => {
    const plain = vertices(dirtBlock(false, '#FFFFFF'));
    const mirrored = vertices(dirtBlock(true, '#FFFFFF'));
    for (let i = 0; i < plain.length; i++) {
      expect(mirrored[i].u).toBeCloseTo(1 - plain[i].u, 5);
      expect(mirrored[i].v).toBeCloseTo(plain[i].v, 5);
    }
  });

  it('keeps its corner as round as the picture\'s', () => {
    const corner = DIRT.picture.corner * T.body;
    // The point of the outline on the diagonal sits the corner's radius in from the square's corner.
    const top = vertices(block(false).geometry).filter((x) => x.n.y > 0.99 && x.p.x > 0 && x.p.z > 0);
    const far = Math.max(...top.map((x) => x.p.x + x.p.z));
    expect(far).toBeCloseTo(T.body - 2 * corner + 2 * corner * Math.SQRT1_2, 3);
  });
});

describe('garden dirt tile, modelled in code (kept as a choice)', () => {
  it('is still there under its own name and under style \'modelled\'', () => {
    const box = boxOf(buildDirtTileModelled(false, false));
    expect(box.getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(T.size);
    expect(box.min.y).toBeCloseTo(0, 3);
    // Only the grass tufts at its near edge stand a little proud of the tile top.
    expect(box.max.y).toBeLessThanOrEqual(T.height + 0.04);
    expect(boxOf(buildDirtTile(false, false, 'modelled')).max.y).toBeCloseTo(box.max.y, 5);
  });

  it('faces outward', () => {
    const { agree, total } = outwardShare(buildDirtTileModelled(true, true));
    expect(agree / total).toBeGreaterThan(0.97);
  });
});
