import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import parts from '../../data/parts.json';
import config from '../../data/config.json';
import { fuse } from '../../src/render/kit';
import { bodyNormal, bodyPoint, bodyReach, buildChick, CHICK_EXPRESSIONS, chickDirection, symbolFacing, symbolSpot, type ChickParts } from '../../src/render/parts/chick';
import { buildFlockbot } from '../../src/render/parts/flockbot';
import { buildChickRobot } from '../../src/render/robot';
import { SHAPE_COLOURS } from '../../src/ui/colourShapes';

const K = parts.chick;
const UNIT = parts.unitPx;
const VIEW_TILT = (config.board.roomy.tilt * Math.PI) / 180;
/** The most a chick may cost on the board: twelve stand on the largest one. */
const GAME_BUDGET = { triangles: 14000, drawCalls: 5 };
/** The least the forehead mark may face the game's camera, in any heading (1 is face on). */
const MIN_FACING = 0.45;

/** Triangles and draw calls of what is visible, as the game draws a figure: fixed parts fused, changing parts apart. */
function cost(fixed: THREE.Object3D, ...loose: THREE.Object3D[]): { triangles: number; drawCalls: number } {
  let triangles = 0;
  let drawCalls = 0;
  for (const object of [fuse(fixed), ...loose]) {
    object.traverseVisible((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const g = node.geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      drawCalls++;
    });
  }
  return { triangles, drawCalls };
}

function chickCost(chick: ChickParts): { triangles: number; drawCalls: number } {
  chick.root.remove(chick.symbol, chick.eyes);
  return cost(chick.root, chick.symbol, chick.eyes);
}

const visibleMeshes = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverseVisible((node) => void (n += node instanceof THREE.Mesh ? 1 : 0));
  return n;
};

