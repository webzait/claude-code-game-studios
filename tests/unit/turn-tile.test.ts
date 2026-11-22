import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import parts from '../../data/parts.json';
import config from '../../data/config.json';
import { step } from '../../src/engine/engine';
import type { Command } from '../../src/engine/types';
import { LEVELS } from '../../src/levels/index';
import { headingAngle, QUARTER, travelAxis } from '../../src/render/heading';
import { buildFloorTile, buildTurnTile } from '../../src/render/parts/board';
import { quarterTurns, tileBeats } from '../../src/render/stepPlan';
import { board } from './helpers';

const T = parts.turnTile;
const sizeOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const triangles = (o: THREE.Object3D): number => {
  let n = 0;
  o.traverse((m) => {
    if (m instanceof THREE.Mesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
  });
  return n;
};
/** Triangles a turn tile may add to a floor tile; a board has three at most. */
const EXTRA_TRIANGLE_BUDGET = 700;
/**
 * Robot colours the tile must stay away from, and how far (distance in RGB, 0 to 1.73). The
 * collar is the board frame's own periwinkle, which sits nearest to blue; the bound is set so
 * that the frame's tones pass and a robot's own tone or a shade of it would not.
 */
const ROBOT_TONES = [config.colors.red, config.colors.blue, config.colors.yellow, ...(['red', 'blue', 'yellow'] as const).map((c) => config.colors.robots[c].main)];
const MIN_TONE_DISTANCE = 0.2;

describe('turn tile part', () => {
  it('fills one cell and is a floor tile with a low disc on top', () => {
    const size = sizeOf(buildTurnTile(false, false));
    expect(size.x).toBeCloseTo(parts.floorTile.size, 2);
    expect(size.z).toBeCloseTo(parts.floorTile.size, 2);
    expect(size.y).toBeCloseTo(parts.floorTile.height + T.discHeight + T.lift, 3);
    // Low enough that a robot standing on it does not visibly sink in or float.
    expect(T.discHeight).toBeLessThanOrEqual(0.03);
  });

  it('has a collar that reaches almost to the edge, so it shows around a robot standing on it', () => {
    expect(T.ringOuter * 2).toBeGreaterThan(config.board.grid.robotFill);
    expect(T.ringOuter).toBeLessThan(parts.floorTile.size / 2);
    expect(T.disc).toBeLessThan(T.ringOuter);
  });

  it('hands the game a disc to turn and a light that starts dark', () => {
    const tile = buildTurnTile(false, false);
    const disc = tile.userData.disc as THREE.Object3D;
    const glow = tile.userData.glow as THREE.Mesh;
    expect(disc.name).toBe('turn-disc');
    expect(tile.getObjectByName('turn-disc')).toBe(disc);
    expect(disc.position.x).toBe(0);
    expect(disc.position.z).toBe(0);
    expect((glow.material as THREE.MeshBasicMaterial).opacity).toBe(0);
    // Each tile flashes on its own: the light's material is not shared.
    expect((buildTurnTile().userData.glow as THREE.Mesh).material).not.toBe(glow.material);
  });

  it('draws its arrows clockwise: each head lies clockwise of its tail, seen from above', () => {
    const disc = buildTurnTile(false, false).userData.disc as THREE.Object3D;
    const arrows = disc.children.slice(1) as THREE.Mesh[];
    expect(arrows.length).toBe(T.arrow.count);
    arrows.forEach((arrow, k) => {
      const start = T.arrow.start + (k * 360) / T.arrow.count;
      const position = arrow.geometry.getAttribute('position');
      const along: number[] = [];
      const head: number[] = [];
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        // Compass degrees (0 = north, 90 = east) measured clockwise from the arrow's tail.
        const degrees = ((((Math.atan2(x, -z) * 180) / Math.PI - start + 20) % 360) + 360) % 360 - 20;
        along.push(degrees);
        if (Math.abs(Math.hypot(x, z) - T.arrow.radius) > T.arrow.width / 2 + 0.01) head.push(degrees);
      }
      expect(head.length).toBeGreaterThan(0);
      // The wide part (the head) sits at the far, clockwise end of the stroke.
      expect(Math.min(...head)).toBeGreaterThan(T.arrow.span - T.arrow.head - 1);
      expect(Math.max(...along)).toBeCloseTo(T.arrow.span, 0);
      expect(Math.min(...along)).toBeGreaterThan(-20);
    });
  });

  it('wears no robot colour and not the exit green', () => {
    const kit = config.colors.kit;
    const far = (a: string, b: string): number => {
      const ca = new THREE.Color(a);
      const cb = new THREE.Color(b);
      return Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b);
    };
    for (const tone of [kit.turnDisc, kit.turnRing, kit.turnRingEdge, kit.turnInk]) {
      for (const taken of [...ROBOT_TONES, kit.exit, kit.exitTop]) expect(far(tone, taken), `${tone} vs ${taken}`).toBeGreaterThan(MIN_TONE_DISTANCE);
    }
  });

  it('stays cheap to draw', () => {
    expect(triangles(buildTurnTile(false, false)) - triangles(buildFloorTile(false, false))).toBeLessThanOrEqual(EXTRA_TRIANGLE_BUDGET);
  });
});

