import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import garden from '../../data/themes/garden/exit.json';
import parts from '../../data/parts.json';
import { buildExit, EXIT_MOMENT_LOOKS, exitLookOf, setExitLook } from '../../src/render/parts/garden/exit';
import { exitLook, exitMoment, type ExitSituation } from '../../src/render/parts/garden/exitMoments';
import { buildGazebo } from '../../src/render/parts/garden/gazebo';
import { buildFloorTile, buildGate, buildPlate, buildStandInTile, buildTurnTile, gateDoorScale, useGardenFloorTile } from '../../src/render/parts/garden/specials';
import { triangleCount } from '../../src/render/parts/garden/common';

const sizeOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const FLASH = garden.exit.flashSeconds;
const situation = (over: Partial<ExitSituation>): ExitSituation => ({ waitingFor: 3, stillOut: 3, sinceEntry: Infinity, flashSeconds: FLASH, ...over });

describe('garden exit: which look at which moment', () => {
  it('exit_waits_green_while_its_chicks_are_out', () => {
    expect(exitMoment(situation({}))).toBe('waiting');
    expect(exitLook(situation({}), EXIT_MOMENT_LOOKS)).toBe('green');
  });

  it('exit_shows_rays_just_after_a_chick_went_in', () => {
    expect(exitMoment(situation({ sinceEntry: 0 }))).toBe('entered');
    expect(exitMoment(situation({ sinceEntry: FLASH * 0.99 }))).toBe('entered');
    expect(exitMoment(situation({ sinceEntry: FLASH }))).toBe('waiting');
    expect(exitLook(situation({ sinceEntry: 0 }), EXIT_MOMENT_LOOKS)).toBe('rays');
  });

  it('exit_keeps_rays_when_every_chick_is_in', () => {
    const done = situation({ waitingFor: 0, stillOut: 0, sinceEntry: 10 });
    expect(exitMoment(done)).toBe('complete');
    expect(exitLook(done, EXIT_MOMENT_LOOKS)).toBe('rays');
  });

  it('colour_exit_turns_grey_when_its_colour_is_all_in_but_others_are_out', () => {
    const spent = situation({ waitingFor: 0, stillOut: 2, sinceEntry: 5 });
    expect(exitMoment(spent)).toBe('spent');
    expect(exitLook(spent, EXIT_MOMENT_LOOKS)).toBe('grey');
  });

  it('a_fresh_entry_on_a_spent_exit_still_flashes_first', () => {
    expect(exitMoment(situation({ waitingFor: 0, stillOut: 2, sinceEntry: 0.1 }))).toBe('entered');
  });

  it('the_look_table_follows_the_data_file', () => {
    expect(EXIT_MOMENT_LOOKS).toEqual({ waiting: garden.moments.waiting, entered: garden.moments.entered, complete: garden.moments.complete, spent: garden.moments.spent });
    expect(exitLook(situation({}), { waiting: 'grey', entered: 'green', complete: 'rays', spent: 'grey' })).toBe('grey');
  });
});

