import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import * as robot from '../../src/render/parts/board';
import { buildFloorTile } from '../../src/render/parts/garden/board';
import { buildFloorTileCode } from '../../src/render/parts/garden/grass';
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

describe('garden grass tile from the owner picture', () => {
  const I = TILE.image;
  const atlas = 'assets/turnflock/garden/board/tile/grass-tile.webp';

  it('is a small WebP atlas of the size the data file says', () => {
    const bytes = readFileSync(atlas);
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeLessThan(80 * 1024);
    // VP8X header: canvas width and height minus one, 24-bit little endian.
    expect(bytes.subarray(12, 16).toString()).toBe('VP8X');
    expect(bytes.readUIntLE(24, 3) + 1).toBe(I.atlas.top);
    expect(bytes.readUIntLE(27, 3) + 1).toBe(I.atlas.top + I.atlas.pad + I.atlas.side);
  });

  it('is one mesh in one material, so a board of tiles fuses into one draw', () => {
    const meshes: THREE.Mesh[] = [];
    buildFloorTile(true, false).traverse((n) => { if (n instanceof THREE.Mesh) meshes.push(n); });
    expect(meshes.length).toBe(1);
    expect(meshes[0].material).toBe((buildFloorTile(false, false).children[0] as THREE.Mesh).material);
  });

  it('keeps the side inside the fuzzy outline of the top, seen from above', () => {
    // The picture's fur tips reach 0.962 of the top's width (cut.py); the side must not show past them.
    expect(I.wall).toBeLessThan(I.top * 0.962);
    expect(I.wallTop).toBeLessThan(TILE.tile.height);
  });

  it('samples only its own piece of the atlas: the top the top rows, the side the strip', () => {
    const g = (buildFloorTile(false, false).children[0] as THREE.Mesh).geometry;
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const h = I.atlas.top + I.atlas.pad + I.atlas.side;
    const topFloor = 1 - I.atlas.top / h;
    const sideCeil = 1 - (I.atlas.top + I.atlas.pad) / h;
    for (let i = 0; i < pos.count; i++) {
      const v = uv.getY(i);
      const u = uv.getX(i);
      expect(u).toBeGreaterThanOrEqual(-1e-6);
      expect(u).toBeLessThanOrEqual(1 + 1e-6);
      if (Math.abs(pos.getY(i) - TILE.tile.height) < 1e-6) expect(v).toBeGreaterThanOrEqual(topFloor - 1e-6);
      else expect(v).toBeLessThanOrEqual(sideCeil + 1e-6);
    }
  });

  it('the earlier code tile is still there, with the same footprint', () => {
    const a = boxOf(buildFloorTileCode(false, false)).getSize(new THREE.Vector3());
    expect(a.x).toBeGreaterThan(0.9);
    expect(a.y).toBeCloseTo(TILE.tile.height, 3);
  });
});
