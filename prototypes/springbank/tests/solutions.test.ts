// PROTOTYPE - NOT FOR PRODUCTION
// Every level keeps a recorded clear: a catch position, a timing and a launch. This replays each
// one through the simulation; a level whose recorded clear stops winning fails here.
import { describe, expect, it } from 'vitest';
import { replay } from '../src/sim/sim.ts';
import { LEVELS } from '../src/sim/levels.ts';

describe('each level is provably winnable', () => {
  LEVELS.forEach((lv, i) => {
    it(`level ${i + 1} "${lv.name}": the recorded clear wins within its launches`, () => {
      const sim = replay(lv, lv.solution);
      expect(sim.status).toBe('won');
      expect(sim.scored).toBeGreaterThanOrEqual(lv.target);
      expect(sim.launchesUsed).toBeLessThanOrEqual(lv.launches);
    });
    it(`level ${i + 1} "${lv.name}": doing nothing does not win`, () => {
      expect(replay(lv, [], 120 * 20).status).toBe('playing');
    });
  });
  it('level 5 puts at least 40 balls in the air in one launch', () => {
    let most = 0;
    replay(LEVELS[4], LEVELS[4].solution, 120 * 60, (s) => { most = Math.max(most, s.inFlight()); });
    expect(most).toBeGreaterThanOrEqual(40);
  });
});