describe('flock chick part', () => {
  it('chick_is_one_cell_wide_and_tall_and_stands_on_the_floor', () => {
    for (const color of SHAPE_COLOURS) {
      const box = new THREE.Box3().setFromObject(buildChick(color, { detail: 'game' }).root);
      const size = box.getSize(new THREE.Vector3());
      expect(Math.abs(size.x - K.width) * UNIT).toBeLessThanOrEqual(1);
      expect(Math.abs(size.y - K.height) * UNIT).toBeLessThanOrEqual(1);
      expect(size.z).toBeLessThanOrEqual(1);
      expect(box.min.y).toBeCloseTo(0, 2);
    }
  });

  it('body_skin_meets_its_measures_at_the_crown_the_sides_and_underneath', () => {
    expect(bodyPoint(chickDirection(90, 0)).y).toBeCloseTo(K.body.top, 6);
    expect(bodyPoint(chickDirection(-90, 0)).y).toBeCloseTo(K.body.bottom, 6);
    expect(bodyPoint(chickDirection(0, 90)).x).toBeCloseTo(K.body.radius, 6);
    expect(bodyPoint(chickDirection(0, 0)).z).toBeCloseTo(K.body.depth, 6);
    expect(bodyReach(chickDirection(0, 270))).toBeCloseTo(K.body.radius, 6);
  });

  it('body_skin_is_smooth_where_the_upper_and_lower_half_meet', () => {
    const above = bodyNormal(chickDirection(0.5, 30));
    const below = bodyNormal(chickDirection(-0.5, 30));
    expect(above.angleTo(below)).toBeLessThan(0.08);
    expect(bodyNormal(chickDirection(90, 0)).y).toBeCloseTo(1, 3);
    expect(bodyNormal(chickDirection(0, 0)).z).toBeCloseTo(1, 3);
  });

  it('front_and_back_differ_so_the_heading_can_be_read_from_the_body', () => {
    const chick = buildChick('red', { detail: 'game' });
    const beak = new THREE.Box3().setFromObject(chick.beak);
    const tail = new THREE.Box3().setFromObject(chick.tail);
    const eyes = new THREE.Box3().setFromObject(chick.eyes);
    // The beak sticks out in front of the body, the tail behind it; the eyes are on the front half.
    expect(beak.max.z).toBeGreaterThan(K.body.depth + 0.03);
    expect(tail.min.z).toBeLessThan(-K.body.depth - 0.03);
    expect(eyes.min.z).toBeGreaterThan(0);
    // The mark lies on the front of the head, between the eyes and the crown.
    const mark = new THREE.Box3().setFromObject(chick.symbol);
    expect(mark.min.z).toBeGreaterThan(0);
    expect(mark.min.y).toBeGreaterThan(eyes.max.y - 0.02);
  });

  it('forehead_mark_faces_the_game_camera_in_all_four_headings', () => {
    for (let heading = 0; heading < 4; heading++) {
      expect(symbolFacing(heading, VIEW_TILT, K.board.lean)).toBeGreaterThanOrEqual(MIN_FACING);
    }
    // Facing the player it is seen best, facing away worst, and the two sideways headings are alike.
    expect(symbolFacing(2, VIEW_TILT)).toBeGreaterThan(symbolFacing(0, VIEW_TILT));
    expect(symbolFacing(1, VIEW_TILT)).toBeCloseTo(symbolFacing(3, VIEW_TILT), 6);
  });

  it('pointer_mark_points_from_the_crown_towards_the_beak', () => {
    const chick = buildChick('blue', { detail: 'game', tip: 'beak' });
    const position = (chick.symbol.children[0].children[0] as THREE.Mesh).geometry.getAttribute('position');
    const spot = symbolSpot();
    // Along the skin's "up" the triangle is wide near the crown and comes to a point near the beak.
    let low = Infinity, high = -Infinity;
    const p = new THREE.Vector3();
    const along = (i: number): number => p.fromBufferAttribute(position, i).sub(spot.position).dot(spot.up);
    for (let i = 0; i < position.count; i++) {
      low = Math.min(low, along(i));
      high = Math.max(high, along(i));
    }
    const widthNear = (edge: number): number => {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < position.count; i++) {
        if (Math.abs(along(i) - edge) > 0.03) continue;
        const across = p.fromBufferAttribute(position, i).sub(spot.position).dot(spot.right);
        min = Math.min(min, across);
        max = Math.max(max, across);
      }
      return max - min;
    };
    expect(widthNear(high)).toBeGreaterThan(widthNear(low) * 2);
  });

  it('every_expression_shows_exactly_one_pair_of_eyes', () => {
    const chick = buildChick('yellow', { detail: 'game' });
    expect(CHICK_EXPRESSIONS.length).toBeGreaterThanOrEqual(2);
    expect(visibleMeshes(chick.eyes)).toBe(1);
    const shown = new Set<THREE.Object3D>();
    for (const expression of CHICK_EXPRESSIONS) {
      chick.setExpression(expression);
      const visible = chick.eyes.children.filter((eye) => eye.visible);
      expect(visible).toHaveLength(1);
      shown.add(visible[0]);
    }
    expect(shown.size).toBe(CHICK_EXPRESSIONS.length);
  });

  it('colour_shapes_swap_the_pointer_for_a_plate_with_a_pointer', () => {
    const chick = buildChick('red', { detail: 'game' });
    expect(visibleMeshes(chick.symbol)).toBe(1);
    chick.showShape(true);
    expect(visibleMeshes(chick.symbol)).toBe(2);
    chick.showShape(false);
    expect(visibleMeshes(chick.symbol)).toBe(1);
  });

  it('the_triangle_is_the_same_for_every_colour_and_can_stand_upright', () => {
    const mark = (color: 'red' | 'blue' | 'yellow', tip: 'beak' | 'crown'): THREE.BufferGeometry =>
      (buildChick(color, { detail: 'game', tip }).symbol.children[0].children[0] as THREE.Mesh).geometry;
    expect(mark('red', 'beak')).toBe(mark('blue', 'beak'));
    expect(mark('red', 'beak')).toBe(mark('yellow', 'beak'));
    // Upright it is the same triangle turned half round: as many vertices, another shape on the skin.
    expect(mark('red', 'crown')).not.toBe(mark('red', 'beak'));
    expect(mark('red', 'crown').getAttribute('position').count).toBe(mark('red', 'beak').getAttribute('position').count);
  });

  it('a_chick_on_the_board_stays_within_budget_and_is_lighter_than_the_flockbot', () => {
    const chick = chickCost(buildChick('red', { detail: 'game' }));
    const bot = buildFlockbot('red');
    bot.root.remove(bot.symbol);
    const flockbot = cost(bot.root, bot.symbol);
    expect(chick.triangles).toBeLessThanOrEqual(GAME_BUDGET.triangles);
    expect(chick.drawCalls).toBeLessThanOrEqual(GAME_BUDGET.drawCalls);
    expect(chick.triangles).toBeLessThan(flockbot.triangles);
    expect(chick.drawCalls).toBeLessThanOrEqual(flockbot.drawCalls);
    // With the colour shape shown there is one more thing to draw.
    const shaped = buildChick('red', { detail: 'game' });
    shaped.showShape(true);
    expect(chickCost(shaped).drawCalls).toBeLessThanOrEqual(GAME_BUDGET.drawCalls + 1);
  });

  it('chicks_of_one_colour_share_their_geometry', () => {
    expect(buildChick('blue', { detail: 'game' }).body.geometry).toBe(buildChick('blue', { detail: 'game' }).body.geometry);
    expect(buildChick('blue', { detail: 'game' }).body.geometry).not.toBe(buildChick('blue', { detail: 'fine' }).body.geometry);
  });

  it('chick_robot_turns_as_a_whole_and_cheers_with_its_eyes', () => {
    const view = buildChickRobot(1, 'yellow');
    const front = (): THREE.Vector3 => {
      view.root.updateMatrixWorld(true);
      let eyes: THREE.Object3D | null = null;
      view.root.traverse((node) => {
        if (node instanceof THREE.Group && node.children.length === 2 && node.children.every((c) => c instanceof THREE.Mesh) && node.children.some((c) => !c.visible)) eyes = node;
      });
      return new THREE.Box3().setFromObject(eyes!).getCenter(new THREE.Vector3());
    };
    // Heading 0 is north (-z), and a quarter turn clockwise is east (+x): the eyes lead the way.
    view.aim(0);
    expect(front().z).toBeLessThan(-0.1);
    view.aim(-Math.PI / 2);
    expect(front().x).toBeGreaterThan(0.1);
    expect(view.cheer).toBeDefined();
    const box = new THREE.Box3().setFromObject(view.root);
    expect(box.getSize(new THREE.Vector3()).x).toBeLessThanOrEqual(config.board.grid.robotFill + 0.02);
  });
});
