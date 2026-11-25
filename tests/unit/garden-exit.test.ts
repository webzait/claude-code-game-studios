import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import garden from '../../data/themes/garden/exit.json';
import parts from '../../data/parts.json';
import { buildExit, EXIT_MOMENT_LOOKS, exitLookOf, setExitLook } from '../../src/render/parts/garden/exit';
import { exitLook, exitMoment, type ExitSituation } from '../../src/render/parts/garden/exitMoments';
import { buildGazebo } from '../../src/render/parts/garden/gazebo';
import { buildFloorTile, buildGate, buildPlate, buildStandInTile, buildTurnTile, gateDoorScale, useGardenFloorTile } from '../../src/render/parts/garden/specials';
import { triangleCount } from '../../src/render/parts/garden/common';
import * as pic from '../../src/render/parts/garden/exitPictures';
import config from '../../data/config.json';

const sizeOf = (o: THREE.Object3D): THREE.Vector3 => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const FLASH = garden.exit.flashSeconds;
const situation = (over: Partial<ExitSituation>): ExitSituation => ({ waitingFor: 3, stillOut: 3, sinceEntry: Infinity, flashSeconds: FLASH, ...over });

describe('garden exit: which look at which moment', () => {
  it('exit_waits_green_while_its_chicks_are_out', () => {
    expect(exitMoment(situation({}))).toBe('waiting');
    expect(exitLook(situation({}), EXIT_MOMENT_LOOKS)).toBe('green');
  });

  it('exit_shows_the_portal_just_after_a_chick_went_in', () => {
    expect(exitMoment(situation({ sinceEntry: 0 }))).toBe('entered');
    expect(exitMoment(situation({ sinceEntry: FLASH * 0.99 }))).toBe('entered');
    expect(exitMoment(situation({ sinceEntry: FLASH }))).toBe('waiting');
    expect(exitLook(situation({ sinceEntry: 0 }), EXIT_MOMENT_LOOKS)).toBe('portal');
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

describe('garden picture parts (the standard version) keep the robot contract', () => {
  const spriteOf = (o: THREE.Object3D): string => o.userData.sprite as string;

  it('picture exit shows the owner pad for each look', () => {
    const pad = pic.buildExit(undefined, 'grey');
    expect(spriteOf(pad.userData.check)).toBe('exit-grey');
    expect((pad.userData.glow as THREE.Object3D).visible).toBe(false);
    pic.setExitLook(pad, 'green');
    expect(spriteOf(pad.userData.check)).toBe('exit-green');
    pic.setExitLook(pad, 'rays');
    expect(spriteOf(pad.userData.check)).toBe('exit-rays');
    expect((pad.userData.glow as THREE.Object3D).visible).toBe(true);
    pic.setExitLook(pad, 'portal');
    expect(spriteOf(pad.userData.check)).toBe('exit-portal');
  });

  it('picture exit entry shows the portal and a rising column, then puts everything back', () => {
    const pad = pic.buildExit(undefined, 'green');
    const glow = (pad.userData.glow as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const before = glow.opacity;
    pic.exitEntry(pad, 0.3);
    const layers = pad.userData.entry as { portal: THREE.Group; beam: THREE.Group; beamQuad: THREE.Mesh; portalMat: THREE.MeshBasicMaterial; beamMat: THREE.MeshBasicMaterial };
    expect(spriteOf(layers.portal)).toBe('exit-portal');
    expect(spriteOf(layers.beam)).toBe('exit-portal-beam');
    expect(layers.portal.visible).toBe(true);
    expect(layers.portalMat.opacity).toBeGreaterThan(0.9);
    expect(layers.beam.visible).toBe(true);
    expect(layers.beamQuad.scale.y).toBeGreaterThan(0.5);
    expect(layers.beamMat.blending).toBe(THREE.AdditiveBlending);
    expect(glow.opacity).toBeGreaterThan(before);
    pic.exitEntry(pad, 1);
    expect(layers.portal.visible).toBe(false);
    expect(layers.beam.visible).toBe(false);
    expect(glow.opacity).toBeCloseTo(before, 6);
    expect((pad.userData.check as THREE.Object3D).scale.x).toBe(1);
    expect(spriteOf(pad.userData.check)).toBe('exit-green');
  });

  it('picture exit entry fades only the pad it plays on', () => {
    const a = pic.buildExit();
    const b = pic.buildExit();
    pic.exitEntry(a, 0.3);
    pic.exitEntry(b, 0);
    const portalOf = (p: THREE.Group) => (p.userData.entry as { portalMat: THREE.MeshBasicMaterial }).portalMat;
    expect(portalOf(a)).not.toBe(portalOf(b));
    expect(portalOf(b).opacity).toBe(0);
  });

  it('picture colour exit entry pops without a green portal', () => {
    const pad = pic.buildExit('blue');
    pic.exitEntry(pad, 0.15);
    expect((pad.userData.entry as { portal: unknown }).portal).toBeNull();
    expect((pad.userData.check as THREE.Object3D).scale.x).toBeGreaterThan(1);
    pic.exitEntry(pad, 1);
    expect((pad.userData.check as THREE.Object3D).scale.x).toBe(1);
  });

  it('picture exit glow follows the square tile, not a circle', () => {
    const g = garden.exit.entry.glowSquare;
    const n = 64;
    const square = pic.squareGlowTexture('#ffffff', g.inner, g.corner, g.falloff, n).image.data as Uint8Array;
    const alpha = (i: number, j: number) => square[(j * n + i) * 4 + 3];
    // Same distance from the centre: towards a corner as bright as towards a side (a circle would fade the corner).
    const side = alpha(Math.round(n / 2 + 0.29 * n), n / 2);
    const diagonal = alpha(Math.round(n / 2 + 0.29 * n), Math.round(n / 2 + 0.29 * n));
    expect(side).toBe(255);
    expect(diagonal).toBeGreaterThan(200);
  });

  it('picture colour exit keeps its own colour in the portal moment', () => {
    const pad = pic.buildExit('red', 'portal');
    expect(spriteOf(pad.userData.check)).toBe('exit-red');
  });

  it('picture colour exit carries its retoned pad and a hidden shape version', () => {
    const pad = pic.buildExit('yellow');
    expect(spriteOf(pad.userData.check)).toBe('exit-yellow');
    expect(spriteOf(pad.userData.shape)).toBe('exit-shape-yellow');
    expect((pad.userData.shape as THREE.Object3D).visible).toBe(false);
  });

  it('picture quads face the game camera', () => {
    const pad = pic.buildExit();
    const holder = pad.userData.check as THREE.Object3D;
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(holder.rotation);
    const tilt = THREE.MathUtils.degToRad(config.board.roomy.tilt);
    expect(normal.y).toBeCloseTo(Math.cos(tilt), 5);
    expect(normal.z).toBeCloseTo(Math.sin(tilt), 5);
  });

  it('picture quads stay above the floor', () => {
    for (const part of [pic.buildExit(undefined, 'rays'), pic.buildExit(undefined, 'portal'), pic.buildTurnTile(false, false), pic.buildPlate(false, false)]) {
      part.updateMatrixWorld(true);
      let lowest = Infinity;
      part.traverse((n) => {
        if (n instanceof THREE.Mesh && n.userData.sprite === undefined && n.parent?.userData.sprite) {
          const box = new THREE.Box3().setFromObject(n);
          lowest = Math.min(lowest, box.min.y);
        }
      });
      expect(lowest).toBeLessThan(1);
      expect(lowest).toBeGreaterThanOrEqual(0);
    }
  });

  it('picture pads line their stone tile up with the cell', () => {
    // The stone tile's front foot, corner to corner, lies on the cell's front edge, a cell wide.
    const sprites = Object.assign({}, ...Object.values(import.meta.glob<{ sprites: Record<string, { width: number; height: number; anchor: number[]; tile?: number[] }> }>('../../data/themes/garden/exit-sprites/*.json', { eager: true, import: 'default' })).map((f) => f.sprites));
    for (const [part, name] of [[pic.buildExit(undefined, 'green'), 'exit-green'], [pic.buildExit(undefined, 'grey'), 'exit-grey'], [pic.buildExit(undefined, 'rays'), 'exit-rays'], [pic.buildExit('red'), 'exit-red'], [pic.buildTurnTile(false, false), 'turn']] as [THREE.Group, string][]) {
      part.updateMatrixWorld(true);
      const quad = part.getObjectByName(name) as THREE.Mesh;
      const geo = quad.geometry as THREE.PlaneGeometry;
      const s = sprites[name];
      const [x0, , x1, y1] = s.tile;
      const at = (fx: number, fy: number) => new THREE.Vector3((fx - 0.5) * geo.parameters.width, (0.5 - fy) * geo.parameters.height, 0).applyMatrix4(quad.matrixWorld);
      const left = at(x0, y1);
      const right = at(x1, y1);
      expect(right.x - left.x).toBeCloseTo(garden.floorStandIn.size, 4);
      expect((left.x + right.x) / 2).toBeCloseTo(0, 2);
      // On the front edge, seen from the camera: the foot is only slid towards the camera by a hair.
      expect(left.y).toBeGreaterThanOrEqual(0);
      expect(left.y).toBeLessThan(0.01);
      expect(left.z).toBeCloseTo(garden.floorStandIn.size / 2, 2);
    }
  });

  it('picture special tiles move the same children as the robot tiles', () => {
    const turn = pic.buildTurnTile(false, false);
    expect((turn.userData.disc as THREE.Object3D).name).toBe('turn-disc');
    expect(((turn.userData.glow as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity).toBe(0);
    const plate = pic.buildPlate(false, false);
    expect((plate.userData.button as THREE.Object3D).userData.restY).toBeCloseTo((plate.userData.button as THREE.Object3D).position.y, 6);
    const gate = pic.buildGate(false, false);
    expect(spriteOf(gate.userData.door)).toBe('gate');
    expect(pic.gateDoorScale(false)).toBe(1);
    expect(pic.gateDoorScale(true)).toBeLessThan(0.2);
  });

  it('picture parts are cheap', () => {
    expect(triangleCount(pic.buildExit(undefined, 'rays'))).toBeLessThan(400);
    expect(triangleCount(pic.buildGazebo(true))).toBe(2);
  });
});
