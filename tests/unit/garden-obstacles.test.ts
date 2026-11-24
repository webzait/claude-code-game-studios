import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import levels from '../../data/levels.json';
import data from '../../data/themes/garden/obstacles.json';
import { parseLevel } from '../../src/levels/parse';
import { cellHash, chooseObstacles, FAMILY_OF, type ChoiceWeights, type ObstacleChoice } from '../../src/render/parts/garden/obstacleChoice';
import { buildObstacle, GARDEN_OBSTACLE_KINDS, OBSTACLE_SPRITES } from '../../src/render/parts/garden/obstacles';

const LEVELS = levels.map((def) => parseLevel(def));
/** A 5×5 board that is all wall: the hardest case for the neighbour rule. */
const ALL_WALLS = { width: 5, height: 5, walls: new Array(25).fill(true) as boolean[] };

describe('garden obstacle choice', () => {
  it('cell_hash_is_stable_and_differs_between_cells_and_levels', () => {
    expect(cellHash('first-steps', 2, 3)).toBe(cellHash('first-steps', 2, 3));
    expect(cellHash('first-steps', 2, 3)).not.toBe(cellHash('first-steps', 3, 2));
    expect(cellHash('first-steps', 2, 3)).not.toBe(cellHash('long-gate', 2, 3));
  });

  it('the_same_level_always_gets_the_same_obstacles', () => {
    for (const level of LEVELS) {
      const { width, height, walls } = level.board;
      expect(chooseObstacles(level.id, width, height, walls)).toEqual(chooseObstacles(level.id, width, height, walls));
    }
  });

  it('only_wall_cells_get_an_obstacle_with_a_quarter_turn', () => {
    for (const level of LEVELS) {
      const { width, height, walls } = level.board;
      chooseObstacles(level.id, width, height, walls).forEach((c, i) => {
        expect(c !== null).toBe(walls[i]);
        if (c) expect([0, 1, 2, 3]).toContain(c.turn);
      });
    }
  });

  it('touching_walls_are_never_the_same_family', () => {
    const check = (id: string, width: number, height: number, choices: (ObstacleChoice | null)[]): void => {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const c = choices[y * width + x];
        if (!c) continue;
        const right = x + 1 < width ? choices[y * width + x + 1] : null;
        const below = y + 1 < height ? choices[(y + 1) * width + x] : null;
        if (right) expect(FAMILY_OF[right.kind], `${id} ${x},${y} right`).not.toBe(FAMILY_OF[c.kind]);
        if (below) expect(FAMILY_OF[below.kind], `${id} ${x},${y} below`).not.toBe(FAMILY_OF[c.kind]);
      }
    };
    for (const level of LEVELS) {
      const { width, height, walls } = level.board;
      check(level.id, width, height, chooseObstacles(level.id, width, height, walls));
    }
    for (const id of ['a', 'b', 'c', 'long-gate']) check(id, 5, 5, chooseObstacles(id, ALL_WALLS.width, ALL_WALLS.height, ALL_WALLS.walls));
  });

  it('every_kind_appears_across_the_shipped_levels', () => {
    const seen = new Set<string>();
    for (const level of LEVELS) {
      const { width, height, walls } = level.board;
      for (const c of chooseObstacles(level.id, width, height, walls)) if (c) seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...GARDEN_OBSTACLE_KINDS].sort());
  });

  it('weights_steer_the_choice_and_the_neighbour_rule_still_wins', () => {
    const onlyRock: ChoiceWeights = { families: { rock: 1, bush: 0, stump: 0 }, variants: data.choice.variants as ChoiceWeights['variants'] };
    // A lone wall follows the weights.
    const lone = chooseObstacles('x', 3, 1, [false, true, false], onlyRock);
    expect(FAMILY_OF[lone[1]!.kind]).toBe('rock');
    // Two touching walls: the second cannot be a rock, so it falls back to the others.
    const pair = chooseObstacles('x', 2, 1, [true, true], onlyRock);
    expect(FAMILY_OF[pair[0]!.kind]).toBe('rock');
    expect(FAMILY_OF[pair[1]!.kind]).not.toBe('rock');
  });
});

/** Where a point lands on screen under the game camera (orthographic approximation): x right, y up. */
const TILT = THREE.MathUtils.degToRad(30);
const screenUp = (p: THREE.Vector3): number => p.y * Math.sin(TILT) - p.z * Math.cos(TILT);
const toCamera = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT));
/** The obstacle's picture card and its square ground shadow, found by material name. */
const partOf = (o: THREE.Object3D, ground: boolean): THREE.Mesh =>
  o.children.find((c) => c instanceof THREE.Mesh && ((c.material as THREE.Material).name === 'garden-obstacle-ground') === ground) as THREE.Mesh;
