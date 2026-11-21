import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../../src/config';
import config from '../../data/config.json';
import type { Dir } from '../../src/engine/types';
import { DIR_DX, DIR_DY } from '../../src/engine/types';
import { DEFAULT_LAB } from '../../src/game/lab';
import { defaultSave, migrate, SAVE_VERSION } from '../../src/game/save';
import { bodyYaw, headingAngle, HEADING_STYLES, nearestAngle, QUARTER, squashScale, travelAxis, turnAngle } from '../../src/render/heading';
import { buildPartsRobot, buildRobot } from '../../src/render/robot';

const DIRS: readonly Dir[] = [0, 1, 2, 3];
const VIEW_TILT = (config.board.roomy.tilt * Math.PI) / 180;
/** Where the camera sees a board-space point: across the screen and down it. */
const onScreen = (p: THREE.Vector3): { u: number; v: number } => ({ u: p.x, v: p.z * Math.cos(VIEW_TILT) - p.y * Math.sin(VIEW_TILT) });

describe('heading shown by a robot', () => {
  it('the_angle_for_each_heading_is_the_heading_times_a_quarter_turn_clockwise', () => {
    for (const dir of DIRS) expect(headingAngle(dir)).toBeCloseTo(-dir * (Math.PI / 2), 12);
  });

  it('the_shown_angle_points_along_the_step_the_engine_takes', () => {
    for (const dir of DIRS) expect(travelAxis(headingAngle(dir))).toEqual({ x: DIR_DX[dir], z: DIR_DY[dir] });
  });

  it('a_turn_is_one_quarter_clockwise_and_ends_on_the_next_heading', () => {
    for (const dir of DIRS) {
      const next = ((dir + 1) % 4) as Dir;
      const end = turnAngle(headingAngle(dir), 1);
      expect(end).toBeCloseTo(headingAngle(dir) - QUARTER, 12);
      expect(travelAxis(end)).toEqual(travelAxis(headingAngle(next)));
      expect(turnAngle(headingAngle(dir), 0)).toBe(headingAngle(dir));
    }
  });

  it('four_turns_keep_winding_clockwise_and_an_undo_goes_back_the_short_way', () => {
    let angle = headingAngle(3);
    // West to north: the cumulative angle goes on past a full turn instead of jumping back.
    angle = turnAngle(angle, 1);
    expect(angle).toBeCloseTo(-4 * QUARTER, 12);
    expect(nearestAngle(angle, headingAngle(0))).toBeCloseTo(-4 * QUARTER, 12);
    // Undoing that turn shows west again a quarter back, not three quarters on.
    expect(nearestAngle(angle, headingAngle(3)) - angle).toBeCloseTo(QUARTER, 12);
  });

  it('the_part_shows_its_front_to_the_player_when_heading_south_and_its_back_when_north', () => {
    const front = (dir: Dir): THREE.Vector3 => new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bodyYaw(headingAngle(dir)));
    for (const dir of DIRS) {
      expect(front(dir).x).toBeCloseTo(DIR_DX[dir], 9);
      expect(front(dir).z).toBeCloseTo(DIR_DY[dir], 9);
    }
  });

  it('a_blocked_robot_squashes_along_its_own_way_of_travel', () => {
    const amount = 0.14;
    for (const dir of DIRS) {
      const s = squashScale(headingAngle(dir), amount);
      const [along, across] = DIR_DX[dir] !== 0 ? [s.x, s.z] : [s.z, s.x];
      expect(along).toBeCloseTo(1 - amount, 9);
      expect(across).toBeGreaterThan(1);
      expect(s.y).toBeGreaterThan(1);
    }
    expect(squashScale(headingAngle(1), 0)).toEqual({ x: 1, y: 1, z: 1 });
  });
});

describe('robots turn as a whole', () => {
  const boxOf = (o: THREE.Object3D): THREE.Box3 => {
    o.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(o);
  };

  it('every_heading_of_the_face_up_robot_is_the_same_picture_a_quarter_turn_on', () => {
    // Its box on screen is as wide facing east as it is tall facing south, and it stays on its cell.
    const sizes = DIRS.map((dir) => {
      const view = buildPartsRobot(1, 'red', 'faceUp', VIEW_TILT);
      view.aim(headingAngle(dir));
      view.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      const p = new THREE.Vector3();
      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      view.root.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        const position = node.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          p.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
          box.expandByPoint(p);
          const s = onScreen(p);
          minU = Math.min(minU, s.u);
          maxU = Math.max(maxU, s.u);
          minV = Math.min(minV, s.v);
          maxV = Math.max(maxV, s.v);
        }
      });
      return { dir, w: maxU - minU, h: maxV - minV, cu: (minU + maxU) / 2, cv: (minV + maxV) / 2, low: box.min.y };
    });
    const south = sizes[2];
    for (const s of sizes) {
      const [along, across] = s.dir % 2 === 0 ? [s.h, s.w] : [s.w, s.h];
      // Only a robot that turns around the line of sight (followCamera 1) is the same picture in every
      // heading; turning around the board's upright, as under the 30 degree camera, it is not meant to be.
      if (CONFIG.robot.faceUp.followCamera === 1) {
        expect(along).toBeCloseTo(south.h, 2);
        expect(across).toBeCloseTo(south.w, 2);
      }
      // Inside its own cell on screen, and centred on it.
      expect(s.w).toBeLessThanOrEqual(1);
      expect(s.h).toBeLessThanOrEqual(1);
      expect(Math.abs(s.cu)).toBeLessThan(0.06);
      expect(Math.abs(s.cv)).toBeLessThan(0.06);
      // Resting on the tile: not sunk into it, not floating over it.
      expect(s.low).toBeGreaterThan(-0.02);
      expect(s.low).toBeLessThan(0.1);
    }
  });

  it('the_whole_body_turns_in_both_body_styles_and_stays_put_in_the_symbol_style', () => {
    for (const build of [buildPartsRobot, buildRobot]) {
      for (const style of HEADING_STYLES) {
        const view = build(1, 'blue', style, VIEW_TILT);
        view.aim(headingAngle(2));
        const south = boxOf(view.root).getSize(new THREE.Vector3());
        view.aim(headingAngle(1));
        const east = boxOf(view.root).getSize(new THREE.Vector3());
        // No robot is the same from the front as from the side: a body that turned has a different outline.
        const change = Math.max(Math.abs(east.x - south.x), Math.abs(east.y - south.y), Math.abs(east.z - south.z));
        if (style === 'symbol') expect(change).toBeLessThan(0.01);
        else expect(change).toBeGreaterThan(0.02);
      }
    }
  });
});

describe('heading style in the test lab', () => {
  it('the_default_is_the_whole_robot_turning_towards_the_player_and_an_older_save_gets_it', () => {
    expect(DEFAULT_LAB.heading).toBe('towardPlayer');
    const old = migrate({ version: SAVE_VERSION, best: {}, lab: { robots: 'builtin' } }, []);
    expect(old.lab.heading).toBe('towardPlayer');
    expect(old.lab.robots).toBe('builtin');
  });

  it('a_saved_style_is_kept_and_an_unknown_one_falls_back', () => {
    for (const style of HEADING_STYLES) expect(migrate({ version: SAVE_VERSION, lab: { heading: style } }, []).lab.heading).toBe(style);
    expect(migrate({ version: SAVE_VERSION, lab: { heading: 'sideways' } }, []).lab.heading).toBe(defaultSave().lab.heading);
    expect(migrate({ version: SAVE_VERSION, lab: { heading: 7 } }, []).lab.heading).toBe(defaultSave().lab.heading);
  });
});
