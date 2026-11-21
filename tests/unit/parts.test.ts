import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import parts from '../../data/parts.json';
import { boardFootprint, boardPixels, buildExit, buildFloorTile, buildObstacle, buildRim, buildRimCorner, buildRimEdge, buildUnderlay, rimLayout } from '../../src/render/parts/board';
import config from '../../data/config.json';
import { buildFlockbot } from '../../src/render/parts/flockbot';

const sizeOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const UNIT = parts.unitPx;
const GAP = config.board.grid.gap;
const PHONE = 390;
const BOARDS = [[5, 5], [6, 6], [8, 8], [4, 7]] as const;
const TRIANGLE_BUDGET = { tile: 300, rimEdge: 120, rimCorner: 700, board8x8: 25000 };

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

  it('six_by_six_board_has_the_owner_pixel_sizes_on_a_390px_phone', () => {
    const px = boardPixels(6, 6, GAP, PHONE - 2 * config.camera.marginX);
    expect(px.width).toBeGreaterThanOrEqual(360);
    expect(px.width).toBeLessThanOrEqual(368);
    expect(px.tile).toBeGreaterThanOrEqual(52);
    expect(px.tile).toBeLessThanOrEqual(56);
    expect(px.gap).toBeGreaterThanOrEqual(3);
    expect(px.gap).toBeLessThanOrEqual(4);
    expect(px.frame).toBeGreaterThanOrEqual(10);
    expect(px.frame).toBeLessThanOrEqual(14);
  });

  it('rim_is_repeated_modules_one_straight_piece_per_cell_and_one_corner_shape', () => {
    for (const [cols, rows] of BOARDS) {
      const pieces = buildRim(cols, rows, GAP).children as THREE.Mesh[];
      const layout = rimLayout(cols, rows, GAP);
      expect(layout.filter((p) => p.kind === 'edge').length).toBe(2 * (cols + rows));
      expect(layout.filter((p) => p.kind === 'corner').length).toBe(4);
      expect(new Set(pieces.map((m) => m.geometry.uuid)).size).toBe(2);
      // A straight piece is never stretched far from its one-cell length.
      for (const place of layout) if (place.kind === 'edge') expect(Math.abs(place.length - 1)).toBeLessThan(0.06);
    }
  });

  it('rim_closes_around_the_board_without_steps_or_gaps', () => {
    for (const [cols, rows] of BOARDS) {
      const frame = buildRim(cols, rows, GAP);
      frame.updateMatrixWorld(true);
      const { outerW, outerD } = boardFootprint(cols, rows, GAP);
      const size = sizeOf(frame);
      expect(size.x).toBeCloseTo(outerW, 4);
      expect(size.z).toBeCloseTo(outerD, 4);
      // Every piece ends on the same cross-section as its neighbour: collect each
      // piece's two end outlines and check that every outline is shared by two pieces.
      const ends = new Map<string, number>();
      for (const piece of frame.children as THREE.Mesh[]) {
        const position = piece.geometry.getAttribute('position');
        const keys = new Set<string>();
        const isCorner = sizeOf(new THREE.Mesh(piece.geometry)).z > parts.rim.width + 0.01;
        for (let i = 0; i < position.count; i++) {
          const local = new THREE.Vector3().fromBufferAttribute(position, i);
          const atEnd = isCorner ? Math.abs(local.x) < 1e-6 || Math.abs(local.z) < 1e-6 : Math.abs(Math.abs(local.x) - 0.5) < 1e-6;
          if (!atEnd) continue;
          const world = local.applyMatrix4(piece.matrixWorld);
          keys.add([world.x, world.y, world.z].map((n) => n.toFixed(4)).join(','));
        }
        for (const key of keys) ends.set(key, (ends.get(key) ?? 0) + 1);
      }
      expect([...ends.values()].every((count) => count === 2)).toBe(true);
    }
  });

  it('underlay_follows_the_grid_and_carries_the_rim', () => {
    for (const [cols, rows] of BOARDS) {
      const { outerW, outerD } = boardFootprint(cols, rows, GAP);
      const size = sizeOf(buildUnderlay(cols, rows, GAP));
      expect(size.x).toBeCloseTo(outerW, 4);
      expect(size.z).toBeCloseTo(outerD, 4);
      expect(buildUnderlay(cols, rows, GAP, true).children.length).toBe(1 + cols * rows);
    }
    // Tray height as drawn: 12 mm on a 30 mm cell, the same as the rim.
    expect(sizeOf(buildUnderlay(6, 6, GAP)).y).toBeCloseTo(12 / 30, 1);
  });

  it('corner_tile_keeps_the_same_clearance_around_its_rounded_corner', () => {
    expect(parts.rim.innerRadius).toBeCloseTo(parts.rim.margin + parts.floorTile.radius, 5);
  });

  it('an_eight_by_eight_board_stays_within_the_triangle_budget', () => {
    const triangles = (o: THREE.Object3D): number => {
      let n = 0;
      o.traverse((m) => {
        if (m instanceof THREE.Mesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
      });
      return n;
    };
    const total = 64 * triangles(buildFloorTile(false, false)) + triangles(buildRim(8, 8, GAP)) + triangles(buildUnderlay(8, 8, GAP));
    expect(triangles(buildFloorTile(false, false))).toBeLessThanOrEqual(TRIANGLE_BUDGET.tile);
    expect(triangles(buildRimEdge(1))).toBeLessThanOrEqual(TRIANGLE_BUDGET.rimEdge);
    expect(triangles(buildRimCorner())).toBeLessThanOrEqual(TRIANGLE_BUDGET.rimCorner);
    expect(total).toBeLessThanOrEqual(TRIANGLE_BUDGET.board8x8);
  });
});
