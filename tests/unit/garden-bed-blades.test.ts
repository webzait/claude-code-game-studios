import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import UNDER from '../../data/themes/garden/underlay.json';
import { boardFootprint, buildFloorTile, buildRim, buildUnderlay } from '../../src/render/parts/garden/board';
import { bedSpans, bladeFieldGeometry } from '../../src/render/parts/garden/underlay';

// The grass bed made of blade cards (design/themes/garden-board-bed.md).
const GAP = 0.06;
const B = UNDER.blades;
const PITCH = TILE.tile.size + GAP;

function triangles(o: THREE.Object3D | THREE.BufferGeometry): number {
  if (o instanceof THREE.BufferGeometry) return (o.index ? o.index.count : o.getAttribute('position').count) / 3;
  let t = 0;
  o.traverse((n) => {
    if (n instanceof THREE.Mesh) t += triangles(n.geometry as THREE.BufferGeometry);
  });
  return t;
}

describe('garden grass bed of blade cards', () => {
  it('a whole 8x8 board with the blade bed stays within the robot board budget', () => {
    const board = new THREE.Group();
    board.add(buildUnderlay(8, 8, GAP), buildRim(8, 8, GAP));
    for (let i = 0; i < 64; i++) board.add(buildFloorTile(i % 2 === 1, false));
    // The robot board of this size has 19,596 triangles (garden-rim.test.ts).
    expect(triangles(board) + triangles(bladeFieldGeometry(8, 8, GAP))).toBeLessThan(19600);
  });

  it('no card stands inside a tile wall or outside the rim', () => {
    const { innerW } = boardFootprint(6, 6, GAP);
    const hw = TILE.image.wall / 2 - B.tuck;
    const straight = hw - Math.max(0, TILE.image.wallRadius - B.tuck);
    for (let z = -3.2; z <= 3.2; z += 0.013) {
      for (const [x0, x1] of bedSpans(6, 6, GAP, z)) {
        expect(x0).toBeLessThan(x1);
        expect(x0).toBeGreaterThanOrEqual(-innerW / 2 - B.outset - 1e-9);
        expect(x1).toBeLessThanOrEqual(innerW / 2 + B.outset + 1e-9);
        // Inside the straight part of a tile's wall no span may reach past its sides.
        for (let c = 0; c < 6; c++) {
          const cx = (c - 2.5) * PITCH;
          for (let r = 0; r < 6; r++) {
            const cz = (r - 2.5) * PITCH;
            if (Math.abs(z - cz) < straight) expect(x1 <= cx - hw + 1e-9 || x0 >= cx + hw - 1e-9).toBe(true);
          }
        }
      }
    }
  });

  it('every gap between two tiles is covered along its whole length', () => {
    // The middle of the gap between the first two columns, at every depth along a tile's side.
    const x = -2 * PITCH;
    for (let z = -0.4; z <= 0.4; z += 0.05) {
      expect(bedSpans(6, 6, GAP, z).some(([a, b]) => a < x && b > x)).toBe(true);
    }
    // A row along a gap between two rows of tiles is one card the whole width of the bed.
    expect(bedSpans(6, 6, GAP, 0)).toHaveLength(1);
    // A row through a row of six tiles has one card per gap: five between them and one at each rim.
    expect(bedSpans(6, 6, GAP, PITCH / 2)).toHaveLength(7);
  });

  it('is the same every time, with two triangles per card and blades rising from the bed', () => {
    const a = bladeFieldGeometry(4, 4, GAP);
    const b = bladeFieldGeometry(4, 4, GAP);
    expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
    expect(a.getAttribute('position').count).toBe((a.index?.count ?? 0) / 6 * 4);
    const box = new THREE.Box3().setFromBufferAttribute(a.getAttribute('position') as THREE.BufferAttribute);
    expect(box.min.y).toBeGreaterThan(0);
    expect(box.max.y).toBeLessThanOrEqual(B.height * (1 + B.heightJitter) * B.rimHeight + 1e-9);
  });
});