const card = (o: THREE.Object3D): THREE.Mesh => partOf(o, false);

describe('garden obstacle pictures (the default)', () => {
  for (const kind of GARDEN_OBSTACLE_KINDS) {
    it(`${kind}_is_one_camera_facing_card_whose_object_fits_the_cell`, () => {
      const o = buildObstacle(kind);
      const meshes: THREE.Mesh[] = [];
      o.traverse((m) => (m instanceof THREE.Mesh ? meshes.push(m) : undefined));
      expect(meshes).toHaveLength(2);
      const g = card(o).geometry as THREE.BufferGeometry;
      expect(g.index!.count / 3).toBe(2);
      // Square to the camera: every corner the same distance along the view direction.
      const pos = g.getAttribute('position');
      const depth = [0, 1, 2, 3].map((i) => new THREE.Vector3().fromBufferAttribute(pos, i).dot(toCamera));
      for (const d of depth) expect(d).toBeCloseTo(depth[0], 5);
      // The object (not its shadow) is as wide as the data says, so it stays inside one cell.
      const s = OBSTACLE_SPRITES[kind];
      const cardWidth = new THREE.Box3().setFromBufferAttribute(pos as THREE.BufferAttribute).getSize(new THREE.Vector3()).x;
      const objectWidth = cardWidth * (s.objectRight - s.objectLeft);
      expect(objectWidth).toBeCloseTo(data.sprite.width[kind], 5);
      expect(objectWidth).toBeLessThanOrEqual(0.9);
      // Never below the tile.
      for (let i = 0; i < 4; i++) expect(pos.getY(i)).toBeGreaterThanOrEqual(0);
    });
  }

  it('the_object_foot_sits_on_the_cell_as_seen_from_the_camera', () => {
    for (const kind of GARDEN_OBSTACLE_KINDS) {
      const g = card(buildObstacle(kind)).geometry as THREE.BufferGeometry;
      const pos = g.getAttribute('position');
      const bottom = screenUp(new THREE.Vector3().fromBufferAttribute(pos, 0));
      const top = screenUp(new THREE.Vector3().fromBufferAttribute(pos, 3));
      const s = OBSTACLE_SPRITES[kind];
      const foot = top + (bottom - top) * s.foot;
      // The foot line lands where the floor point footForward towards the camera lands.
      expect(foot).toBeCloseTo(screenUp(new THREE.Vector3(0, 0, data.sprite.footForward)), 5);
    }
  });

  it('odd_turns_mirror_only_pictures_that_allow_it', () => {
    for (const kind of GARDEN_OBSTACLE_KINDS) {
      const uv = (turn: number) => Array.from((card(buildObstacle(kind, turn)).geometry as THREE.BufferGeometry).getAttribute('uv').array);
      if (data.sprite.mirror[kind]) expect(uv(1)).not.toEqual(uv(0));
      else expect(uv(1)).toEqual(uv(0));
      expect(uv(2)).toEqual(uv(0));
    }
  });

  it('copies_share_one_material_per_kind_and_cast_no_shadow', () => {
    const a = card(buildObstacle('stump'));
    const b = card(buildObstacle('stump', 3));
    expect(a.material).toBe(b.material);
    expect(a.castShadow).toBe(false);
  });

  it('every_obstacle_stands_in_one_shared_square_shadow_lying_flat_inside_its_tile', () => {
    const tile = 0.96;
    const grounds = GARDEN_OBSTACLE_KINDS.map((k) => partOf(buildObstacle(k), true));
    for (const g of grounds) {
      expect(g.material).toBe(grounds[0].material);
      expect(g.castShadow).toBe(false);
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      expect(size.y).toBeCloseTo(0, 5);
      expect(box.min.y).toBeGreaterThan(0);
      expect(size.x).toBeLessThanOrEqual(tile);
      expect(size.z).toBeLessThanOrEqual(tile);
      expect(size.x).toBeCloseTo(size.z, 5);
    }
  });

  it('the_pictures_stay_small', () => {
    const total = GARDEN_OBSTACLE_KINDS.reduce((sum, k) => sum + OBSTACLE_SPRITES[k].bytes, 0);
    expect(total).toBeLessThanOrEqual(80 * 1024);
  });
});
