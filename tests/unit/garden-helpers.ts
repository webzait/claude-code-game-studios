/** Shared helpers of the garden board tests (garden-*.test.ts). */
import * as THREE from 'three';

/** Every board size the game uses: 4×4 to 8×8, square or not. */
export const SIZES: [number, number][] = [];
for (let c = 4; c <= 8; c++) for (let r = 4; r <= 8; r++) SIZES.push([c, r]);

/** The box round an object. */
export const boxOf = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o);

/**
 * Share of a single-sided mesh's triangles whose winding agrees with their vertex normals, so
 * the face the camera sees is its outside. Double-sided meshes (leaves, fur, flowers) are skipped.
 */
export function outwardShare(object: THREE.Object3D): { agree: number; total: number } {
  let agree = 0;
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if ((node.material as THREE.Material).side === THREE.DoubleSide) return;
    const g = node.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const index = g.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const [i0, i1, i2] = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      if (face.lengthSq() < 1e-14) continue;
      n.fromBufferAttribute(nor, i0).add(new THREE.Vector3().fromBufferAttribute(nor, i1)).add(new THREE.Vector3().fromBufferAttribute(nor, i2));
      total++;
      if (face.dot(n) > 0) agree++;
    }
  });
  return { agree, total };
}
