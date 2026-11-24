import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import { buildDirtTile } from '../../src/render/parts/garden/board';
import { boxOf, outwardShare } from './garden-helpers';

describe('garden dirt tile', () => {
  it('fills one cell, stands on the floor and rises little above the grass tile', () => {
    const box = boxOf(buildDirtTile(false, false));
    expect(box.getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(TILE.tile.size);
    expect(box.min.y).toBeCloseTo(0, 3);
    // Only the grass tufts at its near edge stand a little proud of the tile top.
    expect(box.max.y).toBeLessThanOrEqual(TILE.tile.height + 0.04);
  });

  it('hangs its pegs below the tile only when asked for', () => {
    expect(boxOf(buildDirtTile(false, true)).min.y).toBeCloseTo(-TILE.tile.pegHeight, 3);
  });

  it('faces outward', () => {
    for (const part of [buildDirtTile(false, true), buildDirtTile(true, false)]) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });
});
