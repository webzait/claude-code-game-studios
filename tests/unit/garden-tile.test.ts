import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import * as robot from '../../src/render/parts/board';
import { buildFloorTile } from '../../src/render/parts/garden/board';
import { boxOf, outwardShare } from './garden-helpers';

describe('garden grass tile', () => {
  it('grass tile fills one cell and is as high as the robot tile', () => {
    const box = boxOf(buildFloorTile(false, false));
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(TILE.tile.size);
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
    expect(boxOf(buildFloorTile(false, true)).min.y).toBeCloseTo(-TILE.tile.pegHeight, 3);
  });

  it('faces outward', () => {
    for (const part of [buildFloorTile(false, true), buildFloorTile(true, false)]) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });
});
