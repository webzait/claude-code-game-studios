import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import parts from '../../data/parts.json';
import { boardFootprint, buildExit, buildFloorTile, buildObstacle, buildRimEdge } from '../../src/render/parts/board';
import { buildFlockbot } from '../../src/render/parts/flockbot';

const sizeOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const UNIT = parts.unitPx;

describe('standalone parts follow the asset sheet', () => {
  it('flockbot_is_one_cell_wide_and_tall_and_stands_on_the_floor', () => {
    const bot = buildFlockbot('red').root;
    const box = new THREE.Box3().setFromObject(bot);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.round(size.x * UNIT)).toBe(56);
    expect(Math.round(size.y * UNIT)).toBe(56);
    expect(box.min.y).toBeCloseTo(0, 2);
  });

  it('floor_tile_and_exit_fill_one_cell', () => {
    expect(sizeOf(buildFloorTile(false, false)).x).toBeCloseTo(1, 2);
    expect(sizeOf(buildExit()).x).toBeCloseTo(1, 2);
  });

  it('obstacle_is_standard_height_within_a_cell', () => {
    const size = sizeOf(buildObstacle());
    expect(size.x).toBeLessThan(1);
    expect(Math.round(parts.obstacle.height * UNIT)).toBeGreaterThanOrEqual(22);
    expect(Math.round(parts.obstacle.height * UNIT)).toBeLessThanOrEqual(24);
  });

  it('rim_piece_has_the_sheet_proportions', () => {
    const size = sizeOf(buildRimEdge(1));
    expect(size.z / size.x).toBeCloseTo(8 / 30, 2);
    expect(size.y / size.x).toBeCloseTo(12 / 30, 2);
  });

  it('board_footprint_grows_with_the_grid', () => {
    const small = boardFootprint(5, 5, 0.06);
    const tall = boardFootprint(4, 7, 0.06);
    expect(tall.outerD).toBeGreaterThan(tall.outerW);
    expect(boardFootprint(8, 8, 0.06).outerW).toBeGreaterThan(small.outerW);
  });
});
