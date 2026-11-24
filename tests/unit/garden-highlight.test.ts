import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import TILE from '../../data/themes/garden/tile.json';
import HL from '../../data/themes/garden/highlight.json';
import { buildFloorTile, buildHighlightTile, buildTileGlow, hintGlowCells } from '../../src/render/parts/garden/board';
import { glowAt, glowPictureSource, glowPulse } from '../../src/render/parts/garden/highlight';
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

  it("shows the owner's picture by default, the painted glow only when asked", () => {
    expect(buildTileGlow().userData.style).toBe('picture');
    expect((buildHighlightTile().userData.glow as THREE.Mesh).userData.style).toBe('picture');
    expect(buildTileGlow('painted').userData.style).toBe('painted');
    expect(buildHighlightTile(true, false, 'painted').userData.glow.userData.style).toBe('painted');
    expect(glowPictureSource).toMatch(/glow-rim\.webp$/);
  });

  it('is the plain grass tile with the glow on it', () => {
    for (const alt of [false, true]) {
      const lit = buildHighlightTile(alt, false);
      const plain = buildFloorTile(alt, false);
      // The same tile meshes, plus the glow.
      expect(lit.children.length).toBe(plain.children.length + 1);
      expect(lit.children.at(-1)).toBe(lit.userData.glow);
    }
  });

  it('follows the profile measured from the reference: cream line on the outline, halo out, nothing far off', () => {
    const line = glowAt(0);
    expect(line.alpha).toBe(1);
    expect(Math.min(...line.rgb)).toBeGreaterThan(225); // cream, close to white
    const halo = glowAt(0.05);
    expect(halo.alpha).toBeGreaterThan(0.5);
    expect(halo.rgb[2]).toBeLessThan(halo.rgb[0] - 120); // yellow: little blue
    expect(glowAt(-0.05).alpha).toBeGreaterThan(0.4); // inner glow
    expect(glowAt(HL.glow.reach).alpha).toBe(0);
    expect(glowAt(-0.3).alpha).toBe(0);
    // Out from the line the halo only fades.
    for (let d = 0.036; d < HL.glow.reach; d += 0.01) expect(glowAt(d + 0.01).alpha).toBeLessThanOrEqual(glowAt(d).alpha);
  });

  it('pulses between low and high, one cycle per pulse.seconds', () => {
    const p = HL.glow.pulse;
    expect(glowPulse(0)).toBeCloseTo(p.high);
    expect(glowPulse(p.seconds / 2)).toBeCloseTo(p.low);
    expect(glowPulse(p.seconds)).toBeCloseTo(p.high);
    for (let t = 0; t < 2 * p.seconds; t += 0.05) {
      expect(glowPulse(t)).toBeGreaterThanOrEqual(p.low - 1e-9);
      expect(glowPulse(t)).toBeLessThanOrEqual(p.high + 1e-9);
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
