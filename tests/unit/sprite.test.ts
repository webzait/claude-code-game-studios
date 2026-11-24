// Picture parts (src/render/parts/sprite.ts) and how the board keeps them apart when it fuses (src/render/kit.ts).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fuse } from '../../src/render/kit';
import { buildBillboard, buildDecal, DEFAULT_ALPHA_CUT, prepareSpriteTexture, spriteMaterial } from '../../src/render/parts/sprite';

const texture = (): THREE.Texture => prepareSpriteTexture(new THREE.Texture());
const box = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);

describe('picture parts', () => {
  it('a texture is prepared sharp and in sRGB, with mipmaps', () => {
    const t = texture();
    expect(t.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(t.generateMipmaps).toBe(true);
    expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(t.magFilter).toBe(THREE.LinearFilter);
  });

  it('draws as a cut-out: alpha test, depth written, no blending, unlit unless asked', () => {
    const t = texture();
    const m = spriteMaterial(t) as THREE.MeshBasicMaterial;
    expect(m).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(m.alphaTest).toBe(DEFAULT_ALPHA_CUT);
    expect(m.alphaToCoverage).toBe(true);
    expect(m.transparent).toBe(false);
    expect(m.depthWrite).toBe(true);
    expect(spriteMaterial(t, { lit: true })).toBeInstanceOf(THREE.MeshStandardMaterial);
    // One material per picture and look, so pieces sharing a picture fuse into one mesh.
    expect(spriteMaterial(t)).toBe(m);
  });

  it('a billboard stands with its foot on the origin and is kept apart from fusing', () => {
    const b = buildBillboard(texture(), { width: 0.8, aspect: 0.5 });
    const size = box(b);
    expect(size.min.y).toBeCloseTo(0);
    expect(size.max.y).toBeCloseTo(1.6);
    expect(size.max.x - size.min.x).toBeCloseTo(0.8);
    expect(b.userData.keepApart).toBe(true);
    // Transparent space under the foot is pushed below the tile.
    const lifted = buildBillboard(texture(), { width: 1, height: 1, foot: 0.1 });
    expect(box(lifted).min.y).toBeCloseTo(-0.1);
  });

  it('a billboard faces the camera fully by default, pivoting on its foot', () => {
    const b = buildBillboard(texture(), { width: 1, height: 1 });
    const mesh = b.children[0] as THREE.Mesh;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 8, 4);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    mesh.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), camera, mesh.geometry, mesh.material as THREE.Material, null as unknown as THREE.Group);
    expect(mesh.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0);
    b.updateMatrixWorld(true);
    expect(mesh.localToWorld(new THREE.Vector3(0, 0, 0)).length()).toBeCloseTo(0);
  });

  it('an upright billboard turns only around the vertical', () => {
    const b = buildBillboard(texture(), { width: 1, height: 1, facing: 'upright' });
    const mesh = b.children[0] as THREE.Mesh;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 5, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    mesh.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), camera, mesh.geometry, mesh.material as THREE.Material, null as unknown as THREE.Group);
    expect(mesh.rotation.x).toBe(0);
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it('a decal lies flat at its height and shows the asked part of the picture', () => {
    const d = buildDecal(texture(), { width: 1, depth: 0.5, y: 0.02, uv: [0.5, 0, 1, 0.25] });
    const size = box(d);
    expect(size.min.y).toBeCloseTo(0.02);
    expect(size.max.y).toBeCloseTo(0.02);
    expect(size.max.z - size.min.z).toBeCloseTo(0.5);
    const uv = d.geometry.getAttribute('uv');
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
    expect(Math.min(...us)).toBeCloseTo(0.5);
    expect(Math.max(...vs)).toBeCloseTo(0.25);
    const turned = buildDecal(texture(), { width: 1, depth: 0.5, quarterTurns: 1 });
    expect(box(turned).max.x - box(turned).min.x).toBeCloseTo(0.5);
  });

  it('fusing merges still pieces but keeps a billboard apart, in the same place', () => {
    const t = texture();
    const group = new THREE.Group();
    for (const x of [0, 1]) {
      const decal = buildDecal(t, { width: 1, depth: 1 });
      decal.position.x = x;
      group.add(decal);
    }
    const rock = buildBillboard(t, { width: 1, height: 1 });
    rock.position.set(2, 0.3, -1);
    group.add(rock);
    const fused = fuse(group);
    expect(fused.children).toHaveLength(2);
    expect(fused.children).toContain(rock);
    expect(rock.position.toArray()).toEqual([2, 0.3, -1]);
  });
});
