import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import FX from '../../data/fx_bump_cloud.json';
import { BumpClouds, bumpCloudSeconds, type BumpCloudPictures } from '../../src/render/bumpCloud';

// The cloud puff where a robot bumps into something, kept from the garden theme (design/themes.md).

/** Blank textures in place of the pictures: no browser is needed to place and time the puffs. */
const blank = (): BumpCloudPictures => ({ cloud: new THREE.Texture(), ball: new THREE.Texture() });
const FRAME = { pitch: 1.06, floorY: 0.3, tilt: 30 };

describe('the cloud puff on a bump', () => {
  it('is short enough not to hold up play, and its calm version is no longer', () => {
    expect(bumpCloudSeconds(false)).toBeGreaterThan(0);
    expect(bumpCloudSeconds(false)).toBeLessThanOrEqual(1);
    expect(bumpCloudSeconds(true)).toBeLessThanOrEqual(bumpCloudSeconds(false));
  });

  it('appears where the robot touches, on the floor, and goes away by itself', () => {
    const board = new THREE.Group();
    const clouds = new BumpClouds(board, FRAME, FX, blank());
    const cloud = clouds.bump(2.5, -1);
    expect(board.children).toContain(cloud.group);
    expect(cloud.group.position.toArray()).toEqual([2.5, FRAME.floorY, -1]);
    clouds.update(cloud.seconds / 2);
    expect(clouds.active).toBe(1);
    clouds.update(cloud.seconds);
    expect(clouds.active).toBe(0);
    expect(board.children).toHaveLength(0);
  });

  it('breaks into its balls when lively, and only fades in and out with reduced motion', () => {
    const clouds = new BumpClouds(new THREE.Group(), FRAME, FX, blank());
    const lively = clouds.bump(0, 0);
    clouds.reduced = true;
    const calm = clouds.bump(0, 0);
    const balls = (c: typeof lively): number => (c.group.children.find((m) => m instanceof THREE.InstancedMesh) as THREE.InstancedMesh).count;
    expect(balls(lively)).toBeGreaterThan(0);
    expect(balls(calm)).toBe(0);
    expect(calm.seconds).toBe(FX.calm_seconds);
    // Calm: nothing grows; the picture keeps its size the whole time.
    const cloudMesh = calm.group.children.find((m) => !(m instanceof THREE.InstancedMesh))!;
    calm.update(calm.seconds / 2);
    expect(cloudMesh.scale.x).toBe(1);
  });

  it('stops every puff at once when the level changes', () => {
    const board = new THREE.Group();
    const clouds = new BumpClouds(board, FRAME, FX, blank());
    clouds.bump(0, 0);
    clouds.bump(1, 1);
    clouds.dispose();
    expect(clouds.active).toBe(0);
    expect(board.children).toHaveLength(0);
  });
});
