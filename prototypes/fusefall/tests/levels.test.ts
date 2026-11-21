// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// Solvability of the five shipped levels: the recorded solution wins, an exhaustive search
// agrees, and each level asks what its place in the curve promises.
import { describe, expect, it } from 'vitest';
import {
  playSequence,
  sequenceSpace,
  sourceIds,
  totalBalls,
  validateLevel,
  winningSequences,
} from '../src/engine/engine';
import { LEVELS } from '../src/levels/levels';

const key = (seq: string[]) => seq.join('');
const tilts = (events: ReturnType<typeof playSequence>['events']) =>
  events.flat().filter((e) => e.type === 'tilt');

describe('all levels', () => {
  it('test_there_are_five_levels_in_order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
  });

  describe.each(LEVELS.map((l) => [l.id, l] as const))('level %i', (_id, level) => {
    it('test_level_is_well_formed', () => {
      expect(validateLevel(level)).toEqual([]);
    });

    it('test_recorded_solution_wins_within_the_pulse_budget', () => {
      expect(level.solution.length).toBeLessThanOrEqual(level.pulses);
      const { state } = playSequence(level, level.solution);
      expect(state.status).toBe('won');
      expect(state.bin).toBeGreaterThanOrEqual(level.goal);
    });

    it('test_exhaustive_search_finds_the_recorded_solution', () => {
      const wins = winningSequences(level).map(key);
      expect(wins.length).toBeGreaterThan(0);
      expect(wins).toContain(key(level.solution));
    });

    it('test_solution_is_no_longer_than_the_shortest_win', () => {
      const shortest = Math.min(...winningSequences(level).map((s) => s.length));
      expect(level.solution.length).toBe(shortest);
    });

    it('test_no_ball_is_created_or_destroyed', () => {
      const { state } = playSequence(level, level.solution);
      const resting = Object.values(state.balls).reduce((a, b) => a + b, 0);
      expect(state.bin + state.lost + resting).toBe(totalBalls(level));
    });
  });
});

describe('the curve', () => {
  const [l1, l2, l3, l4, l5] = LEVELS;

  it('test_level_1_is_one_source_one_pulse', () => {
    expect(sourceIds(l1)).toEqual(['A']);
    expect(l1.pulses).toBe(1);
  });

  it('test_level_2_is_a_real_choice_one_source_wins_one_loses', () => {
    expect(sourceIds(l2)).toHaveLength(2);
    expect(winningSequences(l2).map(key)).toEqual(['B']);
    expect(playSequence(l2, ['A']).state.status).toBe('lost');
  });

  it('test_level_3_one_pulse_tips_three_platforms_two_by_load', () => {
    const run = playSequence(l3, ['A']);
    expect(tilts(run.events).map((e) => e.type === 'tilt' && e.cause)).toEqual(['latch', 'load', 'load']);
    expect(run.state.bin).toBe(8);
    expect(winningSequences(l3).map(key)).toEqual(['A']);
  });

  it('test_level_4_needs_both_sources_in_one_order', () => {
    expect(winningSequences(l4).map(key)).toEqual(['AB']);
    // neither source can do it alone, even twice
    expect(playSequence(l4, ['A', 'A']).state.status).toBe('lost');
    expect(playSequence(l4, ['B', 'A']).state.status).toBe('lost');
    // the two pulses add up on one latch: 1 from A, then 2 from B
    const afterA = playSequence(l4, ['A']).state;
    expect(afterA.charge.L2).toBe(1);
    expect(afterA.closed.k).toBe(true);
    expect(playSequence(l4, ['A', 'B']).state.charge.L2).toBe(3);
  });

  it('test_level_5_order_matters_and_every_source_is_needed', () => {
    const wins = winningSequences(l5).map(key).sort();
    expect(wins).toEqual(['ABC', 'BAC', 'BCA']);
    expect(wins.length).toBeLessThan(sequenceSpace(l5) / 4);
    // the obvious move, heating the reservoir twice, cuts B's conductor and strands the balls
    const trap = playSequence(l5, ['A', 'A']);
    expect(trap.state.closed.x).toBe(false);
    expect(trap.state.balls.M).toBe(10);
    expect(trap.state.status).toBe('lost');
    expect(trap.state.lossReason).toBe('unreachable');
    // C is dead until the chute has closed its contact
    expect(playSequence(l5, ['C']).events[0].filter((e) => e.type === 'heat')).toEqual([]);
  });

  it('test_levels_2_to_5_cannot_be_won_by_any_order', () => {
    for (const level of [l2, l3, l4, l5]) {
      expect(winningSequences(level).length).toBeLessThan(sequenceSpace(level));
    }
  });
});
