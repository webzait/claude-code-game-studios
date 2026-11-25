import { describe, expect, it } from 'vitest';
import garden from '../../data/themes/garden/levels.json';
import { pathScene, pathSteps } from '../../src/ui/levelPath';

// The garden theme's level path (design/themes/garden-levels.md): gardens of 20 levels, each ending at a gazebo,
// and the last completed levels drawn as green steps below the current one.

const TOTAL = 100;
const SIZE = garden.chapter;
const AHEAD = 5;

describe('level path with chapters (garden theme)', () => {
  it('without chapters it is exactly the robot path, finish included', () => {
    for (const total of [1, 7, 40, TOTAL]) {
      for (let current = 0; current < total; current++) {
        for (const ahead of [0, 1, 5]) {
          const scene = pathScene(total, current, ahead);
          const old = pathSteps(total, current, ahead);
          expect(scene.ahead).toEqual(old.ahead);
          expect(scene.behind).toEqual([]);
          expect(scene.finish).toBe(old.ahead.length < ahead ? 'end' : null);
        }
      }
    }
  });
  it('a garden is 20 levels, the size of one page of the level grid', () => {
    expect(SIZE).toBe(20);
  });
  it('stops at the end of the current garden and shows its gazebo once that end is in sight', () => {
    expect(pathScene(TOTAL, 0, AHEAD, SIZE)).toMatchObject({ ahead: [1, 2, 3, 4, 5], finish: null, chapter: 1 });
    expect(pathScene(TOTAL, 13, AHEAD, SIZE)).toMatchObject({ ahead: [14, 15, 16, 17, 18], finish: null });
    // Level 15 is current: levels 16-20 fill the path exactly, and the gazebo closes it.
    expect(pathScene(TOTAL, 14, AHEAD, SIZE)).toMatchObject({ ahead: [15, 16, 17, 18, 19], finish: 'chapter', chapter: 1 });
    expect(pathScene(TOTAL, 17, AHEAD, SIZE)).toMatchObject({ ahead: [18, 19], finish: 'chapter' });
    expect(pathScene(TOTAL, 19, AHEAD, SIZE)).toMatchObject({ ahead: [], finish: 'chapter' });
  });
  it('starts a fresh path in the next garden', () => {
    expect(pathScene(TOTAL, 20, AHEAD, SIZE)).toMatchObject({ ahead: [21, 22, 23, 24, 25], finish: null, chapter: 2 });
  });
  it('the last garden ends at the end of the game', () => {
    expect(pathScene(TOTAL, 96, AHEAD, SIZE)).toMatchObject({ ahead: [97, 98, 99], finish: 'end', chapter: 5 });
    // A last garden shorter than 20 still ends at the last level.
    expect(pathScene(45, 41, AHEAD, SIZE)).toMatchObject({ ahead: [42, 43, 44], finish: 'end', chapter: 3 });
  });
  it('draws up to `behind` completed levels below the current one, only from the same garden', () => {
    expect(pathScene(TOTAL, 0, AHEAD, SIZE, 2).behind).toEqual([]);
    expect(pathScene(TOTAL, 1, AHEAD, SIZE, 2).behind).toEqual([0]);
    expect(pathScene(TOTAL, 9, AHEAD, SIZE, 2).behind).toEqual([7, 8]);
    expect(pathScene(TOTAL, 20, AHEAD, SIZE, 2).behind).toEqual([]);
    expect(pathScene(TOTAL, 21, AHEAD, SIZE, 2).behind).toEqual([20]);
  });
  it('has nothing to draw once every level is completed', () => {
    expect(pathScene(TOTAL, null, AHEAD, SIZE, 2)).toEqual({ current: null, ahead: [], behind: [], finish: null, chapter: 0 });
  });
});

describe('garden level screen config', () => {
  it('turns every colour into a custom property the stylesheet reads', async () => {
    const { gardenLevelsVars, GARDEN_LEVELS, gardenPathModel } = await import('../../src/ui/themes/garden/levels');
    const vars = gardenLevelsVars(GARDEN_LEVELS);
    for (const [name, value] of Object.entries(vars)) {
      expect(name).toMatch(/^--tg-/);
      expect(value).not.toBe('');
    }
    expect(vars['--tg-cur-face']).toBe(garden.current.face);
    expect(gardenPathModel()).toEqual({ chapter: 20, behind: 2 });
  });
});
