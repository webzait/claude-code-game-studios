import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import HL from '../../data/themes/garden/highlight.json';
import { buildHighlightTile, buildTileGlow, hintGlowCells } from '../../src/render/parts/garden/board';
import { boxOf, outwardShare } from './garden-helpers';

describe('garden glowing tile', () => {
  it('highlight tile carries its glow and the glow does not change its size', () => {
    const tile = buildHighlightTile(false, false);
    const glow = tile.userData.glow as THREE.Mesh;
    expect(glow).toBeInstanceOf(THREE.Mesh);
    expect(glow.name).toBe('tile-glow');
    const material = glow.material as THREE.MeshBasicMaterial;
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBe(HL.glow.pulse.high);
    expect(boxOf(tile).getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(TILE.tile.size);
    // Each glow has a material of its own, so one can pulse without the others.
    expect(buildTileGlow().material).not.toBe(buildTileGlow().material);
  });

  it('faces outward', () => {
    for (const part of [buildHighlightTile(false, true), buildHighlightTile(true, false)]) {
      const { agree, total } = outwardShare(part);
      expect(total).toBeGreaterThan(0);
      expect(agree / total).toBeGreaterThan(0.97);
    }
  });

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
