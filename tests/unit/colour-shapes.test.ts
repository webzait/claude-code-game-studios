import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import config from '../../data/config.json';
import parts from '../../data/parts.json';
import { buildFlockbot, shapePlate } from '../../src/render/parts/flockbot';
import { buildPartsRobot, buildRobot } from '../../src/render/robot';
import { HEADING_STYLES } from '../../src/render/heading';
import { SHAPE_COLOURS, SHAPE_OUTLINES, shapeOf, shapesInWords, shapeSvg } from '../../src/ui/colourShapes';

/** Meshes that would be drawn: visible themselves and under visible parents only. */
function drawn(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const walk = (node: THREE.Object3D): void => {
    if (!node.visible) return;
    if (node instanceof THREE.Mesh) out.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return out;
}

describe('colour shapes', () => {
  it('every_robot_colour_has_a_known_shape_of_its_own', () => {
    const shapes = SHAPE_COLOURS.map(shapeOf);
    for (const shape of shapes) expect(Object.keys(SHAPE_OUTLINES)).toContain(shape);
    expect(new Set(shapes).size).toBe(SHAPE_COLOURS.length);
    expect(Object.keys(config.colourShapes).sort()).toEqual([...SHAPE_COLOURS].sort());
  });

  it('names_the_shapes_in_words_from_the_data', () => {
    expect(shapesInWords()).toBe(`Red ${config.colourShapes.red}, blue ${config.colourShapes.blue}, yellow ${config.colourShapes.yellow}`);
  });

  it('draws_each_shape_inside_its_box_and_no_two_alike', () => {
    const pictures = Object.keys(SHAPE_OUTLINES).map((name) => shapeSvg(name as keyof typeof SHAPE_OUTLINES));
    expect(new Set(pictures).size).toBe(pictures.length);
    for (const { side, turn } of Object.values(SHAPE_OUTLINES)) {
      // A turned square reaches its box with its corners.
      const reach = turn === 0 ? side : side * (Math.abs(Math.cos((turn * Math.PI) / 180)) + Math.abs(Math.sin((turn * Math.PI) / 180)));
      expect(reach).toBeLessThanOrEqual(1.1);
    }
  });

  it('the_plate_on_a_robot_stays_on_its_top_and_holds_the_heading_triangle', () => {
    const S = parts.flockbot.symbol;
    for (const color of SHAPE_COLOURS) {
      const plate = shapePlate(color, S.shape.size, S.shape.raise, S.sink);
      plate.computeBoundingBox();
      const size = plate.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeLessThan(parts.flockbot.width * 0.8);
      expect(size.z).toBeLessThan(parts.flockbot.depth * 0.85);
      expect(size.x).toBeGreaterThan(S.shape.triangle);
      expect(plate.boundingBox!.max.y).toBeCloseTo(S.shape.raise, 3);
    }
  });

  it('a_flockbot_shows_the_plain_triangle_until_the_shape_is_switched_on', () => {
    const bot = buildFlockbot('blue');
    const plain = drawn(bot.symbol).length;
    bot.showShape(true);
    const marked = drawn(bot.symbol);
    expect(marked.length).toBe(plain + 1);
    bot.showShape(false);
    expect(drawn(bot.symbol).length).toBe(plain);
  });

  it('every_robot_of_the_game_can_switch_its_shape_while_it_stands_on_the_board', () => {
    const count = (root: THREE.Object3D): number => drawn(root).length;
    for (const style of HEADING_STYLES) {
      for (const view of [buildPartsRobot(1, 'red', style), buildRobot(2, 'yellow', style)]) {
        const before = count(view.root);
        view.showShape(true);
        expect(count(view.root)).toBe(before + 1);
        view.showShape(false);
        expect(count(view.root)).toBe(before);
      }
    }
  });
});