describe('garden exit pad keeps the robot exit contract', () => {
  it('exit_fits_one_cell_and_stands_on_the_floor', () => {
    const pad = buildExit();
    const box = new THREE.Box3().setFromObject(pad);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(parts.floorTile.size);
    expect(size.z).toBeLessThanOrEqual(parts.floorTile.size);
    expect(size.x).toBeGreaterThan(0.9);
    expect(box.min.y).toBeCloseTo(0, 2);
    // A chick steps onto it as onto the robot pad: about a tile high, not a step up.
    expect(box.max.y).toBeLessThan(parts.floorTile.height + 0.06);
  });

  it('exit_carries_glow_check_and_rays', () => {
    const pad = buildExit();
    expect(pad.userData.glow).toBeInstanceOf(THREE.Mesh);
    expect(pad.userData.check).toBeInstanceOf(THREE.Mesh);
    expect(pad.userData.rays).toBeInstanceOf(THREE.Object3D);
    expect(pad.userData.shape).toBeUndefined();
  });

  it('colour_exit_carries_a_hidden_shape', () => {
    const pad = buildExit('blue');
    expect((pad.userData.shape as THREE.Object3D).visible).toBe(false);
  });

  it('looks_switch_glow_and_rays', () => {
    const pad = buildExit(undefined, 'grey');
    expect(exitLookOf(pad)).toBe('grey');
    expect((pad.userData.glow as THREE.Object3D).visible).toBe(false);
    expect((pad.userData.rays as THREE.Object3D).visible).toBe(false);
    setExitLook(pad, 'green');
    expect((pad.userData.glow as THREE.Object3D).visible).toBe(true);
    expect((pad.userData.rays as THREE.Object3D).visible).toBe(false);
    setExitLook(pad, 'rays');
    expect((pad.userData.rays as THREE.Object3D).visible).toBe(true);
    expect(exitLookOf(pad)).toBe('rays');
  });

  it('light_does_not_count_towards_the_measured_size', () => {
    const lit = sizeOf(buildExit(undefined, 'rays'));
    const grey = sizeOf(buildExit(undefined, 'grey'));
    expect(lit.x).toBeCloseTo(grey.x, 3);
    expect(lit.y).toBeCloseTo(grey.y, 3);
  });
});

describe('garden special tiles keep the robot contract', () => {
  it('turn_tile_has_a_disc_and_a_dark_glow', () => {
    const tile = buildTurnTile(false, false);
    expect((tile.userData.disc as THREE.Object3D).name).toBe('turn-disc');
    expect(((tile.userData.glow as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity).toBe(0);
    expect(sizeOf(tile).x).toBeCloseTo(1, 2);
  });

  it('plate_has_a_button_with_its_rest_height', () => {
    const plate = buildPlate(false, false);
    const button = plate.userData.button as THREE.Object3D;
    expect(button.userData.restY).toBeCloseTo(button.position.y, 6);
    expect(button.position.y).toBeGreaterThanOrEqual(garden.floorStandIn.height);
  });

  it('gate_has_a_door_that_flattens_when_open', () => {
    const gate = buildGate(false, false);
    const door = gate.userData.door as THREE.Object3D;
    expect(sizeOf(door).y).toBeGreaterThan(0.35);
    expect(sizeOf(door).x).toBeLessThan(parts.floorTile.size);
    expect(gateDoorScale(false)).toBe(1);
    expect(gateDoorScale(true)).toBeLessThan(0.1);
  });

  it('special_tiles_can_stand_on_another_grass_tile', () => {
    let built = 0;
    useGardenFloorTile((alt, pegs) => {
      built++;
      return buildStandInTile(alt, pegs);
    });
    buildPlate();
    buildGate();
    buildTurnTile();
    expect(buildFloorTile()).toBeInstanceOf(THREE.Group);
    expect(built).toBe(4);
    useGardenFloorTile(buildStandInTile);
  });
});

describe('garden parts stay within their triangle budgets', () => {
  it('each_part_is_under_its_budget', () => {
    const b = garden.budget;
    expect(triangleCount(buildExit(undefined, 'rays'))).toBeLessThanOrEqual(b.exit);
    expect(triangleCount(buildTurnTile(false, false))).toBeLessThanOrEqual(b.turnTile);
    expect(triangleCount(buildPlate(false, false))).toBeLessThanOrEqual(b.plate);
    expect(triangleCount(buildGate(false, false))).toBeLessThanOrEqual(b.gate);
    expect(triangleCount(buildGazebo(true))).toBeLessThanOrEqual(b.gazebo);
  });

  it('gazebo_is_a_free_standing_part_a_few_cells_wide', () => {
    const size = sizeOf(buildGazebo(true));
    expect(size.x).toBeGreaterThan(2.5);
    expect(size.x).toBeLessThan(3.5);
    expect(size.y).toBeGreaterThan(2.5);
  });
});