describe('turn tile in the view\'s bookkeeping', () => {
  it('gives one beat for a robot that arrives on a tile, at that tile', () => {
    const level = board(['r> @@ ..', '.. EX ..']);
    const result = step(level.board, level.start, 'forward');
    expect(tileBeats(result.events)).toEqual([{ id: 0, x: 1, y: 0 }]);
    expect(quarterTurns(result.events[0])).toBe(1);
  });

  it('adds the tile\'s quarter to the command\'s own: a colour turn onto a tile is a half turn', () => {
    const level = board(['r^ @@ ..', '.. .. EX']);
    const result = step(level.board, level.start, 'red');
    expect(quarterTurns(result.events[0])).toBe(2);
    expect(result.state.robots[0].dir).toBe(2);
  });

  it('gives no beat for a robot that stays on a tile, is blocked before one, or leaves by the exit', () => {
    // Arrives on the tile facing east, turns south, and is then blocked by the wall below: no second turn.
    const stay = board(['r> @@ ..', '.. ## EX']);
    const arrived = step(stay.board, stay.start, 'forward');
    expect(tileBeats(step(stay.board, arrived.state, 'forward').events)).toEqual([]);
    // Blue stands in front of the tile's cell and cannot leave; red bumps into it.
    const blocked = board(['r> bv @@', '.. ## EX']);
    expect(tileBeats(step(blocked.board, blocked.start, 'forward').events)).toEqual([]);
    const exit = board(['r> EX @@']);
    expect(tileBeats(step(exit.board, exit.start, 'forward').events)).toEqual([]);
  });

  it('gives two beats when two robots arrive on two tiles in one step', () => {
    const level = board(['r> @@ ..', 'b> @@ EX']);
    expect(tileBeats(step(level.board, level.start, 'forward').events)).toEqual([{ id: 0, x: 1, y: 0 }, { id: 1, x: 1, y: 1 }]);
  });

  const withTiles = LEVELS.map((level, index) => ({ level, number: index + 1 })).filter(({ level }) => level.board.turnTiles);
  it('is exercised by the shipped levels', () => {
    expect(withTiles.length).toBeGreaterThanOrEqual(16);
  });

  for (const { level, number } of withTiles) {
    it(`level ${number} (${level.name}): turning by the plan keeps every robot's shown heading equal to the engine's, along the whole witness`, () => {
      const shown = new Map(level.start.robots.map((r) => [r.id, headingAngle(r.dir)]));
      let state = level.start;
      for (const command of level.witness as Command[]) {
        const result = step(level.board, state, command);
        const beats = tileBeats(result.events);
        // Every tileTurned event has its beat, on a cell that really is a turn tile.
        expect(beats.length).toBe(result.events.filter((e) => e.tileTurned).length);
        for (const beat of beats) expect(level.board.turnTiles?.[beat.y * level.board.width + beat.x]).toBe(true);
        for (const event of result.events) shown.set(event.id, shown.get(event.id)! - QUARTER * quarterTurns(event));
        for (const robot of result.state.robots) {
          if (!robot.collected) expect(travelAxis(shown.get(robot.id)!), `robot ${robot.id} after ${command}`).toEqual(travelAxis(headingAngle(robot.dir)));
        }
        state = result.state;
      }
    });
  }
});
